import { useState, useCallback, useEffect } from 'react';
import { warrantyRepository } from '../api/warrantyRepository';

/**
 * Custom Hook for managing quotation post-sale warranty lifecycle in Dr. Terrace API v2.
 * 
 * Lifecycle:
 * 1. ELIGIBLE: Receipt generated and locked.
 * 2. CONFIGURED: Start date and per-service warranty years defined.
 * 3. GENERATED: Immutable warranty record created.
 * 4. 3-Day Window: Admin can delete generated warranty within 3 days to re-configure.
 */
export function useWarranty(initialQuotationId = null) {
  const [quotationId, setQuotationId] = useState(initialQuotationId);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [eligibility, setEligibility] = useState({
    isEligible: false,
    receiptNumber: null,
    hasConfig: false,
    hasWarranty: false,
    reason: null,
  });

  const [config, setConfig] = useState(null);
  const [availableServices, setAvailableServices] = useState([]);
  const [warranty, setWarranty] = useState(null);

  /**
   * Loads full warranty state for a given quotationId
   */
  const loadWarrantyData = useCallback(async (targetQuoteId) => {
    const qId = targetQuoteId || quotationId;
    if (!qId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Check eligibility
      const eligRes = await warrantyRepository.checkEligibility(qId);
      if (!eligRes.success) {
        setError(eligRes.message);
        setEligibility({
          isEligible: false,
          receiptNumber: null,
          hasConfig: false,
          hasWarranty: false,
          reason: eligRes.message,
        });
        setIsLoading(false);
        return;
      }

      setEligibility({
        isEligible: eligRes.isEligible,
        receiptNumber: eligRes.receiptNumber,
        hasConfig: eligRes.hasConfig,
        hasWarranty: eligRes.hasWarranty,
        reason: eligRes.reason,
      });

      // 2. Fetch config and available services
      const configRes = await warrantyRepository.getConfig(qId);
      if (configRes.success) {
        setConfig(configRes.config);
        setAvailableServices(configRes.availableServices || []);
      }

      // 3. If warranty is marked as generated, fetch warranty record
      if (eligRes.hasWarranty) {
        const wRes = await warrantyRepository.getWarranty(qId);
        if (wRes.success && wRes.warranty) {
          setWarranty(wRes.warranty);
        }
      } else {
        setWarranty(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load warranty data');
    } finally {
      setIsLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    if (initialQuotationId) {
      setQuotationId(initialQuotationId);
      loadWarrantyData(initialQuotationId);
    }
  }, [initialQuotationId, loadWarrantyData]);

  /**
   * Save initial warranty configuration
   * @param {{ warrantyStartDate: string, services: Array<{ serviceId: number, isAdditional: boolean, years: number }> }} payload
   */
  const saveConfig = useCallback(async (payload) => {
    if (!quotationId) return { success: false, message: 'Quotation ID missing' };
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await warrantyRepository.createConfig(quotationId, payload);
      if (res.success) {
        setConfig(res.config);
        setEligibility((prev) => ({ ...prev, hasConfig: true }));
        await loadWarrantyData(quotationId);
      } else {
        setError(res.message);
      }
      return res;
    } finally {
      setIsSubmitting(false);
    }
  }, [quotationId, loadWarrantyData]);

  /**
   * Update existing warranty configuration (PATCH)
   * @param {{ warrantyStartDate: string, services: Array<{ serviceId: number, isAdditional: boolean, years: number }> }} payload
   */
  const updateConfig = useCallback(async (payload) => {
    if (!quotationId) return { success: false, message: 'Quotation ID missing' };
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await warrantyRepository.updateConfig(quotationId, payload);
      if (res.success) {
        setConfig(res.config);
        await loadWarrantyData(quotationId);
      } else {
        setError(res.message);
      }
      return res;
    } finally {
      setIsSubmitting(false);
    }
  }, [quotationId, loadWarrantyData]);

  /**
   * Generate official immutable warranty
   */
  const generate = useCallback(async () => {
    if (!quotationId) return { success: false, message: 'Quotation ID missing' };
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await warrantyRepository.generateWarranty(quotationId);
      if (res.success) {
        setWarranty(res.warranty);
        setEligibility((prev) => ({ ...prev, hasWarranty: true }));
        await loadWarrantyData(quotationId);
      } else {
        setError(res.message);
      }
      return res;
    } finally {
      setIsSubmitting(false);
    }
  }, [quotationId, loadWarrantyData]);

  /**
   * Delete warranty within 3-day window (Admin Only)
   * Clears warranty back to null and returns to CONFIGURED state
   */
  const removeWarranty = useCallback(async () => {
    if (!quotationId) return { success: false, message: 'Quotation ID missing' };
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await warrantyRepository.deleteWarranty(quotationId);
      if (res.success) {
        setWarranty(null);
        setEligibility((prev) => ({ ...prev, hasWarranty: false, hasConfig: true }));
        await loadWarrantyData(quotationId);
      } else {
        setError(res.message);
      }
      return res;
    } finally {
      setIsSubmitting(false);
    }
  }, [quotationId, loadWarrantyData]);

  return {
    quotationId,
    setQuotationId,
    isLoading,
    isSubmitting,
    error,
    eligibility,
    config,
    availableServices,
    warranty,
    loadWarrantyData,
    saveConfig,
    updateConfig,
    generate,
    removeWarranty,
  };
}

export default useWarranty;
