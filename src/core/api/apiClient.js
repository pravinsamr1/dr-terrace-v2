import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config/config';
import { notifySessionExpired } from '../auth/sessionEvents';
import { setApiClientForRetry, notifyServerError, isServerError } from './serverErrorEvents';

/**
 * Handle 401 Unauthorized / Expired Token
 */
function handleUnauthorized() {
  console.log('[Auth] Token expired or invalid (401). Triggering session expiration warning...');
  notifySessionExpired();
}

/**
 * Global Axios Client Instance
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  proxy: false,
  adapter: "fetch",
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Register client instance for retrying failed requests
setApiClientForRetry(apiClient);

// Request Interceptor: Automatically attach Auth Token if available
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_err) {
      // Ignore token read error and proceed
    }

    // If request data is FormData, remove Content-Type and bypass Axios fetch.js serialization
    const isMultipart =
      config.data instanceof FormData ||
      (config.data && typeof config.data.getParts === 'function') ||
      (config.data && typeof config.data.append === 'function') ||
      (config.headers && String(config.headers['Content-Type'] || config.headers['content-type'] || '').includes('multipart'));

    if (isMultipart) {
      config.transformRequest = [(data) => data];
      if (config.headers?.delete) {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      }
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];

      // Use XMLHttpRequest for multipart FormData to bypass Expo Winter fetch's convertFormData limitation with file URIs
      config.adapter = (cfg) => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const fullUrl = (cfg.baseURL || '') + (cfg.url || '');
          const method = (cfg.method || 'POST').toUpperCase();

          xhr.open(method, fullUrl, true);
          xhr.timeout = cfg.timeout || 120000;

          if (cfg.headers) {
            const rawHeaders = typeof cfg.headers.toJSON === 'function' ? cfg.headers.toJSON() : cfg.headers;
            for (const key of Object.keys(rawHeaders)) {
              if (key.toLowerCase() !== 'content-type') {
                xhr.setRequestHeader(key, String(rawHeaders[key]));
              }
            }
          }

          xhr.onload = () => {
            let responseData;
            try {
              responseData = JSON.parse(xhr.responseText);
            } catch (_e) {
              responseData = xhr.responseText;
            }

            const axiosResponse = {
              data: responseData,
              status: xhr.status,
              statusText: xhr.statusText,
              headers: xhr.responseHeaders || {},
              config: cfg,
              request: xhr,
            };

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(axiosResponse);
            } else {
              const error = new Error(`Request failed with status code ${xhr.status}`);
              error.response = axiosResponse;
              error.config = cfg;
              error.status = xhr.status;
              reject(error);
            }
          };

          xhr.onerror = () => {
            const error = new Error('Network Error');
            error.config = cfg;
            error.request = xhr;
            reject(error);
          };

          xhr.ontimeout = () => {
            const error = new Error(`timeout of ${xhr.timeout}ms exceeded`);
            error.code = 'ECONNABORTED';
            error.config = cfg;
            error.request = xhr;
            reject(error);
          };

          xhr.send(cfg.data);
        });
      };
    }

    console.log(`[Axios Request] ${(config.method || 'GET').toUpperCase()} ${(config.baseURL || '') + (config.url || '')}`, {
      headers: config.headers,
      data: isMultipart ? '[FormData]' : JSON.stringify(config.data),
      params: JSON.stringify(config.params),
    });

    return config;
  },
  (error) => {
    console.log('[Axios Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Extracts a user-friendly error message from an API error or response object.
 */
export function extractApiErrorMessage(error, defaultMessage = 'An unexpected error occurred. Please try again.') {
  if (!error) return defaultMessage;

  // 1. Check error.response.data
  const resData = error.response?.data;
  if (resData) {
    let parsed = resData;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (_e) {}
    }
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return parsed.message.join('\n');
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
      if (typeof parsed.msg === 'string' && parsed.msg.trim()) {
        return parsed.msg.trim();
      }
    } else if (typeof parsed === 'string' && parsed.trim()) {
      return parsed.trim();
    }
  }

  // 2. Check error.data (if attached directly on custom response/error)
  if (error.data) {
    let d = error.data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (_e) {}
    }
    if (d && typeof d === 'object') {
      if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
      if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
    }
  }

  // 3. Check error.message (skip generic Axios status text)
  if (typeof error.message === 'string' && error.message.trim()) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object') {
        const nestedMsg = parsed.message || parsed.error || parsed.msg;
        if (nestedMsg && typeof nestedMsg === 'string') return nestedMsg.trim();
      }
    } catch (_e) {}

    if (!error.message.startsWith('Request failed with status code') && error.message !== 'Network Error') {
      return error.message.trim();
    }
  }

  return defaultMessage;
}

