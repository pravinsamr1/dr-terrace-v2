/**
 * Global Server Connection & Error Event Bus & Retry Manager
 * 
 * Centralized detection, modal notification, and transparent request retry
 * for server connection failures, ngrok offline tunnels, and gateway outages
 * across the entire application.
 */

let apiClientInstance = null;
let serverErrorHandler = null;
let pendingQueue = [];
let isModalOpen = false;
let isRetrying = false;

/**
 * Check whether an error is due to server disconnection, ngrok offline tunnel,
 * network failure, or gateway outage (502 / 503 / 504 / Cloudflare 520-524).
 */
export function isServerError(error) {
  if (!error) return false;

  const status = error.response?.status || error.status;
  const code = String(error.code || '');
  const message = String(error.message || '');

  const rawData = error.response?.data ?? error.data ?? '';
  let dataStr = '';
  if (typeof rawData === 'string') {
    dataStr = rawData;
  } else if (typeof rawData === 'object' && rawData !== null) {
    try {
      dataStr = JSON.stringify(rawData);
    } catch (_e) {
      dataStr = String(rawData);
    }
  } else {
    dataStr = String(rawData || '');
  }

  // 1. ngrok tunnel / endpoint offline errors (typically 404 with ERR_NGROK_3200 or message)
  if (
    /ERR_NGROK_/i.test(dataStr) ||
    /ERR_NGROK_/i.test(message) ||
    /(?:endpoint|tunnel)\s+.+\s+is\s+(?:offline|not\s+online)/i.test(dataStr) ||
    /(?:endpoint|tunnel)\s+.+\s+is\s+(?:offline|not\s+online)/i.test(message) ||
    (/ngrok/i.test(dataStr) && /(?:offline|tunnel|gateway|unreachable|not found|error)/i.test(dataStr)) ||
    /tunnel\s+.+\s+not\s+found/i.test(dataStr)
  ) {
    return true;
  }

  // 2. Direct server gateway outage status codes (502, 503, 504, Cloudflare 520-524)
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (status >= 520 && status <= 524)
  ) {
    return true;
  }

  // 3. Network connection failures (server unreachable, connection refused, DNS error, timeout)
  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    /Network Error/i.test(message) ||
    /Network request failed/i.test(message) ||
    /Failed to fetch/i.test(message)
  ) {
    return true;
  }

  // 4. Axios bad response code with 5xx status or nginx HTML content
  if (code === 'ERR_BAD_RESPONSE') {
    if (status >= 500) return true;
    if (/502|503|504|Bad Gateway|nginx/i.test(message)) return true;
    if (/502|503|504|Bad Gateway|nginx/i.test(dataStr)) return true;
  }

  // 5. HTML error pages returned by web servers / proxies (nginx, caddy, apache)
  if (
    /502 Bad Gateway|503 Service Temporarily Unavailable|504 Gateway Time-out|Bad Gateway/i.test(
      dataStr
    )
  ) {
    return true;
  }

  // 6. Message matches status code
  if (/status code (?:502|503|504|520|521|522|523|524)/i.test(message)) {
    return true;
  }

  return false;
}

/**
 * Register the Axios apiClient instance to execute retries
 */
export function setApiClientForRetry(client) {
  apiClientInstance = client;
}

/**
 * Register the UI handler callback (connected in app/_layout.jsx)
 */
export function setServerErrorHandler(handler) {
  serverErrorHandler = handler;
  if (handler && isModalOpen) {
    // Re-notify UI if modal was triggered before handler was registered
    handler({
      visible: true,
      title: 'Server is not connected',
      message: 'Unable to connect to the server. Please tap Try Again to reconnect.',
      isRetrying,
    });
  }
}

/**
 * Internal helper to notify the UI handler of state updates
 */
function notifyUi(state) {
  if (typeof serverErrorHandler === 'function') {
    serverErrorHandler(state);
  }
}

/**
 * Notify the UI of a server connection error and queue the request for retry
 * Returns a Promise that resolves when the user retries successfully, or rejects on dismissal.
 */
export function notifyServerError(error) {
  return new Promise((resolve, reject) => {
    pendingQueue.push({
      config: error.config,
      resolve,
      reject,
      error,
    });

    if (!isModalOpen) {
      isModalOpen = true;
      isRetrying = false;
      notifyUi({
        visible: true,
        title: 'Server is not connected',
        message: 'Unable to connect to the server. Please tap Try Again to reconnect.',
        isRetrying: false,
      });
    }
  });
}

/**
 * Retry all pending failed requests when user taps "Try Again"
 */
export async function retryPendingServerRequests() {
  if (isRetrying) return;
  if (pendingQueue.length === 0) {
    isModalOpen = false;
    notifyUi({
      visible: false,
      isRetrying: false,
    });
    return;
  }

  if (!apiClientInstance) {
    console.warn('[serverErrorEvents] apiClientInstance is not registered for retry');
    return;
  }

  isRetrying = true;
  notifyUi({
    visible: true,
    title: 'Server is not connected',
    message: 'Connecting to server, please wait...',
    isRetrying: true,
  });

  const batch = [...pendingQueue];
  pendingQueue = [];

  let anyFailed = false;

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    try {
      if (item.config) {
        // Prevent interceptor recursion during retry
        const retryConfig = {
          ...item.config,
          _skipServerErrorPopup: true,
        };
        const response = await apiClientInstance.request(retryConfig);
        item.resolve(response);
      } else {
        item.reject(item.error);
      }
    } catch (err) {
      if (isServerError(err)) {
        anyFailed = true;
        // Keep in queue for subsequent retry attempts
        pendingQueue.push(item);
        // If the server is still offline, remaining requests will also fail.
        // Re-queue the rest of the batch immediately without making redundant failed calls.
        for (let j = i + 1; j < batch.length; j++) {
          pendingQueue.push(batch[j]);
        }
        break;
      } else {
        // Non-server error (e.g. 400 validation error), reject this individual item
        item.reject(err);
      }
    }
  }

  isRetrying = false;

  if (anyFailed && pendingQueue.length > 0) {
    // Keep modal visible and allow the user to tap Try Again again
    notifyUi({
      visible: true,
      title: 'Server is not connected',
      message: 'Still unable to connect to the server. Please tap Try Again once the connection is restored.',
      isRetrying: false,
    });
  } else {
    // All retried successfully! Close the modal
    isModalOpen = false;
    notifyUi({
      visible: false,
      isRetrying: false,
    });
  }
}

/**
 * Dismiss the modal and reject all pending requests
 */
export function dismissPendingServerRequests() {
  const batch = [...pendingQueue];
  pendingQueue = [];
  isModalOpen = false;
  isRetrying = false;

  notifyUi({
    visible: false,
    isRetrying: false,
  });

  batch.forEach((item) => {
    item.reject(item.error);
  });
}
