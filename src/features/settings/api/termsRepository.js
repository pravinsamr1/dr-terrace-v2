import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Terms and Conditions Repository
 * Fetches dynamic terms and conditions from the backend API.
 */
export const termsRepository = {
  getTerms: async () => {
    try {
      const endpoints = [
        API_ENDPOINTS.TERMS_AND_CONDITIONS || '/terms-and-conditions',
        '/admin/terms-and-conditions',
        '/terms',
        '/terms-and-conditions/latest',
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
          message: 'Unable to retrieve terms and conditions from server.',
        };
      }

      let list = rawData;
      if (list && Array.isArray(list.data)) {
        list = list.data;
      } else if (list && Array.isArray(list.terms)) {
        list = list.terms;
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

      const normalizedTerms = list
        .filter((item) => item && (item.isActive !== false))
        .map((item, index) => ({
          id: item.id || item._id || index + 1,
          title: item.title || item.heading || '',
          description: item.description || item.term || item.text || item.content || '',
          sequence: Number(item.sequence) || (index + 1),
          isActive: item.isActive !== false,
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null,
        }))
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      return {
        success: true,
        data: normalizedTerms,
      };
    } catch (err) {
      console.warn('termsRepository.getTerms error:', err.message);
      return {
        success: false,
        data: [],
        message: err.message || 'Failed to load terms & conditions.',
      };
    }
  },

  /**
   * Get single term by ID
   * GET /terms-and-conditions/:id
   */
  getTermById: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.get(
        `${API_ENDPOINTS.TERMS_AND_CONDITIONS || '/terms-and-conditions'}/${cleanId}`
      );
      const data = response.data;
      const term = data?.data || data?.term || data;
      return {
        success: true,
        data: term,
      };
    } catch (err) {
      console.warn(`termsRepository.getTermById error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to load term',
        data: null,
      };
    }
  },

  /**
   * Create term & condition (Admin only)
   * POST /terms-and-conditions
   */
  createTerm: async (termData) => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.TERMS_AND_CONDITIONS || '/terms-and-conditions',
        termData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Term created successfully',
      };
    } catch (err) {
      console.warn('termsRepository.createTerm error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to create term',
      };
    }
  },

  /**
   * Update term & condition by ID (Admin only)
   * PUT /terms-and-conditions/:id
   */
  updateTerm: async (id, termData) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(
        `${API_ENDPOINTS.TERMS_AND_CONDITIONS || '/terms-and-conditions'}/${cleanId}`,
        termData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Term updated successfully',
      };
    } catch (err) {
      console.warn(`termsRepository.updateTerm error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to update term',
      };
    }
  },

  /**
   * Delete term & condition by ID (Admin only)
   * DELETE /terms-and-conditions/:id
   */
  deleteTerm: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(
        `${API_ENDPOINTS.TERMS_AND_CONDITIONS || '/terms-and-conditions'}/${cleanId}`
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Term deleted successfully',
      };
    } catch (err) {
      console.warn(`termsRepository.deleteTerm error for ${id}:`, err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to delete term',
      };
    }
  },

  /**
   * Reorder terms & conditions sequence (Admin only)
   * PUT/PATCH /terms-and-conditions/reorder
   */
  reorderTerms: async (orderPayload) => {
    try {
      const payload = Array.isArray(orderPayload) ? { order: orderPayload } : orderPayload;
      let response;
      try {
        response = await apiClient.put(
          API_ENDPOINTS.TERMS_REORDER || '/terms-and-conditions/reorder',
          payload
        );
      } catch (putErr) {
        if (putErr?.response?.status === 405) {
          response = await apiClient.patch(
            API_ENDPOINTS.TERMS_REORDER || '/terms-and-conditions/reorder',
            payload
          );
        } else {
          throw putErr;
        }
      }
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Terms reordered successfully',
      };
    } catch (err) {
      console.warn('termsRepository.reorderTerms error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to reorder terms',
      };
    }
  },
};

export default termsRepository;

