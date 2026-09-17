import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Master Data & Dropdowns Repository (API v2)
 * Unified access to all master data tables and dropdown catalogs.
 */
export const masterDataRepository = {
  // ── Where to Waterproof ───────────────────────────────────────────────────
  getWhereToWaterproof: async () => {
    try {
      let response;
      try {
        response = await apiClient.get(API_ENDPOINTS.WHERE_TO_WATERPROOF || '/where-to-waterproof');
      } catch (err) {
        if (err?.response?.status === 404) {
          response = await apiClient.get('/whereforwaterproof');
        } else {
          throw err;
        }
      }
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.whereToWaterproof || data?.data || [];
      return { success: true, data: list, whereToWaterproof: list };
    } catch (error) {
      console.warn('[masterData] getWhereToWaterproof error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], whereToWaterproof: [] };
    }
  },

  createWhereToWaterproof: async (payload) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.WHERE_TO_WATERPROOF || '/where-to-waterproof', payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updateWhereToWaterproof: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(`${API_ENDPOINTS.WHERE_TO_WATERPROOF || '/where-to-waterproof'}/${cleanId}`, payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deleteWhereToWaterproof: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(`${API_ENDPOINTS.WHERE_TO_WATERPROOF || '/where-to-waterproof'}/${cleanId}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  // ── Properties ────────────────────────────────────────────────────────────
  getProperties: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PROPERTIES || '/properties');
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.properties || data?.data || [];
      return { success: true, data: list, properties: list };
    } catch (error) {
      console.warn('[masterData] getProperties error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], properties: [] };
    }
  },

  createProperty: async (payload) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.PROPERTIES || '/properties', payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updateProperty: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(`${API_ENDPOINTS.PROPERTIES || '/properties'}/${cleanId}`, payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deleteProperty: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(`${API_ENDPOINTS.PROPERTIES || '/properties'}/${cleanId}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  // ── Packages ──────────────────────────────────────────────────────────────
  getPackages: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PACKAGES || '/packages');
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.packages || data?.data || [];
      return { success: true, data: list, packages: list };
    } catch (error) {
      console.warn('[masterData] getPackages error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], packages: [] };
    }
  },

  createPackage: async (payload) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.PACKAGES || '/packages', payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updatePackage: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(`${API_ENDPOINTS.PACKAGES || '/packages'}/${cleanId}`, payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deletePackage: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(`${API_ENDPOINTS.PACKAGES || '/packages'}/${cleanId}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  // ── Package Sub-Categories ────────────────────────────────────────────────
  getPackageSubCategories: async (packageId = null) => {
    try {
      const endpoint = packageId
        ? `/packages/${packageId}/sub-categories`
        : (API_ENDPOINTS.PACKAGE_SUB_CATEGORIES || '/package-sub-categories');
      const response = await apiClient.get(endpoint);
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.subCategories || data?.data || [];
      return { success: true, data: list, subCategories: list };
    } catch (error) {
      console.warn('[masterData] getPackageSubCategories error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], subCategories: [] };
    }
  },

  createPackageSubCategory: async (payload) => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.PACKAGE_SUB_CATEGORIES || '/package-sub-categories',
        payload
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updatePackageSubCategory: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(
        `${API_ENDPOINTS.PACKAGE_SUB_CATEGORIES || '/package-sub-categories'}/${cleanId}`,
        payload
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deletePackageSubCategory: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(
        `${API_ENDPOINTS.PACKAGE_SUB_CATEGORIES || '/package-sub-categories'}/${cleanId}`
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  // ── Services ──────────────────────────────────────────────────────────────
  getServices: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.SERVICES || '/services');
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.services || data?.data || [];
      return { success: true, data: list, services: list };
    } catch (error) {
      console.warn('[masterData] getServices error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], services: [] };
    }
  },

  createService: async (payload) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.SERVICES || '/services', payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updateService: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(`${API_ENDPOINTS.SERVICES || '/services'}/${cleanId}`, payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deleteService: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(`${API_ENDPOINTS.SERVICES || '/services'}/${cleanId}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  // ── Service Details ───────────────────────────────────────────────────────
  getServiceDetails: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.SERVICE_DETAILS || '/service-details');
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.serviceDetails || data?.data || [];
      return { success: true, data: list, serviceDetails: list };
    } catch (error) {
      console.warn('[masterData] getServiceDetails error:', error?.response?.data || error.message);
      return { success: false, message: error.message, data: [], serviceDetails: [] };
    }
  },

  createServiceDetail: async (payload) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.SERVICE_DETAILS || '/service-details', payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  updateServiceDetail: async (id, payload) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(`${API_ENDPOINTS.SERVICE_DETAILS || '/service-details'}/${cleanId}`, payload);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  deleteServiceDetail: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(`${API_ENDPOINTS.SERVICE_DETAILS || '/service-details'}/${cleanId}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },
};

export default masterDataRepository;
