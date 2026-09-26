import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal, MaterialDeleteModal, MaterialDetailSkeleton, MaterialOverlayLoader, MaterialPageLoader, MaterialSuccessModal } from '../../../shared/components/material';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { authRepository } from '../../auth/api/authRepository';
import { clientRepository as clientService } from '../../clients/api/clientRepository';
import { quotationRepository } from '../../quotations/api/quotationRepository';
import { paymentRepository } from '../../payments/api/paymentRepository';
import { quotationPaymentRepository } from '../../payments/api/quotationPaymentRepository';
import SelectQuotationTiersModal from '../../quotations/components/SelectQuotationTiersModal';
import WarrantyTab from '../../warranty/components/WarrantyTab';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';
import { isPastDate } from '../../../core/utils/validation';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { resolveProofImageUrl } from '../../../core/utils/imageUtils';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, copyAsync, downloadAsync } from 'expo-file-system/legacy';
import { generateTaxInvoiceHTML } from '../../payments/screens/ReceiptScreen';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

const TextInput = React.forwardRef((props, ref) => (
  <RNTextInput ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
TextInput.displayName = 'TextInput';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState('master');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    authRepository.getUser().then((u) => {
      if (u) {
        setCurrentUser(u);
        if (u.role) setUserRole(u.role);
      }
    });
  }, []);

  const { handleScroll } = useTabBarScroll();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBack]);

  const isDark = colorScheme === 'dark';
  const isAdminOrMaster = userRole === 'ADMIN' || userRole === 'admin' || userRole === 'master';

  const [clientData, setClientData] = useState(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [apiPackages, setApiPackages] = useState([]);
  const [apiQuotations, setApiQuotations] = useState([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState({
    visible: false,
    title: 'Delete Revision?',
    message: '',
    confirmText: 'Delete',
    onConfirm: null,
    isDeleting: false,
  });

  const saveQuotation = (targetId, updatedQuote) => {
    setClientData(prev => {
      if (!prev) return prev;
      const existingQuots = prev.quotations || [];
      const targetQuoteId = String(updatedQuote.id || updatedQuote.quotationId || '');
      const existingIndex = existingQuots.findIndex((q) => String(q.id || q.quotationId) === targetQuoteId);
      let updatedQuots;
      if (existingIndex >= 0) {
        updatedQuots = [...existingQuots];
        updatedQuots[existingIndex] = { ...existingQuots[existingIndex], ...updatedQuote };
      } else {
        updatedQuots = [...existingQuots, updatedQuote];
      }
      return { ...prev, quotations: updatedQuots, activeQuotationId: updatedQuote.id || prev.activeQuotationId };
    });
  };

  const deleteQuotation = async (appId, quotationId) => {
    try {
      if (quotationId) {
        await quotationRepository.deleteQuotation(quotationId);
      }
    } catch (_e) { }
    setClientData(prev => {
      if (!prev) return prev;
      const filtered = (prev.quotations || []).filter(q => String(q.id) !== String(quotationId) && String(q.quotationId) !== String(quotationId));
      return { ...prev, quotations: filtered, confirmedQuoteId: String(prev.confirmedQuoteId) === String(quotationId) ? null : prev.confirmedQuoteId };
    });
  };

  const deleteAllQuotations = () => {
    setClientData(prev => prev ? { ...prev, quotations: [], confirmedQuoteId: null } : prev);
  };

  const handleConfirmQuotation = async (quotationId) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[API v2] Confirming quotation ${cleanQuoteId}`);
      const result = await quotationRepository.confirmQuotation(cleanQuoteId, true);

      if (!result?.success) {
        let errorTitle = 'Failed to Confirm';
        let errorMessage = result?.message || 'Could not confirm quotation. Please try again.';
        if (result?.statusCode === 403) {
          errorTitle = 'Access Denied';
          errorMessage = 'You do not have permission to confirm this quotation.';
        } else if (result?.statusCode === 404) {
          errorTitle = 'Not Found';
          errorMessage = 'Quotation not found on server.';
        }
        return { success: false, title: errorTitle, message: errorMessage };
      }

      // Update local state
      const confirmedQuote = (quotationsList || []).find(q => String(q.id) === String(quotationId));
      setClientData(prev => prev ? {
        ...prev,
        confirmedQuoteId: quotationId,
        activeQuotationId: quotationId,
        totalPayment: confirmedQuote?.grandTotal || confirmedQuote?.total || prev.totalPayment,
        serviceType: confirmedQuote?.service || confirmedQuote?.packageName || prev.serviceType,
        unlockRequested: false,
        unlockRequestStatus: null,
        quotations: (prev.quotations || []).filter(q => String(q.id) === String(quotationId)),
      } : prev);

      // Re-fetch quotations from server (server automatically deletes unconfirmed drafts for this appointment)
      const cleanAppId = String(params.id || app?.id || '').replace(/^DR/i, '').trim();
      if (cleanAppId) {
        try {
          const quotsRes = await clientService.getCustomerQuotations(cleanAppId);
          if (quotsRes?.success && Array.isArray(quotsRes.quotations)) {
            setApiQuotations(quotsRes.quotations);
          }
        } catch (_fetchErr) {
          // non-blocking
        }
      }

      return { success: true };
    } catch (error) {
      console.warn('Error confirming quotation:', error?.message);
      return { success: false, title: 'Confirmation Error', message: error?.message || 'Failed to confirm quotation.' };
    }
  };

  const handleUnlockQuotation = async (quotationId, showSuccessAlert = false) => {
    try {
      const cleanQuoteId = String(quotationId).replace(/\D/g, '') || quotationId;
      console.log(`[API v2] Unlocking quotation ${cleanQuoteId}`);

      let result = null;
      const isCurrentlyReceiptLocked = Boolean(
        isReceiptLocked ||
        isReceiptGenerated ||
        payView?.isReceiptLocked ||
        payView?.isReceiptGenerated ||
        payView?.receipt?.isReceiptLocked ||
        payView?.receipt?.isReceiptGenerated
      );

      // If quotation is receipt-locked or has an official receipt, use Admin PATCH /api/v2/quotations/:id/receipt-lock
      if (isCurrentlyReceiptLocked) {
        result = await paymentRepository.toggleReceiptLock(cleanQuoteId, false, 'Emergency unlock by Admin');
        if (result?.success) {
          setPayView((prev) => (prev ? {
            ...prev,
            isReceiptLocked: false,
            receiptStatus: 'READY',
            receipt: {
              ...(prev.receipt || {}),
              isReceiptLocked: false,
              receiptStatus: 'READY',
            },
          } : prev));
          setClientData((prev) => (prev ? {
            ...prev,
            isReceiptLocked: false,
            receiptStatus: 'READY',
          } : prev));
        }
      }

      if (!result || !result.success) {
        result = await quotationRepository.unlockQuotation(cleanQuoteId);
      }

      if (!result?.success) {
        let errorTitle = 'Unlock Failed';
        let errorMessage = result?.message || 'Could not unlock quotation. Please try again.';
        if (result?.statusCode === 403) {
          if (result?.message && result.message.toLowerCase().includes('payment')) {
            errorTitle = 'Quotation Locked';
            errorMessage = result.message;
          } else if (result?.message && !['forbidden', 'bad request', 'error'].includes(result.message.trim().toLowerCase())) {
            errorTitle = result.message.toLowerCase().includes('admin') ? 'Admin Access Required' : 'Quotation Locked';
            errorMessage = result.message;
          } else {
            errorTitle = 'Admin Access Required';
            errorMessage = 'Only Admin users can unlock a confirmed quotation. Field staff cannot unlock it directly.';
          }
        } else if (result?.statusCode === 404) {
          errorTitle = 'Not Found';
          errorMessage = result?.message || 'Quotation not found on server.';
        }
        if (showSuccessAlert) {
          showAlert(errorTitle, errorMessage, 'error', 'OK');
        }
        return { success: false, title: errorTitle, message: errorMessage };
      }

      // Update local state, and optimistically clear the lock/confirm flags on the
      // matching quotation inside app.quotations too. Without this, the stale local
      // copy keeps isConfirmed/isLocked/status === 'CONFIRMED' from the initial load,
      // and the Edit button won't flip until a manual refresh replaces app.quotations.
      setClientData(prev => {
        if (!prev) return prev;
        const clearLockFlags = (q) => {
          if (!q) return q;
          const qKey = String(q.id || q.quotationId || '');
          if (qKey !== String(quotationId)) return q;
          return {
            ...q,
            isConfirmed: false,
            isLocked: false,
            status: q.status === 'CONFIRMED' || q.status === 'LOCKED' ? 'DRAFT' : q.status,
          };
        };
        return {
          ...prev,
          confirmedQuoteId: null,
          unlockRequested: false,
          unlockRequestStatus: null,
          quotations: Array.isArray(prev.quotations) ? prev.quotations.map(clearLockFlags) : prev.quotations,
          quotation: prev.quotation ? clearLockFlags(prev.quotation) : prev.quotation,
        };
      });

      // Also clear the same flags on the current apiQuotations snapshot immediately,
      // so the UI reflects the unlock the instant this promise resolves rather than
      // waiting on the (slower, separate) network refetch below.
      setApiQuotations(prev => Array.isArray(prev)
        ? prev.map((q) => {
            const qKey = String(q.id || q.quotationId || '');
            if (qKey !== String(quotationId)) return q;
            return {
              ...q,
              isConfirmed: false,
              isLocked: false,
              status: q.status === 'CONFIRMED' || q.status === 'LOCKED' ? 'DRAFT' : q.status,
            };
          })
        : prev
      );

      // Re-fetch quotations from server (authoritative refresh; will overwrite the
      // optimistic update above once it resolves)
      const cleanAppId = String(params.id || app?.id || '').replace(/^DR/i, '').trim();
      if (cleanAppId) {
        try {
          const quotsRes = await clientService.getCustomerQuotations(cleanAppId);
          if (quotsRes?.success && Array.isArray(quotsRes.quotations)) {
            setApiQuotations(quotsRes.quotations);
          }
        } catch (_fetchErr) {
          // non-blocking
        }
      }

      if (showSuccessAlert) {
        showAlert(
          'Quotation Unlocked',
          'The quotation has been unlocked. You can now select other tiers, edit, or create new revisions.',
          'info',
          'OK'
        );
      }
      return { success: true };
    } catch (error) {
      console.warn('Error unlocking quotation:', error?.message);
      if (showSuccessAlert) {
        showAlert('Unlock Error', error?.message || 'Failed to unlock quotation.', 'error', 'OK');
      }
      return { success: false, title: 'Unlock Error', message: error?.message || 'Failed to unlock quotation.' };
    }
  };


  const requestQuotationUnlock = (appId, quotationId, requestedBy = 'Staff') => {
    const todayStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setClientData(prev => prev ? {
      ...prev,
      unlockRequested: true,
      unlockRequestStatus: 'pending',
      unlockRequestedBy: requestedBy,
      unlockRequestedQuoteId: quotationId,
      unlockRequestedAt: todayStr,
    } : prev);
  };

  const resolveQuotationUnlockRequest = async (appId, approved = true) => {
    if (approved && (app?.confirmedQuoteId || app?.unlockRequestedQuoteId)) {
      const qId = app?.confirmedQuoteId || app?.unlockRequestedQuoteId;
      await handleUnlockQuotation(qId);
    } else {
      setClientData(prev => prev ? {
        ...prev,
        unlockRequested: false,
        unlockRequestStatus: approved ? 'approved' : 'rejected',
      } : prev);
    }
  };

  const updateAppointmentInspection = (appId, inspectionDetails) => {
    setClientData(prev => prev ? { ...prev, ...inspectionDetails } : prev);
  };

  const updateAppointment = async (appId, updatedFields) => {
    setClientData(prev => prev ? { ...prev, ...updatedFields } : prev);
    try {
      await appointmentService.updateAppointment(appId, updatedFields);
    } catch (_e) { }
  };

  const setProjectTotal = (appId, totalPayment, combinedServices, categoryName) => {
    setClientData(prev => prev ? { ...prev, totalPayment, serviceType: combinedServices, chosenCategory: categoryName } : prev);
  };

  const generateWarranty = async (appId, completedDate, validYears, serviceWarranties) => {
    const year = completedDate ? completedDate.split('-')[0] : new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const certificateNo = `DTW-${year}-${randomNum}`;
    const warrantyData = {
      generated: true,
      certificateNo,
      completedDate,
      validYears,
      serviceWarranties: serviceWarranties || [],
    };
    setClientData(prev => prev ? {
      ...prev,
      warranty: warrantyData,
    } : prev);
    try {
      await appointmentService.updateAppointment(appId, { warranty: warrantyData });
    } catch (_e) { }
  };

  const addWarrantyClaim = async (appId, claimDetails) => {
    const claimsList = clientData?.warrantyClaims || [];
    if (claimsList.length >= 2) {
      return { success: false, message: 'Maximum 2 warranty claims allowed for this warranty period.' };
    }
    const newClaim = {
      id: Date.now(),
      issue: claimDetails.issue,
      claimDate: claimDetails.claimDate || new Date().toISOString().split('T')[0],
      status: claimDetails.status || 'Pending',
    };
    const updatedClaims = [...(clientData?.warrantyClaims || []), newClaim];
    setClientData(prev => prev ? {
      ...prev,
      warrantyClaims: updatedClaims,
    } : prev);
    try {
      await appointmentService.updateAppointment(appId, { warrantyClaims: updatedClaims });
    } catch (_e) { }
    return { success: true, message: 'Warranty claim logged successfully.' };
  };

  const addServiceCycle = () => { };

  // Find current appointment or client data
  // Find current appointment or client data
  const app = React.useMemo(() => {
    if (clientData) {
      return clientData;
    }
    return params.id ? { id: params.id, appointmentId: params.id, quotations: [] } : null;
  }, [clientData, params.id]);

  // API v2: PayView state for the payments tab (live blockchain ledger)
  const [payView, setPayView] = useState(null);

  // Unified Additional Payments / Variation Work Orders resolver
  // Merges and normalizes items across payView (additionalPayment, additionalPayments, additionalServices)
  // and appointment/clientData (additionalPayments, additionalPayment)
  const resolvedAdditionalPayments = React.useMemo(() => {
    const list = [];
    const seenIds = new Set();

    const addItems = (items, source) => {
      if (!items) return;
      const arr = Array.isArray(items) ? items : (typeof items === 'object' ? [items] : []);
      arr.forEach((item, idx) => {
        if (!item) return;
        const rawId = item.id || item._id;
        const key = rawId != null ? String(rawId) : `${source}_${idx}`;
        if (seenIds.has(key)) return;

        const totalPrice = Number(item.totalPrice ?? item.amount ?? item.price ?? item.cost ?? 0);
        const paidAmount = Number(
          item.paidAmount ??
          (item.status === 'paid' || item.status === 'COMPLETED' || item.isPaid
            ? totalPrice
            : (Array.isArray(item.payments) && item.payments.length > 0
                ? item.payments.reduce((acc, p) => acc + Number(p?.amount || 0), 0)
                : 0))
        );
        const balanceAmount = Number(
          item.balanceAmount ?? Math.max(0, totalPrice - paidAmount)
        );
        const title = item.title || item.workDescription || item.description || item.name || item.serviceName || `Variation ${list.length + 1}`;

        if (item.id || (title && String(title).trim() !== '') || totalPrice > 0 || paidAmount > 0) {
          seenIds.add(key);

          // Normalize payments receipts array
          let payments = [];
          if (Array.isArray(item.payments) && item.payments.length > 0) {
            payments = item.payments;
          } else if (paidAmount > 0 || item.status === 'paid' || item.voucherNumber || item.transactionId) {
            payments = [{
              id: item.paymentId || item.id || `pay_${key}`,
              amount: paidAmount > 0 ? paidAmount : totalPrice,
              paymentMethod: item.paymentMethod || item.method || 'CASH',
              voucher: item.voucherNumber || item.voucher || item.transactionId || item.upiId || (rawId ? String(rawId).slice(0, 8) : 'N/A'),
              createdAt: item.paymentDate || item.date || item.createdAt || new Date().toISOString(),
              isVerified: item.isVerified !== undefined ? Boolean(item.isVerified) : true,
              proofImageUrl: item.document || item.proofImageUrl || item.proofImage || null,
            }];
          }

          list.push({
            ...item,
            id: item.id || key,
            title,
            totalPrice,
            paidAmount,
            balanceAmount,
            sqft: item.sqft || item.area || 0,
            rate: item.rate || (item.sqft > 0 && totalPrice > 0 ? Math.round(totalPrice / item.sqft) : null),
            status: item.status || (balanceAmount <= 0 && totalPrice > 0 ? 'COMPLETED' : 'PENDING'),
            payments,
          });
        }
      });
    };

    addItems(payView?.additionalPayment, 'pv_add');
    addItems(payView?.additionalPayments, 'pv_adds');
    addItems(payView?.additionalServices, 'pv_services');
    addItems(app?.additionalPayments, 'app_adds');
    addItems(app?.additionalPayment, 'app_add');
    addItems(clientData?.additionalPayments, 'cd_adds');
    addItems(clientData?.additionalPayment, 'cd_add');

    return list;
  }, [payView, app, clientData]);
  const [isLoadingPayView, setIsLoadingPayView] = useState(false);
  const payViewRef = React.useRef(payView);
  payViewRef.current = payView;
  const payViewIdRef = React.useRef(null);
  const activeTabSectionRef = React.useRef('profile');
  const isFetchingPayViewRef = React.useRef(false);
  const isFetchingCustomerDataRef = React.useRef(false);
  const isFetchingQuotationsRef = React.useRef(false);
  const hasLoadedQuotationsRef = React.useRef(false);
  const isFirstFocusRef = React.useRef(true);
  const prevTabRef = React.useRef(null);

  const appRef = React.useRef(app);
  appRef.current = app;

  const apiQuotationsRef = React.useRef(apiQuotations);
  apiQuotationsRef.current = apiQuotations;

  useEffect(() => {
    if (payView?.id) {
      payViewIdRef.current = String(payView.id);
    }
  }, [payView?.id]);

  // Fetch quotations strictly for the Quotation tab on demand
  const fetchCustomerQuotations = useCallback(async (force = false) => {
    const targetId = params.id;
    if (!targetId) return;
    if (isFetchingQuotationsRef.current) return;
    if (!force && hasLoadedQuotationsRef.current && apiQuotationsRef.current.length > 0) return;

    isFetchingQuotationsRef.current = true;
    setIsLoadingQuotations(true);
    const cleanId = String(targetId).replace(/^DR/i, '').trim();

    try {
      const quotsRes = await clientService.getCustomerQuotations(cleanId);
      if (quotsRes && quotsRes.success) {
        hasLoadedQuotationsRef.current = true;
        if (Array.isArray(quotsRes.packages)) {
          setApiPackages(quotsRes.packages);
        }
        if (Array.isArray(quotsRes.quotations)) {
          setApiQuotations(quotsRes.quotations);
          const confirmedQ = quotsRes.quotations.find(
            (q) =>
              q.isConfirmed === true ||
              q.isConfirmed === 1 ||
              q.isConfirmed === 'true' ||
              q.status === 'CONFIRMED' ||
              q.status === 'confirmed' ||
              q.confirmed === true
          );
          if (confirmedQ) {
            setClientData((prev) =>
              prev
                ? {
                    ...prev,
                    confirmedQuoteId: confirmedQ.id,
                    activeQuotationId: confirmedQ.id,
                    totalPayment: confirmedQ.grandTotal || confirmedQ.total || prev.totalPayment,
                  }
                : prev
            );
            fetchPayView(confirmedQ.id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load customer quotations from API:', err?.message);
    } finally {
      setIsLoadingQuotations(false);
      isFetchingQuotationsRef.current = false;
    }
  }, [params.id]);

  // API v2: Fetch fresh PayView from API for payments & quotation tabs (strictly on demand)
  const fetchPayView = useCallback(async (quoteIdOverride = null, force = false) => {
    // If not on payment tab or quotation tab, skip unless explicit quoteIdOverride is provided
    if (activeTabSectionRef.current !== 'payment' && activeTabSectionRef.current !== 'quotation' && !quoteIdOverride) {
      return null;
    }

    if (isFetchingPayViewRef.current) return null;

    const currentApp = appRef.current;
    const currentApiQuots = apiQuotationsRef.current;
    const cleanParamId = params.id ? String(params.id).replace(/^DR/i, '').trim() : null;
    const confirmedQuoteId =
      quoteIdOverride ||
      params.quotationId ||
      currentApp?.confirmedQuoteId ||
      currentApp?.activeQuotationId ||
      currentApp?.quotationId ||
      currentApp?.payView?.id ||
      payViewRef.current?.id ||
      (Array.isArray(currentApp?.quotations) && (
        currentApp.quotations.find((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.status === 'confirmed' || q.confirmed)?.id ||
        currentApp.quotations.find((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.status === 'confirmed' || q.confirmed)?.quotationId ||
        (currentApp.quotations.length === 1 ? (currentApp.quotations[0].id || currentApp.quotations[0].quotationId) : null)
      )) ||
      (Array.isArray(currentApiQuots) && (
        currentApiQuots.find((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.status === 'confirmed' || q.confirmed)?.id ||
        currentApiQuots.find((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.status === 'confirmed' || q.confirmed)?.quotationId ||
        (currentApiQuots.length === 1 ? (currentApiQuots[0].id || currentApiQuots[0].quotationId) : null)
      )) ||
      payViewIdRef.current ||
      (cleanParamId && !isNaN(Number(cleanParamId)) ? cleanParamId : null);

    if (!confirmedQuoteId) return null;

    // Return existing payView if already loaded and not forced
    if (!force && payViewRef.current && (!confirmedQuoteId || String(payViewRef.current.id) === String(confirmedQuoteId))) {
      return payViewRef.current;
    }

    isFetchingPayViewRef.current = true;
    setIsLoadingPayView(true);
    try {
      // Use the new quotation-payments summary endpoint (canonical for the Payments tab)
      const res = await paymentRepository.getPaymentSummary(String(confirmedQuoteId));
      if (res?.success && res.data) {
        const summaryData = res.data;
        // Normalize so existing payView consumers (history, progress, pricing) work
        // The new API returns { quotationId, pricing, progress, history, gstDecision, ... }
        const normalized = {
          id: summaryData.quotationId || confirmedQuoteId,
          quotationId: summaryData.quotationId || confirmedQuoteId,
          ...summaryData,
          // Map new API fields to legacy consumers
          totalPrice: summaryData.pricing?.withoutGstTotal ?? summaryData.pricing?.subTotal,
          totalWithGst: summaryData.pricing?.withGstTotal,
          totalPaid: summaryData.progress?.totalPaid,
          balanceAmount: summaryData.progress?.withoutGstBalance,
          // history is already present in new API
          payments: summaryData.history || [],
          additionalServices: summaryData.additionalServices || summaryData.quotation?.additionalServices || (Array.isArray(summaryData.additionalPayment) ? summaryData.additionalPayment : summaryData.additionalPayment ? [summaryData.additionalPayment] : []),
          additionalPayment: summaryData.additionalPayment || summaryData.additionalServices || [],
        };
        payViewIdRef.current = String(confirmedQuoteId);
        payViewRef.current = normalized;
        setPayView(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Failed to fetch payment summary from API:', err?.message);
    } finally {
      setIsLoadingPayView(false);
      isFetchingPayViewRef.current = false;
    }
    return null;
  }, [params.quotationId, params.id]);

  // Load customer profile data strictly (no unwanted extra tab calls)
  const loadCustomerData = useCallback(async () => {
    const targetId = params.id;
    if (!targetId) {
      setIsLoadingClient(false);
      return;
    }
    if (isFetchingCustomerDataRef.current) return;
    isFetchingCustomerDataRef.current = true;

    setIsLoadingClient(true);
    const cleanId = String(targetId).replace(/^DR/i, '').trim();

    try {
      const clientRes = await clientService.getClientById(cleanId);
      if (clientRes && clientRes.success && clientRes.data) {
        const client = clientRes.data;
        setClientData(client);

        if (Array.isArray(client.packages) && client.packages.length > 0) {
          setApiPackages(client.packages);
        }
        if (Array.isArray(client.quotations) && client.quotations.length > 0) {
          setApiQuotations(client.quotations);
          hasLoadedQuotationsRef.current = true;
        }
        const activePv = client.payView || clientRes.payView || (Array.isArray(client.quotations) ? client.quotations.find(q => q.isConfirmed)?.payView : null);
        if (activePv && (activePv.id || activePv.quotationId)) {
          const pvWithId = activePv.id ? activePv : { ...activePv, id: activePv.quotationId };
          setPayView(pvWithId);
          payViewRef.current = pvWithId;
          payViewIdRef.current = String(pvWithId.id);
        } else {
          const confirmedQId =
            client.confirmedQuoteId ||
            client.activeQuotationId ||
            (Array.isArray(client.quotations) ? client.quotations.find(q => q.isConfirmed)?.id : null);
          if (confirmedQId) {
            fetchPayView(confirmedQId);
          }
        }
      } else {
        const appRes = await appointmentService.getAppointmentById(cleanId);
        if (appRes && appRes.success && appRes.appointment) {
          setClientData(appRes.appointment);
          const confirmedQId = appRes.appointment.confirmedQuoteId || appRes.appointment.activeQuotationId;
          if (confirmedQId) {
            fetchPayView(confirmedQId);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load client details from API:', err?.message);
    } finally {
      setIsLoadingClient(false);
      isFetchingCustomerDataRef.current = false;
    }
  }, [params.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCustomerData();
      if (activeTabSectionRef.current === 'quotation') {
        await fetchCustomerQuotations(true);
      } else if (activeTabSectionRef.current === 'payment') {
        await fetchPayView(null, true);
      }
    } catch (err) {
      console.warn('CustomerDetailScreen refresh error:', err?.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Load customer data strictly ONCE when screen mounts or params.id changes
  const prevIdRef = React.useRef(params.id);
  useEffect(() => {
    if (prevIdRef.current !== params.id) {
      prevIdRef.current = params.id;
      setPayView(null);
      payViewRef.current = null;
      payViewIdRef.current = null;
      hasLoadedQuotationsRef.current = false;
      prevTabRef.current = null;
    }
    loadCustomerData();
  }, [loadCustomerData, params.id]);

  // When returning to this screen after recording a payment, refresh customer data and payView
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadCustomerData();
      if (activeTabSectionRef.current === 'payment' || activeTabSectionRef.current === 'quotation') {
        fetchPayView(null, true);
      }
    }, [fetchPayView, loadCustomerData])
  );

  // Stitch Payment Details Modal state
  const [selectedPaymentDetailModal, setSelectedPaymentDetailModal] = useState(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [sharingPaymentId, setSharingPaymentId] = useState(null);
  // Stitch Activate Warranty Modal state
  const [showStitchWarrantyModal, setShowStitchWarrantyModal] = useState(false);
  const [warrantyStartDate, setWarrantyStartDate] = useState(() => {
    return formatDateDDMMYY(new Date());
  });
  const [showWarrantyDatePicker, setShowWarrantyDatePicker] = useState(false);
  const [warrantyDateObj, setWarrantyDateObj] = useState(new Date());

  // Date and Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateValue, setDateValue] = useState(new Date());
  const [timeValue, setTimeValue] = useState(new Date());

  const [attendedDate, setAttendedDate] = useState('');
  const [attendedTime, setAttendedTime] = useState('');
  const [isSavingSiteDetails, setIsSavingSiteDetails] = useState(false);
  const [isLocallySaved, setIsLocallySaved] = useState(false);
  const [siteSuccessModal, setSiteSuccessModal] = useState({ visible: false, title: '', message: '' });
  const [alertModalConfig, setAlertModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'lock',
    buttonText: 'Got It',
  });
  const [totalArea, setTotalArea] = useState('');

  const [lockConfirmModal, setLockConfirmModal] = useState({
    visible: false,
    actionType: 'lock', // 'lock' | 'unlock' | 'switch'
    title: '',
    message: '',
    warningNote: '',
    quoteId: null,
    confirmText: 'Confirm & Lock',
    cancelText: 'Cancel',
  });
  const [isLockActionLoading, setIsLockActionLoading] = useState(false);

  const showAlert = (title, message, type = 'lock', buttonText = 'Got It') => {
    setAlertModalConfig({
      visible: true,
      title,
      message,
      type,
      buttonText,
    });
  };

  // Select Quotation Tiers Modal State & Handlers
  const [isSelectTiersModalVisible, setIsSelectTiersModalVisible] = useState(false);
  const [modalInitialTiers, setModalInitialTiers] = useState(['economic', 'premium', 'elite']);

  const handleOpenSelectTiersModal = (tiers = ['economic', 'premium', 'elite']) => {
    const existingSet = new Set((existingQuoteTiers || []).map((t) => String(t).toLowerCase().trim()));
    const available = ['economic', 'premium', 'elite'].filter((t) => !existingSet.has(t));

    if (available.length === 0) {
      Alert.alert(
        'All Tiers Created',
        'Quotations for all available tiers (Economic, Premium, and Elite) have already been created for this project. You can edit an existing quotation or create a new revision directly from the quotation card.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Only set initial tiers to available ones so existing tiers are not pre-checked
    const filteredTiers = tiers.filter((t) => !existingSet.has(String(t).toLowerCase().trim()));
    const targetTiers = filteredTiers.length > 0 ? filteredTiers : available;

    if (app?.confirmedQuoteId) {
      if (isAdminOrMaster) {
        Alert.alert(
          'Project Locked',
          'A quotation is currently confirmed and locked for this project. Do you want to unlock it to create a new quotation?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unlock & Create',
              onPress: async () => {
                const ok = await handleUnlockQuotation(app.confirmedQuoteId, false);
                if (ok?.success) {
                  setModalInitialTiers(targetTiers);
                  setIsSelectTiersModalVisible(true);
                } else if (ok && !ok.success) {
                  showAlert(ok.title || 'Quotation Locked', ok.message || 'Cannot unlock quotation.', 'error', 'OK');
                }
              },
            },
          ]
        );
      } else {
        showAlert('Quotation Locked 🔒', 'This quotation is confirmed and locked. Only Admin can unlock it.', 'lock', 'OK');
      }
    } else {
      setModalInitialTiers(targetTiers);
      setIsSelectTiersModalVisible(true);
    }
  };

  const handleConfirmSelectTiers = (chosenTiers) => {
    setIsSelectTiersModalVisible(false);
    const existingSet = new Set((existingQuoteTiers || []).map((t) => String(t).toLowerCase().trim()));
    const validChosen = (chosenTiers || []).filter((t) => !existingSet.has(String(t).toLowerCase().trim()));
    if (validChosen.length === 0) return;

    router.push({
      pathname: '/make-quotation',
      params: {
        id: app.id,
        customerName: app?.customerName || app?.clientName,
        phone: app?.mobileNumber || app?.phone,
        selectedTiers: validChosen.join(','),
        existingTiers: (existingQuoteTiers || []).join(','),
        tier: validChosen[0],
        totalArea: totalArea || app?.totalArea,
        ts: Date.now(),
      },
    });
  };

  const [showStatusModal, setShowStatusModal] = useState(false);
  const initialProjectStatus = app?.projectStatus || (app?.siteVisited ? 'Site Visited' : 'Site Visit Pending');
  const [projectStatus, setProjectStatus] = useState(initialProjectStatus);

  useEffect(() => {
    if (app) {
      const current = app.projectStatus || (app.siteVisited ? 'Site Visited' : 'Site Visit Pending');
      setProjectStatus(current);
    }
  }, [app?.id, app?.projectStatus, app?.siteVisited]);

  const STATUS_OPTIONS = [
    'Site Visit Pending',
    'Site Visited',
    'Quotation Waiting',
    'Quotation Sent',
    'Job Started',
    'Bill Cleared'
  ];

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Site Visit Pending':
        return { bg: '#EF4444', text: '#FFFFFF', icon: 'time-outline' };
      case 'Site Visited':
        return { bg: '#10B981', text: '#FFFFFF', icon: 'checkmark-circle' };
      case 'Quotation Waiting':
        return { bg: '#F59E0B', text: '#FFFFFF', icon: 'hourglass-outline' };
      case 'Quotation Sent':
        return { bg: '#2563EB', text: '#FFFFFF', icon: 'send-outline' };
      case 'Job Started':
        return { bg: '#8B5CF6', text: '#FFFFFF', icon: 'construct-outline' };
      case 'Bill Cleared':
        return { bg: '#059669', text: '#FFFFFF', icon: 'receipt-outline' };
      default:
        return { bg: '#10B981', text: '#FFFFFF', icon: 'checkmark-circle' };
    }
  };

  // Category Popup Modal and Payment choice states
  const [activeCategoryModal, setActiveCategoryModal] = useState(null); // 'Basic' | 'Mid' | 'Luxury'
  const [chosenCategory, setChosenCategory] = useState(null);
  const [editingServiceIndex, setEditingServiceIndex] = useState(null);
  const [editRateVal, setEditRateVal] = useState('');
  const [editAreaVal, setEditAreaVal] = useState('');

  // Warranty Claim Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimIssueText, setClaimIssueText] = useState('');

  // Warranty Duration Modal State
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [serviceDurations, setServiceDurations] = useState({}); // { serviceIndex: durationString }

  // Tab Lock & Gating Conditions
  const isInitialPaymentReceived = Boolean(
    app?.initialPaymentReceived ||
    app?.initialPaid ||
    app?.midPaid ||
    app?.finalPaid ||
    app?.fullPaid ||
    (payView?.totalPaid && Number(payView.totalPaid) > 0) ||
    (payView?.progress?.totalPaid && Number(payView.progress.totalPaid) > 0) ||
    (Array.isArray(payView?.payments) && payView.payments.length > 0) ||
    (Array.isArray(payView?.history) && payView.history.length > 0) ||
    (Array.isArray(app?.quotations) && app.quotations.some((q) => Number(q.totalPaid || q.progress?.totalPaid || q.receivedAmount || q.payment?.totalPaid || q.payment?.progress?.totalPaid || 0) > 0 || (Array.isArray(q.payments) && q.payments.length > 0) || (Array.isArray(q.payment?.history) && q.payment.history.length > 0))) ||
    (Array.isArray(apiQuotations) && apiQuotations.some((q) => Number(q.totalPaid || q.progress?.totalPaid || q.receivedAmount || q.payment?.totalPaid || q.payment?.progress?.totalPaid || 0) > 0 || (Array.isArray(q.payments) && q.payments.length > 0) || (Array.isArray(q.payment?.history) && q.payment.history.length > 0))) ||
    (Array.isArray(quotationsList) && quotationsList.some((q) => Number(q.totalPaid || q.progress?.totalPaid || q.receivedAmount || q.payment?.totalPaid || q.payment?.progress?.totalPaid || 0) > 0 || (Array.isArray(q.payments) && q.payments.length > 0) || (Array.isArray(q.payment?.history) && q.payment.history.length > 0) || q.paymentStatus === 'PARTIALLY_PAID' || q.paymentStatus === 'FULLY_PAID' || q.payment?.progress?.paymentStatus === 'PARTIALLY_PAID' || q.payment?.progress?.paymentStatus === 'FULLY_PAID'))
  );

  const isAttendedLocked = Boolean(
    isLocallySaved ||
    isInitialPaymentReceived ||
    (app?.attendedDate && app?.attendedTime && app.attendedDate !== 'Not Set') ||
    Boolean(app?.appointmentAttend?.date && app?.appointmentAttend?.time) ||
    app?.siteVisited === true
  );

  const isQuotationConfirmed = Boolean(
    app?.confirmedQuoteId ||
    app?.activeQuotationId ||
    payView?.isConfirmed ||
    (payView?.id && (payView?.isConfirmed || Number(payView?.receivedAmount || 0) > 0)) ||
    (Array.isArray(app?.quotations) &&
      app.quotations.some((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.isLocked)) ||
    (app?.quotation &&
      (app.quotation.isConfirmed || app.quotation.status === 'CONFIRMED' || app.quotation.isLocked)) ||
    (Array.isArray(apiQuotations) &&
      apiQuotations.some((q) => q.isConfirmed || q.status === 'CONFIRMED' || q.isLocked)) ||
    isInitialPaymentReceived
  );

  const isReceiptGenerated = Boolean(
    payView?.isReceiptGenerated ||
    payView?.receipt?.isReceiptGenerated ||
    payView?.receiptStatus === 'GENERATED' ||
    payView?.receipt?.receiptStatus === 'GENERATED' ||
    payView?.fullReceiptGenerated ||
    payView?.receiptNumber ||
    payView?.receipt?.receiptNumber ||
    app?.isReceiptGenerated ||
    app?.fullReceiptGenerated ||
    app?.receiptNumber
  );

  const isReceiptLocked = Boolean(
    payView?.isReceiptLocked ||
    payView?.receipt?.isReceiptLocked ||
    app?.isReceiptLocked ||
    (isReceiptGenerated && payView?.receiptStatus !== 'READY')
  );

  // True when a final payment (isFinalPayment: true) has been submitted for the active quotation.
  // Once final payment is made, no additional services can be added.
  const isFinalPaymentMade = Boolean(
    payView?.progress?.paymentStatus === 'FULLY_PAID' ||
    (Array.isArray(payView?.history) && payView.history.some((p) => p.isFinalPayment === true)) ||
    (Array.isArray(quotationsList) && quotationsList.some((q) =>
      Array.isArray(q.payment?.history) && q.payment.history.some((p) => p.isFinalPayment === true)
    ))
  );

  const canGenerateReceipt = Boolean(
    payView?.canGenerateReceipt ??
    payView?.receipt?.canGenerateReceipt ??
    (payView?.receiptStatus === 'READY' || payView?.receipt?.receiptStatus === 'READY')
  );

  const receiptStatus =
    payView?.receiptStatus ||
    payView?.receipt?.receiptStatus ||
    (isReceiptGenerated ? 'GENERATED' : (canGenerateReceipt ? 'READY' : 'PENDING'));

  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  // Active section tab anchor focus
  const getInitialTab = useCallback((tabParam) => {
    if (tabParam === 'quotation' || tabParam === 'quotations') return isAttendedLocked ? 'quotation' : 'profile';
    if (tabParam === 'payment' || tabParam === 'payments') return isQuotationConfirmed ? 'payment' : 'profile';
    if (tabParam === 'warranty' || tabParam === 'warranties') return isQuotationConfirmed ? 'warranty' : 'profile';
    return 'profile';
  }, [isAttendedLocked, isQuotationConfirmed]);

  const [activeTabSection, setActiveTabSection] = useState(getInitialTab(params.initialTab || params.tab));
  const hasAppliedInitialTabRef = React.useRef(false);

  useEffect(() => {
    const rawTab = params.initialTab || params.tab;
    if (rawTab && !hasAppliedInitialTabRef.current) {
      const targetTab = getInitialTab(rawTab);
      if (targetTab !== 'profile' || rawTab === 'profile') {
        setActiveTabSection(targetTab);
        hasAppliedInitialTabRef.current = true;
      }
    }
  }, [params.initialTab, params.tab, getInitialTab]);

  // If active tab becomes locked due to data update, fall back safely
  useEffect(() => {
    if (activeTabSection === 'quotation' && !isAttendedLocked) {
      setActiveTabSection('profile');
    } else if (activeTabSection === 'payment' && !isQuotationConfirmed) {
      setActiveTabSection(isAttendedLocked ? 'quotation' : 'profile');
    } else if (activeTabSection === 'warranty' && !isQuotationConfirmed) {
      setActiveTabSection(isAttendedLocked ? 'quotation' : 'profile');
    }
  }, [activeTabSection, isAttendedLocked, isQuotationConfirmed]);
  // On tab switch: keep ref in sync and lazy-load tab-specific data strictly once when active tab changes
  useEffect(() => {
    activeTabSectionRef.current = activeTabSection;

    if (prevTabRef.current !== activeTabSection) {
      prevTabRef.current = activeTabSection;

      if (activeTabSection === 'quotation') {
        fetchCustomerQuotations();
        fetchPayView();
      } else if (activeTabSection === 'payment') {
        fetchPayView();
      }
    }
  }, [activeTabSection, fetchCustomerQuotations, fetchPayView]);

  const [expandedServiceReceipts, setExpandedServiceReceipts] = useState({});
  const [showFullReceiptModal, setShowFullReceiptModal] = useState(false);
  const [fullReceiptStep, setFullReceiptStep] = useState('options'); // 'options' | 'without_gst'
  const [gstNumberInput, setGstNumberInput] = useState('');

  const handleOpenFullReceiptModal = () => {
    setFullReceiptStep('options');
    setGstNumberInput(app?.gstNumber || app?.gstin || '');
    setShowFullReceiptModal(true);
  };

  const handleOpenFullReceiptWithGstModal = () => {
    setFullReceiptStep('with_gst_receipt');
    setGstNumberInput(app?.gstNumber || app?.gstin || '');
    setShowFullReceiptModal(true);
  };

  const toggleServiceReceipts = (serviceKey) => {
    setExpandedServiceReceipts((prev) => ({
      ...prev,
      [serviceKey]: !prev[serviceKey],
    }));
  };

  const toggleAllServiceReceipts = () => {
    const allKeys = [
      ...(Array.isArray(payView?.services) ? payView.services.map((s, i) => s.id || `svc_${i}`) : []),
      ...resolvedAdditionalPayments.map((s, i) => s.id || `add_${i}`),
      'gst_clearance',
    ];
    const isAnyCollapsed = allKeys.some((k) => !expandedServiceReceipts[k]);
    const nextMap = {};
    allKeys.forEach((k) => {
      nextMap[k] = isAnyCollapsed;
    });
    setExpandedServiceReceipts(nextMap);
  };

  const handleAdminVerifyPayment = async (paymentItem) => {
    if (!paymentItem) return;
    const confirmedQuoteId =
      paymentItem.quotationId ||
      payView?.id ||
      payView?.quotationId ||
      app?.confirmedQuoteId ||
      app?.activeQuotationId ||
      null;
    const paymentId = paymentItem.id || paymentItem.details?.id;

    if (!paymentId) {
      showAlert('Missing Identifier', 'Could not locate payment reference ID.', 'OK');
      return;
    }
    if (!confirmedQuoteId) {
      showAlert('Missing Quotation', 'Could not determine quotation ID for verification.', 'OK');
      return;
    }

    setIsVerifyingPayment(true);
    try {
      // Use the new quotation-payments verify endpoint
      const res = await quotationPaymentRepository.verifyPayment(
        String(confirmedQuoteId),
        String(paymentId),
        'Verified against proof / voucher'
      );

      if (res?.success) {
        const verifiedBy = res.data?.verifiedBy || (currentUser?.name ? `${currentUser.name} (Admin)` : 'Admin');
        const verifiedAt = res.data?.verifiedAt || new Date().toISOString();

        // 1. Optimistically update local payView history so the UI reflects verification immediately
        setPayView((prevPayView) => {
          if (!prevPayView) return prevPayView;
          const updated = { ...prevPayView };
          if (Array.isArray(updated.history)) {
            updated.history = updated.history.map((p) => {
              if (String(p.id) === String(paymentId)) {
                return { ...p, isVerified: true, verifiedBy, verifiedAt };
              }
              return p;
            });
          }
          if (Array.isArray(updated.payments)) {
            updated.payments = updated.payments.map((p) => {
              if (String(p.id) === String(paymentId)) {
                return { ...p, isVerified: true, verifiedBy, verifiedAt };
              }
              return p;
            });
          }
          // Update hasUnverifiedPayments flag optimistically
          const remainingUnverified = (updated.history || updated.payments || []).some(
            (p) => p.isVerified === false || p.verificationStatus === 'pending'
          );
          updated.hasUnverifiedPayments = remainingUnverified;
          return updated;
        });

        // 2. Update selectedPaymentDetailModal state immediately
        setSelectedPaymentDetailModal((prev) =>
          prev
            ? {
                ...prev,
                isVerified: true,
                verifiedBy,
                verifiedAt,
                details: { ...prev.details, isVerified: true, verifiedBy, verifiedAt },
              }
            : null
        );

        // 3. Re-fetch payment summary from backend to ensure complete sync
        paymentRepository.getPaymentSummary(String(confirmedQuoteId)).then((pvRes) => {
          if (pvRes?.success && pvRes.data) {
            const summaryData = pvRes.data;
            const normalized = {
              id: summaryData.quotationId || confirmedQuoteId,
              quotationId: summaryData.quotationId || confirmedQuoteId,
              ...summaryData,
              totalPrice: summaryData.pricing?.withoutGstTotal ?? summaryData.pricing?.subTotal,
              totalWithGst: summaryData.pricing?.withGstTotal,
              totalPaid: summaryData.progress?.totalPaid,
              balanceAmount: summaryData.progress?.withoutGstBalance,
              payments: summaryData.history || [],
            };
            setPayView(normalized);
            payViewRef.current = normalized;
          }
        }).catch(() => {});

        showAlert(
          'Payment Verified!',
          'The payment has been successfully approved by Admin. View Receipt and Share options are now unlocked for all staff.',
          'Done'
        );
      } else {
        showAlert('Verification Failed', res?.message || 'Could not verify payment. Please try again.', 'OK');
      }
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to verify payment', 'OK');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleViewReceipt = (pay) => {
    if (!pay) return;
    const targetQuoteId =
      pay.quotationId ||
      payView?.quotationId ||
      payView?.id ||
      app?.confirmedQuoteId ||
      app?.activeQuotationId ||
      (Array.isArray(quotationsList) && quotationsList[0]?.id) ||
      '';
    const resolvedServiceTitle =
      pay.title ||
      pay.stage ||
      payView?.quotationTitle ||
      app?.service ||
      app?.serviceType ||
      `Payment ${pay.id}`;

    router.push({
      pathname: '/receipt',
      params: {
        id: app?.id || params.id,
        quotationId: targetQuoteId ? String(targetQuoteId) : '',
        paymentId: String(pay.id),
        milestone: String(pay.id),
        receiptNumber: pay.receiptNumber || pay.voucher || `DRT${pay.id}`,
        amount: String(pay.amount || ''),
        voucher: pay.voucher || pay.referenceNumber || '',
        method: pay.paymentMethod || pay.method || '',
        date: pay.paymentDate || pay.createdAt || '',
        stage: pay.stage || pay.title || `Payment ${pay.id}`,
        serviceTitle: resolvedServiceTitle,
        isFullServiceReceipt: 'false',
      },
    });
  };

  const handleShareReceiptPdf = async (pay) => {
    if (!pay) return;
    try {
      setSharingPaymentId(pay.id);
      const targetQuoteId =
        pay.quotationId ||
        payView?.quotationId ||
        payView?.id ||
        app?.confirmedQuoteId ||
        app?.activeQuotationId ||
        (Array.isArray(quotationsList) && quotationsList[0]?.id) ||
        '';
      const resolvedServiceTitle =
        pay.title ||
        pay.stage ||
        payView?.quotationTitle ||
        app?.service ||
        app?.serviceType ||
        `Payment ${pay.id}`;

      const receiptParams = {
        id: app?.id || params.id,
        quotationId: targetQuoteId ? String(targetQuoteId) : '',
        paymentId: String(pay.id),
        milestone: String(pay.id),
        receiptNumber: pay.receiptNumber || pay.voucher || `DRT${pay.id}`,
        amount: String(pay.amount || ''),
        voucher: pay.voucher || pay.referenceNumber || '',
        method: pay.paymentMethod || pay.method || '',
        date: pay.paymentDate || pay.createdAt || '',
        stage: pay.stage || pay.title || `Payment ${pay.id}`,
        serviceTitle: resolvedServiceTitle,
        isFullServiceReceipt: 'false',
      };

      const customerGst =
        payView?.customerGstNumber ||
        payView?.customer?.gstNumber ||
        app?.gstNumber ||
        app?.gstin ||
        '';

      const html = generateTaxInvoiceHTML(app, customerGst, null, receiptParams, payView);
      const { uri } = await Print.printToFileAsync({ html });
      const invoiceNo = pay.receiptNumber || pay.voucher || `DRT${pay.id}`;
      const safeInvoiceName = String(invoiceNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeClientName = String(app?.customerName || app?.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const namedUri = `${cacheDirectory}Receipt_${safeInvoiceName}_${safeClientName}.pdf`;

      try {
        await copyAsync({ from: uri, to: namedUri });
      } catch (_e) {
        // fallback to uri if copy fails
      }

      const shareUri = namedUri || uri;
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Payment Receipt - ${invoiceNo}`,
        UTI: Platform.OS === 'ios' ? 'com.adobe.pdf' : undefined,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to share receipt: ' + err.message);
    } finally {
      setSharingPaymentId(null);
    }
  };

  const handleShareProofDoc = async (pay) => {
    if (!pay) return;
    try {
      setSharingPaymentId(pay.id);
      const rawProof = pay.proofImageUrl || pay.proofImage || pay.proof || pay.document;
      const resolvedUrl = resolveProofImageUrl(rawProof);
      if (!resolvedUrl) {
        Alert.alert('No Document', 'No proof document is attached to this payment.');
        return;
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      let shareUri = resolvedUrl;
      if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        const ext = resolvedUrl.toLowerCase().endsWith('.pdf') ? '.pdf' : '.jpg';
        const localTarget = `${cacheDirectory}PaymentProof_${pay.id}${ext}`;
        const downloadResult = await downloadAsync(resolvedUrl, localTarget);
        shareUri = downloadResult.uri;
      }

      await Sharing.shareAsync(shareUri, {
        dialogTitle: `Payment Proof - Payment #${pay.id}`,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to share proof document: ' + err.message);
    } finally {
      setSharingPaymentId(null);
    }
  };

  const handleShareDocument = (pay) => {
    if (!pay) return;
    const hasProof = Boolean(pay.proofImageUrl || pay.proofImage || pay.proof || pay.document);
    if (hasProof) {
      Alert.alert(
        'Share Document',
        `Choose document to share for Payment #${pay.id}`,
        [
          {
            text: 'Payment Receipt (PDF)',
            onPress: () => handleShareReceiptPdf(pay),
          },
          {
            text: 'Payment Proof File',
            onPress: () => handleShareProofDoc(pay),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      handleShareReceiptPdf(pay);
    }
  };


  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGoogleLocation, setEditGoogleLocation] = useState('');
  const [editServiceType, setEditServiceType] = useState('');
  const [editTotalArea, setEditTotalArea] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editAppDate, setEditAppDate] = useState('');
  const [editAppTime, setEditAppTime] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const handleConfirmInitialPayment = () => {
    if (quotationsList.length === 0) {
      showAlert('No Quotation Found', 'Please create a quotation first before recording initial payment.', 'warning', 'Got It');
      return;
    }

    setLockConfirmModal({
      visible: true,
      actionType: 'initial_payment',
      title: 'Initial Payment Received',
      message: 'Are you sure you want to record the Initial Advance Payment as received?\n\nOnce confirmed:\n• All quotations and revisions will be permanently locked against any changes.\n• Customer and site details will be locked.\n• Only viewing of the locked PDF quotation will be allowed.',
      quoteId: app.confirmedQuoteId || (quotationsList.find(q => q.id === app.confirmedQuoteId) || quotationsList[0])?.id,
      confirmText: 'Confirm & Lock',
      cancelText: 'Cancel',
    });
  };

  const handleOpenEditCustomer = () => {
    if (!app) return;
    if (isInitialPaymentReceived) {
      showAlert(
        'Project Locked',
        'Initial payment has been received for this project. Customer and site details are locked and cannot be edited.',
        'lock',
        'Got It'
      );
      return;
    }
    setEditClientName(app.clientName || app.name || '');
    setEditClientPhone(app.clientPhone || app.phone || '');
    setEditCity(app.city || '');
    setEditArea(app.area || '');
    setEditAddress(app.address || app.location || '');
    setEditGoogleLocation(app.googleLocation || app.mapUrl || app.googleMapsUrl || '');
    setEditServiceType(app.serviceType || '');
    setEditTotalArea(app.totalArea ? String(app.totalArea) : '');
    setEditAssignedTo(app.assignedTo || '');
    setEditAppDate(app.appointmentDate || app.fixDate || '');
    setEditAppTime(app.time || '');
    setEditStatus(app.status || app.projectStatus || 'Upcoming');
    setShowEditCustomerModal(true);
  };

  const handleSaveCustomerEdit = () => {
    if (!editClientName.trim()) {
      showAlert('Validation Error', 'Customer Name is required.', 'warning');
      return;
    }
    const cleanPhone = editClientPhone.replace(/[^0-9]/g, '');
    if (!editClientPhone.trim() || cleanPhone.length !== 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }
    updateAppointment(app.id, {
      clientName: editClientName.trim(),
      clientPhone: editClientPhone.trim(),
      city: editCity.trim(),
      area: editArea.trim(),
      address: editAddress.trim(),
      location: `${editArea.trim()}${editCity.trim() ? `, ${editCity.trim()}` : ''}`,
      googleLocation: editGoogleLocation.trim(),
      mapUrl: editGoogleLocation.trim(),
      serviceType: editServiceType.trim(),
      totalArea: editTotalArea.trim(),
      assignedTo: editAssignedTo.trim(),
      appointmentDate: editAppDate.trim(),
      time: editAppTime.trim(),
      status: editStatus,
      projectStatus: editStatus,
    });
    setShowEditCustomerModal(false);
    showAlert('Success', 'Customer details updated successfully!', 'success');
  };
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState(null);

  const getQuoteTierCategory = (quote) => {
    if (!quote) return 'Economic';
    const pkgId = quote.packageId != null ? Number(quote.packageId) : null;
    if (pkgId === 3) return 'Elite';
    if (pkgId === 2) return 'Premium';
    if (pkgId === 1) return 'Economic';
    if (pkgId === 0 || (quote.packageId === null && quote.packageId !== undefined)) {
      const lower = String(quote.tier || quote.packages || quote.packageName || '').toLowerCase();
      if (!lower || lower === 'none' || lower.includes('single tier')) return 'None';
    }

    const pkg = String(quote.tier || quote.packages || quote.packageName || quote.quoteFor || quote.tierName || '').toLowerCase().trim();
    if (pkg === '3' || pkg.includes('elite') || pkg.includes('luxury') || pkg.includes('polyurea') || pkg.includes('12')) {
      return 'Elite';
    }
    if (pkg === '2' || pkg.includes('premium') || pkg.includes('polyurethane') || pkg.includes('10')) {
      return 'Premium';
    }
    if (pkg === 'none' || pkg.includes('single tier')) {
      return 'None';
    }
    if (pkg === '1' || pkg.includes('economic') || pkg.includes('elastomeric') || pkg.includes('basic') || pkg.includes('5')) {
      return 'Economic';
    }
    return 'Economic';
  };

  const getTierVisualTheme = (tierId) => {
    const t = String(tierId || '').toLowerCase().trim();
    if (t.includes('elite') || t.includes('luxury') || t.includes('polyurea') || t === '3') {
      return {
        color: '#7C3AED',
        lightBg: '#F5F3FF',
        darkBg: '#2E1065',
        badgeBg: '#EDE9FE',
        activeBorder: '#B090E5',
        icon: 'ribbon',
      };
    }
    if (t.includes('premium') || t.includes('polyurethane') || t === '2') {
      return {
        color: '#0052CC',
        lightBg: '#EEF2FF',
        darkBg: '#1E1B4B',
        badgeBg: '#E0E7FF',
        activeBorder: '#8B9FD0',
        icon: 'star',
      };
    }
    if (t === 'none' || t.includes('single tier')) {
      return {
        color: '#0D9488',
        lightBg: '#F0FDFA',
        darkBg: '#134E4A',
        badgeBg: '#CCFBF1',
        activeBorder: '#5EEAD4',
        icon: 'layers-outline',
      };
    }
    return {
      color: '#2563EB',
      lightBg: '#EFF6FF',
      darkBg: '#172554',
      badgeBg: '#DBEAFE',
      activeBorder: '#7C9EE9',
      icon: 'shield-checkmark',
    };
  };

  const DEFAULT_TIERS_CONFIG = [
    {
      id: 'Economic',
      packageId: 1,
      packages: 'Economic',
      packageName: 'Economic',
      title: 'Economic Method',
      subtitle: 'Acrylic Elastomeric Coating (5 Yrs Warranty)',
      quoteForDefault: 'Acrylic Elastomeric Coating (Economic)',
      warranty: '5 Years',
      color: '#2563EB',
      lightBg: '#EFF6FF',
      darkBg: '#172554',
      badgeBg: '#DBEAFE',
      activeBorder: '#7C9EE9',
      icon: 'shield-checkmark',
    },
    {
      id: 'Premium',
      packageId: 2,
      packages: 'Premium',
      packageName: 'Premium',
      title: 'Premium Method',
      subtitle: 'Pure Flexible Polyurethane (10 Yrs Warranty)',
      quoteForDefault: 'Pure Flexible Polyurethane (Premium)',
      warranty: '10 Years',
      color: '#0052CC',
      lightBg: '#EEF2FF',
      darkBg: '#1E1B4B',
      badgeBg: '#E0E7FF',
      activeBorder: '#8B9FD0',
      icon: 'star',
    },
    {
      id: 'Elite',
      packageId: 3,
      packages: 'Elite',
      packageName: 'Elite',
      title: 'Elite Method',
      subtitle: 'Polyurethane based Polyurea (12 Yrs Warranty)',
      quoteForDefault: 'Polyurethane based Polyurea (Elite)',
      warranty: '12 Years',
      color: '#7C3AED',
      lightBg: '#F5F3FF',
      darkBg: '#2E1065',
      badgeBg: '#EDE9FE',
      activeBorder: '#B090E5',
      icon: 'ribbon',
    },
    {
      id: 'None',
      packageId: null,
      packages: 'None',
      packageName: 'Single Tier Services',
      title: 'Single Tier Services',
      subtitle: 'Individual Waterproofing Services',
      quoteForDefault: 'Single Tier Services',
      warranty: 'Single Tier',
      color: '#0D9488',
      lightBg: '#F0FDFA',
      darkBg: '#134E4A',
      badgeBg: '#CCFBF1',
      activeBorder: '#5EEAD4',
      icon: 'layers-outline',
    },
  ];

  const TIERS_CONFIG = DEFAULT_TIERS_CONFIG;

  // Merge API quotations with any locally-saved quotations (local ones take precedence by id)
  const quotationsList = React.useMemo(() => {
    const localQuotes = app?.quotations || (app?.quotation ? [{ ...app.quotation, id: app.quotation.id || Date.now() }] : []);
    if (apiQuotations.length === 0) return localQuotes;
    // Merge: start with API quotations, then overlay any local-only entries.
    // IMPORTANT: for keys that exist in both, the freshly-fetched API copy must win
    // over the local copy. The local copy (app.quotations) is a snapshot taken at
    // initial load and never has its lock/confirm fields updated in place, so if it
    // were allowed to win, a just-unlocked quotation would keep showing as locked
    // (isConfirmed/isLocked/status stuck at their old values) until a full manual
    // refresh replaced app.quotations entirely.
    const mergedMap = new Map();
    apiQuotations.forEach((q) => {
      const k = String(q.id || q.quotationId || '');
      if (k) mergedMap.set(k, q);
    });
    localQuotes.forEach((q) => {
      const qKey = String(q.id || q.quotationId || '');
      if (qKey) {
        if (mergedMap.has(qKey)) {
          // local fills in any fields the API copy is missing, but never overrides
          // fields the API copy already provides (api = source of truth post-refetch)
          mergedMap.set(qKey, { ...q, ...mergedMap.get(qKey) });
        } else {
          mergedMap.set(qKey, q);
        }
      }
    });
    return Array.from(mergedMap.values());
  }, [app?.quotations, app?.quotation, apiQuotations]);

  // List of tier category IDs that already have at least one quotation created for this customer
  const existingQuoteTiers = React.useMemo(() => {
    const set = new Set();
    (quotationsList || []).forEach((q) => {
      const t = getQuoteTierCategory(q);
      if (t && String(t).toLowerCase() !== 'none') {
        set.add(String(t).toLowerCase().trim());
      }
    });
    return Array.from(set);
  }, [quotationsList]);

  // Packages list mapped dynamically from backend API packages and existing quotations (only showing packages with quotations)
  const displayPackages = React.useMemo(() => {
    const tierMap = new Map();

    if (Array.isArray(apiPackages) && apiPackages.length > 0) {
      apiPackages.forEach((pkg) => {
        const rawPkgName = pkg.packages || pkg.packageName || pkg.name || pkg.tier || '';
        const lowerName = rawPkgName.toLowerCase();
        const pId = pkg.packageId != null ? Number(pkg.packageId) : (pkg.id != null ? Number(pkg.id) : null);

        let tierId = 'Economic';
        if (pId === 3 || lowerName.includes('elite') || lowerName.includes('luxury') || lowerName.includes('polyurea') || lowerName === 'elite') {
          tierId = 'Elite';
        } else if (pId === 2 || lowerName.includes('premium') || lowerName.includes('polyurethane') || lowerName === 'premium') {
          tierId = 'Premium';
        } else if (pId === 0 || lowerName === 'none' || lowerName.includes('single tier') || pkg.packageId === null) {
          tierId = 'None';
        } else if (pId === 1 || lowerName.includes('economic') || lowerName.includes('elastomeric') || lowerName === 'economic') {
          tierId = 'Economic';
        } else {
          tierId = rawPkgName || 'Economic';
        }

        const theme = getTierVisualTheme(tierId);
        const name = pkg.packageName || pkg.name || rawPkgName || (tierId === 'None' ? 'Single Tier Services' : `${tierId} Method`);
        const title = pkg.title || (tierId === 'None' ? 'Single Tier Services' : name);
        const warranty = pkg.warranty ? String(pkg.warranty) : (tierId === 'None' ? 'Single Tier' : '');
        const subtitle = pkg.subtitle || (warranty ? `${name} (${warranty})` : name);

        tierMap.set(tierId.toLowerCase(), {
          ...theme,
          id: tierId,
          packageId: pId,
          packages: pkg.packages || tierId,
          packageName: name,
          title,
          warranty,
          subtitle,
          quoteForDefault: pkg.quoteForDefault || name,
        });
      });
    }

    // Also populate from quotationsList if any quotation matches a tier
    quotationsList.forEach((q) => {
      const tierId = getQuoteTierCategory(q);
      if (!tierMap.has(tierId.toLowerCase())) {
        const theme = getTierVisualTheme(tierId);
        const name = q.packageName || q.quoteFor || (tierId === 'None' ? 'Single Tier Services' : `${tierId} Method`);
        const title = tierId === 'None' ? 'Single Tier Services' : name;
        const warranty = q.warranty ? String(q.warranty) : (tierId === 'None' ? 'Single Tier' : '');
        const subtitle = warranty ? `${name} (${warranty})` : name;

        tierMap.set(tierId.toLowerCase(), {
          ...theme,
          id: tierId,
          packageId: q.packageId != null ? Number(q.packageId) : null,
          packages: q.packages || tierId,
          packageName: name,
          title,
          warranty,
          subtitle,
          quoteForDefault: q.quoteFor || name,
        });
      }
    });

    const list = Array.from(tierMap.values());

    // Filter to only packages that have at least one quotation
    const withQuotes = list.filter((pkg) => {
      return quotationsList.some(q => getQuoteTierCategory(q).toLowerCase() === pkg.id.toLowerCase());
    });

    // Sort in standard order: Economic -> Premium -> Elite -> None
    const ORDER = { economic: 1, premium: 2, elite: 3, none: 4 };
    withQuotes.sort((a, b) => (ORDER[a.id.toLowerCase()] || 99) - (ORDER[b.id.toLowerCase()] || 99));

    // If there are packages with quotations, only display those packages
    if (withQuotes.length > 0) {
      return withQuotes;
    }

    // If no quotations exist yet, show only Economic Method as default
    return [DEFAULT_TIERS_CONFIG[0]];
    // Return packages with quotations from API data (empty list if no quotations created yet)
    return withQuotes;
  }, [apiPackages, quotationsList]);

  const activeQuotationId = app?.activeQuotationId;
  const activeQuote =
    (app?.confirmedQuoteId && quotationsList.find(q => String(q.id || q.quotationId) === String(app.confirmedQuoteId))) ||
    quotationsList.find(q => q.isConfirmed || q.status === 'CONFIRMED' || q.confirmed) ||
    quotationsList.find(q => String(q.id || q.quotationId) === String(chosenCategory)) ||
    (quotationsList.length > 0 ? quotationsList[quotationsList.length - 1] : null);

  // Resolve service items array
  const currentServicesList = React.useMemo(() => {
    if (!activeQuote) {
      return [{
        id: 1,
        serviceName: app?.serviceType || 'Terrace Waterproofing',
        specs: [],
        area: '1000',
        rateBasic: 100,
        rateMid: 120,
        rateLuxury: 150,
        subtotalBasic: app?.totalPayment || 100000,
        subtotalMid: app?.totalPayment || 120000,
        subtotalLuxury: app?.totalPayment || 150000,
      }];
    }
    if (activeQuote.servicesList && activeQuote.servicesList.length > 0) {
      return activeQuote.servicesList;
    }
    // Fallback if legacy single service format
    const areaVal = parseFloat(activeQuote.area) || 0;
    const bRate = parseFloat(activeQuote.rates?.basic) || 0;
    const mRate = parseFloat(activeQuote.rates?.mid || activeQuote.rates?.medium) || 0;
    const lRate = parseFloat(activeQuote.rates?.luxury || activeQuote.rates?.high) || 0;
    return [{
      id: 1,
      serviceName: activeQuote.service || 'Terrace Waterproofing',
      specs: activeQuote.specs || [],
      area: activeQuote.area || '500',
      rateBasic: bRate,
      rateMid: mRate,
      rateLuxury: lRate,
      subtotalBasic: areaVal * bRate,
      subtotalMid: areaVal * mRate,
      subtotalLuxury: areaVal * lRate,
    }];
  }, [activeQuote, app?.serviceType, app?.totalPayment]);

  useEffect(() => {
    if (showDurationModal && currentServicesList.length > 0) {
      const initial = {};
      currentServicesList.forEach((_, idx) => {
        initial[idx] = '10 Years';
      });
      setServiceDurations(initial);
    }
  }, [showDurationModal, currentServicesList.length]);

  const getQuotationCatTotal = (quoteObj, catName) => {
    if (!quoteObj) return 0;
    if (quoteObj.total != null && !isNaN(Number(quoteObj.total))) {
      return Math.round(Number(quoteObj.total));
    }
    const catKey = catName ? catName.toString().toLowerCase() : 'basic';
    if (quoteObj.totals && quoteObj.totals[catKey]) {
      return Math.round(quoteObj.totals[catKey]);
    }
    const gstFact = quoteObj.gst !== '0%' && quoteObj.gst !== '0' ? (parseFloat(quoteObj.gstRate || 18) / 100) : 0;
    const sList = quoteObj.servicesList && quoteObj.servicesList.length > 0 ? quoteObj.servicesList : [{
      area: quoteObj.area,
      rateBasic: quoteObj.rates?.basic,
      rateMid: quoteObj.rates?.mid || quoteObj.rates?.medium,
      rateLuxury: quoteObj.rates?.luxury || quoteObj.rates?.high,
    }];
    const sub = sList.reduce((acc, s) => {
      const area = parseFloat(s.area || quoteObj.area) || 0;
      const rateKey = catKey.includes('mid') || catKey.includes('premium') ? (s.rateMid || s.rateMedium) : (catKey.includes('lux') || catKey.includes('elite') ? (s.rateLuxury || s.rateHigh) : (s.rateBasic || s.rate));
      const rate = parseFloat(rateKey) || parseFloat(s.rate) || 0;
      return acc + (area * rate);
    }, 0);
    return Math.round(sub * (1 + gstFact));
  };

  const calculateCategoryTotal = (catName) => {
    return getQuotationCatTotal(activeQuote, catName);
  };

  const handleUpdateServiceItem = (indexToEdit) => {
    if (!activeQuote) return;
    const updatedServices = [...currentServicesList];
    const item = { ...updatedServices[indexToEdit] };

    if (editAreaVal) item.area = editAreaVal;
    const newRate = parseFloat(editRateVal);
    if (!isNaN(newRate)) {
      if (activeCategoryModal === 'Basic') item.rateBasic = editRateVal;
      else if (activeCategoryModal === 'Mid') item.rateMid = editRateVal;
      else if (activeCategoryModal === 'Luxury') item.rateLuxury = editRateVal;
    }

    const areaVal = parseFloat(item.area) || 0;
    const bRate = parseFloat(item.rateBasic) || 0;
    const mRate = parseFloat(item.rateMid) || 0;
    const lRate = parseFloat(item.rateLuxury) || 0;

    item.subtotalBasic = areaVal * bRate;
    item.subtotalMid = areaVal * mRate;
    item.subtotalLuxury = areaVal * lRate;

    updatedServices[indexToEdit] = item;

    // Recalculate totals
    const gstFact = activeQuote.gst !== '0%' && activeQuote.gst !== '0' ? ((parseFloat(activeQuote.gstRate) || 18) / 100) : 0;
    const sumB = updatedServices.reduce((acc, s) => acc + (s.subtotalBasic || 0), 0);
    const sumM = updatedServices.reduce((acc, s) => acc + (s.subtotalMid || 0), 0);
    const sumL = updatedServices.reduce((acc, s) => acc + (s.subtotalLuxury || 0), 0);

    const updatedQuote = {
      ...activeQuote,
      servicesList: updatedServices,
      subtotals: { basic: sumB, mid: sumM, medium: sumM, luxury: sumL, high: sumL },
      totals: {
        basic: sumB * (1 + gstFact),
        mid: sumM * (1 + gstFact),
        medium: sumM * (1 + gstFact),
        luxury: sumL * (1 + gstFact),
        high: sumL * (1 + gstFact),
      },
    };

    saveQuotation(app.id, updatedQuote);

    setEditingServiceIndex(null);
    setEditRateVal('');
    setEditAreaVal('');
    showAlert('Updated', 'Service details updated successfully.', 'success');
  };

  const handleDeleteServiceItem = (indexToDelete) => {
    if (!activeQuote) return;
    if (currentServicesList.length <= 1) {
      showAlert('Notice', 'Quotation must have at least one service. To delete the entire quotation, use the edit / make quotation button.', 'info');
      return;
    }

    setDeleteModalConfig({
      visible: true,
      title: 'Remove Service?',
      message: 'Are you sure you want to remove this service from the quotation? This action cannot be undone.',
      confirmText: 'Remove',
      isDeleting: false,
      onConfirm: () => {
        const updatedServices = currentServicesList.filter((_, idx) => idx !== indexToDelete);
        const gstFact = activeQuote.gst !== '0%' && activeQuote.gst !== '0' ? ((parseFloat(activeQuote.gstRate) || 18) / 100) : 0;
        const sumB = updatedServices.reduce((acc, s) => acc + (s.subtotalBasic || 0), 0);
        const sumM = updatedServices.reduce((acc, s) => acc + (s.subtotalMid || 0), 0);
        const sumL = updatedServices.reduce((acc, s) => acc + (s.subtotalLuxury || 0), 0);

        const updatedQuote = {
          ...activeQuote,
          service: updatedServices.map(s => s.serviceName).join(' & '),
          servicesList: updatedServices,
          subtotals: { basic: sumB, mid: sumM, medium: sumM, luxury: sumL, high: sumL },
          totals: {
            basic: sumB * (1 + gstFact),
            mid: sumM * (1 + gstFact),
            medium: sumM * (1 + gstFact),
            luxury: sumL * (1 + gstFact),
            high: sumL * (1 + gstFact),
          },
        };

        saveQuotation(app.id, updatedQuote);
        setDeleteModalConfig(prev => ({ ...prev, visible: false }));
      },
    });
  };

  const handleProceedToPayment = (categoryName) => {
    const finalAmount = calculateCategoryTotal(categoryName);
    setProjectTotal(app.id, finalAmount, `${categoryName} Package - ${activeQuote?.service || 'Waterproofing'}`, categoryName);
    setActiveCategoryModal(null);
    router.push({
      pathname: '/payment-form',
      params: { id: app.id, amount: finalAmount, milestone: 'initialPaid' },
    });
  };

  const handleLogWarrantyClaim = () => {
    const claimsList = app.warrantyClaims || [];
    if (claimsList.length >= 2) {
      showAlert(
        'Claim Limit Reached',
        'Maximum 2 warranty claims allowed per warranty cycle. You cannot log further warranty claims for this project.',
        'warning'
      );
      setShowClaimModal(false);
      return;
    }
    if (!claimIssueText.trim()) {
      showAlert('Notice', 'Please describe the issue or service requested.', 'info');
      return;
    }
    const res = addWarrantyClaim(app.id, {
      issue: claimIssueText.trim(),
      claimDate: new Date().toISOString().split('T')[0],
    });
    setShowClaimModal(false);
    setClaimIssueText('');
    showAlert('Claim Logged', res.message || 'Warranty claim logged successfully.', 'success');
  };

  // Helper date parsing (supports YYYY-MM-DD and DD-MM-YYYY)
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day);
        } else {
          // DD-MM-YYYY or DD-MM-YY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          return new Date(year, month, day);
        }
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Helper time parsing e.g. "10:30 AM" or "10.00 Am" or "02:30 PM"
  const parseTime = (timeStr) => {
    if (!timeStr) return new Date();
    const today = new Date();
    try {
      const clean = timeStr.trim().toLowerCase();
      const isPm = clean.includes('pm');
      const timePart = clean.replace('am', '').replace('pm', '').trim();
      const parts = timePart.includes('.') ? timePart.split('.') : timePart.split(':');
      if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isPm && hours < 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
        today.setHours(hours, minutes, 0, 0);
      }
    } catch {
      // ignore parsing error, return today
    }
    return today;
  };

  // Formatter for date: DD-MM-YY (e.g. 12-12-26)
  const formatDate = (date) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Formatter for time: HH:MM AM/PM
  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Sync state with selected appointment / client data
  useEffect(() => {
    if (app) {
      const initialAttendedDate = app.attendedDate ? formatDateDDMMYY(app.attendedDate) : '';
      const initialAttendedTime = app.attendedTime || '';

      setAttendedDate(initialAttendedDate);
      setAttendedTime(initialAttendedTime);
      setTotalArea(app.totalArea ? app.totalArea.toString() : '');

      if (initialAttendedDate) {
        setDateValue(parseDate(initialAttendedDate));
      } else {
        setDateValue(new Date());
      }

      if (initialAttendedTime) {
        setTimeValue(parseTime(initialAttendedTime));
      } else {
        setTimeValue(new Date());
      }
    }
  }, [app?.id, app?.attendedDate, app?.attendedTime, app?.totalArea]);

  if (!app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Appointment not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={{ color: '#FFFFFF' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Formatting display names & fields from API
  const rawClientName = (app.customerName || app.clientName || app.name || 'Customer').trim();
  const customerInitial = (() => {
    const cleaned = rawClientName.replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.|er\.|mr|mrs|ms|dr)\s+/i, '').trim();
    return (cleaned || rawClientName).charAt(0).toUpperCase() || 'C';
  })();
  const displayName = `${rawClientName}`;
  const displayId = `DR${app.appointmentId || app.customerId || app.id || ''}`;
  const displayPhone = app.mobileNumber || app.clientPhone || app.phone || app.mobile || 'No Phone Number';

  const rawAppDate = app.appointmentDate || app.date || app.appointmentFixDate || '';
  const displayAppDate = rawAppDate ? formatDateDDMMYY(rawAppDate) : 'Not Set';
  const rawFixDate = app.appointmentFixDate || app.appointmentFixedDate || app.fixDate || '';
  const displayFixDate = rawFixDate ? formatDateDDMMYY(rawFixDate) : 'Not Set';
  const displayAppTime = app.appointmentTime || app.time || 'Not Set';
  const displayAttendedBy = app.employeeName || app.attendedBy || app.assignedTo || app.technician || app.assignedTechnician || 'Unassigned';
  const displayServiceType = app.serviceType || app.services || app.service || 'Waterproofing';

  const handleSaveDetails = async () => {
    if (isAttendedLocked) {
      showAlert('Site Details Locked 🔒', 'Attended date and time have already been saved and cannot be modified.', 'lock');
      return;
    }

    if (!attendedDate && !attendedTime) {
      showAlert('Missing Details', 'Please fill Attended Date and Attended Time before saving.', 'warning', 'OK');
      return;
    }

    if (isPastDate(attendedDate)) {
      showAlert('Invalid Date', 'Attended Date cannot be in the past.', 'warning', 'OK');
      return;
    }

    setIsSavingSiteDetails(true);
    try {
      const cleanAppId = String(app.appointmentId || app.id || params.id).replace(/^DR/i, '').trim();
      const cleanCustId = String(app.customerId || app.id || params.id).replace(/^DR/i, '').trim();
      const empId = app?.employeeId || app?.assignedEmployeeId || app?.appointmentAttend?.employeeId || 102;

      const result = await appointmentService.saveAttendedDetails(cleanAppId, {
        attendedDate,
        attendedTime,
        date: attendedDate,
        time: attendedTime,
        appointmentId: cleanAppId,
        customerId: cleanCustId,
        employeeId: empId,
        totalArea,
      });
      
      if (!result?.success) {
        let errorTitle = 'Data Not Saved';
        let errorMessage = result?.message || 'Site details could not be saved. Please try again.';

        switch (result?.statusCode) {
          case 400:
            errorTitle = 'Invalid Data';
            errorMessage = result?.message || 'The data sent was invalid. Please check the details and try again.';
            break;
          case 401:
            errorTitle = 'Unauthorized';
            errorMessage = 'Your session has expired. Please log in again.';
            break;
          case 403:
            errorTitle = 'Access Denied';
            errorMessage = 'You do not have permission to save site details.';
            break;
          case 404:
            errorTitle = 'Not Found';
            errorMessage = result?.message || 'Appointment not found or resource unavailable.';
            break;
          case 500:
            errorTitle = 'Server Error';
            errorMessage = 'An internal server error occurred. Please try again later.';
            break;
          default:
            break;
        }

        showAlert(errorTitle, errorMessage, 'error', 'OK');
        return;
      }

      updateAppointmentInspection(app.id, {
        attendedDate,
        attendedTime,
        totalArea,
        siteVisited: true,
        projectStatus: 'Site Visited',
      });
      setProjectStatus('Site Visited');
      setIsLocallySaved(true);

      setSiteSuccessModal({
        visible: true,
        title: 'Site Details Saved! 🎉',
        message: `Attended Date (${attendedDate || 'Recorded'}) and Attended Time (${attendedTime || 'Recorded'}) have been saved successfully and are now locked.`,
      });
    } catch (err) {
      console.warn('Error saving site details:', err?.message);
      showAlert('Save Error', err?.message || 'Failed to save site details to server.', 'error');
    } finally {
      setIsSavingSiteDetails(false);
    }
  };

  const handleMakeQuotation = () => {
    updateAppointmentInspection(app.id, {
      attendedDate,
      attendedTime,
      totalArea,
    });
    handleOpenSelectTiersModal(['economic', 'premium', 'elite']);
  };

  const handleActivateWarranty = () => {
    const serviceWarranties = currentServicesList.map((s, idx) => ({
      serviceId: s.id,
      serviceName: s.serviceName || s.service,
      duration: serviceDurations[idx] || '10 Years'
    }));

    // For summary/legacy use max duration or first
    const summaryDuration = serviceWarranties.length > 1
      ? "Multiple Periods"
      : (serviceWarranties[0]?.duration || '10 Years');

    generateWarranty(app.id, new Date().toISOString().split('T')[0], summaryDuration, serviceWarranties);
    setShowDurationModal(false);
    showAlert('Success', 'Warranty activated successfully.', 'success');
  };

  if (isLoadingClient && !app?.clientName && !app?.customerName) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <InnerHeader title="Customer Detail" onBack={handleBack} paddingTop={insets.top} isDark={isDark} />
        <MaterialDetailSkeleton showHeader={false} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader title="Customer Detail" onBack={handleBack} paddingTop={insets.top} isDark={isDark} />

      {/* Main Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0052CC']}
            tintColor={isDark ? '#FFFFFF' : '#0052CC'}
          />
        }
        style={[{ flex: 1, backgroundColor: isDark ? '#080808' : '#F8FAFC', marginTop: 0, zIndex: 2 }, isDark && { backgroundColor: '#121212' }]}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110), paddingTop: 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Master Customer Summary Card */}
        <View style={[{ borderRadius: 20, padding: 16, marginBottom: 16, backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isDark ? '#1E293B' : '#E0F2FE',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 14,
                borderWidth: 2,
                borderColor: isDark ? '#3B82F6' : '#0052CC',
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: isDark ? '#60A5FA' : '#0052CC',
                }}
              >
                {customerInitial}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A', flex: 1, marginRight: 8 }}>
                  {displayName}
                </Text>
              </View>

              <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 10 }}>
                Cust ID: {displayId} • {displayPhone}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <Ionicons name="location" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB', flexShrink: 1 }}>
                  {app.location || (app.area && app.city ? `${app.area}, ${app.city}` : app.city || app.area || 'Central, Chennai')}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Action Contact Bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#F1F5F9', paddingTop: 12, marginTop: 4 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#080808' : '#EFF6FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, flex: 1, marginRight: 6, justifyContent: 'center' }}
              onPress={() => {
                const phoneClean = (displayPhone || '').replace(/[^0-9+]/g, '');
                if (phoneClean) {
                  Linking.openURL(`tel:${phoneClean}`).catch(() => showAlert('Call Failed', `Unable to open dialer for ${displayPhone}.`, 'error'));
                } else {
                  showAlert('Invalid Number', 'No phone number available to call.', 'warning');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={18} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#080808' : '#ECFDF5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, flex: 1, marginRight: 6, justifyContent: 'center' }}
              onPress={() => {
                const phoneClean = (displayPhone || '').replace(/[^0-9]/g, '');
                if (!phoneClean) {
                  showAlert('Invalid Number', 'No mobile number available for WhatsApp.', 'warning');
                  return;
                }
                const waNumber = phoneClean.startsWith('91') ? phoneClean : `91${phoneClean}`;
                Linking.openURL(`https://wa.me/${waNumber}`).catch(() => showAlert('WhatsApp Error', 'Unable to launch WhatsApp on this device.', 'error'));
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#080808' : '#FEF2F2', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, flex: 1, justifyContent: 'center' }}
              onPress={async () => {
                const rawLoc = (
                  app.mapLocation ||
                  app.googleLocation ||
                  app.mapUrl ||
                  app.googleMapsUrl ||
                  ''
                ).trim();

                let targetUrl = '';

                if (rawLoc) {
                  if (rawLoc.startsWith('http://') || rawLoc.startsWith('https://')) {
                    targetUrl = rawLoc;
                  } else if (rawLoc.includes('google.com') || rawLoc.includes('goo.gl') || rawLoc.includes('maps.app')) {
                    targetUrl = `https://${rawLoc.replace(/^\/+/, '')}`;
                  } else if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(rawLoc)) {
                    targetUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc.replace(/\s+/g, ''))}`;
                  } else {
                    targetUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc)}`;
                  }
                } else {
                  const addressQuery = [
                    app.doorNo,
                    app.streetName || app.street,
                    app.area,
                    app.city || 'Chennai',
                    app.pincode,
                  ].filter(Boolean).join(', ') || app.fullAddress || app.location || (typeof app.address === 'string' ? app.address : 'Chennai');

                  targetUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
                }

                try {
                  await Linking.openURL(targetUrl);
                } catch (_err) {
                  const fallbackQuery = encodeURIComponent(app.area || app.city || app.location || 'Chennai, Tamil Nadu');
                  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${fallbackQuery}`;
                  try {
                    await Linking.openURL(fallbackUrl);
                  } catch (_err2) {
                    showAlert('Customer Location', `Address: ${app.fullAddress || app.location || 'Chennai'}`, 'info', 'OK');
                  }
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Cards Bar (Site Info, Quotations, Payments, Warranty) */}
        <View style={{ marginBottom: 18, flexDirection: 'row', gap: 6 }}>
          {[
            { id: 'profile', label: 'Site Info', icon: 'person-outline', activeIcon: 'person', color: '#2563EB', bg: '#DBEAFE' },
            { id: 'quotation', label: 'Quotations', icon: 'document-text-outline', activeIcon: 'document-text', color: '#16A34A', bg: '#DCFCE7' },
            { id: 'payment', label: 'Payments', icon: 'card-outline', activeIcon: 'card', color: '#0284C7', bg: '#E0F2FE' },
            { id: 'warranty', label: 'Warranty', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', color: '#7C3AED', bg: '#EDE9FE' },
          ].map((tab) => {
            const isTabLocked =
              (tab.id === 'quotation' && !isAttendedLocked) ||
              (tab.id === 'payment' && !isQuotationConfirmed) ||
              (tab.id === 'warranty' && (!isQuotationConfirmed || !isReceiptGenerated));
            const isActive = activeTabSection === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  {
                    flex: 1,
                    height: 78,
                    borderRadius: 12,
                    padding: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? (isDark ? '#1E293B' : '#EFF6FF') : (isDark ? '#1C1C1C' : '#FFFFFF'),
                    borderWidth: 1,
                    borderColor: isActive ? '#93C5FD' : (isDark ? '#334155' : '#E2E8F0'),
                    opacity: isTabLocked ? 0.65 : 1,
                  }
                ]}
                onPress={() => {
                  if (tab.id === 'quotation' && !isAttendedLocked) {
                    showAlert(
                      'Site Details Required',
                      'Please fill and save the Attended Date and Attended Time under Site Details before opening the Quotations tab.',
                      'lock',
                      'Got It'
                    );
                    return;
                  }
                  if (tab.id === 'payment' && !isQuotationConfirmed) {
                    showAlert(
                      'Quotation Required',
                      'Payments will be available once a quotation is confirmed and locked.',
                      'lock',
                      'Got It'
                    );
                    return;
                  }
                  if (tab.id === 'warranty' && !isQuotationConfirmed) {
                    showAlert(
                      'Quotation Required',
                      'Warranty will be available once a quotation is confirmed and settled.',
                      'lock',
                      'Got It'
                    );
                    return;
                  }
                  setActiveTabSection(tab.id);
                }}
                activeOpacity={0.8}
              >
                {/* Top Center Vector Icon */}
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor: isTabLocked ? (isDark ? '#1E293B' : '#F1F5F9') : (isActive ? tab.bg : (isDark ? '#080808' : '#F8FAFC')),
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 4,
                }}>
                  <Ionicons
                    name={isTabLocked ? 'lock-closed' : (isActive ? tab.activeIcon : tab.icon)}
                    size={17}
                    color={isTabLocked ? '#94A3B8' : (isActive ? tab.color : (isDark ? '#94A3B8' : '#64748B'))}
                  />
                </View>

                {/* Bottom Center Text Label */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      {
                        fontSize: 10.5,
                        fontWeight: isActive ? '700' : '600',
                        color: isTabLocked ? '#94A3B8' : (isActive ? '#0F172A' : (isDark ? '#94A3B8' : '#64748B')),
                      },
                      isDark && isActive && !isTabLocked && { color: '#FFFFFF' }
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isTabLocked && (
                    <Ionicons name="lock-closed" size={9} color="#94A3B8" style={{ marginLeft: 2 }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: SITE & INSPECTION DETAILS */}
        {activeTabSection === 'profile' && (
          <View style={[{ borderRadius: 20, padding: 18, marginBottom: 20, backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 16 }}>
              Site {'&'} Details
            </Text>

            {/* Requested Services Pill Chips */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8 }}>
                Requested Service Packages:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(displayServiceType.includes('&') ? displayServiceType.split('&') : [displayServiceType]).map((srv, idx) => (
                  <View key={idx} style={{ backgroundColor: isDark ? '#1E293B' : '#EFF6FF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                    <Ionicons name="construct" size={14} color="#0052CC" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#60A5FA' : '#0052CC' }}>
                      {srv.trim()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Inspection Info Cards Grid */}
            <View style={{ marginBottom: 14 }}>
              {/* Row 1: Fixed Visit Date & Appointment Time */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ width: '48%', backgroundColor: isDark ? '#080808' : '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>Fixed Visit Date</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="calendar" size={15} color="#0052CC" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>{displayFixDate}</Text>
                  </View>
                </View>

                <View style={{ width: '48%', backgroundColor: isDark ? '#080808' : '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>Appointment Time</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="time-outline" size={15} color="#0052CC" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>{displayAppTime}</Text>
                  </View>
                </View>
              </View>

              {/* Row 2: Attended By */}
              <View style={{ backgroundColor: isDark ? '#080808' : '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>Attended By Technician</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="person-circle-outline" size={18} color="#0052CC" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>{displayAttendedBy}</Text>
                </View>
              </View>

              {/* Row 3: Dedicated Interactive Attended Date & Attended Time Pickers */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* Attended Date Box */}
                <View
                  style={{
                    width: '48%',
                    backgroundColor: isAttendedLocked ? (isDark ? '#1E293B' : '#F1F5F9') : (isDark ? '#080808' : '#EFF6FF'),
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC' }}>Attended Date</Text>
                    {isAttendedLocked && <Ionicons name="lock-closed" size={12} color={isDark ? '#94A3B8' : '#64748B'} />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => !isAttendedLocked && setShowDatePicker(true)}
                      disabled={isAttendedLocked}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="calendar" size={15} color={isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC'} style={{ marginRight: 6 }} />
                    </TouchableOpacity>
                    <TextInput
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC',
                        padding: 0,
                        margin: 0,
                        flex: 1,
                      }}
                      value={attendedDate}
                      onChangeText={setAttendedDate}
                      editable={!isAttendedLocked}
                      placeholder="25-07-2026"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                {/* Attended Time Box */}
                <View
                  style={{
                    width: '48%',
                    backgroundColor: isAttendedLocked ? (isDark ? '#1E293B' : '#F1F5F9') : (isDark ? '#080808' : '#EFF6FF'),
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC' }}>Attended Time</Text>
                    {isAttendedLocked && <Ionicons name="lock-closed" size={12} color={isDark ? '#94A3B8' : '#64748B'} />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => !isAttendedLocked && setShowTimePicker(true)}
                      disabled={isAttendedLocked}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="time" size={15} color={isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC'} style={{ marginRight: 6 }} />
                    </TouchableOpacity>
                    <TextInput
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: isAttendedLocked ? (isDark ? '#94A3B8' : '#64748B') : '#0052CC',
                        padding: 0,
                        margin: 0,
                        flex: 1,
                      }}
                      value={attendedTime}
                      onChangeText={setAttendedTime}
                      editable={!isAttendedLocked}
                      placeholder="10:00 AM"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Site Info Tab Action Buttons */}
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
              {isAttendedLocked ? (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                    borderWidth: 1.5,
                    borderColor: isDark ? '#059669' : '#10B981',
                    borderRadius: 12,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="lock-closed" size={16} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#34D399' : '#047857' }}>
                    Site Details Saved & Locked
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#10B981' }]}
                  onPress={handleSaveDetails}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>Save Site Details</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: QUOTATIONS LIST ORGANIZED BY TIERS (ECONOMIC, PREMIUM, LUXURY) */}
        {activeTabSection === 'quotation' && (
          <View style={{ marginBottom: 20 }}>
            {isLoadingQuotations ? (
              /* LOADING STATE */
              <MaterialPageLoader
                title="Loading Quotations..."
                subtitle="Fetching economic, premium, and luxury packages"
                fullScreen={false}
                showCard={true}
              />
            ) : (
              /* ACTIVE SETUP: ALWAYS SHOW PACKAGE TIERS & REVISIONS */
              <>
                {/* Header with Title and Single Add Button on the Right */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Package Quotations & Revisions
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981', marginTop: 2 }}>
                      {quotationsList.length} Total {quotationsList.length === 1 ? 'Quotation' : 'Quotations / Revisions'}
                    </Text>
                  </View>

                  {!isInitialPaymentReceived && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#2563EB',
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                      }}
                      onPress={() => {
                        handleOpenSelectTiersModal(['economic', 'premium', 'elite']);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Confirmed / Locked Quotation Alert Banner */}
                {(() => {
                  // Banner is irrelevant once the final payment is made
                  if (isFinalPaymentMade) return null;
                  const confirmedQuoteObj = quotationsList.find(q => String(q.id) === String(app?.confirmedQuoteId) || q.isConfirmed);
                  if (!confirmedQuoteObj && !app?.confirmedQuoteId) return null;
                  const confirmedQId = confirmedQuoteObj?.id || app?.confirmedQuoteId;

                  return (
                    isAdminOrMaster && app?.unlockRequested ? (
                      /* Admin Approval Card when Employee Requested Edit */
                      <View style={{
                        backgroundColor: isDark ? '#451A03' : '#FEF3C7',
                        borderColor: '#F59E0B',
                        borderWidth: 1.5,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 14,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#78350F' : '#FDE68A', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Ionicons name="alert-circle" size={20} color="#D97706" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#FDE68A' : '#92400E' }}>
                              Edit Request from {app.unlockRequestedBy || 'Technician'}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#FCD34D' : '#B45309', marginTop: 1 }}>
                              Submitted {app.unlockRequestedAt || 'recently'} • Wants to edit locked quote
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Dismiss Request',
                                'Are you sure you want to dismiss this edit request without unlocking?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Dismiss', onPress: () => resolveQuotationUnlockRequest(app.id, false) }
                                ]
                              );
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 8,
                              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: isDark ? '#334155' : '#D1D5DB',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#64748B' }}>Dismiss</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Approve & Unlock?',
                                'Do you want to approve this request and unlock the quotation for editing?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Approve & Unlock', onPress: () => resolveQuotationUnlockRequest(app.id, true) }
                                ]
                              );
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 7,
                              borderRadius: 8,
                              backgroundColor: '#059669',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>✓ Approve & Unlock</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      /* Standard Confirmed Quote Banner */
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                        borderColor: '#6EE7B7',
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 14,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#047857' : '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Ionicons name="lock-closed" size={18} color="#059669" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#A7F3D0' : '#065F46' }}>
                              Confirmed & Locked Quote
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#6EE7B7' : '#047857', marginTop: 1 }} numberOfLines={1}>
                              {confirmedQuoteObj?.quoteFor || confirmedQuoteObj?.packageName || 'Confirmed Package'} • {confirmedQuoteObj?.revisionLabel || 'Revision #1'}
                            </Text>
                          </View>
                        </View>

                        {isAdminOrMaster ? (
                          /* Admin can unlock directly */
                          <TouchableOpacity
                            onPress={() => {
                              setLockConfirmModal({
                                visible: true,
                                actionType: 'unlock',
                                title: 'Unlock Quotation?',
                                message: 'Do you want to unlock this quotation to allow selecting or editing other package tiers and revisions?',
                                quoteId: confirmedQId,
                                confirmText: 'Unlock',
                                cancelText: 'Cancel',
                              });
                            }}
                            style={{
                              backgroundColor: '#FFFFFF',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Unlock</Text>
                          </TouchableOpacity>
                        ) : app?.unlockRequested ? (
                          /* Employee: Request Pending */
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Request Pending ⏳',
                                'Your request to edit this quotation has been submitted to Admin/Master and is awaiting approval.'
                              );
                            }}
                            style={{
                              backgroundColor: '#FEF3C7',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#FCD34D',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#D97706' }}>Request Pending</Text>
                          </TouchableOpacity>
                        ) : (
                          /* Employee: Request to Edit */
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Quotation Locked',
                                'This quotation is confirmed and locked. Only Admin or Master can unlock it. Would you like to submit a request to edit?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Request to Edit',
                                    onPress: () => {
                                      requestQuotationUnlock(app.id, confirmedQId, currentUser?.name || 'Technician');
                                      showAlert('Request Submitted', 'Your request to edit this quotation has been sent to Admin.', 'success');
                                    }
                                  }
                                ]
                              );
                            }}
                            style={{
                              backgroundColor: '#FFFFFF',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Request to Edit</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )
                  );
                })()}

                {/* Render Tier Sections Separated by Packages from API */}
                {displayPackages.length === 0 ? (

                  <View style={{
                    backgroundColor: isDark ? '#141414' : '#FFFFFF',
                    borderRadius: 18,
                    padding: 24,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDark ? '#262626' : '#E2E8F0',
                    marginTop: 4,
                  }}>
                    <View style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}>
                      <Ionicons name="document-text-outline" size={28} color="#2563EB" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 6, textAlign: 'center' }}>
                      No Quotations Created Yet
                    </Text>
                    <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', marginBottom: 16, lineHeight: 18, paddingHorizontal: 10 }}>
                      Tap below to select package tiers and create a quotation.
                    </Text>
                    {!isInitialPaymentReceived && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#2563EB',
                          paddingVertical: 10,
                          paddingHorizontal: 20,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onPress={() => handleOpenSelectTiersModal(['economic', 'premium', 'elite'])}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Create Quotation</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  displayPackages.map((tierCfg) => {
                  const tierQuotes = quotationsList.filter(q => getQuoteTierCategory(q).toLowerCase() === tierCfg.id.toLowerCase());
                  const sortedTierQuotes = [...tierQuotes].sort((a, b) => {
                    if (String(a.id) === String(app?.confirmedQuoteId) || a.isConfirmed) return -1;
                    if (String(b.id) === String(app?.confirmedQuoteId) || b.isConfirmed) return 1;
                    return (Number(b.revisionNo || b.revision || 0)) - (Number(a.revisionNo || a.revision || 0));
                  });
                  const currentQuote = sortedTierQuotes[0];
                  const previousRevisions = sortedTierQuotes.slice(1);
                  const isAnyConfirmed = Boolean(app?.confirmedQuoteId || quotationsList.some(q => q.isConfirmed || q.status === 'CONFIRMED'));

                  return (
                    <View
                      key={tierCfg.id}
                      style={{
                        backgroundColor: isDark ? '#141414' : '#FFFFFF',
                        borderRadius: 18,
                        padding: 14,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: isDark ? '#262626' : '#E2E8F0',
                      }}
                    >
                      {/* Tier Section Header */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                        paddingBottom: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? '#262626' : '#F1F5F9',
                      }}>
                        <View style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: isDark ? tierCfg.darkBg : tierCfg.lightBg,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 10,
                        }}>
                          <Ionicons name={tierCfg.icon} size={18} color={tierCfg.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: tierCfg.color }}>
                              {tierCfg.title}
                            </Text>
                            <View style={{
                              backgroundColor: isDark ? tierCfg.darkBg : tierCfg.badgeBg,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}>
                              <Text style={{ fontSize: 9.5, fontWeight: '700', color: tierCfg.color }}>
                                {tierCfg.warranty || 'Warranty'}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }} numberOfLines={1}>
                            {tierCfg.subtitle}
                          </Text>
                        </View>
                      </View>

                      {/* When no quotation exists for this tier */}
                      {sortedTierQuotes.length === 0 ? (
                        <TouchableOpacity
                          style={{
                            borderWidth: 1.5,
                            borderStyle: 'dashed',
                            borderColor: isDark ? '#334155' : '#CBD5E1',
                            borderRadius: 12,
                            padding: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDark ? '#0F172A22' : '#F8FAFC',
                            opacity: 1,
                          }}
                          onPress={() => {
                            if (app?.confirmedQuoteId) {
                              setLockConfirmModal({
                                visible: true,
                                actionType: 'unlock',
                                title: 'Project Locked 🔒',
                                message: 'A quotation is currently confirmed and locked for this project. Unlock it first to create a quotation.',
                                quoteId: app.confirmedQuoteId,
                                confirmText: 'Unlock',
                                cancelText: 'Cancel',
                              });
                            } else {
                              handleOpenSelectTiersModal([tierCfg.id]);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tierCfg.color }}>
                            No {tierCfg.title} yet • Tap to create
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          {/* 1. CURRENT / MAIN PACKAGE QUOTATION CARD */}
                          {(() => {
                            const quote = currentQuote;
                            const revLabel = quote.revisionLabel || `Revision #${quote.revisionNo || quote.revision || sortedTierQuotes.length}`;
                            const isConfirmed = String(app?.confirmedQuoteId) === String(quote.id) || Boolean(quote.isConfirmed);
                            const isAnyConfirmed = Boolean(app?.confirmedQuoteId || quotationsList.some(q => q.isConfirmed));
                            const isLocked = isAnyConfirmed && !isConfirmed;
                            const isQuoteLocked = Boolean(
                              isConfirmed ||
                              isLocked ||
                              quote.isLocked ||
                              quote.status === 'CONFIRMED' ||
                              quote.status === 'LOCKED' ||
                              (payView?.isConfirmed && String(payView?.id) === String(quote.id)) ||
                              payView?.isReceiptLocked
                            );
                            const sCount = quote.servicesList?.length || 0;

                            return (
                              <View
                                key={`current-${quote.id}`}
                                style={{
                                  borderWidth: isConfirmed ? 1.8 : 1.2,
                                  borderColor: isConfirmed ? '#10B981' : (isDark ? '#334155' : '#E2E8F0'),
                                  borderRadius: 14,
                                  padding: 12,
                                  backgroundColor: isConfirmed
                                    ? (isDark ? '#06281E' : '#F0FDF4')
                                    : (isLocked ? (isDark ? '#111111' : '#F8FAFC') : (isDark ? '#1A1A1A' : '#FFFFFF')),
                                  opacity: isLocked ? 0.7 : 1,
                                  marginBottom: previousRevisions.length > 0 ? 12 : 0,
                                }}
                              >
                                {/* Header: Status Tag + Revision + Date + Delete Button */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexWrap: 'wrap', gap: 6 }}>
                                    <View style={{
                                      backgroundColor: isConfirmed ? '#DCFCE7' : (isDark ? tierCfg.darkBg : tierCfg.badgeBg),
                                      paddingHorizontal: 8,
                                      paddingVertical: 3.5,
                                      borderRadius: 6,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                    }}>
                                      {isConfirmed && <Ionicons name="lock-closed" size={11} color="#16A34A" style={{ marginRight: 3 }} />}
                                      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '800', color: isConfirmed ? '#16A34A' : tierCfg.color }}>
                                        {isConfirmed ? 'CONFIRMED' : (previousRevisions.length > 0 ? `${revLabel} (Current)` : revLabel)}
                                      </Text>
                                    </View>

                                    {(quote.quotationDate || quote.date) && (
                                      <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '500' }}>
                                        • {quote.quotationDate || quote.date}
                                      </Text>
                                    )}
                                  </View>

                                  {!isInitialPaymentReceived && !isConfirmed && !isFinalPaymentMade && (
                                    <TouchableOpacity
                                      onPress={() => {
                                        const targetQuoteId = quote.id || quote.quotationId;
                                        setDeleteModalConfig({
                                          visible: true,
                                          title: 'Delete Revision?',
                                          message: `Are you sure you want to delete ${revLabel} (₹${Math.round(quote.total || quote.amount || 0).toLocaleString()})? This action cannot be undone.`,
                                          confirmText: 'Delete',
                                          isDeleting: false,
                                          onConfirm: async () => {
                                            setDeleteModalConfig(prev => ({ ...prev, isDeleting: true }));
                                            try {
                                              setApiQuotations(prev => prev.filter(q => String(q.id || q.quotationId) !== String(targetQuoteId)));
                                              await deleteQuotation(app.id, targetQuoteId);
                                              await loadCustomerData();
                                            } catch (err) {
                                              console.warn('Error deleting quotation revision:', err);
                                            } finally {
                                              setDeleteModalConfig({ visible: false, title: '', message: '', onConfirm: null, isDeleting: false });
                                            }
                                          },
                                        });
                                      }}
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        backgroundColor: isDark ? '#2D1F1F' : '#FEE2E2',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: isDark ? '#4C2424' : '#FECACA',
                                      }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      activeOpacity={0.7}
                                    >
                                      <Ionicons name="close" size={14} color="#EF4444" />
                                    </TouchableOpacity>
                                  )}
                                </View>

                                {/* Price Row */}
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: sCount > 0 ? 6 : 10 }}>
                                  <Text style={{ fontSize: 20, fontWeight: '800', color: isConfirmed ? '#10B981' : (isDark ? '#FFFFFF' : '#0F172A') }}>
                                    ₹{Math.round(quote.total != null ? quote.total : (quote.amount != null ? quote.amount : (quote.totalAmount || 0))).toLocaleString()}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginLeft: 6, fontWeight: '600' }}>
                                    {quote.gstAdded ? '(incl. GST)' : '(excl. GST)'}
                                  </Text>
                                </View>

                                {/* Services info preview if available */}
                                {sCount > 0 && (
                                  <View style={{ marginBottom: 10 }}>
                                    <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', lineHeight: 16 }} numberOfLines={2}>
                                      Includes {sCount} {sCount === 1 ? 'service' : 'services'}: {quote.servicesList.map(s => s.serviceName || s.service).filter(Boolean).join(', ')}
                                    </Text>
                                  </View>
                                )}

                                {/* Action Buttons Row */}
                                <View style={{ flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: isDark ? '#262626' : '#F1F5F9', paddingTop: 9, alignItems: 'center' }}>
                                  {isFinalPaymentMade ? (
                                    /* Final payment made — only View PDF is available */
                                    <TouchableOpacity
                                      style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 7.5,
                                        paddingHorizontal: 8,
                                        backgroundColor: isConfirmed ? '#10B981' : tierCfg.color,
                                        borderRadius: 8,
                                      }}
                                      onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: quote.id } })}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="document-text" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' }}>View PDF</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <>
                                  {isConfirmed ? (
                                    <TouchableOpacity
                                      onPress={() => {
                                        if (isAdminOrMaster) {
                                          setLockConfirmModal({
                                            visible: true,
                                            actionType: 'unlock',
                                            title: 'Unlock Quotation?',
                                            message: 'Do you want to unlock this quotation to allow selecting or editing other package tiers?',
                                            quoteId: quote.id,
                                            confirmText: 'Unlock',
                                            cancelText: 'Cancel',
                                          });
                                        } else if (app?.unlockRequested) {
                                          Alert.alert(
                                            'Request Pending ⏳',
                                            'Your request to edit this quotation has been submitted to Admin/Master and is awaiting approval.'
                                          );
                                        } else {
                                          Alert.alert(
                                            'Quotation Locked',
                                            'This quotation is confirmed and locked. Only Admin or Master can unlock it. Would you like to submit a request to edit?',
                                            [
                                              { text: 'Cancel', style: 'cancel' },
                                              {
                                                text: 'Request to Edit',
                                                onPress: () => {
                                                  requestQuotationUnlock(app.id, quote.id, currentUser?.name || 'Technician');
                                                  showAlert('Request Submitted', 'Your request to edit this quotation has been sent to Admin.', 'success');
                                                }
                                              }
                                            ]
                                          );
                                        }
                                      }}
                                      style={{
                                        flex: 1.3,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#DCFCE7',
                                        paddingVertical: 7.5,
                                        paddingHorizontal: 8,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: '#86EFAC',
                                      }}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="lock-closed" size={12} color="#16A34A" style={{ marginRight: 3 }} />
                                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>CONFIRMED</Text>
                                    </TouchableOpacity>
                                  ) : isLocked ? (
                                    <View style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: isDark ? '#334155' : '#E2E8F0',
                                      paddingVertical: 7.5,
                                      paddingHorizontal: 8,
                                      borderRadius: 8,
                                    }}>
                                      <Ionicons name="lock-closed" size={11} color="#64748B" style={{ marginRight: 3 }} />
                                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B' }}>LOCKED</Text>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      onPress={() => {
                                        setLockConfirmModal({
                                          visible: true,
                                          actionType: 'lock',
                                          title: 'Confirm & Lock Quotation?',
                                          message: `Are you sure you want to confirm this ${tierCfg.title} (${revLabel}) and lock the project to this quote?`,
                                          warningNote: 'Note: All other quotations for this project will be deleted.',
                                          quoteId: quote.id,
                                          confirmText: 'Confirm & Lock',
                                          cancelText: 'Cancel',
                                        });
                                      }}
                                      style={{
                                        flex: 1.3,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                                        paddingVertical: 7.5,
                                        paddingHorizontal: 8,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: '#6EE7B7',
                                      }}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="checkmark-circle-outline" size={13} color="#059669" style={{ marginRight: 3 }} />
                                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>Confirm & Lock</Text>
                                    </TouchableOpacity>
                                  )}

                                  {/* Edit Button */}
                                  <TouchableOpacity
                                    disabled={isQuoteLocked}
                                    style={{
                                      flex: 0.9,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      paddingVertical: 7.5,
                                      paddingHorizontal: 8,
                                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: isDark ? '#334155' : '#CBD5E1',
                                      opacity: isQuoteLocked ? 0.45 : 1,
                                    }}
                                    onPress={() => {
                                      if (isQuoteLocked) {
                                        Alert.alert('Quotation Locked', 'This quotation is locked and cannot be edited.');
                                        return;
                                      }
                                      const targetQId = quote.id || quote.quotationId;
                                      router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                                    }}
                                    activeOpacity={isQuoteLocked ? 1 : 0.8}
                                  >
                                    <Ionicons name={isQuoteLocked ? "lock-closed" : "pencil"} size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>{isQuoteLocked ? 'Locked' : 'Edit'}</Text>
                                  </TouchableOpacity>

                                  {/* View PDF Button */}
                                  <TouchableOpacity
                                    style={{
                                      flex: 1.1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      paddingVertical: 7.5,
                                      paddingHorizontal: 8,
                                      backgroundColor: isConfirmed ? '#10B981' : tierCfg.color,
                                      borderRadius: 8,
                                    }}
                                    onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: quote.id } })}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="document-text" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' }}>View PDF</Text>
                                  </TouchableOpacity>
                                    </>
                                  )}
                                </View>
                              </View>
                            );
                          })()}

                          {/* 2. PREVIOUS REVISIONS HISTORY LIST */}
                          {previousRevisions.length > 0 && (
                            <View style={{
                              backgroundColor: isDark ? '#0D0D0D' : '#F8FAFC',
                              borderRadius: 14,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: isDark ? '#262626' : '#E2E8F0',
                            }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
                                <Ionicons name="git-branch-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 5 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
                                  Previous Revisions ({previousRevisions.length})
                                </Text>
                              </View>

                              {previousRevisions.map((revQuote, rIdx) => {
                                const rRevLabel = revQuote.revisionLabel || `Revision #${revQuote.revisionNo || revQuote.revision || (previousRevisions.length - rIdx)}`;
                                const rAmount = Math.round(revQuote.total != null ? revQuote.total : (revQuote.amount != null ? revQuote.amount : (revQuote.totalAmount || 0)));

                                const isRevQuoteLocked = Boolean(
                                  isAnyConfirmed ||
                                  revQuote.isConfirmed ||
                                  revQuote.isLocked ||
                                  revQuote.status === 'CONFIRMED' ||
                                  revQuote.status === 'LOCKED' ||
                                  payView?.isReceiptLocked
                                );

                                return (
                                  <View
                                    key={`rev-${revQuote.id || rIdx}`}
                                    style={{
                                      backgroundColor: isDark ? '#171717' : '#FFFFFF',
                                      borderRadius: 10,
                                      padding: 10,
                                      marginBottom: rIdx === previousRevisions.length - 1 ? 0 : 8,
                                      borderWidth: 1,
                                      borderColor: isDark ? '#262626' : '#E2E8F0',
                                    }}
                                  >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                                        <View style={{
                                          backgroundColor: isDark ? '#334155' : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 2,
                                          borderRadius: 4,
                                        }}>
                                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#E2E8F0' : '#475569' }}>
                                            {rRevLabel}
                                          </Text>
                                        </View>
                                        {(revQuote.quotationDate || revQuote.date) && (
                                          <Text style={{ fontSize: 10.5, color: isDark ? '#94A3B8' : '#64748B' }}>
                                            • {revQuote.quotationDate || revQuote.date}
                                          </Text>
                                        )}
                                      </View>

                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                          ₹{rAmount.toLocaleString()}
                                        </Text>

                                        {!isFinalPaymentMade && (
                                          <TouchableOpacity
                                            onPress={() => {
                                              const targetQuoteId = revQuote.id || revQuote.quotationId;
                                              setDeleteModalConfig({
                                                visible: true,
                                                title: 'Delete Revision?',
                                                message: `Are you sure you want to delete ${rRevLabel} (₹${rAmount.toLocaleString()})? This action cannot be undone.`,
                                                confirmText: 'Delete',
                                                isDeleting: false,
                                                onConfirm: async () => {
                                                  setDeleteModalConfig(prev => ({ ...prev, isDeleting: true }));
                                                  try {
                                                    setApiQuotations(prev => prev.filter(q => String(q.id || q.quotationId) !== String(targetQuoteId)));
                                                    await deleteQuotation(app.id, targetQuoteId);
                                                    await loadCustomerData();
                                                  } catch (err) {
                                                    console.warn('Error deleting quotation revision:', err);
                                                  } finally {
                                                    setDeleteModalConfig({ visible: false, title: '', message: '', onConfirm: null, isDeleting: false });
                                                  }
                                                },
                                              });
                                            }}
                                            style={{
                                              width: 20,
                                              height: 20,
                                              borderRadius: 10,
                                              backgroundColor: isDark ? '#2D1F1F' : '#FEE2E2',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                            }}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                          >
                                            <Ionicons name="close" size={12} color="#EF4444" />
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    </View>

                                    {/* Previous revision action row */}
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                      {/* View PDF always visible */}
                                      <TouchableOpacity
                                        style={{
                                          flex: 1,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          paddingVertical: 5,
                                          backgroundColor: isDark ? '#262626' : '#F1F5F9',
                                          borderRadius: 6,
                                        }}
                                        onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: revQuote.id } })}
                                        activeOpacity={0.8}
                                      >
                                        <Ionicons name="document-text-outline" size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>View PDF</Text>
                                      </TouchableOpacity>

                                      {/* Revise only when final payment not yet made */}
                                      {!isFinalPaymentMade && (
                                        <TouchableOpacity
                                            disabled={isRevQuoteLocked}
                                            style={{
                                              flex: 1,
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              paddingVertical: 5,
                                              backgroundColor: isDark ? '#262626' : '#F1F5F9',
                                              borderRadius: 6,
                                              opacity: isRevQuoteLocked ? 0.45 : 1,
                                            }}
                                            onPress={() => {
                                              if (isRevQuoteLocked) {
                                                Alert.alert('Quotation Locked', 'This quotation is locked and cannot be edited.');
                                                return;
                                              }
                                              const targetQId = revQuote.id || revQuote.quotationId;
                                              router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                                            }}
                                            activeOpacity={isRevQuoteLocked ? 1 : 0.8}
                                          >
                                            <Ionicons name={isRevQuoteLocked ? "lock-closed-outline" : "pencil-outline"} size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
                                              {isRevQuoteLocked ? 'Locked' : 'Revise'}
                                            </Text>
                                          </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })
                )}

                {/* Add Additional Service Button as new at the bottom of Quotation Tab */}
                {isInitialPaymentReceived && !isReceiptLocked && !isFinalPaymentMade && (
                  <View style={{ marginTop: 16 }}>
                    <TouchableOpacity
                      style={{
                        height: 50,
                        borderRadius: 14,
                        backgroundColor: '#059669',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        shadowColor: '#059669',
                        shadowOpacity: 0.25,
                        shadowOffset: { width: 0, height: 4 },
                        shadowRadius: 8,
                        elevation: 3,
                      }}
                      onPress={() => {
                        const targetQuoteId =
                          app?.confirmedQuoteId ||
                          app?.activeQuotationId ||
                          payView?.id ||
                          payView?.quotationId ||
                          quotationsList.find((q) => q.isConfirmed)?.id ||
                          quotationsList[0]?.id;
                        router.push({
                          pathname: '/additional-payment',
                          params: {
                            id: app.id,
                            quotationId: targetQuoteId ? String(targetQuoteId) : '',
                            clientName: app.customerName || app.name || '',
                          },
                        });
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                        Add Additional Service
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}





              </>
            )}
          </View>
        )}

        {/* TAB 3: PAYMENTS & DIRECT SETTLEMENT (API v2) */}
        {activeTabSection === 'payment' && (
          <View style={{ marginBottom: 20 }}>
            {(!app?.confirmedQuoteId && !payView?.id && !payView?.quotationId && !app?.activeQuotationId && quotationsList.length === 0) ? (
              /* EMPTY STATE: NO QUOTATION BOOKED YET */
              <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? '#080808' : '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#D1E5F7' }}>
                  <Ionicons name="alert-circle-outline" size={32} color="#0052CC" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 6, textAlign: 'center' }}>
                  No Quotation Booked
                </Text>
                <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 18, paddingHorizontal: 10 }}>
                  Payments can only be recorded after a quotation is created and saved for this customer.
                </Text>

                <TouchableOpacity
                  style={{ backgroundColor: '#0052CC', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => handleOpenSelectTiersModal(['economic', 'premium', 'elite'])}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Create Quotation Now</Text>
                </TouchableOpacity>
              </View>
            ) : (() => {
              const activeQuoteId = String(payView?.quotationId || payView?.id || app?.confirmedQuoteId || app?.activeQuotationId || (quotationsList[0]?.id) || '');
              const pricing = payView?.pricing || {};
              const progress = payView?.progress || {};

              const withoutGstTotal = Math.round(Number(pricing.withoutGstTotal ?? payView?.totalPrice ?? payView?.subtotalAfterDiscount ?? payView?.grossSubtotal ?? app?.totalCost ?? 0));
              const withGstTotal = Math.round(Number(pricing.withGstTotal ?? payView?.totalWithGst ?? (withoutGstTotal > 0 ? Math.round(withoutGstTotal * 1.18) : 0)));
              const totalPaid = Math.round(Number(progress.totalPaid ?? payView?.totalPaid ?? 0));
              const withoutGstBalance = Math.round(Number(progress.withoutGstBalance ?? payView?.balanceAmount ?? Math.max(0, withoutGstTotal - totalPaid)));
              const withGstBalance = Math.round(Number(progress.withGstBalance ?? Math.max(0, withGstTotal - totalPaid)));

              const historyList = Array.isArray(payView?.history)
                ? payView.history
                : (Array.isArray(payView?.payments) ? payView.payments : []);

              const unverifiedPayment = historyList.find((p) => p.isVerified === false || p.verificationStatus === 'pending');
              const hasUnverified = Boolean(unverifiedPayment || payView?.hasUnverifiedPayments);

              const paymentStatus = progress.paymentStatus || (totalPaid === 0 ? 'UNPAID' : (withoutGstBalance <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID'));
              const paidPct = withoutGstTotal > 0 ? Math.min(100, Math.round((totalPaid / withoutGstTotal) * 100)) : (totalPaid > 0 ? 100 : 0);

              const statusColor = paymentStatus === 'FULLY_PAID' ? '#10B981' : (paymentStatus === 'PARTIALLY_PAID' ? '#2557C7' : '#F59E0B');
              const statusBg = paymentStatus === 'FULLY_PAID' ? (isDark ? '#064E3B' : '#DCFCE7') : (paymentStatus === 'PARTIALLY_PAID' ? (isDark ? '#1E3A8A' : '#EFF6FF') : (isDark ? '#78350F' : '#FEF3C7'));

              return (
                <View>
                  {/* Top Header: Title & Badges */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        Quotation Payments
                      </Text>
                      <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                        Direct settlement & installment tracking
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ backgroundColor: statusBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
                          {paymentStatus.replace('_', ' ')}
                        </Text>
                      </View>
                      {hasUnverified && (
                        <View style={{ backgroundColor: isDark ? '#78350F' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>
                            In Review
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Financial Overview Card */}
                  <View style={{
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderRadius: 18,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    marginBottom: 14,
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 6,
                    elevation: 2,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View>
                        <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Quotation Total
                        </Text>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 3 }}>
                          ₹{withoutGstTotal.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar Track */}
                    <View style={{ height: 8, backgroundColor: isDark ? '#334155' : '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                      <View style={{ height: '100%', width: (paidPct + '%'), backgroundColor: paidPct === 100 ? '#10B981' : '#2557C7', borderRadius: 4 }} />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>
                        Paid so far: <Text style={{ color: '#10B981', fontWeight: '700' }}>₹{totalPaid.toLocaleString()}</Text> ({paidPct}%)
                      </Text>
                      {payView?.gstDecision && payView.gstDecision !== 'PENDING' && (
                        <View style={{ backgroundColor: payView.gstDecision === 'APPLIED' ? '#DCFCE7' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: payView.gstDecision === 'APPLIED' ? '#166534' : '#475569' }}>
                            GST: {payView.gstDecision}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Dual Highlighted Balance Cards */}
                  

                  {/* Sequential Verification Guard Warning */}
                  {hasUnverified && (
                    <View style={{
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
                      borderWidth: 1,
                      borderColor: isDark ? '#78350F' : '#FDE68A',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <Ionicons name="shield-outline" size={20} color="#D97706" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FBBF24' : '#92400E' }}>
                          Sequential Verification Required
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#FDE68A' : '#B45309', marginTop: 1 }}>
                          {'Payment #' + (unverifiedPayment?.id || '') + ' is awaiting Admin verification. Previous payment must be verified before recording next payment.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons Row */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                    {isReceiptGenerated || canGenerateReceipt || (paymentStatus === 'FULLY_PAID' || progress.paymentStatus === 'FULLY_PAID' || (withoutGstBalance <= 0 && totalPaid > 0)) ? (
                      <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
                        {(() => {
                          const isReadyToGenerate = isReceiptGenerated || canGenerateReceipt;
                          let unreadyReason = '';
                          if (!isReadyToGenerate) {
                            if (!isQuotationConfirmed) {
                              unreadyReason = 'Quotation not confirmed';
                            } else if (hasUnverified) {
                              unreadyReason = 'Payment awaiting verification';
                            } else if (payView?.allServicesCompleted === false) {
                              unreadyReason = 'Services not completed';
                            } else if (payView?.gstDecision === 'PENDING') {
                              unreadyReason = 'GST decision pending';
                            } else if (withoutGstBalance > 0) {
                              unreadyReason = `Balance remaining: ₹${withoutGstBalance.toLocaleString('en-IN')}`;
                            } else {
                              unreadyReason = 'Receipt conditions pending';
                            }
                          }

                          return (
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 12,
                                backgroundColor: isReadyToGenerate
                                  ? '#059669'
                                  : (isDark ? '#334155' : '#CBD5E1'),
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                shadowColor: '#059669',
                                shadowOpacity: isReadyToGenerate ? 0.25 : 0,
                                shadowOffset: { width: 0, height: 2 },
                                shadowRadius: 4,
                                elevation: isReadyToGenerate ? 3 : 0,
                              }}
                              disabled={isGeneratingReceipt}
                              onPress={async () => {
                                if (!activeQuoteId) return;

                                if (!isReadyToGenerate) {
                                  Alert.alert(
                                    'Receipt Unavailable',
                                    `The official final receipt cannot be generated yet:\n\n• ${unreadyReason}\n\nAll conditions (confirmed quotation, all services completed, GST decision confirmed, 0 balance, and admin verification of all payments) must be satisfied.`,
                                    [{ text: 'OK' }]
                                  );
                                  return;
                                }

                                const isWithGst = Boolean(
                                  payView?.gstDecision === 'APPLIED' ||
                                  payView?.withGst ||
                                  payView?.isGst ||
                                  app?.hasGst
                                );
                                const customerGst =
                                  payView?.customerGstNumber ||
                                  app?.customerGstNumber ||
                                  app?.gstNumber ||
                                  app?.gstin ||
                                  '';

                                if (isReceiptGenerated) {
                                  // Already generated: Open official Full Receipt Screen directly (no duplicate POST)
                                  router.push({
                                    pathname: '/receipt',
                                    params: {
                                      id: app?.id,
                                      quotationId: activeQuoteId,
                                      isFullServiceReceipt: 'true',
                                      receiptNumber: payView?.receipt?.receiptNumber || payView?.receiptNumber || app?.receiptNumber || '',
                                      hasGst: isWithGst ? 'true' : 'false',
                                      gstNumber: customerGst,
                                      totalCost: String(withoutGstTotal || app?.totalCost || ''),
                                      amount: String(totalPaid || withoutGstTotal || ''),
                                      stage: isWithGst ? 'Full Project Settlement (with GST)' : 'Full Project Settlement',
                                    },
                                  });
                                  return;
                                }

                                // Not yet generated: call POST /api/v2/quotations/:id/final-receipt with double-tap guard
                                setIsGeneratingReceipt(true);
                                try {
                                  const res = await paymentRepository.generateFinalReceipt(
                                    activeQuoteId,
                                    customerGst || null,
                                    isWithGst
                                  );
                                  const recData = res?.data;
                                  const recNo = recData?.receiptNumber || res?.receiptNumber;
                                  if (recNo) {
                                    setClientData((prev) => (prev ? {
                                      ...prev,
                                      isReceiptGenerated: true,
                                      fullReceiptGenerated: true,
                                      receiptNumber: recNo,
                                      isReceiptLocked: true,
                                      receiptStatus: 'GENERATED',
                                    } : prev));
                                    setPayView((prev) => (prev ? {
                                      ...prev,
                                      isReceiptGenerated: true,
                                      fullReceiptGenerated: true,
                                      receiptNumber: recNo,
                                      isReceiptLocked: true,
                                      receiptStatus: 'GENERATED',
                                      receipt: {
                                        ...(prev.receipt || {}),
                                        isReceiptGenerated: true,
                                        receiptNumber: recNo,
                                        isReceiptLocked: true,
                                        receiptStatus: 'GENERATED',
                                      },
                                    } : prev));
                                  }

                                  router.push({
                                    pathname: '/receipt',
                                    params: {
                                      id: app?.id,
                                      quotationId: activeQuoteId,
                                      isFullServiceReceipt: 'true',
                                      receiptNumber: recNo || '',
                                      hasGst: isWithGst ? 'true' : 'false',
                                      gstNumber: customerGst,
                                      totalCost: String(recData?.grossSubtotal || withoutGstTotal || app?.totalCost || ''),
                                      amount: String(recData?.totalPaid || totalPaid || withoutGstTotal || ''),
                                      stage: isWithGst ? 'Full Project Settlement (with GST)' : 'Full Project Settlement',
                                    },
                                  });
                                } catch (err) {
                                  Alert.alert(
                                    'Receipt Generation Error',
                                    err?.message || 'Failed to generate official final receipt.'
                                  );
                                } finally {
                                  setIsGeneratingReceipt(false);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              {isGeneratingReceipt ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Ionicons
                                  name={isReadyToGenerate ? 'receipt-outline' : 'lock-closed-outline'}
                                  size={18}
                                  color={isReadyToGenerate ? '#FFFFFF' : '#64748B'}
                                />
                              )}
                              <Text style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: isReadyToGenerate ? '#FFFFFF' : '#64748B',
                              }}>
                                {isGeneratingReceipt
                                  ? 'Generating...'
                                  : isReceiptGenerated
                                    ? 'View Full Receipt'
                                    : isReadyToGenerate
                                      ? 'Generate Full Receipt'
                                      : unreadyReason}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            height: 46,
                            borderRadius: 12,
                            backgroundColor: hasUnverified || withoutGstBalance <= 0 || isReceiptLocked ? (isDark ? '#334155' : '#E2E8F0') : '#2557C7',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                          disabled={hasUnverified || withoutGstBalance <= 0 || isReceiptLocked}
                          onPress={() => {
                            router.push({
                              pathname: '/payment-form',
                              params: {
                                id: app.id,
                                quotationId: activeQuoteId,
                                remainingBalance: String(withoutGstBalance),
                                withGstBalance: String(withGstBalance),
                                withoutGstTotal: String(withoutGstTotal),
                                clientName: app.customerName || app.name || '',
                                mobileNumber: app.customerPhone || app.phone || '',
                              },
                            });
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add-circle" size={18} color={hasUnverified || withoutGstBalance <= 0 || isReceiptLocked ? '#94A3B8' : '#FFFFFF'} />
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: hasUnverified || withoutGstBalance <= 0 || isReceiptLocked ? '#94A3B8' : '#FFFFFF',
                          }}>
                            Add Payment
                          </Text>
                        </TouchableOpacity>

                        {withoutGstBalance > 0 && !isReceiptLocked && (
                          <TouchableOpacity
                            style={{
                              height: 46,
                              paddingHorizontal: 16,
                              borderRadius: 12,
                              backgroundColor: hasUnverified ? (isDark ? '#334155' : '#E2E8F0') : '#059669',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                            disabled={hasUnverified}
                            onPress={() => {
                              router.push({
                                pathname: '/payment-form',
                                params: {
                                  id: app.id,
                                  quotationId: activeQuoteId,
                                  isFinalSettlement: 'true',
                                  remainingBalance: String(withoutGstBalance),
                                  withGstBalance: String(withGstBalance),
                                  withoutGstTotal: String(withoutGstTotal),
                                  clientName: app.customerName || app.name || '',
                                  mobileNumber: app.customerPhone || app.phone || '',
                                },
                              });
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-done" size={18} color={hasUnverified ? '#94A3B8' : '#FFFFFF'} />
                            <Text style={{
                              fontSize: 14,
                              fontWeight: '700',
                              color: hasUnverified ? '#94A3B8' : '#FFFFFF',
                            }}>
                              Final Settlement
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>

                  {/* Audit History Chain / Recorded Payments */}
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        Payment History ({historyList.length})
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>
                        Total: ₹{totalPaid.toLocaleString()}
                      </Text>
                    </View>

                    {historyList.length === 0 ? (
                      <View style={{
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        borderRadius: 16,
                        padding: 24,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                      }}>
                        <Ionicons name="receipt-outline" size={32} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#CBD5E1' : '#334155' }}>
                          No payments recorded yet
                        </Text>
                        <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', marginTop: 4 }}>
                          Tap "+ Add Payment" above to record the first payment for this quotation.
                        </Text>
                      </View>
                    ) : (
                      historyList.map((pay, idx) => {
                        const isVerified = Boolean(pay.isVerified);
                        const isFinal = Boolean(pay.isFinalPayment);
                        return (
                          <View
                            key={pay.id || ('pay_' + idx)}
                            style={{
                              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                              borderRadius: 16,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: isDark ? '#334155' : '#E2E8F0',
                            }}
                          >
                            {/* Card Top: Payment # & Amount */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                    Payment {pay.id}
                                  </Text>
                                  <View style={{
                                    backgroundColor: pay.paymentMethod === 'UPI' ? '#E0F2FE' : (pay.paymentMethod === 'ACCOUNT' ? '#EDE9FE' : '#FEF3C7'),
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                  }}>
                                    <Text style={{
                                      fontSize: 10,
                                      fontWeight: '800',
                                      color: pay.paymentMethod === 'UPI' ? '#0369A1' : (pay.paymentMethod === 'ACCOUNT' ? '#6D28D9' : '#B45309'),
                                    }}>
                                      {pay.paymentMethod || 'PAYMENT'}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                                  {pay.paymentDate || pay.createdAt ? formatDateDDMMYY(pay.paymentDate || pay.createdAt) : ''}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 17, fontWeight: '800', color: '#10B981' }}>
                                ₹{Number(pay.amount || 0).toLocaleString()}
                              </Text>
                            </View>

                            {/* Audit Ledger Chain: Balance Before -> Balance After */}
                            {(pay.balanceBefore != null || pay.balanceAfter != null) && (
                              <View style={{
                                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 8,
                              }}>
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  Balance: <Text style={{ fontWeight: '600' }}>₹{Number(pay.balanceBefore || 0).toLocaleString()}</Text>
                                </Text>
                                <Ionicons name="arrow-forward" size={12} color="#94A3B8" />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                  ₹{Number(pay.balanceAfter || 0).toLocaleString()}
                                </Text>
                              </View>
                            )}

                            {/* Reference / Upi / Account Info */}
                            <View style={{ marginBottom: 6 }}>
                              {Boolean(pay.referenceNumber) && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  Ref: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>{pay.referenceNumber}</Text>
                                </Text>
                              )}
                              {Boolean(pay.upiId) && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  UPI ID: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>{pay.upiId}</Text>
                                </Text>
                              )}
                              {Boolean(pay.voucher) && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  Voucher: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>{pay.voucher}</Text>
                                </Text>
                              )}
                              {pay.account && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  Bank: {pay.account.bankName} ({pay.account.accountNumber ? ('...' + String(pay.account.accountNumber).slice(-4)) : ''})
                                </Text>
                              )}
                              {pay.receivedBy && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                                  Received by: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>{pay.receivedBy}</Text>
                                </Text>
                              )}
                            </View>

                            {/* Notes */}
                            {Boolean(pay.notes) && (
                              <Text style={{ fontSize: 11, fontStyle: 'italic', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8 }}>
                                {'"' + pay.notes + '"'}
                              </Text>
                            )}

                            {/* Verification Footer & Admin Action Buttons */}
                            <View style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: 8,
                              borderTopWidth: 1,
                              borderTopColor: isDark ? '#334155' : '#F1F5F9',
                            }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isVerified ? '#10B981' : '#F59E0B' }} />
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  color: isVerified ? '#10B981' : '#D97706',
                                }}>
                                  {isVerified ? ('Verified by ' + (pay.verifiedBy || 'Admin')) : 'Pending Admin Verification'}
                                </Text>
                              </View>

                              {/* Admin Inline Actions */}
                              {isAdminOrMaster && !isVerified && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const quoteId =
                                      pay.quotationId ||
                                      activeQuoteId ||
                                      payView?.id ||
                                      payView?.quotationId ||
                                      app?.confirmedQuoteId ||
                                      app?.activeQuotationId;
                                    router.push({
                                      pathname: '/payment-verification',
                                      params: {
                                        id: app?.id || params.id,
                                        quotationId: quoteId ? String(quoteId) : undefined,
                                        paymentId: String(pay.id),
                                        amount: String(pay.amount || ''),
                                        paymentMethod: pay.method || pay.paymentMethod || '',
                                        voucher: pay.voucher || '',
                                        clientName: app?.customerName || app?.name || app?.clientName || '',
                                        serviceTitle: activeQuote?.title || app?.service || '',
                                      },
                                    });
                                  }}
                                  style={{
                                    backgroundColor: '#2557C7',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                                    Verify
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Payment Card Actions: View Receipt & Share Document */}
                            <View style={{
                              flexDirection: 'row',
                              gap: 8,
                              marginTop: 10,
                              paddingTop: 10,
                              borderTopWidth: 1,
                              borderTopColor: isDark ? '#334155' : '#F1F5F9',
                            }}>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  height: 38,
                                  borderRadius: 10,
                                  backgroundColor: isDark ? 'rgba(37,87,199,0.15)' : '#EFF6FF',
                                  borderWidth: 1,
                                  borderColor: isDark ? '#1E3A8A' : '#BFDBFE',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                }}
                                onPress={() => handleViewReceipt(pay)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="receipt-outline" size={16} color="#2557C7" />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#2557C7' }}>
                                  View Receipt
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  height: 38,
                                  borderRadius: 10,
                                  backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5',
                                  borderWidth: 1,
                                  borderColor: isDark ? '#065F46' : '#A7F3D0',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                }}
                                onPress={() => handleShareDocument(pay)}
                                disabled={sharingPaymentId === pay.id}
                                activeOpacity={0.8}
                              >
                                {sharingPaymentId === pay.id ? (
                                  <ActivityIndicator size="small" color="#059669" />
                                ) : (
                                  <Ionicons name="share-social-outline" size={16} color="#059669" />
                                )}
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                                  {sharingPaymentId === pay.id ? 'Preparing...' : 'Share Document'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* TAB 4: POST-SALE WARRANTY (API v2 UNIFIED) */}
        {activeTabSection === 'warranty' && (
          <View style={{ marginHorizontal: -12, paddingHorizontal: 15 }}>
            <WarrantyTab
              quotationId={
                payView?.id ||
                app?.confirmedQuoteId ||
                app?.activeQuotationId ||
                (Array.isArray(app?.quotations) && app.quotations.find((q) => q.isConfirmed)?.id) ||
                null
              }
              app={app}
              payView={payView}
              isAdmin={isAdminOrMaster}
              onNavigatePaymentTab={() => setActiveTabSection('payment')}
            />
          </View>
        )}




      </ScrollView>



      {/* Category Services Popup Modal */}
      {activeCategoryModal && (
        <Modal visible={Boolean(activeCategoryModal)} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={[{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }]}>

              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {activeCategoryModal} Category Services
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                    Services chosen apply across Basic, Mid, and Luxury
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveCategoryModal(null)}>
                  <Ionicons name="close-circle" size={28} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              {/* Total Banner */}
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>
                  {activeCategoryModal} Total Amount (inc. Tax):
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#2563EB' }}>
                  Rs.{calculateCategoryTotal(activeCategoryModal).toLocaleString()}
                </Text>
              </View>

              {/* Services List inside Popup */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {currentServicesList.map((item, index) => {
                  const isEditing = editingServiceIndex === index;
                  const catKey = activeCategoryModal.toLowerCase();
                  const rate = catKey === 'mid' ? (item.rateMid || item.rateMedium) : (catKey === 'luxury' ? (item.rateLuxury || item.rateHigh) : item.rateBasic);
                  const area = item.area || activeQuote.area;
                  const subtotal = item[`subtotal${activeCategoryModal}`] || ((parseFloat(area) || 0) * (parseFloat(rate) || 0));

                  return (
                    <View
                      key={index}
                      style={{
                        backgroundColor: isDark ? '#080808' : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1E293B', flex: 1 }}>
                          {index + 1}. {item.serviceName || item.service}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => {
                              if (isEditing) {
                                setEditingServiceIndex(null);
                              } else {
                                setEditingServiceIndex(index);
                                setEditRateVal(rate?.toString() || '');
                                setEditAreaVal(area?.toString() || '');
                              }
                            }}
                            style={{ marginRight: 12, padding: 4 }}
                          >
                            <Ionicons name="create-outline" size={20} color="#2563EB" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteServiceItem(index)} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Specs */}
                      {item.specs && item.specs.length > 0 && (
                        <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
                          Specs: {Array.isArray(item.specs) ? item.specs.join(', ') : item.specs}
                        </Text>
                      )}

                      {!isEditing ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? '#1E293B' : '#E2E8F0' }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#475569' }}>
                            {area} sq.ft × Rs.{rate}/sq.ft
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                            Subtotal: Rs.{Math.round(subtotal).toLocaleString()}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#CBD5E1' }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', marginBottom: 6 }}>Edit Service Details:</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ width: '48%' }}>
                              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>Site Area (sq.ft)</Text>
                              <TextInput
                                style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, height: 36, fontSize: 13, color: isDark ? '#FFF' : '#000' }}
                                keyboardType="numeric"
                                value={editAreaVal}
                                onChangeText={setEditAreaVal}
                              />
                            </View>
                            <View style={{ width: '48%' }}>
                              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>{activeCategoryModal} Rate (Rs/sq.ft)</Text>
                              <TextInput
                                style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, paddingHorizontal: 8, height: 36, fontSize: 13, color: isDark ? '#FFF' : '#000' }}
                                keyboardType="numeric"
                                value={editRateVal}
                                onChangeText={setEditRateVal}
                              />
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#64748B', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 }}
                              onPress={() => setEditingServiceIndex(null)}
                            >
                              <Text style={{ color: '#FFF', fontSize: 12 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                              onPress={() => handleUpdateServiceItem(index)}
                            >
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Save Changes</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Footer Modal Action Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#64748B', flex: 1, marginRight: 6 }]}
                  onPress={() => {
                    setActiveCategoryModal(null);
                    router.push({ pathname: '/make-quotation', params: { id: app.id, quoteId: activeQuote.id } });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.btnText}>Add Service</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#10B981', flex: 2, marginLeft: 6 }]}
                  onPress={() => handleProceedToPayment(activeCategoryModal)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>Select & Pay (Rs.{calculateCategoryTotal(activeCategoryModal).toLocaleString()})</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* DatePicker Modals */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Date</Text>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  setAttendedDate(formatDate(dateValue));
                }}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setDateValue(d);
                    setAttendedDate(formatDate(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Log Warranty Claim Modal */}
      <Modal visible={showClaimModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', width: '100%', borderRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  Log Warranty Claim Ticket
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                  Claim limit: {(app.warrantyClaims || []).length} of 2 used
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowClaimModal(false)}>
                <Ionicons name="close-circle" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1E293B', marginBottom: 6 }}>
              Describe Issue / Service Needed:
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: 10, padding: 12, fontSize: 13, color: isDark ? '#FFFFFF' : '#000000', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }}
              placeholder="Ex: Minor surface sealant touchup requested on terrace corner after 2 years..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              value={claimIssueText}
              onChangeText={setClaimIssueText}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{ backgroundColor: '#64748B', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginRight: 10 }}
                onPress={() => setShowClaimModal(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#2563EB', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }}
                onPress={handleLogWarrantyClaim}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Submit Claim</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warranty Duration Modal */}
      <Modal visible={showDurationModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', width: '100%', borderRadius: 20, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  Activate Warranty
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                  Choose warranty duration for each service
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDurationModal(false)}>
                <Ionicons name="close-circle" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {currentServicesList.map((service, sIdx) => (
                <View key={sIdx} style={{ marginBottom: 20, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#E2E8F0', pb: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1E293B', marginBottom: 10 }}>
                    {sIdx + 1}. {service.serviceName || service.service}
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['5 Years', '10 Years', '12 Years', '15 Years'].map((duration) => (
                      <TouchableOpacity
                        key={duration}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          backgroundColor: serviceDurations[sIdx] === duration ? '#0052CC' : (isDark ? '#080808' : '#F8FAFC'),
                          borderWidth: 1,
                          borderColor: serviceDurations[sIdx] === duration ? '#0052CC' : (isDark ? '#334155' : '#E2E8F0'),
                        }}
                        onPress={() => setServiceDurations(prev => ({ ...prev, [sIdx]: duration }))}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: serviceDurations[sIdx] === duration ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#475569'),
                        }}>
                          {duration}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{ backgroundColor: '#64748B', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginRight: 10 }}
                onPress={() => setShowDurationModal(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#4F46E5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }}
                onPress={handleActivateWarranty}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Confirm & Activate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', width: '100%', borderRadius: 24, padding: 24 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFFFFF' : '#000000' }}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            {/* Checkboxes */}
            {STATUS_OPTIONS.map((status, idx) => (
              <TouchableOpacity
                key={idx}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
                onPress={() => setProjectStatus(status)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={projectStatus === status ? "checkbox" : "square-outline"}
                  size={24}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
                <Text style={{ fontSize: 16, color: isDark ? '#E2E8F0' : '#475569', marginLeft: 16 }}>{status}</Text>
              </TouchableOpacity>
            ))}

            {/* Save Button */}
            <TouchableOpacity
              style={{ backgroundColor: '#0052CC', borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginTop: 12, alignSelf: 'center', paddingHorizontal: 40 }}
              onPress={() => {
                updateAppointmentInspection(app.id, {
                  projectStatus,
                  siteVisited: projectStatus === 'Site Visited' ? true : (projectStatus === 'Site Visit Pending' ? false : app?.siteVisited),
                });
                setShowStatusModal(false);
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DatePicker Modals */}
      {/* 1. iOS Date picker Modal */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Date</Text>
                <TouchableOpacity onPress={() => {
                  setShowDatePicker(false);
                  setAttendedDate(formatDate(dateValue));
                }}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setDateValue(d);
                    setAttendedDate(formatDate(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* 2. Android Date picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onValueChange={(e, d) => {
            setShowDatePicker(false);
            if (d) {
              setDateValue(d);
              setAttendedDate(formatDate(d));
            }
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {/* 3. iOS Time picker Modal */}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showTimePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Time</Text>
                <TouchableOpacity onPress={() => {
                  setShowTimePicker(false);
                  setAttendedTime(formatTime(timeValue));
                }}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={timeValue}
                mode="time"
                display="spinner"
                is24Hour={false}
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setTimeValue(d);
                    setAttendedTime(formatTime(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* 4. Android Time picker */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={timeValue}
          mode="time"
          display="default"
          is24Hour={false}
          onValueChange={(e, d) => {
            setShowTimePicker(false);
            if (d) {
              setTimeValue(d);
              setAttendedTime(formatTime(d));
            }
          }}
          onDismiss={() => setShowTimePicker(false)}
        />
      )}

      {/* PREVIOUS QUOTATION DETAIL INSPECTION MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedHistoryQuote)}
        onRequestClose={() => setSelectedHistoryQuote(null)}
      >
        <TouchableOpacity
          style={styles.pickerModalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedHistoryQuote(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark, { maxHeight: '85%' }]}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {selectedHistoryQuote?.revisionLabel || `Revision #${selectedHistoryQuote?.revision || 1}`}
                  </Text>
                  <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>PREVIOUS VERSION</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  Quotation Date: {selectedHistoryQuote?.quotationDate || selectedHistoryQuote?.date}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setSelectedHistoryQuote(null)}>
                <Ionicons name="close-circle" size={28} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {/* Methodology & For info */}
              <View style={{ backgroundColor: isDark ? '#080808' : '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#334155' }}>
                  Methodology: <Text style={{ fontWeight: '400', color: isDark ? '#CBD5E1' : '#64748B' }}>{selectedHistoryQuote?.methodology || 'German Tech Waterproofing Methodology'}</Text>
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#334155', marginTop: 4 }}>
                  Site Area: <Text style={{ fontWeight: '400', color: isDark ? '#CBD5E1' : '#64748B' }}>{selectedHistoryQuote?.area || '1000'} sq.ft</Text>
                </Text>
              </View>

              {/* Itemized Services Table */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 8 }}>
                Itemized Services & Rates ({selectedHistoryQuote?.servicesList?.length || 1})
              </Text>

              {(selectedHistoryQuote?.servicesList || []).map((s, idx) => (
                <View key={idx} style={{ backgroundColor: isDark ? '#080808' : '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#D1E5F7' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0052CC', marginBottom: 4 }}>
                    {idx + 1}. {s.serviceName || s.service}
                  </Text>

                  {s.specs && s.specs.length > 0 && (
                    <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8, fontStyle: 'italic' }}>
                      Specs: {s.specs.join(', ')}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '700' }}>BASIC RATE</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateBasic}/sq.ft</Text>
                      <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalBasic || 0)).toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                      <Text style={{ fontSize: 10, color: '#0052CC', fontWeight: '700' }}>MID RATE</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateMid}/sq.ft</Text>
                      <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalMid || 0)).toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '700' }}>LUXURY RATE</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateLuxury}/sq.ft</Text>
                      <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalLuxury || 0)).toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Package Totals Summary Box */}
              <View style={{ backgroundColor: isDark ? '#080808' : '#F1F5F9', borderRadius: 14, padding: 14, marginTop: 6, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 8, textAlign: 'center' }}>
                  Category Package Totals Summary (incl. GST {selectedHistoryQuote?.gst || '18%'})
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>Basic Package Estimate:</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#2563EB' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'basic').toLocaleString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#0052CC' }}>Mid Package Estimate:</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0052CC' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'mid').toLocaleString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#7C3AED' }}>Luxury Package Estimate:</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#7C3AED' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'luxury').toLocaleString()}</Text>
                </View>
              </View>

              {/* Modal Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 20 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#0052CC', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => {
                    const qId = selectedHistoryQuote.id;
                    setSelectedHistoryQuote(null);
                    router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: qId } });
                  }}
                >
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>View PDF</Text>
                </TouchableOpacity>

                {(() => {
                  const isHistQuoteLocked = Boolean(
                    selectedHistoryQuote && (
                      String(app?.confirmedQuoteId) === String(selectedHistoryQuote.id) ||
                      selectedHistoryQuote.isConfirmed ||
                      selectedHistoryQuote.isLocked ||
                      selectedHistoryQuote.status === 'CONFIRMED' ||
                      selectedHistoryQuote.status === 'LOCKED' ||
                      Boolean(app?.confirmedQuoteId || quotationsList.some(q => q.isConfirmed || q.status === 'CONFIRMED')) ||
                      isInitialPaymentReceived
                    )
                  );
                  return (
                    <TouchableOpacity
                      disabled={isHistQuoteLocked}
                      style={{
                        flex: 1,
                        backgroundColor: isHistQuoteLocked ? (isDark ? '#334155' : '#94A3B8') : '#10B981',
                        paddingVertical: 12,
                        borderRadius: 10,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: isHistQuoteLocked ? 0.6 : 1,
                      }}
                      onPress={() => {
                        if (isHistQuoteLocked) {
                          Alert.alert('Quotation Locked', 'This quotation is locked and cannot be edited.');
                          return;
                        }
                        const qId = selectedHistoryQuote.id;
                        setSelectedHistoryQuote(null);
                        router.push({ pathname: '/edit-quotation', params: { id: qId, quoteId: qId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                      }}
                      activeOpacity={isHistQuoteLocked ? 1 : 0.8}
                    >
                      <Ionicons name={isHistQuoteLocked ? "lock-closed" : "create"} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        {isHistQuoteLocked ? 'Locked' : 'Edit / Revise'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* EDIT CUSTOMER DETAILS MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={showEditCustomerModal}
        onRequestClose={() => setShowEditCustomerModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pickerModalBackdrop}
        >
          <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                Edit Customer Details
              </Text>
              <TouchableOpacity onPress={() => setShowEditCustomerModal(false)}>
                <Ionicons name="close-circle" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 8, marginBottom: 4 }}>
                Customer Name *
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editClientName}
                onChangeText={setEditClientName}
                placeholder="Enter Customer Name"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Phone Number *
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editClientPhone}
                onChangeText={setEditClientPhone}
                keyboardType="phone-pad"
                placeholder="Enter Phone Number"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                City
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="Chennai"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Area
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editArea}
                onChangeText={setEditArea}
                placeholder="Ambattur"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Full Address
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark, { height: 60, textAlignVertical: 'top' }]}
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
                placeholder="Door No, Street Name..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Google Maps Link URL
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editGoogleLocation}
                onChangeText={setEditGoogleLocation}
                placeholder="https://maps.google.com/..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Service Type / Package
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editServiceType}
                onChangeText={setEditServiceType}
                placeholder="Terrace Waterproofing & Outer Wall..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Total Area (sq.ft)
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editTotalArea}
                onChangeText={setEditTotalArea}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>
                  Assigned Technician / Employee
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="lock-closed" size={11} color={isDark ? '#94A3B8' : '#64748B'} />
                  <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>Read-only</Text>
                </View>
              </View>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', opacity: 0.85, color: isDark ? '#94A3B8' : '#64748B' }]}
                value={editAssignedTo}
                editable={false}
                placeholder="Employee Name"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Appointment Date
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editAppDate}
                onChangeText={setEditAppDate}
                placeholder="DD-MM-YY"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Appointment Time
              </Text>
              <TextInput
                style={[styles.editInput, isDark && styles.editInputDark]}
                value={editAppTime}
                onChangeText={setEditAppTime}
                placeholder="10:00 AM"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />

              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', marginTop: 10, marginBottom: 4 }}>
                Status
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 16 }}>
                {['Upcoming', 'Site Visit Pending', 'Site Visited', 'Quotation Waiting', 'Quotation Sent', 'Job Started', 'Bill Cleared', 'Completed'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: editStatus === st ? '#2563EB' : (isDark ? '#1C1C1C' : '#F1F5F9'),
                      borderWidth: 1,
                      borderColor: editStatus === st ? '#2563EB' : (isDark ? '#334155' : '#E2E8F0'),
                    }}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: editStatus === st ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#475569') }}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#2563EB',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 20,
                }}
                onPress={handleSaveCustomerEdit}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Material Delete Confirmation Modal */}
      <MaterialDeleteModal
        visible={deleteModalConfig.visible}
        title={deleteModalConfig.title}
        message={deleteModalConfig.message}
        confirmText={deleteModalConfig.confirmText || 'Delete'}
        cancelText="Cancel"
        isDeleting={deleteModalConfig.isDeleting}
        onConfirm={deleteModalConfig.onConfirm}
        onCancel={() => setDeleteModalConfig({ visible: false, title: '', message: '', confirmText: 'Delete', onConfirm: null, isDeleting: false })}
      />

      <MaterialOverlayLoader
        visible={isSavingSiteDetails}
        title="Saving Site Details..."
        subtitle="Uploading attended date and time to server"
      />

      <MaterialSuccessModal
        visible={siteSuccessModal.visible}
        title={siteSuccessModal.title}
        message={siteSuccessModal.message}
        buttonText="Done"
        onClose={() => setSiteSuccessModal({ visible: false, title: '', message: '' })}
      />

      {/* Custom Material Alert & Lock Modal */}
      <MaterialAlertModal
        visible={alertModalConfig.visible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        type={alertModalConfig.type}
        buttonText={alertModalConfig.buttonText}
        onClose={() => setAlertModalConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* Custom Confirm & Lock / Unlock Quotation Confirmation Popup */}
      <Modal
        transparent
        animationType="fade"
        visible={lockConfirmModal.visible}
        onRequestClose={() => !isLockActionLoading && setLockConfirmModal((prev) => ({ ...prev, visible: false }))}
        statusBarTranslucent
      >
        <View style={styles.customModalBackdrop}>
          <View style={[styles.customModalCard, isDark && styles.customModalCardDark]}>
            {/* Pulsing Icon Aura Container */}
            <View style={styles.customModalIconContainer}>
              <View
                style={[
                  styles.customModalIconAura,
                  {
                    backgroundColor:
                      lockConfirmModal.actionType === 'error'
                        ? 'rgba(239, 68, 68, 0.18)'
                        : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment' || lockConfirmModal.isDone
                          ? 'rgba(16, 185, 129, 0.18)'
                          : lockConfirmModal.actionType === 'unlock'
                            ? 'rgba(245, 158, 11, 0.18)'
                            : 'rgba(37, 99, 235, 0.18)',
                  },
                ]}
              />
              <View
                style={[
                  styles.customModalIconCircle,
                  {
                    backgroundColor:
                      lockConfirmModal.actionType === 'error'
                        ? (isDark ? '#450A0A' : '#FEE2E2')
                        : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment' || lockConfirmModal.isDone
                          ? (isDark ? '#064E3B' : '#DCFCE7')
                          : lockConfirmModal.actionType === 'unlock'
                            ? (isDark ? '#451A03' : '#FEF3C7')
                            : (isDark ? '#1E293B' : '#EFF6FF'),
                  },
                ]}
              >
                <Ionicons
                  name={
                    lockConfirmModal.actionType === 'error'
                      ? 'close-circle'
                      : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment' || lockConfirmModal.isDone
                        ? 'shield-checkmark'
                        : lockConfirmModal.actionType === 'unlock'
                          ? 'lock-open-outline'
                          : 'swap-horizontal'
                  }
                  size={30}
                  color={
                    lockConfirmModal.actionType === 'error'
                      ? '#EF4444'
                      : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment' || lockConfirmModal.isDone
                        ? '#10B981'
                        : lockConfirmModal.actionType === 'unlock'
                          ? '#F59E0B'
                          : '#2563EB'
                  }
                />
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.customModalTitle, isDark && styles.textDark]}>
              {lockConfirmModal.title}
            </Text>

            {/* Message */}
            <Text style={[styles.customModalMessage, isDark && styles.subtextDark, Boolean(lockConfirmModal.warningNote) && { marginBottom: 12 }]}>
              {lockConfirmModal.message}
            </Text>

            {/* Warning Note Callout */}
            {Boolean(lockConfirmModal.warningNote) && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 20,
                  gap: 8,
                  width: '100%',
                }}
              >
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: isDark ? '#FCA5A5' : '#DC2626',
                    flex: 1,
                    lineHeight: 17,
                  }}
                >
                  {lockConfirmModal.warningNote}
                </Text>
              </View>
            )}

            {/* Dual Action Buttons */}
            <View style={styles.customModalButtonRow}>
              {Boolean(lockConfirmModal.cancelText) && !lockConfirmModal.isDone && (
                <TouchableOpacity
                  style={[styles.customModalCancelBtn, isDark && styles.customModalCancelBtnDark, isLockActionLoading && { opacity: 0.5 }]}
                  onPress={() => !isLockActionLoading && setLockConfirmModal((prev) => ({ ...prev, visible: false, isDone: false }))}
                  activeOpacity={0.8}
                  disabled={isLockActionLoading}
                >
                  <Text style={[styles.customModalCancelText, isDark && styles.textDark]}>
                    {lockConfirmModal.cancelText || 'Cancel'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.customModalConfirmBtn,
                  {
                    backgroundColor:
                      lockConfirmModal.actionType === 'error'
                        ? '#EF4444'
                        : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment' || lockConfirmModal.isDone
                          ? '#059669'
                          : lockConfirmModal.actionType === 'unlock'
                            ? '#D97706'
                            : '#2563EB',
                  },
                  lockConfirmModal.isDone && { flex: 1 },
                  isLockActionLoading && { opacity: 0.8 },
                ]}
                onPress={async () => {
                  if (isLockActionLoading) return;
                  if (lockConfirmModal.isDone) {
                    setLockConfirmModal((prev) => ({ ...prev, visible: false, isDone: false }));
                    return;
                  }

                  const targetId = lockConfirmModal.quoteId;
                  const action = lockConfirmModal.actionType;
                  setIsLockActionLoading(true);

                  if (action === 'initial_payment') {
                    try {
                      const chosenQuote = quotationsList.find(q => q.id === app?.confirmedQuoteId) || quotationsList[0];
                      const quoteTotal = Number(chosenQuote?.total || 0);
                      const advance50 = Math.round(quoteTotal * 0.5);

                      updateAppointment(app.id, {
                        initialPaymentReceived: true,
                        initialPaid: true,
                        initialPaidAmount: advance50,
                        initialPaidDetails: {
                          amount: advance50,
                          date: formatDateDDMMYY(new Date()),
                          paymentDate: formatDateDDMMYY(new Date()),
                          method: 'Advance Received',
                          status: 'Completed',
                        },
                        confirmedQuoteId: app.confirmedQuoteId || chosenQuote?.id,
                        projectStatus: 'In Progress',
                      });

                      setIsLockActionLoading(false);
                      setLockConfirmModal({
                        visible: true,
                        isDone: true,
                        actionType: 'success',
                        title: 'Payment Confirmed ✅',
                        message: 'Initial advance payment recorded successfully. The quotation is now locked and protected from any edits.',
                        warningNote: '',
                        confirmText: 'Done',
                        cancelText: '',
                      });
                    } catch (_err) {
                      setIsLockActionLoading(false);
                      setLockConfirmModal((prev) => ({ ...prev, visible: false, isDone: false }));
                    }
                    return;
                  }

                  if (targetId) {
                    try {
                      let res = null;
                      if (action === 'lock') {
                        res = await handleConfirmQuotation(targetId);
                      } else if (action === 'unlock') {
                        res = await handleUnlockQuotation(targetId, false);
                      } else if (action === 'switch') {
                        if (app?.confirmedQuoteId) {
                          await quotationRepository.unlockQuotation(app.confirmedQuoteId);
                        }
                        res = await handleConfirmQuotation(targetId);
                      }

                      setIsLockActionLoading(false);
                      if (res?.success) {
                        setLockConfirmModal({
                          visible: true,
                          isDone: true,
                          actionType: 'success',
                          title: action === 'unlock' ? 'Quotation Unlocked ' : 'Quotation Confirmed & Locked!',
                          message: action === 'unlock'
                            ? 'The quotation has been unlocked. You can now select other tiers, edit, or create new revisions.'
                            : 'This quotation has been confirmed and locked for this project. Other draft proposals have been automatically cleaned up.',
                          warningNote: '',
                          confirmText: 'Done',
                          cancelText: '',
                        });
                      } else if (res) {
                        setLockConfirmModal({
                          visible: true,
                          isDone: true,
                          actionType: 'error',
                          title: res.title || 'Action Failed',
                          message: res.message || 'Could not complete quotation operation.',
                          warningNote: '',
                          confirmText: 'OK',
                          cancelText: '',
                        });
                      } else {
                        setLockConfirmModal((prev) => ({ ...prev, visible: false, isDone: false }));
                      }
                    } catch (err) {
                      setIsLockActionLoading(false);
                      setLockConfirmModal({
                        visible: true,
                        isDone: true,
                        actionType: 'error',
                        title: 'Error',
                        message: err?.message || 'An unexpected error occurred.',
                        warningNote: '',
                        confirmText: 'OK',
                        cancelText: '',
                      });
                    }
                  } else {
                    setIsLockActionLoading(false);
                    setLockConfirmModal((prev) => ({ ...prev, visible: false, isDone: false }));
                  }
                }}
                activeOpacity={0.85}
                disabled={isLockActionLoading}
              >
                {isLockActionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons
                    name={
                      lockConfirmModal.actionType === 'error'
                        ? 'close'
                        : lockConfirmModal.isDone
                          ? 'checkmark'
                          : lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
                            ? 'shield-checkmark'
                            : lockConfirmModal.actionType === 'unlock'
                              ? 'lock-open-outline'
                              : 'checkmark'
                    }
                    size={15}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text style={styles.customModalConfirmText}>
                  {isLockActionLoading
                    ? 'Processing...'
                    : (lockConfirmModal.confirmText || (lockConfirmModal.isDone ? 'Done' : 'Confirm & Lock'))}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Select Quotation Tiers Bottom Sheet Modal */}
      <SelectQuotationTiersModal
        visible={isSelectTiersModalVisible}
        initialTiers={modalInitialTiers}
        existingTiers={existingQuoteTiers}
        onClose={() => setIsSelectTiersModalVisible(false)}
        onConfirm={handleConfirmSelectTiers}
        isDark={isDark}
      />

      {/* Stitch Payment Details Popup Modal */}
      <Modal
        visible={Boolean(selectedPaymentDetailModal)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPaymentDetailModal(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setSelectedPaymentDetailModal(null)}
        >
          <View
            style={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              maxHeight: '88%',
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                width: 44,
                height: 4,
                backgroundColor: '#CBD5E1',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 14,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#F1F5F9' }}>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  Payment Details
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  Transaction #{selectedPaymentDetailModal?.voucher || 'VCH-88219'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPaymentDetailModal(null)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#334155' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={isDark ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Amount Banner: Verified vs Pending */}
              {selectedPaymentDetailModal?.isVerified ? (
              <View
                style={{
                  backgroundColor: isDark ? '#064E3B' : 'rgba(236, 253, 245, 0.8)',
                  borderWidth: 1,
                  borderColor: isDark ? '#047857' : '#A7F3D0',
                  borderRadius: 18,
                  padding: 16,
                  alignItems: 'center',
                  marginVertical: 14,
                }}
              >
                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 9999, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={12} color="#166534" />
                  <Text style={{ color: '#166534', fontSize: 11, fontWeight: '700' }}>✓ Verified by Admin</Text>
                </View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  ₹{Number(selectedPaymentDetailModal?.amount || 0).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#047857', marginTop: 2 }}>
                  {selectedPaymentDetailModal?.stage}
                </Text>
                {Boolean(selectedPaymentDetailModal?.verifiedBy) && (
                  <Text style={{ fontSize: 10, color: isDark ? '#A7F3D0' : '#065F46', marginTop: 4 }}>
                    Approved by {selectedPaymentDetailModal.verifiedBy}
                  </Text>
                )}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(120, 53, 15, 0.25)' : '#FEF3C7',
                  borderWidth: 1,
                  borderColor: isDark ? '#B45309' : '#FDE68A',
                  borderRadius: 18,
                  padding: 16,
                  alignItems: 'center',
                  marginVertical: 14,
                }}
              >
                <View style={{ backgroundColor: '#FDE68A', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 9999, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={12} color="#92400E" />
                  <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '700' }}>⏳ Admin Verification Needed</Text>
                </View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  ₹{Number(selectedPaymentDetailModal?.amount || 0).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#FBBF24' : '#B45309', marginTop: 2 }}>
                  {selectedPaymentDetailModal?.stage}
                </Text>
                <Text style={{ fontSize: 10, color: isDark ? '#CBD5E1' : '#78350F', marginTop: 4, textAlign: 'center' }}>
                  {isAdminOrMaster
                    ? 'Inspect payment details and proof image below to approve this transaction.'
                    : 'Awaiting Admin verification. Receipt access is locked until verified.'}
                </Text>
              </View>
            )}

            {/* Specification Rows */}
            <View
              style={{
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                borderRadius: 16,
                padding: 14,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Payment Stage</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {selectedPaymentDetailModal?.stage}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Verification Status</Text>
                {selectedPaymentDetailModal?.isVerified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>
                      Verified
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={13} color="#F59E0B" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
                      Pending Admin Verification
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Payment Method</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={
                      selectedPaymentDetailModal?.method === 'UPI'
                        ? 'qr-code-outline'
                        : selectedPaymentDetailModal?.method?.toLowerCase().includes('bank') || selectedPaymentDetailModal?.method === 'Accounts'
                          ? 'card-outline'
                          : 'cash-outline'
                    }
                    size={14}
                    color="#1E488F"
                  />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {selectedPaymentDetailModal?.method || 'Cash'}
                  </Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Voucher / Ref Number</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E488F', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  #{selectedPaymentDetailModal?.voucher || 'VCH-88219'}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Payment Date</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {selectedPaymentDetailModal?.date || '16 Sep 2026'}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Customer</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {app?.clientName || 'Anita Raman'}
                  </Text>
                  <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>
                    Cust ID: DR{app?.id}
                  </Text>
                </View>
              </View>

              {Boolean(
                selectedPaymentDetailModal?.proofImageUrl ||
                selectedPaymentDetailModal?.referenceImage ||
                selectedPaymentDetailModal?.details?.proofImageUrl ||
                selectedPaymentDetailModal?.details?.proofImage ||
                selectedPaymentDetailModal?.details?.referenceImage ||
                selectedPaymentDetailModal?.details?.documentUri ||
                app?.referenceImage
              ) && (() => {
                const modalProofUri = resolveProofImageUrl(
                  selectedPaymentDetailModal?.proofImageUrl ||
                  selectedPaymentDetailModal?.referenceImage ||
                  selectedPaymentDetailModal?.details?.proofImageUrl ||
                  selectedPaymentDetailModal?.details?.proofImage ||
                  selectedPaymentDetailModal?.details?.referenceImage ||
                  selectedPaymentDetailModal?.details?.documentUri ||
                  app?.referenceImage
                );
                if (!modalProofUri) return null;
                return (
                  <>
                    <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 8 }} />
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Reference Image / Payment Proof</Text>
                        <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="shield-checkmark" size={10} color="#1E488F" />
                          <Text style={{ color: '#1E488F', fontSize: 10, fontWeight: '700' }}>Proof Document</Text>
                        </View>
                      </View>
                      <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                        <Image
                          source={{ uri: modalProofUri }}
                          style={{ width: '100%', height: 140 }}
                          resizeMode="cover"
                        />
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Bottom Actions */}
            {selectedPaymentDetailModal?.isVerified ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    backgroundColor: isDark ? '#1E3A8A' : '#EDF4FF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    const mId = selectedPaymentDetailModal?.id || 'initialPaid';
                    const amt = selectedPaymentDetailModal?.amount || 0;
                    const stg = selectedPaymentDetailModal?.stage || 'Service Payment';
                    const qId = selectedPaymentDetailModal?.quotationId || payView?.id || app?.confirmedQuoteId || app?.activeQuotationId || '';
                    const sId = selectedPaymentDetailModal?.serviceId || selectedPaymentDetailModal?.additionalServiceId || '';
                    const sqft = selectedPaymentDetailModal?.sqft || '';
                    const rate = selectedPaymentDetailModal?.rate || '';
                    const totCost = selectedPaymentDetailModal?.totalCost || amt;
                    const vch = selectedPaymentDetailModal?.voucher || '';
                    const mth = selectedPaymentDetailModal?.method || '';
                    const dt = selectedPaymentDetailModal?.date || '';
                    setSelectedPaymentDetailModal(null);
                    router.push({
                      pathname: '/receipt',
                      params: {
                        id: app.id,
                        quotationId: String(qId),
                        serviceId: String(sId),
                        sqft: String(sqft),
                        rate: String(rate),
                        totalCost: String(totCost),
                        receiptNumber: vch && vch !== 'N/A' ? vch : '',
                        milestone: mId,
                        amount: amt,
                        stage: stg,
                        voucher: vch,
                        method: mth,
                        date: dt,
                      },
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={16} color={isDark ? '#93C5FD' : '#1E488F'} />
                  <Text style={{ color: isDark ? '#93C5FD' : '#1E488F', fontSize: 12, fontWeight: '700' }}>View Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: '#21498B',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setSelectedPaymentDetailModal(null)}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 16 }}>
                {isAdminOrMaster ? (
                  <TouchableOpacity
                    style={{
                      height: 46,
                      borderRadius: 12,
                      backgroundColor: '#2557C7',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    onPress={() => {
                      const quoteId =
                        selectedPaymentDetailModal?.quotationId ||
                        payView?.id ||
                        payView?.quotationId ||
                        app?.confirmedQuoteId ||
                        app?.activeQuotationId ||
                        '';
                      const payId = selectedPaymentDetailModal?.id || selectedPaymentDetailModal?.details?.id;
                      const amt = selectedPaymentDetailModal?.amount || selectedPaymentDetailModal?.details?.amount;
                      const mth = selectedPaymentDetailModal?.method || selectedPaymentDetailModal?.paymentMethod;
                      const vch = selectedPaymentDetailModal?.voucher;
                      const stg = selectedPaymentDetailModal?.stage || app?.service || '';
                      setSelectedPaymentDetailModal(null);
                      router.push({
                        pathname: '/payment-verification',
                        params: {
                          id: app?.id || params.id,
                          quotationId: quoteId ? String(quoteId) : undefined,
                          paymentId: String(payId),
                          amount: amt ? String(amt) : '',
                          paymentMethod: mth || '',
                          voucher: vch || '',
                          clientName: app?.customerName || app?.name || app?.clientName || '',
                          serviceTitle: stg,
                        },
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                      Verify Payment
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
                      borderColor: isDark ? '#78350F' : '#FDE68A',
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="lock-closed" size={14} color="#D97706" />
                    <Text style={{ flex: 1, fontSize: 11, color: isDark ? '#FBBF24' : '#B45309', fontWeight: '600' }}>
                      This payment is awaiting Admin verification. Receipt download and sharing will be available once approved.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={{
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#334155' : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setSelectedPaymentDetailModal(null)}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: isDark ? '#CBD5E1' : '#475569', fontSize: 12, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Stitch Activate Warranty Bottom Sheet Modal */}
      <Modal
        visible={showStitchWarrantyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStitchWarrantyModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setShowStitchWarrantyModal(false)}
        >
          <View
            style={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: 28,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                width: 44,
                height: 4,
                backgroundColor: '#CBD5E1',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 14,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-checkmark" size={20} color="#5145CD" />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    Activate Warranty
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                    Set warranty validity start date to activate coverage.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowStitchWarrantyModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#334155' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={isDark ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1E293B', marginBottom: 6 }}>
                Valid From Date <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onPress={() => setShowWarrantyDatePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {warrantyStartDate}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#5145CD" />
              </TouchableOpacity>

              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#94A3B8', marginTop: 6 }}>
                Warranty coverage period will be calculated from this date.
              </Text>
            </View>

            {showWarrantyDatePicker && (
              <DateTimePicker
                value={warrantyDateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_evt, selDate) => {
                  setShowWarrantyDatePicker(false);
                  if (selDate) {
                    setWarrantyDateObj(selDate);
                    setWarrantyStartDate(formatDateDDMMYY(selDate));
                  }
                }}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setShowStitchWarrantyModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1.4,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: '#5145CD',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  shadowColor: '#5145CD',
                  shadowOpacity: 0.3,
                  shadowOffset: { width: 0, height: 3 },
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={async () => {
                  setShowStitchWarrantyModal(false);
                  await generateWarranty(app.id, warrantyStartDate, '10 Years');
                  showAlert(
                    'Warranty Activated! 🛡️',
                    `10 Years Warranty coverage successfully activated starting from ${warrantyStartDate}. Certificate is now active.`,
                    'success',
                    'View Certificate'
                  );
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Activate Warranty</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Generate Full Receipt Bottom Sheet Modal */}
      <Modal
        visible={showFullReceiptModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFullReceiptModal(false);
          setFullReceiptStep('options');
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => {
            setShowFullReceiptModal(false);
            setFullReceiptStep('options');
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 22,
              paddingBottom: Platform.OS === 'ios' ? 38 : 28,
              maxHeight: '92%',
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Grab handle */}
            <View
              style={{
                width: 44,
                height: 4,
                backgroundColor: isDark ? '#475569' : '#CBD5E1',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {fullReceiptStep === 'options' ? (
              <>
                {/* Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      }}
                    >
                      Generate Full Receipt
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: isDark ? '#94A3B8' : '#64748B',
                        marginTop: 2,
                      }}
                    >
                      Choose receipt type for this completed project
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowFullReceiptModal(false);
                      setFullReceiptStep('options');
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDark ? '#334155' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={18} color={isDark ? '#E2E8F0' : '#475569'} />
                  </TouchableOpacity>
                </View>

                {/* Options List */}
                <View style={{ gap: 12, marginTop: 14 }}>
                  {/* Option 1: Without GST */}
                  <TouchableOpacity
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                    }}
                    onPress={() => {
                      setFullReceiptStep('without_gst');
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-text-outline" size={24} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        }}
                      >
                        Without GST
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? '#94A3B8' : '#64748B',
                          marginTop: 2,
                        }}
                      >
                        Generate full settlement receipt based on collected payments
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? '#64748B' : '#94A3B8'}
                    />
                  </TouchableOpacity>

                  {/* Option 2: With GST */}
                  <TouchableOpacity
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: isDark ? '#1E3A8A' : '#DBEAFE',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                    }}
                    onPress={() => {
                      setShowFullReceiptModal(false);
                      setFullReceiptStep('options');
                      const qId =
                        payView?.quotationId ||
                        payView?.id ||
                        app?.confirmedQuoteId ||
                        app?.activeQuotationId ||
                        (Array.isArray(app?.quotations) &&
                          app.quotations.find((q) => q.isConfirmed)?.id) ||
                        null;
                      const additionalTotal = resolvedAdditionalPayments.reduce(
                        (sum, item) => sum + Number(item?.totalPrice || item?.amount || 0),
                        0
                      );

                      const baseServiceCost = Number(
                        payView?.pricing?.withoutGstTotal ||
                        payView?.pricing?.subTotal ||
                        payView?.totalPrice ||
                        payView?.totalCost ||
                        app?.totalPayment ||
                        app?.totalCost ||
                        app?.cost ||
                        0
                      );
                      const baseTotalValue = baseServiceCost + additionalTotal;
                      const gstPercentToUse = String(
                        payView?.gstPayment?.gstPercentage ||
                        payView?.withGstPayment?.gstPercentage ||
                        payView?.gstPercentage ||
                        app?.gstPercentage ||
                        app?.gstPaidDetails?.gstPercentage ||
                        app?.finalPaidDetails?.gstPercentage ||
                        18
                      );
                      const gstAmt = Math.round(baseTotalValue * (Number(gstPercentToUse) / 100));

                      router.push({
                        pathname: '/payment-form',
                        params: {
                          id: app?.id,
                          baseCost: String(baseTotalValue),
                          totalCost: String(Number(baseTotalValue) + gstAmt),
                          baseServiceCost: String(baseServiceCost),
                          additionalCost: String(additionalTotal),
                          quotationId: qId || '',
                          stage: 'gst',
                          isGstPayment: 'true',
                          hasGst: 'true',
                          gstPercent: gstPercentToUse,
                          amount: String(gstAmt),
                        },
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(33, 73, 139, 0.25)' : '#EEF2FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="receipt-outline" size={24} color="#21498B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        }}
                      >
                        With GST
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? '#94A3B8' : '#64748B',
                          marginTop: 2,
                        }}
                      >
                        Go to payment page to choose GST percentage & record invoice
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? '#64748B' : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Step 2: Without GST or With GST Details, Payment Done & GST Number Input */
              (() => {
                const isWithGstReceipt = fullReceiptStep === 'with_gst_receipt';
                const qId =
                  payView?.quotationId ||
                  payView?.id ||
                  app?.confirmedQuoteId ||
                  app?.activeQuotationId ||
                  (Array.isArray(app?.quotations) &&
                    app.quotations.find((q) => q.isConfirmed)?.id) ||
                  null;
                const additionalTotal = resolvedAdditionalPayments.reduce(
                  (sum, item) => sum + Number(item?.totalPrice || item?.amount || 0),
                  0
                );

                const baseServiceCost = Number(
                  payView?.pricing?.withoutGstTotal ||
                  payView?.pricing?.subTotal ||
                  payView?.totalPrice ||
                  payView?.totalCost ||
                  app?.totalPayment ||
                  app?.totalCost ||
                  app?.cost ||
                  0
                );
                const baseTotalValue = baseServiceCost + additionalTotal;
                const totalPaidSoFar =
                  payView?.progress?.totalPaid ??
                  payView?.totalPaid ??
                  (app?.fullPaid
                    ? Number(app?.fullPaidDetails?.amount || baseTotalValue)
                    : Number(app?.advancePaidAmount || app?.advanceDetails?.amount || 0) +
                      Number(app?.initialPaidAmount || app?.initialPaidDetails?.amount || 0) +
                      Number(app?.midTermPaidAmount || app?.midTermPaidDetails?.amount || 0) +
                      Number(app?.finalPaidAmount || app?.finalPaidDetails?.amount || 0));

                const gstPercentVal =
                  app?.gstPercentage ||
                  app?.gstPaidDetails?.gstPercentage ||
                  app?.finalPaidDetails?.gstPercentage ||
                  '18';

                const gstPaidAmount = Number(
                  app?.gstPaidAmount ||
                  app?.gstPaidDetails?.amount ||
                  app?.finalPaidDetails?.amount ||
                  payView?.gstPayment?.paidAmount ||
                  payView?.withGstPayment?.paidAmount ||
                  payView?.settlement?.amount ||
                  (isWithGstReceipt ? Math.round(baseTotalValue * (Number(gstPercentVal || 18) / 100)) : 0)
                );

                const clientName = app?.clientName || app?.name || app?.customerName || 'Customer';
                const clientPhone = app?.phone || app?.mobile || app?.clientPhone || 'N/A';
                const clientAddress = app?.address || app?.location || app?.area || 'N/A';

                return (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 10 }}
                  >
                    {/* Header with Back button */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <TouchableOpacity
                          onPress={() => {
                            if (isWithGstReceipt) {
                              setShowFullReceiptModal(false);
                              setFullReceiptStep('options');
                            } else {
                              setFullReceiptStep('options');
                            }
                          }}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: isDark ? '#334155' : '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="arrow-back" size={18} color={isDark ? '#E2E8F0' : '#334155'} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight: '800',
                              color: isDark ? '#FFFFFF' : '#0F172A',
                            }}
                          >
                            {isWithGstReceipt ? 'Generate Full Receipt with GST' : 'Without GST Receipt'}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDark ? '#94A3B8' : '#64748B',
                              marginTop: 1,
                            }}
                          >
                            {isWithGstReceipt
                              ? 'Customer & GST payment summary'
                              : 'Review details & generate receipt'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setShowFullReceiptModal(false);
                          setFullReceiptStep('options');
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isDark ? '#334155' : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="close" size={18} color={isDark ? '#E2E8F0' : '#475569'} />
                      </TouchableOpacity>
                    </View>

                    {/* 1. Customer Details Card */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                        padding: 14,
                        marginBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        <Ionicons name="person-outline" size={15} color="#2563EB" />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isDark ? '#94A3B8' : '#64748B',
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          Customer Details
                        </Text>
                      </View>

                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Customer Name</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                            {clientName}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Phone / Mobile</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#E2E8F0' : '#1E293B' }}>
                            {clientPhone}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', width: 90 }}>Address</Text>
                          <Text
                            style={{
                              flex: 1,
                              textAlign: 'right',
                              fontSize: 12,
                              color: isDark ? '#CBD5E1' : '#334155',
                            }}
                            numberOfLines={2}
                          >
                            {clientAddress}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* 2. Payment Done Summary Card */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#0F172A' : '#F0FDF4',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isDark ? '#166534' : '#BBF7D0',
                        padding: 14,
                        marginBottom: 14,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="wallet-outline" size={15} color="#16A34A" />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: isDark ? '#86EFAC' : '#166534',
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            Payment Summary
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: '#DCFCE7',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 9999,
                          }}
                        >
                          <Text style={{ color: '#166534', fontSize: 10, fontWeight: '700' }}>
                            {isWithGstReceipt ? '✓ Settled with GST' : '✓ 100% Paid'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Total Project Cost</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#E2E8F0' : '#1E293B' }}>
                            ₹{Number(baseTotalValue).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        {additionalTotal > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 8 }}>
                            <Text style={{ fontSize: 11, color: isDark ? '#64748B' : '#94A3B8' }}>• Services: ₹{Number(baseServiceCost).toLocaleString('en-IN')} + Variations: ₹{Number(additionalTotal).toLocaleString('en-IN')}</Text>
                          </View>
                        )}

                        {isWithGstReceipt ? (
                          <>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                                GST Settled ({gstPercentVal}%)
                              </Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>
                                ₹{Number(gstPaidAmount).toLocaleString('en-IN')}
                              </Text>
                            </View>

                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingTop: 6,
                                borderTopWidth: 1,
                                borderTopColor: isDark ? '#334155' : '#DCFCE7',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#0F172A' }}>
                                Total Paid (with GST)
                              </Text>
                              <Text style={{ fontSize: 15, fontWeight: '800', color: '#16A34A' }}>
                                ₹{(Number(baseTotalValue) + Number(gstPaidAmount)).toLocaleString('en-IN')}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#0F172A' }}>
                              Total Amount Paid
                            </Text>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#16A34A' }}>
                              ₹{Number(totalPaidSoFar).toLocaleString('en-IN')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* 3. GST Number Input Field */}
                    <View style={{ marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="business-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: isDark ? '#E2E8F0' : '#1E293B',
                            }}
                          >
                            GST Number
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: isDark ? '#334155' : '#F1F5F9',
                            paddingHorizontal: 7,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>
                            {isWithGstReceipt ? 'Customer GSTIN' : 'Optional'}
                          </Text>
                        </View>
                      </View>
                      <TextInput
                        value={gstNumberInput}
                        onChangeText={(text) => setGstNumberInput(text.toUpperCase())}
                        placeholder="Enter GSTIN (e.g. 33AAAAA0000A1Z5)"
                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                        autoCapitalize="characters"
                        maxLength={15}
                        style={{
                          height: 46,
                          borderRadius: 12,
                          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          paddingHorizontal: 14,
                          fontSize: 14,
                          fontWeight: '600',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          letterSpacing: 0.5,
                        }}
                      />
                    </View>

                    {/* 4. Generate Receipt Button */}
                    <TouchableOpacity
                      style={{
                        height: 50,
                        borderRadius: 14,
                        backgroundColor: '#21498B',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        shadowColor: '#21498B',
                        shadowOpacity: 0.3,
                        shadowOffset: { width: 0, height: 3 },
                        shadowRadius: 6,
                        elevation: 3,
                      }}
                      onPress={async () => {
                        const gstVal = gstNumberInput.trim();
                        setShowFullReceiptModal(false);
                        setFullReceiptStep('options');

                        const generatedRecNo =
                          payView?.receiptNumber ||
                          app?.receiptNumber ||
                          `REC-${app?.id || '101'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

                        const finalGstPaidAmt = isWithGstReceipt
                          ? (Number(gstPaidAmount) || Math.round(Number(baseTotalValue) * (Number(gstPercentVal || 18) / 100)))
                          : 0;
                        const finalGstPct = Number(gstPercentVal) || 18;

                        // API v2: Confirm GST settlement first if needed, then generate final receipt & lock
                        if (qId) {
                          try {
                            if (!payView?.isGstConfirmed) {
                              const settlementPayload = {
                                withGst: isWithGstReceipt,
                                ...(gstVal ? { customerGstNumber: gstVal } : {}),
                                ...(isWithGstReceipt && finalGstPaidAmt ? {
                                  amount: finalGstPaidAmt,
                                  paymentMethod: 'UPI',
                                  voucher: `GST-${Date.now().toString().slice(-6)}`,
                                  notes: 'GST settlement upon completion',
                                } : {}),
                              };
                              const settleRes = await paymentRepository.confirmFinalSettlement(qId, settlementPayload);
                              if (!settleRes?.success) {
                                await paymentRepository.updatePricingConfig(qId, {
                                  withGst: isWithGstReceipt,
                                  ...(isWithGstReceipt ? { gstPercentage: finalGstPct } : {}),
                                });
                              }
                            }
                            await paymentRepository.generateFinalReceipt(qId, gstVal, isWithGstReceipt);
                            await paymentRepository.toggleReceiptLock(qId, true, 'Full receipt created');
                          } catch (recErr) {
                            console.warn('Final receipt generation/locking error:', recErr?.message);
                          }
                        }

                        if (isWithGstReceipt) {
                          const finalHalfGst = Math.round(finalGstPaidAmt / 2);
                          const gstDetailsObj = {
                            amount: finalGstPaidAmt,
                            gstPercentage: finalGstPct,
                            paymentMethod: 'UPI',
                            paymentDate: formatDateDDMMYY(new Date()),
                            transactionId: `GST-${Date.now().toString().slice(-6)}`,
                            verificationStatus: 'verified',
                            isVerified: true,
                          };

                          setClientData((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              hasGst: true,
                              gstPaid: true,
                              gstNumber: gstVal,
                              gstin: gstVal,
                              customerGstNumber: gstVal,
                              gstPaidAmount: finalGstPaidAmt,
                              gstPercentage: finalGstPct,
                              gstPaidDetails: gstDetailsObj,
                              isReceiptGenerated: true,
                              fullReceiptGenerated: true,
                              receiptNumber: generatedRecNo,
                              receiptGeneratedAt: new Date().toISOString(),
                              isReceiptLocked: true,
                              receiptStatus: 'GENERATED',
                            };
                          });

                          if (app?.id) {
                            appointmentService.updateAppointment(app.id, {
                              hasGst: true,
                              gstPaid: true,
                              gstNumber: gstVal,
                              gstin: gstVal,
                              customerGstNumber: gstVal,
                              gstPaidAmount: finalGstPaidAmt,
                              gstPercentage: finalGstPct,
                              gstPaidDetails: gstDetailsObj,
                              isReceiptGenerated: true,
                              fullReceiptGenerated: true,
                              receiptNumber: generatedRecNo,
                              receiptGeneratedAt: new Date().toISOString(),
                              isReceiptLocked: true,
                              receiptStatus: 'GENERATED',
                            }).catch(() => {});
                          }

                          setPayView((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              withGst: true,
                              isGst: true,
                              isGstConfirmed: true,
                              customerGstNumber: gstVal,
                              gstAmount: finalGstPaidAmt,
                              gstPercentage: finalGstPct,
                              totalWithGst: Number(baseTotalValue) + finalGstPaidAmt,
                              totalPaid: Number(baseTotalValue) + finalGstPaidAmt,
                              balanceAmount: 0,
                              isReceiptGenerated: true,
                              fullReceiptGenerated: true,
                              receiptNumber: generatedRecNo,
                              receiptGeneratedAt: new Date().toISOString(),
                              isReceiptLocked: true,
                              receiptStatus: 'GENERATED',
                              gstPayment: {
                                ...(prev.gstPayment || {}),
                                id: 0,
                                title: 'GST Tax Clearance',
                                totalPrice: finalGstPaidAmt,
                                paidAmount: finalGstPaidAmt,
                                balanceAmount: 0,
                                gstPercentage: finalGstPct,
                                gstAmount: finalGstPaidAmt,
                                cgst: finalHalfGst,
                                sgst: finalHalfGst,
                                status: 'COMPLETED',
                                payments: [
                                  {
                                    id: `gst_pay_${Date.now()}`,
                                    amount: finalGstPaidAmt,
                                    paymentMethod: 'UPI',
                                    voucher: `GST-${Date.now().toString().slice(-6)}`,
                                    isVerified: true,
                                    date: formatDateDDMMYY(new Date()),
                                    createdAt: new Date().toISOString(),
                                  },
                                ],
                              },
                            };
                          });

                          router.push({
                            pathname: '/receipt',
                            params: {
                              id: app?.id,
                              quotationId: qId || '',
                              isFullServiceReceipt: 'true',
                              stage: 'Full Project Settlement (with GST)',
                              hasGst: 'true',
                              gstPercent: String(finalGstPct),
                              gstPaidAmount: String(finalGstPaidAmt),
                              amount: String(Number(baseTotalValue) + Number(finalGstPaidAmt)),
                              totalCost: String(Number(baseTotalValue) + Number(finalGstPaidAmt)),
                              gstNumber: gstVal,
                              receiptNumber: generatedRecNo,
                            },
                          });
                        } else {
                          setClientData((prev) => (prev ? {
                            ...prev,
                            isReceiptGenerated: true,
                            fullReceiptGenerated: true,
                            receiptNumber: generatedRecNo,
                            receiptGeneratedAt: new Date().toISOString(),
                            isReceiptLocked: true,
                            receiptStatus: 'GENERATED',
                            ...(gstVal ? { gstNumber: gstVal, gstin: gstVal, customerGstNumber: gstVal } : {}),
                          } : prev));

                          if (app?.id) {
                            appointmentService.updateAppointment(app.id, {
                              isReceiptGenerated: true,
                              fullReceiptGenerated: true,
                              receiptNumber: generatedRecNo,
                              receiptGeneratedAt: new Date().toISOString(),
                              isReceiptLocked: true,
                              receiptStatus: 'GENERATED',
                              ...(gstVal ? { gstNumber: gstVal, gstin: gstVal, customerGstNumber: gstVal } : {}),
                            }).catch(() => {});
                          }

                          setPayView((prev) => (prev ? {
                            ...prev,
                            withGst: false,
                            isGst: false,
                            isGstConfirmed: true,
                            gstPayment: null,
                            gstPayments: [],
                            gstAmount: 0,
                            isReceiptGenerated: true,
                            fullReceiptGenerated: true,
                            receiptNumber: generatedRecNo,
                            receiptGeneratedAt: new Date().toISOString(),
                            isReceiptLocked: true,
                            receiptStatus: 'GENERATED',
                            ...(gstVal ? { customerGstNumber: gstVal } : {}),
                          } : prev));

                          router.push({
                            pathname: '/receipt',
                            params: {
                              id: app?.id,
                              quotationId: qId || '',
                              isFullServiceReceipt: 'true',
                              stage: 'Full Project Settlement',
                              amount: String(totalPaidSoFar || baseTotalValue),
                              totalCost: String(baseTotalValue),
                              gstNumber: gstVal,
                              receiptNumber: generatedRecNo,
                            },
                          });
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                        Generate Receipt
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                );
              })()
            )}
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  editInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  editInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#090D16',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  profileRowDark: {
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileTextCol: {
    flex: 1,
  },
  clientNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  profileBadgeText: {
    fontSize: 13,
    color: '#475569',
  },
  infoSubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoSubCardDark: {
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  infoValueRowDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
  },
  infoValueText: {
    fontSize: 14,
    color: '#000000',
  },
  boldValue: {
    fontWeight: '700',
  },
  inputsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridInputCol: {
    width: '48%',
  },
  textInputBox: {
    borderWidth: 1,
    borderColor: '#D1E5F7',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  textInputBoxDark: {
    borderColor: '#475569',
    backgroundColor: '#080808',
  },
  pickerTriggerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerValueText: {
    fontSize: 13,
    color: '#000000',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  siteSubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  siteSubCardDark: {
    backgroundColor: '#1C1C1C',
  },
  siteTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  siteInfoBlock: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  siteInfoBlockDark: {
    backgroundColor: '#080808',
  },
  siteAddressText: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  areaInputBox: {
    borderWidth: 1,
    borderColor: '#D1E5F7',
    borderRadius: 8,
    width: 80,
    height: 30,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
    textAlign: 'center',
  },
  areaInputBoxDark: {
    borderColor: '#475569',
    backgroundColor: '#1C1C1C',
    color: '#F8FAFC',
  },
  blueStaticTextInline: {
    color: '#2563EB',
    fontWeight: '700',
  },
  mapsLinkText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#0052CC',
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeQuoteBtn: {
    flex: 1,
    backgroundColor: '#0052CC',
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Modal styles from new-appointment
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  pickerModalCardDark: {
    backgroundColor: '#1C1C1C',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0052CC',
  },
  quotationTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1E5F7',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  tableBodyRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableBodyCell: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
  },
  customModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  customModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  customModalCardDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  customModalIconContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  customModalIconAura: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  customModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  customModalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  customModalButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  customModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  customModalCancelBtnDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  customModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  customModalConfirmBtn: {
    flex: 1.3,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  customModalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});