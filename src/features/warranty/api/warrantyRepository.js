import { ApiV2, extractApiErrorMessage } from '../../../core/api/apiClient';

/**
 * Dr. Terrace Warranty Repository (API v2 Unified)
 * 
 * Manages post-sale warranty configuration and generation for confirmed and receipt-locked quotations.
 */
export const warrantyRepository = {
  /**
   * 1. Check Warranty Eligibility
   * GET /api/v2/quotations/:id/warranty-eligibility
   */
  async checkEligibility(quotationId) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.checkEligibility(quotationId);
      const data = res?.data?.data || res?.data || {};
      return {
        success: true,
        isEligible: Boolean(data.isEligible),
        receiptNumber: data.receiptNumber || null,
        hasConfig: Boolean(data.hasConfig),
        hasWarranty: Boolean(data.hasWarranty),
        reason: data.reason || null,
        raw: data,
      };
    } catch (err) {
      return {
        success: false,
        isEligible: false,
        message: extractApiErrorMessage(err, 'Failed to check warranty eligibility'),
      };
    }
  },

  /**
   * 2. Get Warranty Config / Available Services
   * GET /api/v2/quotations/:id/warranty-config
   */
  async getConfig(quotationId) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.getConfig(quotationId);
      const payload = res?.data || {};
      const config = payload?.data || payload?.config || null;
      const availableServices = payload?.availableServices || [];
      return {
        success: true,
        config,
        availableServices: Array.isArray(availableServices) ? availableServices : [],
      };
    } catch (err) {
      return {
        success: false,
        config: null,
        availableServices: [],
        message: extractApiErrorMessage(err, 'Failed to fetch warranty configuration'),
      };
    }
  },

  /**
   * 3. Create Warranty Config
   * POST /api/v2/quotations/:id/warranty-config
   * @param {number|string} quotationId
   * @param {{ warrantyStartDate: string, services: Array<{ serviceId: number, isAdditional: boolean, years: number }> }} payload
   */
  async createConfig(quotationId, payload) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.createConfig(quotationId, payload);
      const data = res?.data?.data || res?.data?.config || res?.data || {};
      return {
        success: true,
        message: res?.data?.message || 'Warranty configuration created successfully',
        config: data,
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to create warranty configuration'),
      };
    }
  },

  /**
   * 4. Update Warranty Config
   * PATCH /api/v2/quotations/:id/warranty-config
   * @param {number|string} quotationId
   * @param {{ warrantyStartDate: string, services: Array<{ serviceId: number, isAdditional: boolean, years: number }> }} payload
   */
  async updateConfig(quotationId, payload) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.updateConfig(quotationId, payload);
      const data = res?.data?.data || res?.data?.config || res?.data || {};
      return {
        success: true,
        message: res?.data?.message || 'Warranty configuration updated successfully',
        config: data,
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to update warranty configuration'),
      };
    }
  },

  /**
   * 5. Generate Warranty
   * POST /api/v2/quotations/:id/warranty
   */
  async generateWarranty(quotationId) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.generateWarranty(quotationId);
      const data = res?.data?.data || res?.data?.warranty || res?.data || {};
      return {
        success: true,
        message: res?.data?.message || 'Warranty generated successfully',
        warranty: data,
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to generate warranty certificate'),
      };
    }
  },

  /**
   * 6. Get Warranty
   * GET /api/v2/quotations/:id/warranty
   */
  async getWarranty(quotationId) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.getWarranty(quotationId);
      const data = res?.data?.data || res?.data?.warranty || null;
      return {
        success: true,
        warranty: data,
      };
    } catch (err) {
      return {
        success: false,
        warranty: null,
        message: extractApiErrorMessage(err, 'Failed to fetch warranty details'),
      };
    }
  },

  /**
   * 7. Delete Warranty (3-Day Window, Admin Only)
   * DELETE /api/v2/quotations/:id/warranty
   */
  async deleteWarranty(quotationId) {
    if (!quotationId) return { success: false, message: 'Quotation ID required' };
    try {
      const res = await ApiV2.warranty.deleteWarranty(quotationId);
      return {
        success: true,
        message: res?.data?.message || 'Warranty deleted successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to delete warranty. Deletion is only allowed within 3 days.'),
      };
    }
  },
};

export default warrantyRepository;
