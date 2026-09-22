import { apiClient, extractApiErrorMessage } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Normalizes bank account records received from backend API v2.
 */
function normalizeBankAccount(item, index) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: String(item.id || item._id || item.bankId || `bank_${index}`),
    name: item.name || item.bankName || item.accountName || item.bank || `Bank Account ${index + 1}`,
    isPrimary: Boolean(item.isPrimary || item.is_primary || item.primary || index === 0),
    accountNumber: String(item.accountNumber || item.accountNo || item.account_number || item.accNo || ''),
    ifsc: String(item.ifsc || item.ifscCode || item.ifsc_code || ''),
    beneficiary: item.beneficiary || item.beneficiaryName || item.accountHolderName || item.holderName,
    branch: item.branch || item.branchName || '',
  };
}

/**
 * Normalizes payment payload into FormData when a file or proofImage is present,
 * or returns plain JSON payload if no file is attached.
 */
function preparePaymentPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload instanceof FormData) return payload;

  const rawProof =
    payload.proofImage ||
    payload.proof ||
    payload.image ||
    payload.file ||
    payload.receipt ||
    payload.referenceImage ||
    payload.attachedDoc;

  // If there is no proof file, return as-is (sent as application/json)
  if (!rawProof) {
    return payload;
  }

  const formData = new FormData();
  const skipKeys = new Set([
    'proofImage',
    'proof',
    'image',
    'file',
    'receipt',
    'referenceImage',
    'attachedDoc',
  ]);

  for (const [key, val] of Object.entries(payload)) {
    if (val !== undefined && val !== null && !skipKeys.has(key)) {
      formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
    }
  }

  // Normalize file object for React Native FormData upload
  let fileObj = null;
  if (typeof rawProof === 'object' && rawProof.uri) {
    let filename = rawProof.name || rawProof.fileName || rawProof.filename || (rawProof.uri.split('/').pop() || 'proof_image.jpg');
    filename = filename.split('?')[0].split('#')[0];
    if (!filename.includes('.')) filename = `${filename}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    let type = rawProof.mimeType || rawProof.type || (ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
    if (type === 'image/jpg') type = 'image/jpeg';
    if (type === 'image') type = 'image/jpeg';

    fileObj = {
      uri: rawProof.uri,
      name: filename,
      type,
    };
  } else if (typeof rawProof === 'string') {
    let uri = rawProof.trim();
    if (uri.startsWith('/') && !uri.startsWith('//')) {
      uri = `file://${uri}`;
    }
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      let filename = uri.split('/').pop() || 'proof_image.jpg';
      filename = filename.split('?')[0].split('#')[0];
      if (!filename.includes('.')) filename = `${filename}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';

      fileObj = {
        uri,
        name: filename,
        type,
      };
    } else {
      formData.append('proofImage', uri);
    }
  }

  if (fileObj) {
    // Attach the file once, under the field the backend documents
    // (proofImage). Previously this appended the SAME file under five
    // different keys (proofImage/proof/image/file/receipt), quintupling
    // the upload size on every image-attached payment — worse the larger
    // the photo, and worse still alongside a large payment amount, which
    // made these requests prone to timing out with a raw server/gateway
    // error instead of a clean response.
    formData.append('proofImage', fileObj);
  }

  return formData;
}

/**
 * Payments & Bank Accounts Repository (API v2)
 */
export const paymentRepository = {
  /**
   * Fetch company bank accounts for client payment transfers.
   * Tries `/bank-accounts` and candidate backend endpoints, falling back to defaults if not yet provisioned.
   */
  getBankAccounts: async () => {
    const endpointsToTry = [
      API_ENDPOINTS.BANK_ACCOUNTS || '/bank-accounts',
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await apiClient.get(endpoint);
        const resData = response?.data;
        const rawList = Array.isArray(resData)
          ? resData
          : Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData?.bankAccounts)
          ? resData.bankAccounts
          : Array.isArray(resData?.accounts)
          ? resData.accounts
          : null;

        if (Array.isArray(rawList) && rawList.length > 0) {
          const normalized = rawList.map(normalizeBankAccount).filter(Boolean);
          if (normalized.length > 0) {
            return {
              success: true,
              data: normalized,
              source: 'api',
            };
          }
        }
      } catch (_err) {
        // Try next candidate endpoint
      }
    }

     

    return {
      success: true,
      data: [],
      source: 'empty',
    };
  },

  /**
   * Fetch services from backend API v2.
   * STRICT: Zero static fallback data. If backend endpoints return no data or fail, returns empty array.
   */
  getServices: async () => {
    const endpointsToTry = [
      // API_ENDPOINTS.SERVICES || '/services',
      // '/services',
      // API_ENDPOINTS.QUOTATIONS_PAGE_VIEW || '/quotations/page-view',
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await apiClient.get(endpoint);
        const resData = response?.data;
        let rawList = null;

        if (Array.isArray(resData)) {
          rawList = resData;
        } else if (Array.isArray(resData?.data)) {
          rawList = resData.data;
        } else if (Array.isArray(resData?.services)) {
          rawList = resData.services;
        } else if (Array.isArray(resData?.packages)) {
          // If quotations page-view returned packages, extract unique services
          const extracted = [];
          resData.packages.forEach((pkg) => {
            if (Array.isArray(pkg?.services)) {
              pkg.services.forEach((s) => {
                if (s?.serviceName || s?.name) extracted.push(s);
              });
            }
          });
          if (extracted.length > 0) rawList = extracted;
        }

        if (Array.isArray(rawList) && rawList.length > 0) {
          const seen = new Set();
          const normalized = [];

          rawList.forEach((item, index) => {
            if (!item) return;
            if (typeof item === 'string') {
              const trimmed = item.trim();
              if (trimmed && !seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase());
                normalized.push({
                  id: String(trimmed),
                  name: trimmed,
                  serviceName: trimmed,
                });
              }
              return;
            }

            const name = item.serviceName || item.name || item.title || item.service || item.service_name;
            if (!name || typeof name !== 'string') return;
            const cleanName = name.trim();
            if (!cleanName || seen.has(cleanName.toLowerCase())) return;
            seen.add(cleanName.toLowerCase());

            normalized.push({
              id: String(item.id || item.serviceId || item._id || `srv_${index + 1}`),
              name: cleanName,
              serviceName: cleanName,
              description: item.description || item.spec || item.details || '',
              rate: item.rate != null ? Number(item.rate) : null,
            });
          });

          if (normalized.length > 0) {
            return {
              success: true,
              data: normalized,
              source: 'api',
            };
          }
        }
      } catch (_err) {
        // Try next candidate endpoint
      }
    }

    return {
      success: true,
      data: [],
      source: 'empty',
    };
  },

  /**
   * Fetch the unified Payment State (pay-view) for a confirmed quotation.
   * Returns: totalPrice, totalPaid, balanceAmount, services[], additionalPayment[],
   *          accounts[], currentActiveServiceId, canMakePayment, withGst, etc.
   */
  getPayView: async (quotationId) => {
    const response = await apiClient.get(API_ENDPOINTS.QUOTATION_PAY_VIEW(quotationId));
    const resData = response?.data;
    const data = resData?.data || resData;
    return {
      success: Boolean(data?.id || data?.totalPrice !== undefined),
      data: data || null,
    };
  },

  /**
   * Record a payment block for a base scope service.
   * paymentPayload: { amount, paymentMethod: 'CASH'|'ACCOUNT'|'UPI', voucher?, accountId?, upiId?, notes? }
   */
  recordServicePayment: async (quotationId, serviceId, paymentPayload) => {
    try {
      const dataToSend = preparePaymentPayload(paymentPayload);
      const response = await apiClient.post(
        API_ENDPOINTS.QUOTATION_SERVICE_PAYMENT(quotationId, serviceId),
        dataToSend
      );
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Payment recorded successfully',
      };
    } catch (err) {
      const errorMsg = extractApiErrorMessage(err, 'Failed to record service payment');
      return {
        success: false,
        message: errorMsg,
        error: err,
      };
    }
  },

  /**
   * Create an on-site variation work order (additional service).
   * Supports optional inline payment fields (amount, paymentMethod, voucher/accountId/upiId, notes, proofImage)
   * which are recorded atomically alongside service creation (API v2 Section 3).
   * If inline payment recording fails, the service is rolled back and not saved (Rule 17).
   */
  createAdditionalService: async (quotationId, servicePayload) => {
    try {
      const dataToSend = preparePaymentPayload(servicePayload);
      const response = await apiClient.post(
        API_ENDPOINTS.QUOTATION_ADDITIONAL_SERVICES(quotationId),
        dataToSend
      );
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Additional service created successfully',
      };
    } catch (err) {
      const errorMsg = extractApiErrorMessage(err, 'Failed to create additional service');
      return {
        success: false,
        message: errorMsg,
        error: err,
      };
    }
  },

  /**
   * Record a payment for an on-site variation/additional service.
   * paymentPayload: { amount, paymentMethod, voucher?, accountId?, upiId?, notes? }
   */
  recordAdditionalServicePayment: async (quotationId, serviceId, paymentPayload) => {
    try {
      const dataToSend = preparePaymentPayload(paymentPayload);
      const response = await apiClient.post(
        API_ENDPOINTS.QUOTATION_ADDITIONAL_SERVICE_PAYMENT(quotationId, serviceId),
        dataToSend
      );
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Payment recorded successfully',
      };
    } catch (err) {
      const errorMsg = extractApiErrorMessage(err, 'Failed to record variation payment');
      return {
        success: false,
        message: errorMsg,
        error: err,
      };
    }
  },

  /**
   * Confirm final settlement with deferred GST election.
   * settlementPayload: { withGst, amount, paymentMethod, accountId?, voucher?, upiId?, notes? }
   */
  confirmFinalSettlement: async (quotationId, settlementPayload) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const dataToSend = preparePaymentPayload(settlementPayload);
      const endpoint = API_ENDPOINTS.QUOTATION_FINAL_SETTLEMENT
        ? API_ENDPOINTS.QUOTATION_FINAL_SETTLEMENT(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/final-settlement`;
      const response = await apiClient.post(endpoint, dataToSend);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Final settlement recorded successfully',
      };
    } catch (err) {
      const errorMsg = extractApiErrorMessage(err, 'Failed to confirm final settlement');
      return {
        success: false,
        message: errorMsg,
        error: err,
      };
    }
  },

  /**
   * Dynamic Pricing Configuration (GST & Discount Toggles) (API v2 Section 6).
   * PATCH /api/v2/quotations/:id/pricing-config
   * payload: { withGst?: boolean, gstPercentage?: number, withDiscount?: boolean, discountPercentage?: number }
   */
  updatePricingConfig: async (quotationId, configPayload) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const endpoint = API_ENDPOINTS.QUOTATION_PRICING_CONFIG
        ? API_ENDPOINTS.QUOTATION_PRICING_CONFIG(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/pricing-config`;
      const response = await apiClient.patch(endpoint, configPayload);
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Pricing configuration updated successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to update pricing configuration'),
        error: err,
      };
    }
  },

  /**
   * Verify the blockchain ledger integrity for all payments on a quotation.
   * Returns: { isValid, totalBlocks, chain[] }
   */
  verifyPaymentChain: async (quotationId) => {
    const response = await apiClient.get(API_ENDPOINTS.QUOTATION_VERIFY_CHAIN(quotationId));
    const resData = response?.data;
    const data = resData?.data || resData;
    return {
      success: resData?.success !== false,
      data: data || null,
    };
  },

  /**
   * Admin verification of a payment block.
   * API v2 canonical: POST /api/v2/quotations/:id/payments/:paymentId/verify
   * Fallback: PATCH or direct /api/v2/payments/:paymentId/verify
   * payload: { isVerified: true, notes?: string }
   */
  verifyPayment: async (quotationId, paymentId, notes = '') => {
    let targetPayId = paymentId ? String(paymentId).trim() : '';
    const cleanQuoteId = quotationId
      ? String(quotationId).replace(/\D/g, '') || String(quotationId).trim()
      : null;

    // If targetPayId is synthetic (e.g. 'pay_220_0' or 'gst_rec_...'), try to find the real backend payment ID from payView
    if (
      targetPayId &&
      (targetPayId.startsWith('pay_') || targetPayId.startsWith('gst_rec_') || targetPayId.startsWith('temp_'))
    ) {
      if (quotationId) {
        try {
          const pvRes = await paymentRepository.getPayView(quotationId);
          if (pvRes?.success && pvRes.data) {
            const payViewData = pvRes.data;
            if (Array.isArray(payViewData.services)) {
              for (const svc of payViewData.services) {
                if (Array.isArray(svc.payments) && svc.payments.length > 0) {
                  const p =
                    svc.payments.find((item) => String(item.id).trim() === targetPayId) ||
                    svc.payments[0];
                  if (p?.id && !String(p.id).startsWith('pay_')) {
                    targetPayId = String(p.id).trim();
                    break;
                  }
                }
              }
            }
            if (targetPayId.startsWith('gst_rec_')) {
              const backendGstPay =
                payViewData?.gstPayment?.payments?.[0] ||
                payViewData?.gstPayments?.[0];
              if (backendGstPay?.id) {
                targetPayId = String(backendGstPay.id).trim();
              }
            }
          }
        } catch (_pvErr) {}
      }
    }

    if (!targetPayId) {
      return {
        success: false,
        message: 'Payment ID is required to verify payment',
      };
    }

    const payload = {
      isVerified: true,
      verified: true,
      status: 'approved',
      notes: notes || 'Verified by Admin',
    };

    const endpoints = [];
    if (cleanQuoteId && targetPayId) {
      endpoints.push(
        API_ENDPOINTS.QUOTATION_VERIFY_PAYMENT
          ? API_ENDPOINTS.QUOTATION_VERIFY_PAYMENT(cleanQuoteId, targetPayId)
          : `/quotations/${cleanQuoteId}/payments/${targetPayId}/verify`
      );
    }
    if (quotationId && String(quotationId).trim() !== cleanQuoteId && targetPayId) {
      endpoints.push(`/quotations/${String(quotationId).trim()}/payments/${targetPayId}/verify`);
    }
    if (targetPayId) {
      endpoints.push(
        API_ENDPOINTS.PAYMENT_VERIFY
          ? API_ENDPOINTS.PAYMENT_VERIFY(targetPayId)
          : `/payments/${targetPayId}/verify`
      );
    }

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.post(endpoint, payload);
        const resData = response?.data;
        if (resData?.success !== false) {
          return {
            success: true,
            data: resData?.data || resData,
            message: resData?.message || 'Payment verified successfully by Admin',
          };
        }
      } catch (err) {
        lastError = err;
        // Also attempt PATCH as specified in API v2 documentation
        try {
          const patchRes = await apiClient.patch(endpoint, payload);
          const pData = patchRes?.data;
          if (pData?.success !== false) {
            return {
              success: true,
              data: pData?.data || pData,
              message: pData?.message || 'Payment verified successfully by Admin',
            };
          }
        } catch (_patchErr) {
          // continue to next endpoint
        }
      }
    }

    return {
      success: false,
      message: extractApiErrorMessage(lastError, 'Failed to verify payment'),
    };
  },

  /**
   * Fetch Single Payment Verification View (API v2 Section 9).
   * Focused on inspecting a single payment by `:paymentId`, returning its uploaded proof image,
   * receipt/voucher details, verification chain status, quotation and service context.
   *
   * Canonical: GET /api/v2/quotations/:id/payments/:paymentId/verify-view
   * Or direct: GET /api/v2/payments/:paymentId/verify-view
   * Fallback:  GET /api/v2/payments/:paymentId
   */
  getPaymentVerifyView: async (paymentId, quotationId = null) => {
    if (!paymentId) {
      return {
        success: false,
        message: 'Payment ID is required',
      };
    }

    let targetPayId = String(paymentId).trim();
    let payViewData = null;

    if (quotationId) {
      try {
        const pvRes = await paymentRepository.getPayView(quotationId);
        if (pvRes?.success && pvRes.data) {
          payViewData = pvRes.data;
        }
      } catch (_pvErr) {}
    }

    // Match payment in payViewData across services, additionalPayment, and gstPayment
    let matchedService = null;
    let matchedPayment = null;
    let isGst = false;

    if (payViewData) {
      // 1. Search in services
      if (Array.isArray(payViewData.services)) {
        for (const svc of payViewData.services) {
          if (Array.isArray(svc.payments)) {
            const p = svc.payments.find(
              (item) =>
                String(item.id).trim() === targetPayId ||
                (item.voucher && String(item.voucher).trim() === targetPayId) ||
                (item.upiId && String(item.upiId).trim() === targetPayId)
            );
            if (p) {
              matchedService = svc;
              matchedPayment = p;
              break;
            }
          }
        }
      }

      // 2. Search in additionalPayment
      if (!matchedPayment && Array.isArray(payViewData.additionalPayment)) {
        for (const addSvc of payViewData.additionalPayment) {
          if (Array.isArray(addSvc.payments)) {
            const p = addSvc.payments.find(
              (item) =>
                String(item.id).trim() === targetPayId ||
                (item.voucher && String(item.voucher).trim() === targetPayId) ||
                (item.upiId && String(item.upiId).trim() === targetPayId)
            );
            if (p) {
              matchedService = addSvc;
              matchedPayment = p;
              break;
            }
          }
        }
      }

      // 3. Search in gstPayment
      if (!matchedPayment) {
        const gstPayments = [
          ...(Array.isArray(payViewData.gstPayment?.payments) ? payViewData.gstPayment.payments : []),
          ...(Array.isArray(payViewData.gstPayments) ? payViewData.gstPayments : []),
        ];
        const p = gstPayments.find(
          (item) =>
            String(item.id).trim() === targetPayId ||
            (item.voucher && String(item.voucher).trim() === targetPayId)
        );
        if (p || targetPayId.toLowerCase().startsWith('gst')) {
          matchedService = payViewData.gstPayment || { title: 'GST Tax Clearance', totalPrice: payViewData.gstAmount || 0 };
          matchedPayment = p || gstPayments[0] || null;
          isGst = true;
        }
      }

      if (matchedPayment?.id) {
        targetPayId = String(matchedPayment.id).trim();
      }
    }

    const endpoints = [];
    if (quotationId && API_ENDPOINTS.QUOTATION_PAYMENT_VERIFY_VIEW) {
      endpoints.push(API_ENDPOINTS.QUOTATION_PAYMENT_VERIFY_VIEW(quotationId, targetPayId));
    }
    if (API_ENDPOINTS.PAYMENT_VERIFY_VIEW) {
      endpoints.push(API_ENDPOINTS.PAYMENT_VERIFY_VIEW(targetPayId));
    }
    endpoints.push(`/payments/${targetPayId}/verify-view`);
    if (quotationId) {
      endpoints.push(`/quotations/${quotationId}/payments/${targetPayId}/verify-view`);
    }
    endpoints.push(`/payments/${targetPayId}`);

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get(endpoint);
        const resData = response?.data;
        const data = resData?.data || resData?.payment || resData;
        if (data && (data.paymentId || data.id || data.amount !== undefined || data.proofImage || data.proofImageUrl)) {
          if (matchedService && (!data.service || !data.service.totalPrice || (!isGst && data.service.serviceTitle === 'GST Tax Clearance'))) {
            data.service = {
              serviceId: matchedService.id,
              serviceTitle: matchedService.title || matchedService.serviceTitle || matchedService.name || 'Service Payment',
              sqft: matchedService.sqft ?? null,
              rate: matchedService.rate ?? null,
              totalPrice: Number(matchedService.totalPrice !== undefined ? matchedService.totalPrice : matchedService.originalPrice || 0),
              paidAmount: Number(matchedService.paidAmount !== undefined ? matchedService.paidAmount : 0),
              balanceAmount: Number(
                matchedService.balanceAmount !== undefined
                  ? matchedService.balanceAmount
                  : Math.max(0, Number(matchedService.totalPrice || 0) - Number(matchedService.paidAmount || 0))
              ),
              status: matchedService.status,
            };
          }
          if (payViewData && !data.quotation) {
            data.quotation = {
              quotationId: payViewData.id || payViewData.quotationId || quotationId,
              quotationTitle: payViewData.title || `Quotation #${payViewData.id || quotationId}`,
              siteAddress: payViewData.propertyAddress || payViewData.siteAddress || (payViewData.customer?.address || payViewData.customer?.area || ''),
              clientName: payViewData.customer?.name || payViewData.clientName || '',
              totalAmount: payViewData.totalPrice || payViewData.totalWithGst || 0,
              totalPaid: payViewData.totalPaid || 0,
              balanceAmount: payViewData.balanceAmount || 0,
            };
          }
          return {
            success: true,
            data,
            message: resData?.message || 'Payment verification view retrieved successfully',
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (matchedService || matchedPayment) {
      const synthService = matchedService
        ? {
            serviceId: matchedService.id,
            serviceTitle: matchedService.title || matchedService.serviceTitle || matchedService.name || (isGst ? 'GST Tax Clearance' : 'Service Payment'),
            sqft: matchedService.sqft ?? null,
            rate: matchedService.rate ?? null,
            totalPrice: Number(matchedService.totalPrice !== undefined ? matchedService.totalPrice : matchedService.originalPrice || 0),
            paidAmount: Number(matchedService.paidAmount !== undefined ? matchedService.paidAmount : 0),
            balanceAmount: Number(
              matchedService.balanceAmount !== undefined
                ? matchedService.balanceAmount
                : Math.max(0, Number(matchedService.totalPrice || 0) - Number(matchedService.paidAmount || 0))
            ),
            status: matchedService.status,
          }
        : null;

      const synthQuotation = payViewData
        ? {
            quotationId: payViewData.id || payViewData.quotationId || quotationId,
            quotationTitle: payViewData.title || `Quotation #${payViewData.id || quotationId}`,
            siteAddress: payViewData.propertyAddress || payViewData.siteAddress || (payViewData.customer?.address || payViewData.customer?.area || ''),
            clientName: payViewData.customer?.name || payViewData.clientName || '',
            totalAmount: payViewData.totalPrice || payViewData.totalWithGst || 0,
            totalPaid: payViewData.totalPaid || 0,
            balanceAmount: payViewData.balanceAmount || 0,
          }
        : null;

      return {
        success: true,
        data: {
          id: matchedPayment?.id || targetPayId,
          paymentId: matchedPayment?.id || targetPayId,
          amount: matchedPayment?.amount ?? (isGst ? payViewData?.gstAmount || 0 : 0),
          voucher: matchedPayment?.voucher || matchedPayment?.upiId || '',
          upiId: matchedPayment?.upiId || '',
          paymentMethod: matchedPayment?.paymentMethod || 'CASH',
          paymentDate: matchedPayment?.createdAt || matchedPayment?.date || new Date().toISOString(),
          receivedBy: matchedPayment?.receivedBy || 'Field Executive',
          notes: matchedPayment?.notes || '',
          proofImage: matchedPayment?.proofImage || null,
          proofImageUrl: matchedPayment?.proofImageUrl || matchedPayment?.proofImage || null,
          isVerified: Boolean(matchedPayment?.isVerified),
          verifiedBy: matchedPayment?.verifiedBy || null,
          verifiedAt: matchedPayment?.verifiedAt || null,
          verification: {
            isVerified: Boolean(matchedPayment?.isVerified),
            verifiedBy: matchedPayment?.verifiedBy || null,
            verifiedAt: matchedPayment?.verifiedAt || null,
            canVerify: true,
          },
          service: synthService,
          quotation: synthQuotation,
          accounts: payViewData?.accounts || [],
          primaryAccount: payViewData?.primaryAccount || null,
        },
        message: 'Payment verification view retrieved from quotation view',
      };
    }

    return {
      success: false,
      data: null,
      message: extractApiErrorMessage(lastError, 'Failed to fetch payment verification details'),
      error: lastError,
    };
  },

  /**
   * Record GST clearance payment (API v2 Section 10).
   * POST /api/v2/quotations/:id/gst-payment
   * payload: { amount, paymentMethod: 'CASH'|'ACCOUNT'|'UPI', accountId?, voucher?, upiId?, notes?, proofImage? }
   */
  recordGstPayment: async (quotationId, payload) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const dataToSend = preparePaymentPayload(payload);
      const response = await apiClient.post(
        API_ENDPOINTS.QUOTATION_GST_PAYMENT
          ? API_ENDPOINTS.QUOTATION_GST_PAYMENT(cleanQuoteId)
          : `/quotations/${cleanQuoteId}/gst-payment`,
        dataToSend
      );
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'GST clearance payment recorded successfully',
      };
    } catch (err) {
      return {
        success: false,
        message: extractApiErrorMessage(err, 'Failed to record GST payment'),
        error: err,
      };
    }
  },

  /**
   * Generate or fetch the official Final Receipt with customer GST number (API v2 Section 11).
   * POST or GET /api/v2/quotations/:id/final-receipt
   * Supports customerGstNumber via POST JSON body or GET query param.
   * Auto-recovers if GST decision was not previously confirmed by executing settlement first.
   */
  generateFinalReceipt: async (quotationId, customerGstNumber = null, withGst = null) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const gstVal = customerGstNumber ? String(customerGstNumber).trim() : null;
      const payload = gstVal ? { customerGstNumber: gstVal } : {};
      const endpoint = API_ENDPOINTS.QUOTATION_FINAL_RECEIPT
        ? API_ENDPOINTS.QUOTATION_FINAL_RECEIPT(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/final-receipt`;

      const executeReceiptCall = async () => {
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
        } catch (_postErr) {
          const errMsg = _postErr?.response?.data?.message || _postErr?.message || '';
          if (errMsg.toLowerCase().includes('gst decision') || errMsg.toLowerCase().includes('not been confirmed')) {
            throw _postErr;
          }
          // Fallback to GET with query param as supported by API v2
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
        }
        return null;
      };

      try {
        const result = await executeReceiptCall();
        if (result) return result;
      } catch (firstErr) {
        const errMsg = firstErr?.response?.data?.message || firstErr?.message || '';
        if (errMsg.toLowerCase().includes('gst decision') || errMsg.toLowerCase().includes('not been confirmed')) {
          const isWithGst = withGst !== null ? Boolean(withGst) : Boolean(gstVal);
          try {
            await paymentRepository.confirmFinalSettlement(cleanQuoteId, {
              withGst: isWithGst,
              ...(gstVal ? { customerGstNumber: gstVal } : {}),
            });
          } catch (_settleErr) {
            await paymentRepository.updatePricingConfig(cleanQuoteId, {
              withGst: isWithGst,
            }).catch(() => {});
          }
          const retryResult = await executeReceiptCall();
          if (retryResult) return retryResult;
        } else {
          throw firstErr;
        }
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
   * Admin toggle receipt lock status (API v2 Section 12).
   * PATCH /api/v2/quotations/:id/receipt-lock
   * payload: { isLocked: boolean, notes?: string }
   */
  toggleReceiptLock: async (quotationId, isLocked, notes = '') => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      const endpoint = API_ENDPOINTS.QUOTATION_RECEIPT_LOCK
        ? API_ENDPOINTS.QUOTATION_RECEIPT_LOCK(cleanQuoteId)
        : `/quotations/${cleanQuoteId}/receipt-lock`;
      const response = await apiClient.patch(endpoint, { isLocked, notes });
      const resData = response?.data;
      return {
        success: resData?.success !== false,
        data: resData?.data || resData,
        message: resData?.message || 'Receipt lock status updated successfully',
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
   * Delete a payment record (API v2).
   * Attempts DELETE /api/v2/quotations/:quotationId/payments/:paymentId
   * and fallback DELETE /api/v2/payments/:paymentId
   */
  deletePayment: async (paymentId, quotationId = null) => {
    if (!paymentId) {
      return { success: false, message: 'Payment ID is required to delete payment' };
    }

    const cleanPaymentId = String(paymentId).trim();
    const cleanQuoteId = quotationId ? String(quotationId).replace(/\D/g, '') || String(quotationId).trim() : null;

    const endpoints = [];
    if (cleanQuoteId && cleanPaymentId) {
      endpoints.push(
        API_ENDPOINTS.QUOTATION_PAYMENT_DELETE
          ? API_ENDPOINTS.QUOTATION_PAYMENT_DELETE(cleanQuoteId, cleanPaymentId)
          : `/quotations/${cleanQuoteId}/payments/${cleanPaymentId}`
      );
    }
    endpoints.push(
      API_ENDPOINTS.PAYMENT_DELETE
        ? API_ENDPOINTS.PAYMENT_DELETE(cleanPaymentId)
        : `/payments/${cleanPaymentId}`
    );

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.delete(endpoint);
        const resData = response?.data;
        if (resData?.success !== false) {
          return {
            success: true,
            data: resData?.data || resData,
            message: resData?.message || 'Payment deleted successfully',
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    return {
      success: false,
      message: extractApiErrorMessage(lastError, 'Failed to delete payment from server'),
      error: lastError,
    };
  },

  /**
   * Fetch official receipt numbering configuration (API v2 Section 13).
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
   * Update official receipt numbering configuration (Admin only - API v2 Section 13).
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

export default paymentRepository;