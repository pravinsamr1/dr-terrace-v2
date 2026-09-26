import { apiClient, extractApiErrorMessage } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Prepares a payment payload as FormData (when a file proof is attached)
 * or returns the plain JSON payload. Uses the same file-normalization logic
 * as the legacy paymentRepository so multipart uploads work identically.
 */
function preparePaymentPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload instanceof FormData) return payload;

  const rawProof =
    payload.proofImage ||
    payload.proof ||
    payload.image ||
    payload.file ||
    payload.receipt;

  if (!rawProof) {
    return payload;
  }

  const formData = new FormData();
  const skipKeys = new Set(['proofImage', 'proof', 'image', 'file', 'receipt']);

  for (const [key, val] of Object.entries(payload)) {
    if (val !== undefined && val !== null && !skipKeys.has(key)) {
      formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
    }
  }

  let fileObj = null;
  if (typeof rawProof === 'object' && rawProof.uri) {
    let filename =
      rawProof.name ||
      rawProof.fileName ||
      rawProof.filename ||
      (rawProof.uri.split('/').pop() || 'proof_image.jpg');
    filename = filename.split('?')[0].split('#')[0];
    if (!filename.includes('.')) filename = `${filename}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    let type =
      rawProof.mimeType ||
      rawProof.type ||
      (ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
    if (type === 'image/jpg') type = 'image/jpeg';
    if (type === 'image') type = 'image/jpeg';
    fileObj = { uri: rawProof.uri, name: filename, type };
  } else if (typeof rawProof === 'string') {
    let uri = rawProof.trim();
    if (uri.startsWith('/') && !uri.startsWith('//')) uri = `file://${uri}`;
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      let filename = uri.split('/').pop() || 'proof_image.jpg';
      filename = filename.split('?')[0].split('#')[0];
      if (!filename.includes('.')) filename = `${filename}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type =
        ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
      fileObj = { uri, name: filename, type };
    } else {
      formData.append('proofImage', uri);
    }
  }

  if (fileObj) {
    formData.append('proofImage', fileObj);
  }

  return formData;
}

/**
 * Quotation Payments Repository
 *
 * Implements the new /api/v2/quotation-payments endpoints:
 *
 *   GET    /api/v2/quotation-payments/:id                     - payment summary & history
 *   POST   /api/v2/quotation-payments/:id                     - record intermediate payment
 *   PATCH  /api/v2/quotation-payments/:id/:paymentId/verify   - admin verify payment
 *   POST   /api/v2/quotation-payments/:id/final               - final settlement (GST decision)
 *   DELETE /api/v2/quotation-payments/:id/:paymentId          - rollback latest payment (Admin)
 */
export const quotationPaymentRepository = {
  /**
   * GET /api/v2/quotation-payments/:id
   *
   * Returns full payment summary including:
   *   quotationId, clientName, mobileNumber, gstDecision, customerGstNumber,
   *   pricing { subTotal, withoutGstTotal, withGstTotal },
   *   progress { totalPaid, withGstBalance, withoutGstBalance, paymentStatus },
   *   history []
   */
  getPaymentSummary: async (quotationId) => {
    if (!quotationId) {
      return { success: false, data: null, message: 'Quotation ID is required' };
    }
    try {
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_SUMMARY(String(quotationId));
      const response = await apiClient.get(endpoint);
      const resData = response?.data;
      const data = resData?.data || resData;
      return {
        success: Boolean(resData?.success !== false && data),
        data: data || null,
        message: resData?.message || 'Payment summary retrieved successfully',
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        message: extractApiErrorMessage(err, 'Failed to fetch payment summary'),
        error: err,
      };
    }
  },

  /**
   * POST /api/v2/quotation-payments/:id
   *
   * Records an intermediate payment (deducted from withoutGstBalance).
   * Proof image is mandatory. Sequential verification guard applies.
   *
   * payload: {
   *   amount: number,
   *   paymentMethod: 'UPI' | 'ACCOUNT' | 'CASH',
   *   upiId?: string,
   *   accountId?: number,
   *   voucher?: string,
   *   referenceNumber?: string,
   *   paymentDate: string,    // YYYY-MM-DD
   *   notes?: string,
   *   proofImage: File | { uri, name, type },
   * }
   */
  recordPayment: async (quotationId, payload, { onUploadProgress } = {}) => {
    if (!quotationId) {
      return { success: false, message: 'Quotation ID is required' };
    }
    try {
      const dataToSend = preparePaymentPayload(payload);
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_RECORD(String(quotationId));
      const axiosConfig = onUploadProgress ? { onUploadProgress } : {};
      const response = await apiClient.post(endpoint, dataToSend, axiosConfig);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Payment recorded successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to record payment'),
        error: err,
      };
    }
  },

  /**
   * GET /api/v2/quotation-payments/:id/:paymentId/verify-view
   *
   * Complete payment verification dossier combining:
   *   - payment details (amount, paymentMethod, account, upiId, voucher, etc.)
   *   - proof inspection (hasProofImage, proofImage, proofImageUrl, fileType)
   *   - sequential verification guard (canVerify, blockingPaymentId)
   *   - quotation financial context (pricing, progress, siteAddress, client details)
   *
   * Canonical: GET /api/v2/quotation-payments/:id/:paymentId/verify-view
   */
  getPaymentVerifyView: async (quotationId, paymentId) => {
    if (!paymentId && !quotationId) {
      return { success: false, data: null, message: 'Payment ID is required' };
    }
    const cleanPayId = paymentId ? String(paymentId).trim() : '';
    const cleanQuoteId = quotationId ? String(quotationId).trim() : '';

    const endpoints = [];
    if (cleanQuoteId && cleanPayId) {
      if (API_ENDPOINTS.QUOTATION_PAYMENT_VERIFY_VIEW) {
        endpoints.push(API_ENDPOINTS.QUOTATION_PAYMENT_VERIFY_VIEW(cleanQuoteId, cleanPayId));
      }
      endpoints.push(`/quotation-payments/${cleanQuoteId}/${cleanPayId}/verify-view`);
      endpoints.push(`/quotation-payments/${cleanQuoteId}/${cleanPayId}`);
    }
    if (cleanPayId) {
      endpoints.push(`/quotation-payments/verify-view/${cleanPayId}`);
      endpoints.push(`/quotation-payments/payments/${cleanPayId}/verify-view`);
      endpoints.push(`/payments/${cleanPayId}/verify-view`);
    }

    let lastError = null;
    for (const ep of endpoints) {
      try {
        const response = await apiClient.get(ep);
        const resData = response?.data;
        const data = resData?.data || resData;
        if (data && (data.id || data.paymentId || data.amount !== undefined || data.verification || data.quotation)) {
          return {
            success: true,
            data,
            message: resData?.message || 'Payment verification view retrieved successfully',
          };
        }
      } catch (err) {
        lastError = err;
        if (err?.response?.status && ![404, 400].includes(err.response.status)) {
          break;
        }
      }
    }

    return {
      success: false,
      data: null,
      message: extractApiErrorMessage(lastError, 'Failed to fetch payment verification view'),
      error: lastError,
    };
  },

  /**
   * PATCH /api/v2/quotation-payments/:id/:paymentId/verify
   *
   * Admin-only. Verifies a pending payment.
   *
   * payload: { isVerified: true, verificationNotes?: string }
   */
  verifyPayment: async (quotationId, paymentId, verificationNotes = '') => {
    if (!quotationId || !paymentId) {
      return { success: false, message: 'Quotation ID and Payment ID are required' };
    }
    const payload = {
      isVerified: true,
      verificationNotes: verificationNotes || 'Verified by Admin',
    };
    try {
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_VERIFY(
        String(quotationId),
        String(paymentId)
      );
      const response = await apiClient.patch(endpoint, payload);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Payment verified successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to verify payment'),
        error: err,
      };
    }
  },

  /**
   * POST /api/v2/quotation-payments/:id/final
   *
   * Final settlement. applyGst (boolean) determines GST treatment:
   *   applyGst = false -> settles withoutGstBalance (gstDecision: OPTED_OUT)
   *   applyGst = true  -> settles withGstBalance (gstDecision: APPLIED, 18% GST)
   *
   * payload: {
   *   amount: number,
   *   paymentMethod: 'UPI' | 'ACCOUNT' | 'CASH',
   *   applyGst: boolean,
   *   customerGstNumber?: string,
   *   upiId?: string,
   *   accountId?: number,
   *   voucher?: string,
   *   referenceNumber?: string,
   *   paymentDate: string,
   *   notes?: string,
   *   proofImage: File | { uri, name, type },
   * }
   */
  recordFinalSettlement: async (quotationId, payload, { onUploadProgress } = {}) => {
    if (!quotationId) {
      return { success: false, message: 'Quotation ID is required' };
    }
    try {
      const dataToSend = preparePaymentPayload(payload);
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_FINAL(String(quotationId));
      const axiosConfig = onUploadProgress ? { onUploadProgress } : {};
      const response = await apiClient.post(endpoint, dataToSend, axiosConfig);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Final settlement recorded successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to record final settlement'),
        error: err,
      };
    }
  },

  /**
   * DELETE /api/v2/quotation-payments/:id/:paymentId
   *
   * Admin-only. Deletes the latest payment and restores quotation balance.
   * If the deleted payment was the final payment, gstDecision reverts to PENDING.
   */
  deletePayment: async (quotationId, paymentId) => {
    if (!quotationId || !paymentId) {
      return { success: false, message: 'Quotation ID and Payment ID are required' };
    }
    try {
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_DELETE_NEW(
        String(quotationId),
        String(paymentId)
      );
      const response = await apiClient.delete(endpoint);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Payment deleted and balance restored successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to delete payment'),
        error: err,
      };
    }
  },

  /**
   * POST /api/v2/quotation-payments/:id/additional-services
   *
   * Adds an on-site variation/additional service directly to a quotation.
   * Automatically recalculates totals (subTotal, withoutGstTotal, withGstTotal)
   * and updates payment summary.
   *
   * @param {string | number} quotationId
   * @param {import('../types/quotationPaymentTypes').AddAdditionalServiceRequest} payload
   */
  addAdditionalService: async (quotationId, payload) => {
    if (!quotationId) {
      return { success: false, message: 'Quotation ID is required' };
    }
    try {
      const endpoint = API_ENDPOINTS.QUOTATION_PAYMENT_ADDITIONAL_SERVICES(String(quotationId));
      const response = await apiClient.post(endpoint, payload);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Additional service added and quotation updated successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to add additional service'),
        error: err,
      };
    }
  },

  /**
   * GET /api/v2/quotations/:id/services/options
   * (alias: GET /api/v2/quotations/:id/additional-service-view)
   *
   * Fetches master services and specification details eligible for being
   * added as an additional service to the quotation, automatically filtered
   * by the quotation's package tier.
   *
   * @param {string | number} quotationId
   * @returns {Promise<{
   *   success: boolean,
   *   data: import('../types/quotationPaymentTypes').QuotationServiceOptionsResponse | null,
   *   services: import('../types/quotationPaymentTypes').QuotationServiceOptionItem[],
   *   tier: string | null,
   *   allowedTiers: string[],
   *   existingServicesCount: number,
   *   message: string,
   *   error?: any
   * }>}
   */
  getAdditionalServiceOptions: async (quotationId) => {
    if (!quotationId) {
      return {
        success: false,
        data: null,
        services: [],
        tier: null,
        allowedTiers: [],
        existingServicesCount: 0,
        message: 'Quotation ID is required',
      };
    }
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const endpoint = API_ENDPOINTS.QUOTATION_SERVICES_OPTIONS
        ? API_ENDPOINTS.QUOTATION_SERVICES_OPTIONS(String(cleanQuoteId))
        : `/quotations/${cleanQuoteId}/services/options`;
      const response = await apiClient.get(endpoint);
      const resData = response?.data;
      const data = resData?.data || resData;
      const services = Array.isArray(data?.services) ? data.services : [];
      return {
        success: Boolean(resData?.success !== false && data),
        data: data || null,
        services,
        tier: data?.tier || null,
        allowedTiers: Array.isArray(data?.allowedTiers) ? data.allowedTiers : [],
        existingServicesCount: data?.existingServicesCount != null ? data.existingServicesCount : 0,
        message: resData?.message || 'Additional service options retrieved successfully',
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        services: [],
        tier: null,
        allowedTiers: [],
        existingServicesCount: 0,
        message: extractApiErrorMessage(err, 'Failed to fetch additional service options'),
        error: err,
      };
    }
  },

  /**
   * POST /api/v2/quotations/:id/services
   *
   * Appends an existing master-data service as an additional line item on a quotation.
   * Title/subtitle/description are auto-resolved from master data by the backend.
   * Automatically recalculates totals and payment audit chain.
   *
   * If service already exists, mode controls update behavior:
   * - 'add' (default): adds area (existing.area + area)
   * - 'replace': overwrites existing area (existing.area = area)
   *
   * @param {string | number} quotationId
   * @param {import('../types/quotationPaymentTypes').V2AddAdditionalServiceFromExistingDto} payload
   */
  addServiceFromExisting: async (quotationId, payload) => {
    if (!quotationId) {
      return { success: false, message: 'Quotation ID is required' };
    }
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const endpoint = API_ENDPOINTS.QUOTATION_SERVICES_ADD(String(cleanQuoteId));
      const response = await apiClient.post(endpoint, payload);
      const resData = response?.data;
      const serviceData = resData?.data?.service || resData?.service;
      const isUpdated = Boolean(serviceData?.isUpdated ?? resData?.isUpdated);
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        service: serviceData || null,
        quotation: resData?.data?.quotation || resData?.quotation || null,
        isUpdated,
        message: resData?.message || (isUpdated ? 'Existing service in quotation updated successfully' : 'Service added to quotation successfully'),
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to add service from existing master data'),
        error: err,
      };
    }
  },
  /**
   * GET /api/v2/quotation-payments/:id/final-receipt (or /quotations/:id/final-receipt)
   *
   * Retrieves official final receipt data.
   */
  getFinalReceipt: async (quotationId, customerGstNumber = null) => {
    if (!quotationId) {
      return { success: false, data: null, message: 'Quotation ID is required' };
    }
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const gstVal = customerGstNumber ? String(customerGstNumber).trim() : null;
      const endpoint = API_ENDPOINTS.QUOTATION_FINAL_RECEIPT
        ? API_ENDPOINTS.QUOTATION_FINAL_RECEIPT(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/final-receipt`;

      const response = await apiClient.get(endpoint, {
        params: gstVal ? { customerGstNumber: gstVal } : {},
      });
      const resData = response?.data;
      if (resData?.success !== false && (resData?.data || resData?.receiptNumber)) {
        return {
          success: true,
          data: resData?.data || resData,
          message: resData?.message || 'Final receipt retrieved successfully',
        };
      }
      return {
        success: false,
        data: null,
        message: 'Final receipt not found',
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        message: extractApiErrorMessage(err, 'Failed to fetch final receipt'),
        error: err,
      };
    }
  },

  /**
   * POST /api/v2/quotation-payments/:id/final-receipt (or /quotations/:id/final-receipt)
   *
   * Generates official final receipt and locks quotation.
   */
  generateFinalReceipt: async (quotationId, customerGstNumber = null) => {
    if (!quotationId) {
      return { success: false, data: null, message: 'Quotation ID is required' };
    }
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const gstVal = customerGstNumber ? String(customerGstNumber).trim() : null;
      const payload = gstVal ? { customerGstNumber: gstVal } : {};
      const endpoint = API_ENDPOINTS.QUOTATION_FINAL_RECEIPT
        ? API_ENDPOINTS.QUOTATION_FINAL_RECEIPT(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/final-receipt`;

      try {
        const response = await apiClient.post(endpoint, payload);
        const resData = response?.data;
        if (resData?.success !== false && (resData?.data || resData?.receiptNumber)) {
          return {
            success: true,
            data: resData?.data || resData,
            message: resData?.message || 'Final receipt generated successfully',
          };
        }
      } catch (postErr) {
        // Fallback to GET if already generated
        const getRes = await apiClient.get(endpoint, {
          params: gstVal ? { customerGstNumber: gstVal } : {},
        });
        const resData = getRes?.data;
        if (resData?.success !== false && (resData?.data || resData?.receiptNumber)) {
          return {
            success: true,
            data: resData?.data || resData,
            message: resData?.message || 'Final receipt retrieved successfully',
          };
        }
        throw postErr;
      }
      return {
        success: false,
        data: null,
        message: 'Failed to generate final receipt',
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        message: extractApiErrorMessage(err, 'Failed to generate final receipt'),
        error: err,
      };
    }
  },

  /**
   * PATCH /api/v2/quotations/:id/receipt-lock
   *
   * Admin-only toggle of quotation receipt lock.
   */
  toggleReceiptLock: async (quotationId, isLocked, notes = '') => {
    if (!quotationId) {
      return { success: false, message: 'Quotation ID is required' };
    }
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const endpoint = API_ENDPOINTS.QUOTATION_RECEIPT_LOCK
        ? API_ENDPOINTS.QUOTATION_RECEIPT_LOCK(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/receipt-lock`;
      const response = await apiClient.patch(endpoint, { isLocked: Boolean(isLocked), notes });
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Quotation receipt lock status updated successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to update receipt lock'),
        error: err,
      };
    }
  },

  /**
   * GET /api/v2/receipt-settings
   */
  getReceiptSettings: async () => {
    try {
      const endpoint = API_ENDPOINTS.RECEIPT_SETTINGS || '/receipt-settings';
      const response = await apiClient.get(endpoint);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to fetch receipt settings'),
        error: err,
      };
    }
  },

  /**
   * PUT /api/v2/receipt-settings
   */
  updateReceiptSettings: async (settingsPayload) => {
    try {
      const endpoint = API_ENDPOINTS.RECEIPT_SETTINGS || '/receipt-settings';
      const response = await apiClient.put(endpoint, settingsPayload);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Receipt settings updated successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to update receipt settings'),
        error: err,
      };
    }
  },
};

export default quotationPaymentRepository;
