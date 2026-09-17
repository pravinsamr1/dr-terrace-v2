import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Employee Policy Repository
 * Fetches dynamic company employee policies from the backend API.
 */
export const policyRepository = {
  getPolicies: async () => {
    try {
      const endpoints = [
        API_ENDPOINTS.EMPLOYEE_POLICIES || '/employee-policies',
        '/admin/employee-policies',
        '/emp-policies',
        '/employee-policy',
        '/employee-policies/latest',
      ];

      let rawData = null;

      for (const endpoint of endpoints) {
        try {
          const res = await apiClient.get(endpoint);
          if (res && res.data) {
            rawData = res.data;
            break;
          }
        } catch (_err) {
          // try next fallback
        }
      }

      if (!rawData) {
        return {
          success: false,
          data: [],
          message: 'Unable to retrieve employee policies from server.',
        };
      }

      let list = rawData;
      if (list && Array.isArray(list.data)) {
        list = list.data;
      } else if (list && Array.isArray(list.policies)) {
        list = list.policies;
      } else if (list && typeof list === 'object' && !Array.isArray(list)) {
        if (list.id && list.description) {
          list = [list];
        } else if (Array.isArray(list.results)) {
          list = list.results;
        } else {
          list = [];
        }
      }

      if (!Array.isArray(list)) {
        list = [];
      }

      const normalizedPolicies = list
        .filter((item) => item && (item.isActive !== false))
        .map((item, index) => ({
          id: item.id || item._id || index + 1,
          title: item.title || item.heading || '',
          description: item.description || item.policy || item.text || item.content || '',
          sequence: Number(item.sequence) || (index + 1),
          isActive: item.isActive !== false,
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null,
        }))
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      return {
        success: true,
        data: normalizedPolicies,
      };
    } catch (err) {
      console.warn('policyRepository.getPolicies error:', err.message);
      return {
        success: false,
        data: [],
        message: err.message || 'Failed to load employee policies.',
      };
    }
  },

  /**
   * View Latest Policy
   * GET /employee-policies/latest
   */
  getLatest: async () => {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.EMPLOYEE_POLICIES_LATEST || '/employee-policies/latest'
      );
      const data = response.data;
      const policy = data?.data || data?.policy || data;
      return {
        success: true,
        data: policy,
      };
    } catch (err) {
      console.warn('policyRepository.getLatest error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to load latest policy',
        data: null,
      };
    }
  },

  /**
   * Get single policy by ID
   * GET /employee-policies/:id
   */
  getPolicyById: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.get(
        `${API_ENDPOINTS.EMPLOYEE_POLICIES || '/employee-policies'}/${cleanId}`
      );
      const data = response.data;
      const policy = data?.data || data?.policy || data;
      return {
        success: true,
        data: policy,
      };
    } catch (err) {
      console.warn(`policyRepository.getPolicyById error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to load policy',
        data: null,
      };
    }
  },

  /**
   * Create a new policy (Admin only)
   * POST /employee-policies
   */
  createPolicy: async (policyData) => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.EMPLOYEE_POLICIES || '/employee-policies',
        policyData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Policy created successfully',
      };
    } catch (err) {
      console.warn('policyRepository.createPolicy error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to create policy',
      };
    }
  },

  /**
   * Update policy by ID (Admin only)
   * PUT /employee-policies/:id
   */
  updatePolicy: async (id, policyData) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(
        `${API_ENDPOINTS.EMPLOYEE_POLICIES || '/employee-policies'}/${cleanId}`,
        policyData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Policy updated successfully',
      };
    } catch (err) {
      console.warn(`policyRepository.updatePolicy error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to update policy',
      };
    }
  },

  /**
   * Delete policy by ID (Admin only)
   * DELETE /employee-policies/:id
   */
  deletePolicy: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(
        `${API_ENDPOINTS.EMPLOYEE_POLICIES || '/employee-policies'}/${cleanId}`
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Policy deleted successfully',
      };
    } catch (err) {
      console.warn(`policyRepository.deletePolicy error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to delete policy',
      };
    }
  },

  /**
   * Reorder policies sequence (Admin only)
   * PUT/PATCH /employee-policies/reorder
   */
  reorderPolicies: async (orderPayload) => {
    try {
      const payload = Array.isArray(orderPayload) ? { order: orderPayload } : orderPayload;
      let response;
      try {
        response = await apiClient.put(
          API_ENDPOINTS.EMPLOYEE_POLICIES_REORDER || '/employee-policies/reorder',
          payload
        );
      } catch (putErr) {
        if (putErr?.response?.status === 405) {
          response = await apiClient.patch(
            API_ENDPOINTS.EMPLOYEE_POLICIES_REORDER || '/employee-policies/reorder',
            payload
          );
        } else {
          throw putErr;
        }
      }
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Policies reordered successfully',
      };
    } catch (err) {
      console.warn('policyRepository.reorderPolicies error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to reorder policies',
      };
    }
  },
};

export default policyRepository;