// Response Interceptor: Format error responses and handle expired tokens
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[Axios Response] ${response.status} ${(response.config?.method || 'GET').toUpperCase()} ${(response.config?.baseURL || '') + (response.config?.url || '')}`, JSON.stringify(response.data));
    return response;
  },
  async (error) => {
    // If backend returned a structured error message, attach it to error.message
    const backendMessage = extractApiErrorMessage(error, null);
    if (backendMessage) {
      error.message = backendMessage;
    }

    const errorDetails = {
      message: error.message,
      code: error.code,
      url: (error.config?.baseURL || '') + (error.config?.url || ''),
      status: error.response?.status,
      data: JSON.stringify(error.response?.data),
    };
    console.log('[Axios Response Error]', errorDetails);

    // Auto redirect to /login when token is expired or unauthorized (401)
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '');
      const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

      if (!isAuthEndpoint) {
        handleUnauthorized();
      }
    }

    // Server Connection Error / Offline popup with Try Again button
    if (isServerError(error) && !error.config?._skipServerErrorPopup) {
      return notifyServerError(error);
    }

    return Promise.reject(error);
  }
);

// ── Unified API v2 Client Methods ──────────────────────────────────────────
export const ApiV2 = {
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    getProfile: () => apiClient.get('/auth/profile'),
    logout: () => apiClient.post('/auth/logout'),
  },

  appointments: {
    list: (params) => apiClient.get('/appointments', { params }),
    getById: (id) => apiClient.get(`/appointments/${id}`),
    create: (data) => apiClient.post('/appointments', data),
    update: (id, data) => apiClient.put(`/appointments/${id}`, data),
    delete: (id) => apiClient.delete(`/appointments/${id}`),
    reassign: (id, employeeId) =>
      apiClient.patch(`/appointments/${id}/assign`, { employeeId: Number(employeeId) }),
    checkIn: (id, timeData) =>
      apiClient.post(`/appointments/${id}/checkin`, timeData || {}),
    getAttends: (appointmentId) =>
      appointmentId
        ? apiClient.get(`/appointments/${appointmentId}/attends`)
        : apiClient.get('/appointments/attends'),
    getQuotations: (appointmentId) =>
      apiClient.get(`/appointments/${appointmentId}/quotations`),
  },

  quotations: {
    list: (params) => apiClient.get('/quotations', { params }),
    getById: (id) => apiClient.get(`/quotations/${id}`),
    getPageView: () => apiClient.get('/quotations/page-view'),
    getEditView: (id) => apiClient.get(`/quotations/${id}/edit-view`),
    getByClient: (appointmentId) =>
      apiClient.get(`/quotations/client/${appointmentId}`),
    create: (data) => apiClient.post('/quotations', data),
    update: (id, data) => apiClient.put(`/quotations/${id}`, data),
    delete: (id) => apiClient.delete(`/quotations/${id}`),
    confirm: (id, isConfirmed = true) =>
      apiClient.post(`/quotations/${id}/confirm`, { isConfirmed }),
    unlock: (id) => apiClient.post(`/quotations/${id}/unlock`),
    getPdfView: (id) => apiClient.get(`/quotations/${id}/pdf-view`),
  },

  clients: {
    list: (params) => apiClient.get('/clients', { params }),
    getById: (id) => apiClient.get(`/clients/${id}`),
    getQuotations: (id) => apiClient.get(`/clients/${id}/quotations`),
  },

  schedules: {
    list: (date) =>
      apiClient.get('/appointment-schedules', { params: typeof date === 'string' ? { date } : date }),
    createOrUpdate: (data) => apiClient.post('/appointment-schedules', data),
    update: (id, data) => apiClient.put(`/appointment-schedules/${id}`, data),
    delete: (id) => apiClient.delete(`/appointment-schedules/${id}`),
  },

  policies: {
    list: () => apiClient.get('/employee-policies'),
    getLatest: () => apiClient.get('/employee-policies/latest'),
    getById: (id) => apiClient.get(`/employee-policies/${id}`),
    create: (data) => apiClient.post('/employee-policies', data),
    update: (id, data) => apiClient.put(`/employee-policies/${id}`, data),
    delete: (id) => apiClient.delete(`/employee-policies/${id}`),
    reorder: (order) =>
      apiClient.put('/employee-policies/reorder', Array.isArray(order) ? { order } : order),
  },

  dashboard: {
    getHomeView: (targetDate) =>
      apiClient.get('/home-view', {
        params: typeof targetDate === 'string' ? { targetDate } : targetDate,
      }),
  },

  masterData: {
    getWhereToWaterproof: () => apiClient.get('/where-to-waterproof'),
    createWhereToWaterproof: (data) => apiClient.post('/where-to-waterproof', data),
    updateWhereToWaterproof: (id, data) => apiClient.put(`/where-to-waterproof/${id}`, data),
    deleteWhereToWaterproof: (id) => apiClient.delete(`/where-to-waterproof/${id}`),

    getProperties: () => apiClient.get('/properties'),
    createProperty: (data) => apiClient.post('/properties', data),
    updateProperty: (id, data) => apiClient.put(`/properties/${id}`, data),
    deleteProperty: (id) => apiClient.delete(`/properties/${id}`),

    getPackages: () => apiClient.get('/packages'),
    createPackage: (data) => apiClient.post('/packages', data),
    updatePackage: (id, data) => apiClient.put(`/packages/${id}`, data),
    deletePackage: (id) => apiClient.delete(`/packages/${id}`),

    getPackageSubCategories: (packageId) =>
      packageId
        ? apiClient.get(`/packages/${packageId}/sub-categories`)
        : apiClient.get('/package-sub-categories'),
    createPackageSubCategory: (data) => apiClient.post('/package-sub-categories', data),
    updatePackageSubCategory: (id, data) => apiClient.put(`/package-sub-categories/${id}`, data),
    deletePackageSubCategory: (id) => apiClient.delete(`/package-sub-categories/${id}`),

    getServices: () => apiClient.get('/services'),
    createService: (data) => apiClient.post('/services', data),
    updateService: (id, data) => apiClient.put(`/services/${id}`, data),
    deleteService: (id) => apiClient.delete(`/services/${id}`),

    getServiceDetails: () => apiClient.get('/service-details'),
    createServiceDetail: (data) => apiClient.post('/service-details', data),
    updateServiceDetail: (id, data) => apiClient.put(`/service-details/${id}`, data),
    deleteServiceDetail: (id) => apiClient.delete(`/service-details/${id}`),

    getTerms: () => apiClient.get('/terms-and-conditions'),
    getTermById: (id) => apiClient.get(`/terms-and-conditions/${id}`),
    createTerm: (data) => apiClient.post('/terms-and-conditions', data),
    updateTerm: (id, data) => apiClient.put(`/terms-and-conditions/${id}`, data),
    deleteTerm: (id) => apiClient.delete(`/terms-and-conditions/${id}`),
    reorderTerms: (order) =>
      apiClient.put('/terms-and-conditions/reorder', Array.isArray(order) ? { order } : order),

    getContactInfo: () => apiClient.get('/contact-info'),
    updateContactInfo: (data) => apiClient.put('/contact-info', data),

    getEmployees: () => apiClient.get('/employees'),
    getEmployeeById: (id) => apiClient.get(`/employees/${id}`),
    createEmployee: (data) => apiClient.post('/employees', data),
    updateEmployee: (id, data) => apiClient.put(`/employees/${id}`, data),
    deleteEmployee: (id) => apiClient.delete(`/employees/${id}`),
  },

  payments: {
    getBankAccounts: () => apiClient.get('/bank-accounts'),
  },

  health: {
    check: () => apiClient.get('/health'),
  },
};

export { apiClient };
export default apiClient;

