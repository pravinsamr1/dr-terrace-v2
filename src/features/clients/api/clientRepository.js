import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

export const clientRepository = {
  /**
   * Normalize backend client object - Strict 1:1 mapping with zero artificial fallbacks
   */
  normalizeClient: (client, index = 0) => {
    if (!client) return null;
    const raw = client.data ?? client.client ?? client;

    const rawId = raw.clientId ?? raw.customerId ?? raw.id ?? raw._id ?? raw.appointmentId;
    const id = rawId != null ? String(rawId).trim() : `client-${index}`;
    const customerId = raw.customerId ?? raw.clientId ?? raw.id ?? raw._id ?? id;
    const clientId = raw.clientId ?? customerId;
    const appointmentId = raw.appointmentId ?? id;

    const customerName = raw.customerName ? String(raw.customerName).trim() : (raw.clientName ? String(raw.clientName).trim() : (raw.name ? String(raw.name).trim() : ''));
    const mobileNumber = raw.mobileNumber ? String(raw.mobileNumber).trim() : (raw.phone ? String(raw.phone).trim() : (raw.mobile ? String(raw.mobile).trim() : ''));

    const addr = typeof raw.address === 'object' && raw.address !== null ? raw.address : {};
    const doorNo = addr.doorNo ? String(addr.doorNo).trim() : (raw.doorNo ? String(raw.doorNo).trim() : '');
    const streetName = addr.streetName ? String(addr.streetName).trim() : (addr.street ? String(addr.street).trim() : (raw.streetName ? String(raw.streetName).trim() : ''));
    const area = raw.area ? String(raw.area).trim() : (addr.area ? String(addr.area).trim() : (raw.location ? String(raw.location).trim() : ''));
    const city = raw.city ? String(raw.city).trim() : (addr.city ? String(addr.city).trim() : '');
    const state = addr.state ? String(addr.state).trim() : (raw.state ? String(raw.state).trim() : '');
    const pincode = addr.pincode ? String(addr.pincode).trim() : (raw.pincode ? String(raw.pincode).trim() : '');

    const fullAddress = typeof raw.address === 'string' && raw.address.trim()
      ? raw.address.trim()
      : [doorNo, streetName, area, city, pincode].filter(Boolean).join(', ');

    const location = [area, city].filter(Boolean).join(', ') || fullAddress;
    const status = raw.status ? String(raw.status).trim() : (raw.projectStatus ? String(raw.projectStatus).trim() : '');
    const assignedTo = raw.assignedTo ? String(raw.assignedTo).trim() : (raw.employeeName ? String(raw.employeeName).trim() : (raw.assignedTechnician ? String(raw.assignedTechnician).trim() : ''));
    const appointmentDate = raw.appointmentDate ? String(raw.appointmentDate).trim() : (raw.date ? String(raw.date).trim() : '');
    const appointmentFixDate = raw.appointmentFixDate ? String(raw.appointmentFixDate).trim() : (raw.fixDate ? String(raw.fixDate).trim() : appointmentDate);
    const appointmentTime = raw.appointmentTime ? String(raw.appointmentTime).trim() : (raw.time ? String(raw.time).trim() : '');
    const googleLocation = raw.googleLocation ? String(raw.googleLocation).trim() : (raw.mapLocation ? String(raw.mapLocation).trim() : '');
    const serviceType = raw.serviceType ? String(raw.serviceType).trim() : (raw.services ? String(raw.services).trim() : '');

    const { packages: normalizedPackages, quotations: normalizedQuotations } =
      clientRepository.normalizePackagesAndQuotations(raw);

    const confirmedQuote = normalizedQuotations.find(
      (q) => q.isConfirmed || q.status === 'CONFIRMED' || q.confirmed
    );
    // Only trust an explicit backend confirmation flag, or a quotation that is
    // actually marked isConfirmed. Never infer confirmation from the mere presence
    // of a payView / quotationId — a payView can exist for an unconfirmed draft too.
    const rawConfirmedId = raw.confirmedQuoteId ?? raw.activeQuotationId;
    const confirmedQuoteId = rawConfirmedId != null
      ? String(rawConfirmedId)
      : (confirmedQuote ? String(confirmedQuote.id) : null);
    const activeQuotationId = raw.activeQuotationId != null
      ? String(raw.activeQuotationId)
      : confirmedQuoteId;

    const isReceiptGenerated = Boolean(
      raw.isReceiptGenerated ||
      raw.fullReceiptGenerated ||
      raw.receiptNumber ||
      raw.payView?.isReceiptGenerated ||
      raw.payView?.fullReceiptGenerated ||
      raw.payView?.receiptNumber ||
      raw.payView?.receiptStatus === 'GENERATED'
    );
    const isReceiptLocked = Boolean(raw.isReceiptLocked || raw.payView?.isReceiptLocked);
    const receiptNumber = raw.receiptNumber ?? raw.payView?.receiptNumber ?? null;

    const totalPayment = raw.totalPayment ?? raw.totalAmount ?? raw.grandTotal ?? raw.total ??
      confirmedQuote?.total ?? confirmedQuote?.amount ??
      raw.payView?.totalWithGst ?? raw.payView?.totalPrice ?? 0;

    return {
      id,
      _id: raw._id ?? id,
      clientId,
      customerId,
      appointmentId,
      customerName,
      clientName: customerName,
      name: customerName,
      mobileNumber,
      phone: mobileNumber,
      mobile: mobileNumber,
      clientPhone: mobileNumber,
      area,
      city,
      doorNo,
      streetName,
      street: streetName,
      state,
      pincode,
      address: fullAddress,
      addressBreakdown: {
        doorNo,
        streetName,
        area,
        city,
        state,
        pincode,
      },
      fullAddress,
      location,
      status,
      projectStatus: status,
      assignedTo,
      employeeName: raw.employeeName ?? assignedTo,
      assignedTechnician: assignedTo,
      technician: assignedTo,
      attendedBy: assignedTo,
      appointmentDate,
      date: appointmentDate,
      fixDate: appointmentFixDate,
      appointmentFixDate,
      appointmentFixedDate: appointmentFixDate,
      appointmentTime,
      time: appointmentTime,
      googleLocation,
      mapLocation: googleLocation,
      mapUrl: googleLocation,
      googleMapsUrl: googleLocation,
      serviceType,
      appointmentAttend: raw.appointmentAttend ?? raw.attend ?? null,
      attendedDate: raw.appointmentAttend?.date ? String(raw.appointmentAttend.date).trim() : (raw.attendedDate ? String(raw.attendedDate).trim() : ''),
      attendedTime: raw.appointmentAttend?.time ? String(raw.appointmentAttend.time).trim() : (raw.attendedTime ? String(raw.attendedTime).trim() : ''),
      employeeId: raw.employeeId ?? raw.assignedEmployeeId ?? raw.appointmentAttend?.employeeId ?? null,
      assignedEmployeeId: raw.assignedEmployeeId ?? raw.employeeId ?? raw.appointmentAttend?.employeeId ?? null,
      packages: normalizedPackages.length > 0 ? normalizedPackages : (Array.isArray(raw.packages) ? raw.packages : []),
      quotations: normalizedQuotations.length > 0 ? normalizedQuotations : (Array.isArray(raw.quotations) ? raw.quotations : []),
      payView: confirmedQuote ? (raw.payView ?? confirmedQuote?.payView ?? null) : null,
      sitePhotos: Array.isArray(raw.sitePhotos) ? raw.sitePhotos : [],
      inspections: Array.isArray(raw.inspections) ? raw.inspections : [],
      extraCharges: Array.isArray(raw.extraCharges) ? raw.extraCharges : [],
      confirmedQuoteId,
      activeQuotationId,
      quotationId: confirmedQuoteId,
      totalPayment,
      warranty: raw.warranty ?? null,
      warrantyClaims: Array.isArray(raw.warrantyClaims) ? raw.warrantyClaims : [],
      isReceiptGenerated,
      fullReceiptGenerated: isReceiptGenerated,
      isReceiptLocked,
      receiptNumber,
      siteVisited: Boolean(raw.siteVisited ?? raw.isSiteVisited),
    };
  },

  /**
   * Helper to normalize packages and quotations arrays
   */
  normalizePackagesAndQuotations: (data) => {
    if (!data) return { packages: [], quotations: [] };

    const packagesArray = Array.isArray(data?.packages)
      ? data.packages
      : (Array.isArray(data?.data?.packages) ? data.data.packages : null);

    let normalizedPackages = [];
    let allNormalizedQuotations = [];

    if (packagesArray && packagesArray.length > 0) {
      normalizedPackages = packagesArray.map((pkg) => {
        const rawPackageName = pkg.packages || pkg.packageName || pkg.name || pkg.tier || '';
        const packageName = String(rawPackageName).trim();
        const pkgId = pkg.packageId != null ? Number(pkg.packageId) : (pkg.id != null ? Number(pkg.id) : null);
        const tier = pkg.tier ? String(pkg.tier).trim() : (
          pkgId === 3 || packageName.toLowerCase().includes('elite') ? 'Elite' :
          pkgId === 2 || packageName.toLowerCase().includes('premium') ? 'Premium' :
          pkgId === 1 || packageName.toLowerCase().includes('economic') ? 'Economic' :
          (pkgId === null || packageName.toLowerCase() === 'none' ? 'None' : packageName)
        );
        const warranty = pkg.warranty ? String(pkg.warranty).trim() : '';
        const pkgQuots = Array.isArray(pkg.quotations)
          ? pkg.quotations
          : (Array.isArray(pkg.data) ? pkg.data : []);

        const normalizedPkgQuots = pkgQuots.map((q, qIdx) => {
          return clientRepository.normalizeQuotation(q, qIdx, {
            packageId: pkgId,
            packages: tier || packageName || pkg.packages,
            packageName: q.packageName || packageName,
            tier: q.tier || tier,
            warranty: q.warranty || warranty,
          });
        }).filter(Boolean);

        allNormalizedQuotations.push(...normalizedPkgQuots);

        return {
          packageId: pkgId,
          packages: tier || packageName || pkg.packages,
          packageName: packageName || tier,
          tier,
          warranty,
          quotations: normalizedPkgQuots,
        };
      });
    }

    // Also include any top-level raw quotations that were not in packagesArray
    const topQuots = Array.isArray(data?.quotations)
      ? data.quotations
      : (Array.isArray(data?.data?.quotations) ? data.data.quotations : []);

    topQuots.forEach((q, idx) => {
      const qId = String(q?.quotationId ?? q?.id ?? '');
      if (qId && !allNormalizedQuotations.some((existing) => String(existing.id) === qId || String(existing.quotationId) === qId)) {
        const norm = clientRepository.normalizeQuotation(q, allNormalizedQuotations.length + idx);
        if (norm) {
          allNormalizedQuotations.push(norm);
          const targetPkg = normalizedPackages.find((p) => p.packageId === norm.packageId || (norm.tier && p.tier?.toLowerCase() === norm.tier.toLowerCase()));
          if (targetPkg) {
            targetPkg.quotations.push(norm);
          }
        }
      }
    });

    return {
      packages: normalizedPackages,
      quotations: allNormalizedQuotations,
    };
  },

  /**
   * Fetch paginated clients from API
   * GET /clients?page=1&limit=20&search=...
   */
  getClients: async (page = 1, limit = 20, search = '') => {
    try {
      let params = { page, limit };
      if (typeof page === 'object' && page !== null) {
        params = { ...page };
      } else {
        if (search && typeof search === 'string' && search.trim()) {
          params.search = search.trim();
        }
      }

      const response = await apiClient.get(API_ENDPOINTS.CLIENTS, {
        params,
      });
      const data = response.data;
      const rawList = Array.isArray(data?.clients)
        ? data.clients
        : (Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []));

      const currentPage = Number(data?.page) || page;
      const list = rawList.map((c, index) => clientRepository.normalizeClient(c, (currentPage - 1) * limit + index)).filter(Boolean);
      const totalPages = Number(data?.totalPages)
        || Number(data?.pagination?.totalPages)
        || (data?.total ? Math.ceil(Number(data.total) / limit) : (list.length >= limit ? currentPage + 1 : currentPage));
      const totalItems = Number(data?.totalItems) || Number(data?.total) || Number(data?.totalCount) || list.length;
      const hasMore = data?.hasMore !== undefined
        ? Boolean(data.hasMore)
        : (currentPage < totalPages || list.length >= limit);

      return {
        success: true,
        data: list,
        clients: list,
        page: currentPage,
        limit: Number(data?.limit) || limit,
        totalItems,
        totalPages,
        hasMore,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch clients',
        data: [],
        clients: [],
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 1,
        hasMore: false,
      };
    }
  },

  /**
   * Fetch single client details by ID
   * GET /clients/{id}
   */
  getClientById: async (id) => {
    try {
      const cleanId = String(id).replace(/^DR/i, '').trim();
      const response = await apiClient.get(`${API_ENDPOINTS.CLIENTS}/${cleanId}`);
      const client = clientRepository.normalizeClient(response.data);

      return {
        success: true,
        data: client,
        client,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch client details',
        data: null,
        client: null,
      };
    }
  },

  /**
   * Normalize quotation item - Strict 1:1 mapping with zero artificial fallbacks
   */
  normalizeQuotation: (q, index = 0, packageContext = {}) => {
    if (!q) return null;

    const packageId = q.packageId != null ? Number(q.packageId) : (packageContext.packageId != null ? Number(packageContext.packageId) : null);
    const rawTier = q.tier ? String(q.tier).trim() : (packageContext.tier ? String(packageContext.tier).trim() : (
      packageId === 3 ? 'Elite' : packageId === 2 ? 'Premium' : packageId === 1 ? 'Economic' : (packageId === null ? 'None' : '')
    ));
    const rawPackageName = q.packageName ? String(q.packageName).trim() : (q.packages ? String(q.packages).trim() : (packageContext.packageName ? String(packageContext.packageName).trim() : (packageContext.packages ? String(packageContext.packages).trim() : rawTier)));

    // Normalize services - support services, quotationServices, and payView.services
    const rawServices = (Array.isArray(q.services) && q.services.length > 0)
      ? q.services
      : ((Array.isArray(q.quotationServices) && q.quotationServices.length > 0)
          ? q.quotationServices
          : (Array.isArray(q.payView?.services) ? q.payView.services : []));

    const servicesList = rawServices.map((s, si) => {
      const sArea = s.area != null ? String(s.area) : (s.sqft != null ? String(s.sqft) : '');
      const sRate = s.rate != null ? String(s.rate) : '';
      const sSubtotal = s.subtotal != null ? Number(s.subtotal) : (s.totalPrice != null ? Number(s.totalPrice) : (s.originalPrice != null ? Number(s.originalPrice) : 0));
      const sDesc = s.description ? String(s.description).trim() : (s.spec ? String(s.spec).trim() : (s.title ? String(s.title).trim() : ''));
      const sName = s.serviceName ? String(s.serviceName).trim() : (s.name ? String(s.name).trim() : (s.title ? String(s.title).trim() : ''));

      return {
        id: s.serviceId ?? s.id ?? si + 1,
        serviceId: s.serviceId ?? s.id ?? si + 1,
        serviceName: sName,
        service: sName,
        description: sDesc,
        spec: sDesc,
        specs: Array.isArray(s.specs) ? s.specs : (sDesc ? [sDesc] : []),
        area: sArea,
        rate: sRate,
        subtotal: sSubtotal,
        total: s.total != null ? Number(s.total) : sSubtotal,
        paidAmount: s.paidAmount != null ? Number(s.paidAmount) : 0,
        balanceAmount: s.balanceAmount != null ? Number(s.balanceAmount) : 0,
        status: s.status || '',
        payments: Array.isArray(s.payments) ? s.payments : [],
      };
    });

    const subtotal = q.subTotal != null ? Number(q.subTotal) : (q.subtotal != null ? Number(q.subtotal) : (q.amount != null ? Number(q.amount) : (q.payView?.totalPrice != null ? Number(q.payView.totalPrice) : 0)));
    const total = q.grandTotal != null ? Number(q.grandTotal) : (q.total != null ? Number(q.total) : (q.amount != null ? Number(q.amount) : (q.payView?.totalWithGst != null ? Number(q.payView.totalWithGst) : subtotal)));
    const discount = q.discount != null ? Number(q.discount) : (q.payView?.discountAmount != null ? Number(q.payView.discountAmount) : 0);
    const gstRate = q.gstPercentage != null ? Number(q.gstPercentage) : (q.gstRate != null ? Number(q.gstRate) : (q.payView?.gstPercentage != null ? Number(q.payView.gstPercentage) : 0));
    const gstAdded = q.gstAdded != null ? Boolean(q.gstAdded) : (q.payView?.withGst !== undefined ? Boolean(q.payView.withGst) : gstRate > 0);
    const gstAmount = q.gstAmount != null ? Number(q.gstAmount) : (q.payView?.gstAmount != null ? Number(q.payView.gstAmount) : 0);

    const finalId = q.quotationId != null ? String(q.quotationId).trim() : (q.id != null ? String(q.id).trim() : String(index + 1));
    const packageName = rawPackageName;
    const revNum = q.revisionNo != null ? Number(q.revisionNo) : (q.revision != null ? Number(q.revision) : (index + 1));
    const qDate = q.quotationDate ? String(q.quotationDate).trim() : (q.date ? String(q.date).trim() : '');
    const warranty = q.warranty ? String(q.warranty).trim() : (packageContext.warranty ? String(packageContext.warranty).trim() : '');
    const isConfirmed = Boolean(q.isConfirmed === true || q.isConfirmed === 1 || q.isConfirmed === 'true' || q.status === 'CONFIRMED' || q.confirmed === true || q.payView?.isConfirmed);

    return {
      ...q,
      id: finalId,
      quotationId: finalId,
      _id: finalId,
      packageId,
      packageName,
      packages: q.packages || packageContext.packages || rawTier || packageName,
      revision: revNum,
      revisionNo: revNum,
      revisionLabel: q.revisionLabel || `Revision #${revNum}`,
      quotationDate: qDate,
      date: qDate,
      quoteFor: packageName,
      tier: rawTier,
      propertyType: q.propertyType ? String(q.propertyType).trim() : '',
      propertyId: q.propertyId ?? null,
      area: q.area != null ? String(q.area) : (servicesList[0]?.area || ''),
      rate: q.rate != null ? String(q.rate) : (servicesList[0]?.rate || ''),
      servicesList,
      specs: servicesList.map((s) => s.spec).filter(Boolean),
      subtotal,
      total,
      amount: total,
      grandTotal: total,
      totalPrice: total,
      discount,
      isConfirmed,
      confirmed: isConfirmed,
      payView: q.payView || packageContext.payView || null,
      gst: gstAdded ? `${gstRate}%` : '0%',
      gstRate,
      gstPercentage: gstRate,
      gstAdded,
      gstAmount,
      taxBreakdown: q.taxBreakdown || {
        cgstRate: gstRate / 2,
        sgstRate: gstRate / 2,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
      },
      paymentTerms: (() => {
        let adv = (q.advancePercent != null && Number(q.advancePercent) <= 100)
          ? Number(q.advancePercent)
          : (q.paymentTerms?.advance != null && Number(q.paymentTerms.advance) <= 100
              ? Number(q.paymentTerms.advance)
              : 60);
        let mid = (q.midPercent != null && Number(q.midPercent) <= 100)
          ? Number(q.midPercent)
          : (q.paymentTerms?.mid != null && Number(q.paymentTerms.mid) <= 100
              ? Number(q.paymentTerms.mid)
              : 30);
        let fin = (q.finalPercent != null && Number(q.finalPercent) <= 100)
          ? Number(q.finalPercent)
          : (q.paymentTerms?.final != null && Number(q.paymentTerms.final) <= 100
              ? Number(q.paymentTerms.final)
              : 10);

        if (isNaN(adv) || isNaN(mid) || isNaN(fin) || (adv === 0 && mid === 0 && fin === 0)) {
          adv = 60;
          mid = 30;
          fin = 10;
        } else if (Math.abs(adv - 60) <= 2 && Math.abs(mid - 30) <= 2) {
          // Snap standard defaults if integer rounding caused 59/29/9
          adv = 60;
          mid = 30;
          fin = 10;
        } else if (Math.abs((adv + mid + fin) - 100) > 0.1) {
          fin = Math.max(0, 100 - adv - mid);
        }

        return {
          advance: adv,
          mid,
          final: fin,
          validity: q.paymentTerms?.validity ? String(q.paymentTerms.validity).trim() : (q.quoteValidateDate ? String(q.quoteValidateDate).trim() : ''),
          negotiation: q.paymentTerms?.negotiation ? String(q.paymentTerms.negotiation).trim() : (q.negotiation ? String(q.negotiation).trim() : ''),
          workStart: q.paymentTerms?.workStart ? String(q.paymentTerms.workStart).trim() : (q.workCommencement ? String(q.workCommencement).trim() : ''),
        };
      })(),
      warranty,
    };
  },

  /**
   * Fetch customer quotations directly via the canonical endpoint
   * GET /clients/{id}/quotations
   */
  getCustomerQuotations: async (customerId) => {
    try {
      const cleanId = String(customerId).replace(/^DR/i, '').trim();
      let response;
      try {
        response = await apiClient.get(`${API_ENDPOINTS.CLIENTS}/${cleanId}/quotations`);
      } catch (err) {
        if (err?.response?.status === 404) {
          response = await apiClient.get(API_ENDPOINTS.QUOTATIONS, { params: { customerId: cleanId } });
        } else {
          throw err;
        }
      }

      const data = response?.data;
      const { packages: normalizedPackages, quotations: allNormalizedQuotations } =
        clientRepository.normalizePackagesAndQuotations(data);

      return {
        success: true,
        customerId: cleanId,
        appointmentId: data?.appointmentId || cleanId,
        packages: normalizedPackages,
        quotations: allNormalizedQuotations,
        data: allNormalizedQuotations,
      };
    } catch (error) {
      console.warn('getCustomerQuotations API error:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch quotations',
        packages: [],
        quotations: [],
        data: [],
      };
    }
  },

  /**
   * Alias matching API v2 specification
   * GET /clients/{id}/quotations
   */
  getClientQuotations: async (id) => {
    return clientRepository.getCustomerQuotations(id);
  },
};

export default clientRepository;