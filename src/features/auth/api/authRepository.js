import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';
import { notifySessionExpired } from '../../../core/auth/sessionEvents';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

/**
 * Role normalization helpers for API v2.
 * v2 returns role as "ADMIN" or "FIELD_EMPLOYEE".
 * These helpers provide backward-compatible checks.
 */
const ADMIN_ROLES = ['ADMIN', 'MASTER_ADMIN', 'admin', 'master'];
const FIELD_EMPLOYEE_ROLES = ['FIELD_EMPLOYEE', 'field-employee', 'employee'];

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function isFieldEmployeeRole(role) {
  return FIELD_EMPLOYEE_ROLES.includes(role);
}

/**
 * Normalize user object from API v2 login/profile response.
 * Ensures consistent role flags across the app.
 */
function normalizeUser(rawUser) {
  if (!rawUser) return null;

  const rawRole = rawUser.role || '';
  const empType = rawUser.employeeType || '';

  const isFieldEmp =
    isFieldEmployeeRole(rawRole) ||
    empType === 'FieldEmployee';

  const normalizedRole = isFieldEmp ? 'FIELD_EMPLOYEE' : 'ADMIN';

  return {
    ...rawUser,
    // `role` stays "ADMIN" / "FIELD_EMPLOYEE": several screens compare it to those values. `serverRole` is the exact
    // role the server sent (for example "MASTER_ADMIN"). Both are saved in local storage at login.
    role: normalizedRole,
    serverRole: rawRole || normalizedRole,
    isAdmin: !isFieldEmp,
    // The one master admin (role "MASTER_ADMIN"); also an admin. Only they can verify a warranty.
    isMasterAdmin: !isFieldEmp && (rawUser.isMasterAdmin === true || rawRole === 'MASTER_ADMIN'),
    isFieldEmployee: isFieldEmp,
  };
}

/**
 * Universal safe base64 decoder
 */
function decodeBase64(str) {
  if (typeof atob === 'function') {
    try {
      return atob(str);
    } catch (_e) {}
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let cleanStr = String(str).replace(/=+$/, '');
  if (cleanStr.length % 4 === 1) return '';
  for (let bc = 0, bs, buffer, idx = 0; (buffer = cleanStr.charAt(idx++)); ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Authentication Repository
 */
export const authRepository = {
  /**
   * Check if a JWT token has expired based on its payload exp
   */
  isTokenExpired: (token) => {
    if (!token || typeof token !== 'string') return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeBase64(base64);
      const payload = JSON.parse(jsonStr);
      if (payload && payload.exp) {
        // payload.exp is in seconds
        return Date.now() >= payload.exp * 1000;
      }
    } catch (_e) {
      // If parsing fails, allow server verification to decide
    }
    return false;
  },

  /**
   * Check if current session token is valid when app resumes from background
   */
  checkSessionValidity: async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return false;

      // 1. Fast client-side JWT expiration check
      if (authRepository.isTokenExpired(token)) {
        console.log('[Auth] Token expired locally while backgrounded. Triggering session expiration warning...');
        notifySessionExpired();
        return false;
      }

      // 2. Server-side validation check
      await apiClient.get(`${API_ENDPOINTS.APPOINTMENTS}?page=1&limit=1`);
      return true;
    } catch {
      // 401 Unauthorized is caught by apiClient interceptor which calls notifySessionExpired()
      return false;
    }
  },

  clearLocalSession: async () => {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
    } catch (storageErr) {
      console.error('Error clearing auth local storage:', storageErr);
    }
  },
  storeToken: async (token) => {
    try {
      if (token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, String(token));
      }
    } catch (error) {
      console.error('Error saving auth token to local storage:', error);
    }
  },

  getToken: async () => {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting auth token from local storage:', error);
      return null;
    }
  },

  removeToken: async () => {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error removing auth token from local storage:', error);
    }
  },

  storeUser: async (user) => {
    try {
      if (user) {
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      }
    } catch (error) {
      console.error('Error saving user data to local storage:', error);
    }
  },

  getUser: async () => {
    try {
      const data = await AsyncStorage.getItem(USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading user data from local storage:', error);
      return null;
    }
  },

  logout: async () => {
    // First, while the login token still exists: stop pushes for this phone.
    // Loaded here (not at the top of the file) so the auth module does not pull in Expo's notification packages.
    try {
      const { unregisterPushDevice } = require('../../notifications/utils/pushRegistration');
      await unregisterPushDevice();
    } catch (pushErr) {
      console.warn('Could not unregister this device from push notifications:', pushErr?.message);
    }
    try {
      await apiClient.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      console.warn('Backend logout API error:', error?.response?.data || error?.message);
    } finally {
      try {
        await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
      } catch (storageErr) {
        console.error('Error clearing auth local storage on logout:', storageErr);
      }
    }
    return { success: true };
  },

  login: async (mobileOrUsername, password) => {
    try {
      const payload = {
        username: mobileOrUsername,
        password: password,
      };

      const response = await apiClient.post(API_ENDPOINTS.LOGIN, payload);
      const data = response.data;

      console.log('[Login Response]', data);

      const token =
        data?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.jwt ||
        data?.data?.token ||
        data?.data?.accessToken ||
        data?.data?.access_token ||
        data?.data?.jwt ||
        '';

      const user =
        data?.user ||
        data?.data?.user ||
        data?.data ||
        { name: 'Admin', role: 'ADMIN', username: mobileOrUsername };

      const normalizedUserObj = normalizeUser(user);

      if (token) {
        await authRepository.storeToken(token);
      }
      if (normalizedUserObj) {
        await authRepository.storeUser(normalizedUserObj);
      }

      return {
        success: true,
        token,
        user: normalizedUserObj,
        data,
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          success: false,
          message: 'Connection timed out. Please check your internet connection and try again.',
        };
      }

      if (error.response) {
        const resData = error.response.data;
        const status = error.response.status;
        const rawMsg = String((resData && (resData.message || resData.error || resData.msg)) || '');

        let userFriendlyMsg = 'Invalid username or password. Please try again.';

        if (status === 401 || status === 403) {
          userFriendlyMsg = 'Invalid username or password. Please check your credentials.';
        } else if (
          status === 404 ||
          rawMsg.includes('Route') ||
          rawMsg.includes('POST') ||
          rawMsg.includes('GET') ||
          rawMsg.includes('/api/') ||
          rawMsg.toLowerCase().includes('not found')
        ) {
          userFriendlyMsg = 'Unable to reach the server. Please check the network or server configuration.';
        } else if (status >= 500) {
          userFriendlyMsg = 'Server is currently experiencing issues. Please try again later.';
        } else if (rawMsg && !rawMsg.includes('Route') && !rawMsg.includes('/api/') && !rawMsg.includes('POST') && !rawMsg.includes('GET')) {
          userFriendlyMsg = rawMsg;
        }

        return {
          success: false,
          message: userFriendlyMsg,
          status: error.response.status,
          data: resData,
        };
      }

      return {
        success: false,
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
      };
    }
  },

  /**
   * API v2: Get Current User Profile
   * GET /auth/profile
   */
  getProfile: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PROFILE || '/auth/profile');
      const data = response.data;
      const rawUser = data?.user || data?.data || data;
      const normalized = normalizeUser(rawUser);

      if (normalized) {
        await authRepository.storeUser(normalized);
      }

      return {
        success: true,
        data: normalized,
        user: normalized,
      };
    } catch (error) {
      console.warn('[authRepository] getProfile error:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch user profile',
        user: null,
      };
    }
  },
};

export default authRepository;
export { isAdminRole, isFieldEmployeeRole, normalizeUser };
