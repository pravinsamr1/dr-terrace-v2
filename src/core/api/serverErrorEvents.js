/**
 * Global Server Error (502 Bad Gateway / 503 / 504) Event Bus & Retry Manager
 * 
 * Provides centralized detection, modal notification, and transparent
 * request retry for server gateway failures across the entire application.
 */

let apiClientInstance = null;
let serverErrorHandler = null;
let pendingQueue = [];
let isModalOpen = false;
let isRetrying = false;

/**
 * Check whether an error is a 502 Bad Gateway or server gateway outage
 */
export function isServerError(error) {
  if (!error) return false;

  const status = error.response?.status || error.status;
  const code = error.code;
  const message = String(error.message || '');
  const data = typeof error.response?.data === 'string'
    ? error.response.data
    : (typeof error.data === 'string' ? error.data : '');

  // Direct 502, 503, 504 status codes
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  // Axios bad response code with 5xx status or nginx HTML content
  if (code === 'ERR_BAD_RESPONSE') {
    if (status >= 500) return true;
    if (/502|503|504|Bad Gateway|nginx/i.test(message)) return true;
    if (/502|503|504|Bad Gateway|nginx/i.test(data)) return true;
  }

  // HTML page returned by nginx (e.g. <html>...502 Bad Gateway...</html>)
  if (/502 Bad Gateway|503 Service Temporarily Unavailable|504 Gateway Time-out|Bad Gateway/i.test(data)) {
    return true;
  }

  // Message matches
  if (/status code 502|status code 503|status code 504/i.test(message)) {
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
 * Notify the UI of a 502 / server error and queue the request for retry
 * Returns a Promise that resolves if the user retries successfully, or rejects on dismissal.
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
        title: 'Server Error (502)',
        message: 'The server is temporarily unavailable (502 Bad Gateway). Please tap Try Again to reconnect.',
        isRetrying: false,
      });
    }
  });
}

/**
 * Retry all pending failed requests when user taps "Try Again"
 */
export async function retryPendingServerRequests() {
  if (isRetrying || pendingQueue.length === 0) return;
  if (!apiClientInstance) {
    console.warn('[serverErrorEvents] apiClientInstance is not registered for retry');
    return;
  }

  isRetrying = true;
  notifyUi({
    visible: true,
    title: 'Connecting...',
    message: 'Re-establishing connection to server...',
    isRetrying: true,
  });

  const batch = [...pendingQueue];
  pendingQueue = [];

  let anyFailed = false;

  for (const item of batch) {
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
      } else {
        item.reject(err);
      }
    }
  }

  isRetrying = false;

  if (anyFailed && pendingQueue.length > 0) {
    // Keep modal visible and allow the user to tap Try Again again
    notifyUi({
      visible: true,
      title: 'Server Still Unavailable (502)',
      message: 'The server is still unreachable. Please wait a moment and tap Try Again.',
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
