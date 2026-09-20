import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

export const quotationRepository = {
  /**
   * Fetch quotation page view configuration (properties, packages, services, descriptions, rates)
   * GET /quotations/page-view
   */
  getPageView: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.QUOTATIONS_PAGE_VIEW);
      const data = response.data;
      return {
        success: true,
        data: data || {},
        properties: Array.isArray(data?.properties) ? data.properties : [],
        packages: Array.isArray(data?.packages) ? data.packages : [],
      };
    } catch (error) {
      console.warn('Failed to fetch quotation page view:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotation page view',
        properties: [],
        packages: [],
      };
    }
  },

  /**
   * Fetch quotation configuration for editing an existing quotation
   * GET /quotations/{id}/edit-view
   */
  getQuotationEditView: async (quotationId) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[getQuotationEditView] Fetching ${API_ENDPOINTS.QUOTATIONS}/${cleanId}/edit-view`);
      const response = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/${cleanId}/edit-view`);
      const data = response.data;
      const quotation = data?.quotation || data?.data?.quotation || (data?.id ? data : null);
      const properties = Array.isArray(data?.properties)
        ? data.properties
        : Array.isArray(data?.data?.properties)
        ? data.data.properties
        : [];
      const packages = Array.isArray(data?.packages)
        ? data.packages
        : Array.isArray(data?.data?.packages)
        ? data.data.packages
        : [];
      return {
        success: true,
        data,
        quotation,
        properties,
        packages,
      };
    } catch (error) {
      console.warn(`[getQuotationEditView] Error fetching edit-view for ${quotationId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotation edit-view',
        quotation: null,
        properties: [],
        packages: [],
      };
    }
  },

  /**
   * Fetch specific quotation details by ID for viewing
   * GET /quotations/{id}
   */
  getQuotationById: async (quotationId) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[getQuotationById] Fetching ${API_ENDPOINTS.QUOTATIONS}/${cleanId}`);
      const response = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/${cleanId}`);
      const data = response.data;
      return {
        success: true,
        data,
        quotation: data?.quotation || data?.data || data,
      };
    } catch (error) {
      console.warn(`[getQuotationById] Failed to fetch quotation ${quotationId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotation',
        quotation: null,
      };
    }
  },

  /**
   * Fetch quotation details + active terms and conditions + company contact for PDF view / printing
   * GET /quotations/{id}/pdf-view
   */
  getQuotationPdfView: async (quotationId) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[getQuotationPdfView] Fetching ${API_ENDPOINTS.QUOTATIONS}/${cleanId}/pdf-view`);
      const response = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/${cleanId}/pdf-view`);
      const data = response.data;
      const quotation = data?.data?.quotation || data?.quotation || data?.data || data;
      return {
        success: true,
        data: quotation,
        quotation,
      };
    } catch (error) {
      console.warn(`[getQuotationPdfView] Failed to fetch pdf-view for ${quotationId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotation PDF view',
        quotation: null,
      };
    }
  },

  /**
   * Save a new quotation
   * POST /quotations
   */
  createQuotation: async (quotationPayload) => {
    try {
      const todayIso = new Date().toISOString().split('T')[0];

      const sanitizePayload = (p) => {
        if (!p || typeof p !== 'object') return p;
        const copy = { ...p };
        // Ensure quotationDate key exists and has fallback
        const qDate = copy.quotationDate || copy.date || copy.quotation_date;
        copy.quotationDate = (qDate && String(qDate).trim()) ? String(qDate).trim() : todayIso;
        // Remove non-standard aliases if present
        delete copy.date;
        delete copy.quotation_date;
        return copy;
      };

      if (Array.isArray(quotationPayload)) {
        if (quotationPayload.length === 1) {
          const singlePayload = sanitizePayload(quotationPayload[0]);
          console.log('[createQuotation] Axios request payload right before POST:', JSON.stringify(singlePayload, null, 2));
          const response = await apiClient.post(API_ENDPOINTS.QUOTATIONS, singlePayload);
          const data = response.data;
          return {
            success: true,
            data,
            quotation: data?.quotation || data?.data || data,
          };
        } else if (quotationPayload.length > 1) {
          console.log(`[createQuotation] Batch posting ${quotationPayload.length} quotations...`);
          const results = await Promise.all(
            quotationPayload.map(async (item, idx) => {
              const sanitized = sanitizePayload(item);
              console.log(`[createQuotation] Axios request payload item ${idx + 1}/${quotationPayload.length} right before POST:`, JSON.stringify(sanitized, null, 2));
              const res = await apiClient.post(API_ENDPOINTS.QUOTATIONS, sanitized);
              return res.data;
            })
          );
          const first = results[0];
          return {
            success: true,
            data: first,
            quotation: first?.quotation || first?.data || first,
            allResults: results,
          };
        } else {
          return {
            success: false,
            message: 'No quotation payload provided',
          };
        }
      }

      const singlePayload = sanitizePayload(quotationPayload);
      console.log('[createQuotation] Axios request payload right before POST:', JSON.stringify(singlePayload, null, 2));
      const response = await apiClient.post(API_ENDPOINTS.QUOTATIONS, singlePayload);
      const data = response.data;
      return {
        success: true,
        data,
        quotation: data?.quotation || data?.data || data,
      };
    } catch (error) {
      console.warn('Failed to save quotation:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to save quotation',
        error: error.response?.data,
      };
    }
  },

  /**
   * Update an existing quotation
   * PUT /quotations/:id
   */
  updateQuotation: async (quotationId, quotationPayload) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      const todayIso = new Date().toISOString().split('T')[0];
      const payloadCopy = typeof quotationPayload === 'object' && quotationPayload !== null ? { ...quotationPayload } : {};
      const qDate = payloadCopy.quotationDate || payloadCopy.date || payloadCopy.quotation_date;
      payloadCopy.quotationDate = (qDate && String(qDate).trim()) ? String(qDate).trim() : todayIso;
      delete payloadCopy.date;
      delete payloadCopy.quotation_date;

      console.log(`[updateQuotation] Axios request payload right before PUT ${API_ENDPOINTS.QUOTATIONS}/${cleanId}:`, JSON.stringify(payloadCopy, null, 2));
      const response = await apiClient.put(`${API_ENDPOINTS.QUOTATIONS}/${cleanId}`, payloadCopy);
      const data = response.data;
      return {
        success: true,
        data,
        id: data?.id || cleanId,
        quotation: data?.quotation || data?.data || data,
        message: data?.message || 'Quotation updated successfully',
      };
    } catch (error) {
      console.warn(`[updateQuotation] Failed to update quotation ${quotationId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update quotation',
        error: error.response?.data,
      };
    }
  },

  /**
   * Delete a specific quotation by ID
   * DELETE /quotations/:id
   */
  deleteQuotation: async (quotationId) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[deleteQuotation] Sending DELETE ${API_ENDPOINTS.QUOTATIONS}/${cleanId}`);
      const response = await apiClient.delete(`${API_ENDPOINTS.QUOTATIONS}/${cleanId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.warn(`[deleteQuotation] Failed to delete quotation ${quotationId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to delete quotation',
      };
    }
  },

  /**
   * API v2: Confirm a quotation (Admin or Field Employee)
   * POST /quotations/:id/confirm
   * Body: { isConfirmed: true }
   * Note: Other unconfirmed drafts for this appointment are automatically cleaned up
   */
  confirmQuotation: async (quotationId, isConfirmed = true) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[confirmQuotation] POST ${API_ENDPOINTS.QUOTATIONS}/${cleanId}/confirm`);
      const response = await apiClient.post(
        `${API_ENDPOINTS.QUOTATIONS}/${cleanId}/confirm`,
        { isConfirmed }
      );
      return {
        success: true,
        statusCode: response.status || 200,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Quotation confirmed successfully',
      };
    } catch (error) {
      const status = error?.response?.status;
      const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to confirm quotation';
      console.warn(`[confirmQuotation] Failed to confirm quotation ${quotationId}:`, status, message);
      return {
        success: false,
        statusCode: status,
        message,
      };
    }
  },

  /**
   * API v2: Unlock a quotation (Admin Only)
   * POST /quotations/:id/unlock
   */
  unlockQuotation: async (quotationId) => {
    try {
      const cleanId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[unlockQuotation] POST ${API_ENDPOINTS.QUOTATIONS}/${cleanId}/unlock`);
      const response = await apiClient.post(
        `${API_ENDPOINTS.QUOTATIONS}/${cleanId}/unlock`
      );
      return {
        success: true,
        statusCode: response.status || 200,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Quotation unlocked successfully',
      };
    } catch (error) {
      const status = error?.response?.status;
      let message = error.response?.data?.message || error.response?.data?.error;
      if (!message && typeof error.response?.data === 'string') {
        try {
          const parsed = JSON.parse(error.response.data);
          message = parsed?.message || parsed?.error;
        } catch (_e) {}
      }
      if (!message) {
        message = error.message || 'Failed to unlock quotation';
      }
      console.warn(`[unlockQuotation] Failed to unlock quotation ${quotationId}:`, status, message);
      return {
        success: false,
        statusCode: status,
        message,
      };
    }
  },

  /**
   * API v2: List Quotations (Role-Scoped)
   * GET /quotations?page=1&limit=20
   */
  getQuotations: async (params = {}) => {
    try {
      const cleanParams = typeof params === 'object' && params !== null ? { ...params } : {};
      const response = await apiClient.get(API_ENDPOINTS.QUOTATIONS, { params: cleanParams });
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.data || data?.quotations || [];

      return {
        success: true,
        data: list,
        quotations: list,
        meta: data?.meta || null,
      };
    } catch (error) {
      console.warn('[quotationRepository] getQuotations error:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotations',
        data: [],
        quotations: [],
        meta: null,
      };
    }
  },

  /**
   * API v2: List Quotations by Client / Appointment
   * GET /quotations/client/:appointmentId
   */
  getByClient: async (appointmentId) => {
    try {
      const cleanId = String(appointmentId).replace(/\D/g, '') || appointmentId;
      const response = await apiClient.get(`${API_ENDPOINTS.QUOTATIONS}/client/${cleanId}`);
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.quotations || data?.data || [];

      return {
        success: true,
        data: list,
        quotations: list,
      };
    } catch (error) {
      console.warn(`[quotationRepository] getByClient error for appointment ${appointmentId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch client quotations',
        data: [],
        quotations: [],
      };
    }
  },

  /** Alias for getByClient */
  getQuotationsByClient: async (appointmentId) => {
    return quotationRepository.getByClient(appointmentId);
  },
};

export default quotationRepository;
