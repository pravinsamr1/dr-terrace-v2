import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { useTabBar } from '../../../core/context/TabBarContext';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { paymentRepository } from '../api/paymentRepository';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { compressImage, formatFileSize } from '../../../core/utils/imageUtils';

const PAYMENT_STAGES = [
  { id: 'advance', label: 'Booking Advance' },
  { id: 'initial', label: 'Initial Payment' },
  { id: 'mid', label: 'Mid Payment' },
  { id: 'final', label: 'Final Payment' },
];

export default function PaymentFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setTabBarVisible } = useTabBar();

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  const [app, setApp] = useState(null);
  const [stageId, setStageId] = useState(
    params.stage || (params.milestone?.includes('final') ? 'final' : 'initial')
  );
  const [hasGst, setHasGst] = useState(params.hasGst === 'true' || params.hasGst === true);
  const isGstPayment = Boolean(
    stageId === 'gst' ||
    params.isGstPayment === 'true' ||
    params.isGstPayment === true ||
    params.stage === 'GST Tax Clearance' ||
    params.serviceTitle === 'GST Tax Clearance'
  );
  const [gstPercent, setGstPercent] = useState(params.gstPercent ? String(params.gstPercent) : '18');
  const [paymentAmount, setPaymentAmount] = useState(params.amount != null && params.amount !== '' ? String(params.amount) : '');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'upi' | 'card' | 'cash'
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  // API v2: Quotation ID & PayView state
  const [quotationId, setQuotationId] = useState(params.quotationId || null);
  const [payView, setPayView] = useState(null);
  const [isLoadingPayView, setIsLoadingPayView] = useState(false);
  const [activeService, setActiveService] = useState(null); // currentActiveService from payView

  // Services state - 100% sourced dynamically from backend API, zero static or fallback data
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState('');
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load payView from API v2 when quotationId is available
  useEffect(() => {
    if (!quotationId) return;
    let isMounted = true;
    setIsLoadingPayView(true);
    paymentRepository.getPayView(quotationId).then((res) => {
      if (!isMounted) return;
      setIsLoadingPayView(false);
      if (res?.success && res.data) {
        const pv = res.data;
        setPayView(pv);
        // Set bank accounts from payView (API v2 provides accounts alongside payment state)
        if (Array.isArray(pv.accounts) && pv.accounts.length > 0) {
          const normalized = pv.accounts.map((a, i) => ({
            id: String(a.id || a._id || `bank_${i}`),
            name: a.accountName || a.bankName || a.name || `Account ${i + 1}`,
            isPrimary: Boolean(a.isPrimary || i === 0),
            accountNumber: String(a.accountNumber || a.account_number || ''),
            ifsc: String(a.ifscCode || a.ifsc || ''),
            beneficiary: a.accountName || a.beneficiaryName || '',
            branch: a.branchName || a.branch || '',
          }));
          setBankAccounts(normalized);
          const primary = normalized.find((b) => b.isPrimary) || normalized[0];
          if (primary) setSelectedBankId(primary.id);
        }
        // Identify the target service from all services (including variation payments)
        const allPvServices = [
          ...(Array.isArray(pv.services) ? pv.services : []),
          ...(Array.isArray(pv.additionalPayment) ? pv.additionalPayment : []),
        ];
        if (allPvServices.length > 0) {
          const paramSvcId = params.serviceId ? String(params.serviceId) : null;
          const paramSvcName = (params.serviceName || params.service || '').trim().toLowerCase();
          const targetSvc = (paramSvcId && allPvServices.find((s) => String(s.id) === paramSvcId))
            || (paramSvcName && allPvServices.find((s) => (s.title || s.name || '').trim().toLowerCase() === paramSvcName))
            || (pv.currentActiveServiceId && allPvServices.find((s) => String(s.id) === String(pv.currentActiveServiceId)))
            || allPvServices[0];
          if (targetSvc) {
            setActiveService(targetSvc);
            setSelectedServiceId(String(targetSvc.id));
            setSelectedServiceName(targetSvc.title || targetSvc.name || '');
          }

          const pvServices = allPvServices.map((s, idx) => ({
            id: String(s.id || `pv_svc_${idx}`),
            name: s.title || s.name || `Service ${idx + 1}`,
          }));
          setServices((prev) => {
            const map = new Map();
            pvServices.forEach((s) => map.set(s.name.toLowerCase().trim(), s));
            prev.forEach((s) => {
              if (s?.name && !map.has(s.name.toLowerCase().trim())) {
                map.set(s.name.toLowerCase().trim(), s);
              }
            });
            return Array.from(map.values());
          });
        }
      }
    }).catch(() => {
      if (isMounted) setIsLoadingPayView(false);
    });
    return () => { isMounted = false; };
  }, [quotationId, params.serviceId, params.serviceName, params.service]);



  // Fetch live services dynamically from backend API v2 (zero static fallback data)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingServices(true);
    paymentRepository.getServices().then((res) => {
      if (isMounted) {
        setIsLoadingServices(false);
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setServices((prev) => {
            const map = new Map();
            res.data.forEach((s) => {
              if (s?.name) map.set(s.name.toLowerCase().trim(), s);
            });
            prev.forEach((s) => {
              if (s?.name && !map.has(s.name.toLowerCase().trim())) {
                map.set(s.name.toLowerCase().trim(), s);
              }
            });
            return Array.from(map.values());
          });
        }
      }
    }).catch(() => {
      if (isMounted) setIsLoadingServices(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Include any services associated with this appointment / client from backend
  useEffect(() => {
    if (!app) return;
    const appServices = [];
    if (Array.isArray(app.services)) {
      app.services.forEach((s, idx) => {
        const name = typeof s === 'string' ? s : s?.name || s?.serviceName || s?.title;
        if (name && typeof name === 'string' && name.trim()) {
          appServices.push({ id: String(s?.id || `app_srv_${idx}`), name: name.trim() });
        }
      });
    }
    if (Array.isArray(app.servicesList)) {
      app.servicesList.forEach((s, idx) => {
        const name = s?.serviceName || s?.name || s?.service || s?.title;
        if (name && typeof name === 'string' && name.trim()) {
          appServices.push({ id: String(s?.id || s?.serviceId || `app_sl_${idx}`), name: name.trim() });
        }
      });
    }
    if (Array.isArray(app.whereToWaterproof)) {
      app.whereToWaterproof.forEach((w, idx) => {
        const name = typeof w === 'object' && w !== null ? w.name : w;
        if (name && typeof name === 'string' && name.trim()) {
          appServices.push({ id: String(w?.id || `app_wtw_${idx}`), name: name.trim() });
        }
      });
    }
    if (typeof app.serviceType === 'string' && app.serviceType.trim()) {
      app.serviceType.split(',').forEach((st, idx) => {
        const trimmed = st.trim();
        if (trimmed && trimmed.toLowerCase() !== 'none') {
          appServices.push({ id: `app_st_${idx}`, name: trimmed });
        }
      });
    }
    if (Array.isArray(app.additionalPayments)) {
      app.additionalPayments.forEach((a, idx) => {
        const name = a?.title || a?.name || a?.serviceName || `Variation ${idx + 1}`;
        if (name && typeof name === 'string' && name.trim()) {
          appServices.push({ id: String(a?.id || `app_add_${idx}`), name: name.trim() });
        }
      });
    }

    if (appServices.length > 0) {
      setServices((prev) => {
        const map = new Map();
        prev.forEach((s) => {
          if (s?.name) map.set(s.name.toLowerCase().trim(), s);
        });
        appServices.forEach((s) => {
          if (s?.name && !map.has(s.name.toLowerCase().trim())) {
            map.set(s.name.toLowerCase().trim(), s);
          }
        });
        return Array.from(map.values());
      });
    }
  }, [app]);

  // Pre-select service from route params if passed
  useEffect(() => {
    if (params.serviceId) {
      setSelectedServiceId(String(params.serviceId));
    }
    const paramSvc = params.service || params.serviceName;
    if (paramSvc && typeof paramSvc === 'string') {
      setSelectedServiceName(paramSvc.trim());
    }
  }, [params.service, params.serviceName, params.serviceId]);

  // Auto-select first service from backend when services are loaded and no param was specified
  useEffect(() => {
    if (!selectedServiceName && !params.service && !params.serviceName && !params.serviceId && services.length > 0) {
      setSelectedServiceId(services[0].id);
      setSelectedServiceName(services[0].name);
    }
  }, [services, selectedServiceName, params.service, params.serviceName, params.serviceId]);

  // Reference image upload state (for Admin Verification)
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    setPaymentDate(formatDateDDMMYY(new Date()));
  }, []);

  useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        const appt = res.appointment;
        setApp(appt);
        // Resolve quotationId from appointment record if not already set from params
        if (!params.quotationId) {
          const qId = appt.confirmedQuoteId
            || appt.activeQuotationId
            || (Array.isArray(appt.quotations) && appt.quotations.find((q) => q.isConfirmed)?.id)
            || (Array.isArray(appt.quotations) && appt.quotations[0]?.id)
            || null;
          if (qId) setQuotationId(String(qId));
        }
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            const clientData = cRes.client || cRes.data;
            setApp(clientData);
            if (!params.quotationId) {
              const qId = clientData.confirmedQuoteId
                || clientData.activeQuotationId
                || (Array.isArray(clientData.quotations) && clientData.quotations.find((q) => q.isConfirmed)?.id)
                || (Array.isArray(clientData.quotations) && clientData.quotations[0]?.id)
                || null;
              if (qId) setQuotationId(String(qId));
            }
          }
        });
      }
    });
  }, [params.id]);

  const additionalPaymentsTotal = React.useMemo(() => {
    if (payView) {
      // API may return additionalPayment as a single object OR as an array
      const addPayList = Array.isArray(payView?.additionalPayment)
        ? payView.additionalPayment
        : (payView?.additionalPayment && typeof payView.additionalPayment === 'object' ? [payView.additionalPayment] : []);
      if (addPayList.length > 0) {
        return addPayList.reduce(
          (sum, item) => sum + Number(item?.totalPrice || item?.amount || item?.price || item?.paidAmount || 0),
          0
        );
      }
      // Also check additionalAmount from payView (pre-computed by API)
      if (payView?.additionalAmount != null && Number(payView.additionalAmount) > 0) {
        return Number(payView.additionalAmount);
      }
      return 0;
    }
    if (Array.isArray(app?.additionalPayments) && app.additionalPayments.length > 0) {
      return app.additionalPayments.reduce(
        (sum, item) => sum + Number(item?.totalPrice || item?.amount || item?.price || 0),
        0
      );
    }
    return Number(params.additionalCost || 0);
  }, [payView, payView?.additionalPayment, payView?.additionalAmount, app?.additionalPayments, params.additionalCost]);

  const primaryServicesCost = React.useMemo(() => {
    if (payView?.totalPrice != null && Number(payView.totalPrice) > 0) {
      return Number(payView.totalPrice);
    }
    const paramBase = Number(params.baseServiceCost);
    if (paramBase > 0) return paramBase;
    const paramCost = Number(params.baseCost || params.totalCost);
    if (paramCost > 0) return Math.max(0, paramCost - additionalPaymentsTotal);
    const appCost = Number(app?.cost || app?.totalPayment || app?.totalCost || app?.totalAmount || 0);
    return appCost;
  }, [payView?.totalPrice, params.baseServiceCost, params.baseCost, params.totalCost, app, additionalPaymentsTotal]);

  const baseTotal = React.useMemo(() => {
    // For GST or Final settlement, base must be the actual Grand Total for the
    // project (totalWithGst — the authoritative field from the API pay-view),
    // NOT grossSubtotal (a pre-discount figure that drifts once discounts,
    // additional services, or other adjustments are applied).
    if (hasGst || stageId === 'final' || isGstPayment) {
      const apiGrandTotal = Number(
        payView?.totalWithGst ||
        payView?.totalPrice ||
        payView?.grossSubtotal ||
        payView?.subtotalAfterDiscount ||
        payView?.totalPaid ||
        0
      );
      if (apiGrandTotal > 0) return apiGrandTotal;

      // Fall back to params.baseCost explicitly passed by the caller (already includes additional)
      const paramCost = Number(params.baseCost);
      if (paramCost > 0) return paramCost;

      // Last resort: services total + additional
      if (payView?.totalPrice != null && Number(payView.totalPrice) > 0) {
        return Number(payView.totalPrice) + additionalPaymentsTotal;
      }
      const appCost = Number(app?.cost || app?.totalPayment || app?.totalCost || app?.totalAmount || 0);
      return appCost + additionalPaymentsTotal;
    }

    if (payView?.totalPrice != null && Number(payView.totalPrice) > 0) {
      return Number(payView.totalPrice);
    }
    const paramCost = Number(params.baseCost || params.totalCost);
    if (paramCost > 0) return paramCost;
    const appCost = Number(app?.cost || app?.totalPayment || app?.totalCost || app?.totalAmount || 0);
    return appCost;
  }, [payView?.totalPrice, payView?.totalWithGst, payView?.grossSubtotal, payView?.subtotalAfterDiscount, payView?.totalPaid, params.baseCost, params.totalCost, app, hasGst, stageId, isGstPayment, additionalPaymentsTotal, primaryServicesCost]);

  // The GST tax rate/base is decided and stored server-side on the quotation
  // (payView.gstPercentage over the pre-GST subtotal), even before the GST
  // decision is formally "confirmed" (isGstConfirmed). The backend enforces
  // a remaining-balance cap computed from THAT stored rate, regardless of
  // what percentage preset is highlighted in this form. Previously, when
  // payView.gstAmount happened to be 0 (first-time GST recording), the app
  // had no cap at all client-side and would let the user compute an amount
  // off an arbitrary preset (e.g. 28%) against the grand total, which the
  // backend then rejected because its own cap is based on the confirmed
  // rate (e.g. 18%) applied to the pre-GST subtotal. gstBalanceCap mirrors
  // the backend's calculation so the UI never lets the amount drift past
  // what will actually be accepted.
  const gstBalanceCap = React.useMemo(() => {
    if (!payView) return null;
    if (payView.gstPayment?.balanceAmount != null) {
      const v = Number(payView.gstPayment.balanceAmount);
      return v >= 0 ? v : null;
    }
    if (payView.gstAmount != null && Number(payView.gstAmount) > 0) {
      return Number(payView.gstAmount);
    }
    if (payView.isGst && Number(payView.gstPercentage) > 0) {
      const preGstBase = Number(
        payView.grossSubtotal ||
        payView.subtotalAfterDiscount ||
        payView.totalPrice ||
        payView.totalWithGst ||
        0
      );
      if (preGstBase > 0) {
        return Math.round(preGstBase * (Number(payView.gstPercentage) / 100) * 100) / 100;
      }
    }
    return null;
  }, [payView]);

  // Once the quotation's actual GST rate is known, default the percentage
  // field to it instead of the hardcoded '18' guess, so the presets shown
  // start in sync with what the backend will actually accept.
  useEffect(() => {
    if (params.gstPercent == null && payView?.gstPercentage != null && Number(payView.gstPercentage) > 0) {
      setGstPercent(String(payView.gstPercentage));
    }
  }, [payView?.gstPercentage, params.gstPercent]);

  // Auto-sync calculated GST amount when baseTotal or gstPercent updates
  useEffect(() => {
    if ((stageId === 'final' && hasGst || isGstPayment) && baseTotal > 0) {
      const pct = parseFloat(gstPercent) || 18;
      let calculatedGst = Math.round(baseTotal * (pct / 100));
      if (gstBalanceCap != null) calculatedGst = Math.min(calculatedGst, gstBalanceCap);
      setPaymentAmount(String(calculatedGst));
    }
  }, [baseTotal, stageId, hasGst, isGstPayment, gstPercent, gstBalanceCap]);

  const handleGstPercentChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setGstPercent(cleaned);
    const pct = parseFloat(cleaned) || 0;
    let calculatedGst = Math.round(baseTotal * (pct / 100));
    if (gstBalanceCap != null) calculatedGst = Math.min(calculatedGst, gstBalanceCap);
    setPaymentAmount(String(calculatedGst));
  };

  const handleSelectGstPreset = (presetPct) => {
    setGstPercent(String(presetPct));
    let calculatedGst = Math.round(baseTotal * (presetPct / 100));
    if (gstBalanceCap != null) calculatedGst = Math.min(calculatedGst, gstBalanceCap);
    setPaymentAmount(String(calculatedGst));
  };

  const isInitialPaid = Boolean(app?.initialPaid || app?.initialPaymentReceived);
  const isAdvancePaid = Boolean(app?.advancePaid || app?.bookingAdvancePaid);
  const isFinalPaid = Boolean(app?.finalPaid);

  // Available stages:
  // At first time (before Initial Payment): Booking Advance (if unpaid) and Initial Payment
  // After Initial Payment: Mid Payment (can be made multiple times) and Final Payment (one-time)
  const availableStages = React.useMemo(() => {
    if (params.stage === 'final' || String(params.milestone || '').toLowerCase().includes('final')) {
      const finalStage = PAYMENT_STAGES.find((s) => s.id === 'final');
      return finalStage ? [finalStage] : [];
    }
    if (!isInitialPaid) {
      const list = [];
      if (!isAdvancePaid) {
        list.push(PAYMENT_STAGES.find((s) => s.id === 'advance'));
      }
      list.push(PAYMENT_STAGES.find((s) => s.id === 'initial'));
      return list.filter(Boolean);
    } else {
      const list = [
        PAYMENT_STAGES.find((s) => s.id === 'mid'),
      ];
      if (!isFinalPaid) {
        list.push(PAYMENT_STAGES.find((s) => s.id === 'final'));
      }
      return list.filter(Boolean);
    }
  }, [isInitialPaid, isAdvancePaid, isFinalPaid, params.stage, params.milestone]);

  // Keep stageId valid within availableStages
  useEffect(() => {
    if (availableStages.length > 0 && !availableStages.some((s) => s.id === stageId)) {
      const nextStageId = availableStages[0].id;
      setStageId(nextStageId);
    }
  }, [availableStages, stageId]);

  // Initialize amount based on params or stage
  useEffect(() => {
    if (params.amount !== undefined && params.amount !== '') {
      setPaymentAmount(String(params.amount));
    }

    if (params.hasGst !== undefined) {
      setHasGst(params.hasGst === 'true' || params.hasGst === true);
    }

    if (params.gstPercent !== undefined) {
      setGstPercent(String(params.gstPercent));
    }

    if (params.stage) {
      setStageId(params.stage);
    } else if (params.milestone) {
      const ms = String(params.milestone).toLowerCase();
      if (ms.includes('initial')) setStageId('initial');
      else if (ms.includes('mid')) setStageId('mid');
      else if (ms.includes('final')) setStageId('final');
      else if (ms.includes('advance') || ms.includes('booking')) setStageId('advance');
    }
  }, [params.amount, params.hasGst, params.gstPercent, params.stage, params.milestone]);

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;

  const rawClientName = app?.clientName || app?.name || app?.customerName || params.clientName || params.customerName || '';
  // const prefix = rawClientName.trim();
  const displayName = rawClientName.trim() ? `${rawClientName.trim()}` : '';
  const displayId = (app?.id || params.id) ? `DR${app?.id || params.id}` : '';
  const displayPhone = app?.phone || app?.mobile || app?.mobileNumber || params.phone || '';
  const displayArea = app?.area || app?.location || app?.city || params.area || '';

  const initials = (displayName || 'CU')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'CU';

  const handleTakePhoto = async () => {
    setShowUploadModal(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture reference images.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || `ref_photo_${Date.now()}.jpg`;
        const compressedUri = await compressImage(asset.uri);
        const fileSize = asset.fileSize || asset.filesize || 0;
        setAttachedDoc({
          uri: compressedUri,
          name: filename,
          type: 'image',
          size: fileSize,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handlePickFromGallery = async () => {
    setShowUploadModal(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Photo library permission is required to choose a reference image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || `ref_image_${Date.now()}.jpg`;
        const compressedUri = await compressImage(asset.uri);
        const fileSize = asset.fileSize || asset.filesize || 0;
        setAttachedDoc({
          uri: compressedUri,
          name: filename,
          type: 'image',
          size: fileSize,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleChooseFile = async () => {
    setShowUploadModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.name || `ref_doc_${Date.now()}`;
        const isPdf = asset.mimeType?.includes('pdf');
        const finalUri = isPdf ? asset.uri : await compressImage(asset.uri);
        const fileSize = asset.size || 0;
        setAttachedDoc({
          uri: finalUri,
          name: filename,
          type: isPdf ? 'pdf' : 'image',
          size: fileSize,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  const handleSubmit = async () => {
    const cleanAmtStr = String(paymentAmount ?? '').trim().replace(/[^0-9.]/g, '');
    const numericAmt = parseFloat(cleanAmtStr) || 0;
    const isFinalSettlement = stageId === 'final';
    const isGstPayment =
      stageId === 'gst' ||
      params.isGstPayment === 'true' ||
      params.stage === 'GST Tax Clearance' ||
      params.serviceTitle === 'GST Tax Clearance';

    if (isNaN(numericAmt) || numericAmt < 0 || (numericAmt === 0 && !(isFinalSettlement && !hasGst))) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
      return;
    }

    const maxQuotationBalance = payView?.balanceAmount != null ? Number(payView.balanceAmount) : null;
    if (!isFinalSettlement && !isGstPayment && maxQuotationBalance !== null && maxQuotationBalance >= 0 && numericAmt > (maxQuotationBalance + 0.01)) {
      Alert.alert(
        'Amount Exceeds Balance',
        `Payment amount (₹${numericAmt.toLocaleString()}) exceeds remaining quotation balance (₹${maxQuotationBalance.toLocaleString()}).`
      );
      return;
    }

    if (isGstPayment) {
      // gstBalanceCap mirrors the backend's own remaining-GST-balance
      // calculation (see its definition above), so this catches any
      // mismatch — including a manually-typed amount — before it ever
      // reaches the server.
      if (gstBalanceCap != null && numericAmt > (gstBalanceCap + 0.01)) {
        Alert.alert(
          'Amount Exceeds GST Balance',
          `Payment amount (₹${numericAmt.toLocaleString()}) exceeds remaining GST tax clearance balance (₹${gstBalanceCap.toLocaleString()}).`
        );
        return;
      }
      // If no cap could be determined, this is a first-time GST payment with no known rate yet — no cap applied.
    }

    const allKnownServices = [
      ...(Array.isArray(payView?.services) ? payView.services : []),
      ...(Array.isArray(payView?.additionalPayment) ? payView.additionalPayment : []),
    ];
    const targetService = (selectedServiceId && allKnownServices.find((s) => String(s.id) === String(selectedServiceId)))
      || activeService;

    const maxAllowedServiceAmt = targetService?.balanceAmount != null && Number(targetService.balanceAmount) > 0
      ? Number(targetService.balanceAmount)
      : (targetService?.totalPrice != null && Number(targetService.totalPrice) > 0 ? Number(targetService.totalPrice) : null);

    if (!isFinalSettlement && !isGstPayment && maxAllowedServiceAmt !== null && maxAllowedServiceAmt > 0 && numericAmt > (maxAllowedServiceAmt + 0.01)) {
      Alert.alert(
        'Amount Exceeds Service Balance',
        `Payment amount (₹${numericAmt.toLocaleString()}) cannot exceed the service balance (₹${maxAllowedServiceAmt.toLocaleString()}).`
      );
      return;
    }

    if (!isFinalSettlement && !isGstPayment && services.length > 0 && !selectedServiceName) {
      Alert.alert('Missing Service', 'Please select a service for this payment.');
      return;
    }

    if (numericAmt > 0 && paymentMethod === 'cash' && !voucherNumber.trim()) {
      Alert.alert('Missing Voucher', 'Please enter the cash receipt / voucher number.');
      return;
    }
    if (numericAmt > 0 && paymentMethod === 'upi' && !upiTransactionId.trim()) {
      Alert.alert('Missing UTR', 'Please enter the UPI transaction ID / UTR number.');
      return;
    }
    if (numericAmt > 0 && !attachedDoc) {
      Alert.alert(
        'No Reference Image Attached',
        'Adding a reference image (payment receipt, bank transfer screenshot, or cash voucher) will be verified by the admin. Would you like to attach one now or continue?',
        [
          { text: 'Add Image', onPress: () => setShowUploadModal(true) },
          { text: 'Continue Anyway', onPress: processPaymentSubmission },
        ]
      );
      return;
    }
    processPaymentSubmission();
  };

  const processPaymentSubmission = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const cleanAmtStr = String(paymentAmount ?? '').trim().replace(/[^0-9.]/g, '');
    const numericAmt = parseFloat(cleanAmtStr) || 0;
    const isFinalSettlement = stageId === 'final';
    const cleanId = String(app?.id || params.id).replace(/^DR/i, '').trim();

    // Build payment method payload per API v2 contract
    const buildPaymentMethodFields = () => {
      if (paymentMethod === 'cash') {
        return { paymentMethod: 'CASH', voucher: voucherNumber.trim() };
      }
      if (paymentMethod === 'card') {
        // ACCOUNT type uses accountId (integer) from payView.accounts
        const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0];
        return { paymentMethod: 'ACCOUNT', accountId: selectedBank ? Number(selectedBank.id) || selectedBank.id : undefined };
      }
      if (paymentMethod === 'upi') {
        return { paymentMethod: 'UPI', upiId: upiTransactionId.trim() };
      }
      return {};
    };

    const docInfo = attachedDoc ? {
      document: attachedDoc.name,
      documentName: attachedDoc.name,
      documentUri: attachedDoc.uri,
      referenceImage: attachedDoc.uri,
      referenceImageType: attachedDoc.type,
    } : {};

    try {
      // ── API v2 Path: quotationId available ──────────────────────────────────
      if (quotationId) {
        const methodFields = buildPaymentMethodFields();
        const notesWithRef = attachedDoc?.name
          ? `${paymentDate} [Ref: ${attachedDoc.name}]`
          : paymentDate;
        const basePayload = {
          amount: numericAmt,
          notes: notesWithRef,
          ...methodFields,
          ...(attachedDoc ? { proofImage: attachedDoc } : {}),
        };

        if (isGstPayment) {
          const res = await paymentRepository.recordGstPayment(quotationId, basePayload);
          if (!res?.success) throw new Error(res?.message || 'GST clearance payment failed');
        } else if (isFinalSettlement) {
          const settlementPayload = {
            withGst: hasGst,
            gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
            ...basePayload,
          };
          const res = await paymentRepository.confirmFinalSettlement(quotationId, settlementPayload);
          if (!res?.success) throw new Error(res?.message || 'Final settlement failed');
        } else {
          // Progressive payment targeting the active service or variation
          const targetServiceId = selectedServiceId || (payView?.currentActiveServiceId ? String(payView.currentActiveServiceId) : null);
          if (!targetServiceId) throw new Error('No active service found for payment.');

          const isVariation =
            params.isAdditional === 'true' ||
            params.isAdditional === true ||
            (Array.isArray(payView?.additionalPayment) &&
              payView.additionalPayment.some((a) => String(a.id) === String(targetServiceId)));

          const res = isVariation
            ? await paymentRepository.recordAdditionalServicePayment(quotationId, targetServiceId, basePayload)
            : await paymentRepository.recordServicePayment(quotationId, targetServiceId, basePayload);

          if (!res?.success) throw new Error(res?.message || 'Payment recording failed');
        }

        // Also persist reference image & pending admin verification on appointment
        if (cleanId) {
          const apptUpdate = {
            verificationStatus: 'pending',
            isVerified: false,
            ...(isGstPayment ? {
              hasGst: true,
              gstPaid: true,
              gstPercentage: Number(gstPercent) || 18,
              gstPaidAmount: numericAmt,
              gstPaidDetails: {
                amount: numericAmt,
                paymentMethod,
                paymentDate,
                hasGst: true,
                gstPercentage: Number(gstPercent) || 18,
                voucherNumber: voucherNumber.trim(),
                upiTransactionId: upiTransactionId.trim(),
                verificationStatus: 'pending',
                ...docInfo,
              },
            } : isFinalSettlement ? {
              hasGst: hasGst,
              gstPaid: hasGst,
              gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
              gstPaidAmount: numericAmt,
              gstPaidDetails: {
                amount: numericAmt,
                paymentMethod,
                paymentDate,
                hasGst,
                gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
                voucherNumber: voucherNumber.trim(),
                upiTransactionId: upiTransactionId.trim(),
                verificationStatus: 'pending',
                ...docInfo,
              },
              finalPaid: true,
              finalPaidAmount: numericAmt,
              finalPaidDetails: {
                amount: numericAmt,
                paymentMethod,
                paymentDate,
                hasGst,
                gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
                voucherNumber: voucherNumber.trim(),
                upiTransactionId: upiTransactionId.trim(),
                verificationStatus: 'pending',
                ...docInfo,
              },
            } : {}),
            ...(attachedDoc ? {
              attachedDoc: { uri: attachedDoc.uri, name: attachedDoc.name, type: attachedDoc.type },
              referenceImage: attachedDoc.uri,
              referenceImageName: attachedDoc.name,
              documentUri: attachedDoc.uri,
              documentName: attachedDoc.name,
            } : {}),
          };
          await appointmentRepository.updateAppointment(cleanId, apptUpdate).catch(() => { });
        }
      } else {
        // ── Legacy Path: no quotationId — update appointment directly ──────────
        if (cleanId) {
          const updatePayload = {
            verificationStatus: 'pending',
            isVerified: false,
            ...(attachedDoc ? {
              attachedDoc: { uri: attachedDoc.uri, name: attachedDoc.name, type: attachedDoc.type },
              referenceImage: attachedDoc.uri,
              referenceImageName: attachedDoc.name,
              documentUri: attachedDoc.uri,
              documentName: attachedDoc.name,
            } : {}),
          };
          const bankInfo = paymentMethod === 'card' ? {
            bankAccount: bankAccounts.find((b) => b.id === selectedBankId)?.name || null,
            bankId: selectedBankId || null,
          } : {};
          const serviceInfo = selectedServiceName ? {
            service: selectedServiceName,
            serviceName: selectedServiceName,
            serviceId: selectedServiceId || null,
          } : {};

          if (stageId === 'advance') {
            updatePayload.advancePaid = true;
            updatePayload.advancePaidAmount = numericAmt;
            updatePayload.advanceDetails = { amount: numericAmt, paymentMethod, paymentDate, ...bankInfo, ...serviceInfo, ...docInfo };
          } else if (stageId === 'initial') {
            updatePayload.initialPaid = true;
            updatePayload.initialPaidAmount = numericAmt;
            updatePayload.initialPaymentReceived = true;
            updatePayload.initialPaidDetails = { amount: numericAmt, paymentMethod, paymentDate, ...bankInfo, ...serviceInfo, ...docInfo };
          } else if (stageId === 'mid') {
            updatePayload.midTermPaid = true;
            updatePayload.midTermPaidAmount = Number(app?.midTermPaidAmount || 0) + numericAmt;
            const newMidEntry = { amount: numericAmt, paymentMethod, paymentDate, ...bankInfo, ...serviceInfo, ...docInfo };
            updatePayload.midPayments = [...(Array.isArray(app?.midPayments) ? app.midPayments : []), newMidEntry];
          } else if (stageId === 'final') {
            updatePayload.finalPaid = true;
            updatePayload.finalPaidAmount = numericAmt;
            updatePayload.hasGst = hasGst;
            updatePayload.gstPaid = hasGst;
            updatePayload.gstPercentage = hasGst ? (Number(gstPercent) || 0) : 0;
            updatePayload.gstPaidAmount = numericAmt;
            updatePayload.gstPaidDetails = {
              amount: numericAmt,
              paymentMethod,
              paymentDate,
              hasGst,
              gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
              voucherNumber: voucherNumber.trim(),
              upiTransactionId: upiTransactionId.trim(),
              verificationStatus: 'pending',
              ...bankInfo,
              ...serviceInfo,
              ...docInfo,
            };
            updatePayload.finalPaidDetails = {
              amount: numericAmt,
              paymentMethod,
              paymentDate,
              hasGst,
              gstPercentage: hasGst ? (Number(gstPercent) || 0) : 0,
              voucherNumber: voucherNumber.trim(),
              upiTransactionId: upiTransactionId.trim(),
              verificationStatus: 'pending',
              ...bankInfo,
              ...serviceInfo,
              ...docInfo,
            };
          }
          await appointmentRepository.updateAppointment(cleanId, updatePayload);
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      const errorMessage = extractApiErrorMessage(err, 'Could not record payment. Please try again.');
      Alert.alert('Payment Failed', errorMessage);
      return;
    } finally {
      setIsSubmitting(false);
    }

    Alert.alert(
      'Payment Recorded Successfully!',
      attachedDoc
        ? `Payment of ₹${numericAmt.toLocaleString()} and reference image recorded. Sent to Admin for verification.`
        : isGstPayment
          ? `GST clearance payment of ₹${numericAmt.toLocaleString()} recorded in the blockchain ledger. Sent to Admin for verification.`
          : isFinalSettlement
            ? `Final Settlement of ₹${numericAmt.toLocaleString()} has been recorded. Warranty activation is now pending.`
            : `Payment of ₹${numericAmt.toLocaleString()} recorded in the blockchain ledger.`,
      [
        {
          text: 'Done',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({
                pathname: '/customer-detail',
                params: { id: cleanId, initialTab: 'payments' },
              });
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Customer Context Summary Pill */}
      <View style={[styles.clientSummaryBar, isDark && styles.clientSummaryBarDark]}>
        <View style={styles.clientSummaryLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clientName, isDark && styles.textDark]} numberOfLines={1}>
              {displayName || 'Client'}
            </Text>
            <Text style={[styles.clientMeta, isDark && styles.subtextDark]} numberOfLines={1}>
              {[displayId, displayPhone, displayArea].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scope Card: If GST clearance, render Full Project Scope (Services + Additional Payments); else Active Service */}
        {((stageId === 'final' && hasGst) || isGstPayment) ? (
          <View style={[styles.serviceInfoCard, isDark && styles.serviceInfoCardDark]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                <Ionicons name="document-text-outline" size={16} color="#2557C7" />
                <Text style={[styles.serviceInfoTitle, isDark && styles.textDark]} numberOfLines={1}>
                  GST Clearance Scope (Full Project)
                </Text>
              </View>
              <View style={[styles.statusBadge, styles.statusCompleted]}>
                <Text style={styles.statusBadgeText}>TAX INVOICE</Text>
              </View>
            </View>

            {/* List of Primary Services */}
            {Array.isArray(payView?.services) && payView.services.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Contract Services
                </Text>
                {payView.services.map((svc, sIdx) => (
                  <View key={svc.id || `svc_${sIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#334155', flex: 1 }} numberOfLines={1}>
                      • {svc.title || svc.name || `Service ${sIdx + 1}`}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      ₹{Number(svc.totalPrice || svc.paidAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* List of Additional Variation Payments */}
            {Array.isArray(payView?.additionalPayment) && payView.additionalPayment.length > 0 && (
              <View style={{ marginBottom: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Variation Work Orders ({payView.additionalPayment.length})
                </Text>
                {payView.additionalPayment.map((addSvc, aIdx) => (
                  <View key={addSvc.id || `add_${aIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#334155', flex: 1 }} numberOfLines={1}>
                      • {addSvc.title || `Variation Order ${aIdx + 1}`}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      ₹{Number(addSvc.totalPrice || addSvc.amount || addSvc.paidAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* If no payView but app has additionalPayments */}
            {!payView && Array.isArray(app?.additionalPayments) && app.additionalPayments.length > 0 && (
              <View style={{ marginBottom: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Variation Work Orders ({app.additionalPayments.length})
                </Text>
                {app.additionalPayments.map((addSvc, aIdx) => (
                  <View key={addSvc.id || `app_add_${aIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#334155', flex: 1 }} numberOfLines={1}>
                      • {addSvc.title || `Variation Order ${aIdx + 1}`}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      ₹{Number(addSvc.amount || addSvc.totalPrice || 0).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* 3-Column Summary Balance Row */}
            <View style={[styles.serviceBalanceRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={styles.serviceBalanceItem}>
                <Text style={styles.serviceBalanceLabel}>Services</Text>
                <Text style={[styles.serviceBalanceValue, isDark && styles.textDark]}>
                  ₹{primaryServicesCost.toLocaleString()}
                </Text>
              </View>
              <View style={styles.serviceBalanceDivider} />
              <View style={styles.serviceBalanceItem}>
                <Text style={styles.serviceBalanceLabel}>Additional Payment</Text>
                <Text style={[styles.serviceBalanceValue, { color: '#D97706' }]}>
                  ₹{additionalPaymentsTotal.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Service Selector: Allows paying for ANY service regardless of order */}
            {stageId !== 'final' && !isGstPayment && Array.isArray(payView?.services) && payView.services.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 8, fontSize: 13, fontWeight: '700' }]}>
                  Select Service to Pay <Text style={styles.requiredStar}>*</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {payView.services.map((svc) => {
                    const isSelected = String(svc.id) === String(selectedServiceId || activeService?.id);
                    const isCompleted = svc.status === 'COMPLETED' || (Number(svc.balanceAmount) === 0 && Number(svc.totalPrice) > 0);
                    return (
                      <TouchableOpacity
                        key={svc.id}
                        onPress={() => {
                          setActiveService(svc);
                          setSelectedServiceId(String(svc.id));
                          setSelectedServiceName(svc.title || svc.name || '');
                          if (svc.balanceAmount != null && Number(svc.balanceAmount) > 0) {
                            setPaymentAmount(String(svc.balanceAmount));
                          }
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#2557C7' : (isDark ? '#334155' : '#E2E8F0'),
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(37, 87, 199, 0.25)' : '#EFF6FF')
                            : (isDark ? '#1E293B' : '#FFFFFF'),
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isCompleted ? 'checkmark-circle' : (isSelected ? 'radio-button-on' : 'radio-button-off')}
                          size={16}
                          color={isSelected ? '#2557C7' : (isCompleted ? '#16A34A' : (isDark ? '#94A3B8' : '#64748B'))}
                        />
                        <View>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? '700' : '600',
                              color: isSelected ? '#2557C7' : (isDark ? '#FFFFFF' : '#0F172A'),
                            }}
                          >
                            {svc.title || svc.name}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: (svc.balanceAmount || 0) > 0 ? '#DC2626' : '#16A34A', marginTop: 1 }}>
                            Bal: ₹{(svc.balanceAmount || 0).toLocaleString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {activeService && (
              <View style={[styles.serviceInfoCard, isDark && styles.serviceInfoCardDark]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.serviceInfoTitle, isDark && styles.textDark]} numberOfLines={1}>
                  {activeService.title || activeService.name}
                </Text>
                <View style={[styles.statusBadge, activeService.status === 'COMPLETED' ? styles.statusCompleted : styles.statusPending]}>
                  <Text style={styles.statusBadgeText}>{activeService.status || 'IN PROGRESS'}</Text>
                </View>
              </View>
              {activeService.sqft > 0 && (
                <Text style={[styles.serviceInfoMeta, isDark && styles.subtextDark]}>
                  {activeService.sqft} sqft
                </Text>
              )}
              <View style={styles.serviceBalanceRow}>
                <View style={styles.serviceBalanceItem}>
                  <Text style={styles.serviceBalanceLabel}>Total</Text>
                  <Text style={[styles.serviceBalanceValue, isDark && styles.textDark]}>
                    ₹{(activeService.totalPrice || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.serviceBalanceDivider} />
                <View style={styles.serviceBalanceItem}>
                  <Text style={styles.serviceBalanceLabel}>Paid</Text>
                  <Text style={[styles.serviceBalanceValue, { color: '#16A34A' }]}>
                    ₹{(activeService.paidAmount || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.serviceBalanceDivider} />
                <View style={styles.serviceBalanceItem}>
                  <Text style={styles.serviceBalanceLabel}>Remaining</Text>
                  <Text style={[styles.serviceBalanceValue, { color: activeService.balanceAmount > 0 ? '#DC2626' : '#16A34A' }]}>
                    ₹{(activeService.balanceAmount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </>
        )}



        {/* GST Percentage Input (When With GST is selected in Final Payment, or this is a GST clearance payment) */}
        {(stageId === 'final' && hasGst || isGstPayment) && (
          <View style={styles.formGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, isDark && styles.textDark]}>
                GST Percentage (%) <Text style={styles.requiredStar}>*</Text>
              </Text>
              {baseTotal > 0 && (
                <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '500' }}>
                  Base: ₹{baseTotal.toLocaleString()}
                </Text>
              )}
            </View>

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {[5, 12, 18, 28].map((preset) => {
                const isSelected = String(gstPercent) === String(preset);
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => handleSelectGstPreset(preset)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#2557C7' : (isDark ? '#334155' : '#E2E8F0'),
                      backgroundColor: isSelected ? (isDark ? 'rgba(37, 87, 199, 0.2)' : '#EFF6FF') : (isDark ? '#1E293B' : '#FFFFFF'),
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '600',
                        color: isSelected ? '#2557C7' : (isDark ? '#94A3B8' : '#64748B'),
                      }}
                    >
                      {preset}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Percentage Text Input */}
            <View
              style={[
                styles.amountInputBox,
                isDark && styles.amountInputBoxDark,
                { height: 48, paddingHorizontal: 14 },
              ]}
            >
              <Ionicons name="calculator-outline" size={20} color="#2557C7" style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.amountInput, isDark && styles.textDark, { fontSize: 16 }]}
                keyboardType="numeric"
                placeholder="e.g. 18"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={gstPercent}
                onChangeText={handleGstPercentChange}
              />
              <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginLeft: 8 }}>
                %
              </Text>
            </View>


          </View>
        )}

        {/* 3. Payment Amount Input (Read-only during GST Payment, derived from GST %) */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>
              Payment Amount (₹) <Text style={styles.requiredStar}>*</Text>
            </Text>
            {Boolean(stageId === 'final' && hasGst || isGstPayment) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#F0F9FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD' }}>
                <Ionicons name="lock-closed" size={11} color={isDark ? '#38BDF8' : '#0284C7'} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#38BDF8' : '#0284C7' }}>
                  Locked ({gstPercent || 18}% of Base)
                </Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.amountInputBox,
              isDark && styles.amountInputBoxDark,
              Boolean(stageId === 'final' && hasGst || isGstPayment) && {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons
              name="cash-outline"
              size={24}
              color={(stageId === 'final' && hasGst || isGstPayment) ? '#94A3B8' : '#2557C7'}
              style={{ marginRight: 10 }}
            />
            <Text
              style={[
                styles.currencyPrefix,
                isDark && styles.textDark,
                Boolean(stageId === 'final' && hasGst) && { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              Rs.
            </Text>
            <TextInput
              style={[
                styles.amountInput,
                isDark && styles.textDark,
                Boolean(stageId === 'final' && hasGst || isGstPayment) && { color: isDark ? '#94A3B8' : '#334155' },
              ]}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={paymentAmount}
              onChangeText={(val) => {
                const filtered = val.replace(/[^0-9.]/g, '');
                const parts = filtered.split('.');
                const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : filtered;
                setPaymentAmount(sanitized);
              }}
              editable={!(stageId === 'final' && hasGst || isGstPayment)}
            />
            {Boolean(stageId === 'final' && hasGst || isGstPayment) && (
              <Ionicons name="lock-closed" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 8 }} />
            )}
          </View>
        </View>

        {/* 4. Payment Method Tabs */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Payment Method <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.methodTabsRow}>
            <TouchableOpacity
              style={[styles.methodTab, paymentMethod === 'upi' && styles.methodTabActive]}
              onPress={() => setPaymentMethod('upi')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={paymentMethod === 'upi' ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
              />
              <Text style={[styles.methodTabText, paymentMethod === 'upi' && styles.methodTabTextActive]}>
                UPI / QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodTab, paymentMethod === 'card' && styles.methodTabActive]}
              onPress={() => setPaymentMethod('card')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="card-outline"
                size={16}
                color={paymentMethod === 'card' ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
              />
              <Text style={[styles.methodTabText, paymentMethod === 'card' && styles.methodTabTextActive]}>
                Accounts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodTab, paymentMethod === 'cash' && styles.methodTabActive]}
              onPress={() => setPaymentMethod('cash')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cash-outline"
                size={16}
                color={paymentMethod === 'cash' ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
              />
              <Text style={[styles.methodTabText, paymentMethod === 'cash' && styles.methodTabTextActive]}>
                Cash
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Payment Method Fields */}
        {paymentMethod === 'upi' && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              UPI Transaction ID / UTR Number <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="receipt-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.textInput, isDark && styles.textDark]}
                placeholder="Enter 12-digit UPI reference / UTR"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={upiTransactionId}
                onChangeText={setUpiTransactionId}
              />
            </View>
          </View>
        )}

        {paymentMethod === 'card' && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Select Bank Account <Text style={styles.requiredStar}>*</Text>
            </Text>
            {bankAccounts.length > 0 && selectedBank ? (
              <>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, isDark && styles.dropdownTriggerDark, { marginBottom: 10 }]}
                  onPress={() => setShowBankPicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="business-outline" size={18} color="#2557C7" style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownValueText, isDark && styles.textDark, { flex: 1 }]} numberOfLines={1}>
                    {selectedBank.name}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.bankDetailCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.bankDetailTitle} numberOfLines={1}>{selectedBank.name}</Text>
                    {selectedBank.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.bankDetailDivider} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankDetailLabel}>Account Number</Text>
                      <Text style={styles.bankDetailValue}>{selectedBank.accountNumber}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankDetailLabel}>IFSC Code</Text>
                      <Text style={styles.bankDetailValue}>{selectedBank.ifsc}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.bankDetailLabel}>Beneficiary Name & ID</Text>
                    <Text style={styles.bankDetailValue}>{selectedBank.beneficiary}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={[styles.bankDetailCard, { paddingVertical: 14, alignItems: 'center' }]}>
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>
                  No bank accounts configured on server.
                </Text>
              </View>
            )}
          </View>
        )}

        {paymentMethod === 'cash' && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Voucher Number <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <Ionicons name="receipt-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.textInput, isDark && styles.textDark]}
                placeholder="Enter cash receipt / voucher number"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={voucherNumber}
                onChangeText={setVoucherNumber}
              />
            </View>
          </View>
        )}

        {/* 5. Payment Date */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Payment Date <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.inputContainer, isDark && styles.inputContainerDark]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <TextInput
              style={[styles.textInput, isDark && styles.textDark]}
              value={paymentDate}
              editable={false}
              pointerEvents="none"
            />
            <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_evt, selDate) => {
                setShowDatePicker(false);
                if (selDate) {
                  setDateObj(selDate);
                  setPaymentDate(formatDateDDMMYY(selDate));
                }
              }}
            />
          )}
        </View>

        {/* 6. Reference Image / Payment Proof (Verified by Admin) */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>
              Reference Image / Payment Proof
            </Text>
           
          </View>
          <Text style={[styles.helperSubtext, isDark && styles.subtextDark]}>
            Add a payment receipt photo, UPI screenshot, cheque, or cash voucher to be verified by admin.
          </Text>

          {!attachedDoc ? (
            <TouchableOpacity
              style={[styles.dashedUploadButton, isDark && styles.dashedUploadButtonDark]}
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="camera-outline" size={22} color="#1E488F" />
              </View>
              <Text style={styles.dashedUploadText}>+ Add Reference Image</Text>
              <Text style={[styles.dashedUploadSubtext, isDark && styles.subtextDark]}>
                Take a photo or choose from gallery / documents
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.attachedDocCard, isDark && styles.attachedDocCardDark]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}
                onPress={() => {
                  if (attachedDoc.uri && attachedDoc.type === 'image') {
                    setShowPreviewModal(true);
                  }
                }}
                activeOpacity={attachedDoc.type === 'image' ? 0.7 : 1}
              >
                {attachedDoc.type === 'image' && attachedDoc.uri ? (
                  <Image
                    source={{ uri: attachedDoc.uri }}
                    style={styles.attachedThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.docIconBox}>
                    <Ionicons
                      name={attachedDoc.type === 'pdf' ? 'document-text-outline' : 'image-outline'}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: attachedDoc.type === 'image' && attachedDoc.uri ? 10 : 0 }}>
                  <Text style={[styles.attachedDocName, isDark && styles.textDark]} numberOfLines={1}>
                    {attachedDoc.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.pendingVerifyDot} />
                      <Text style={styles.attachedDocStatus}>Pending Admin Verification</Text>
                    </View>
                    {attachedDoc.size > 0 && (
                      <Text style={[styles.attachedDocSize, isDark && styles.subtextDark]}>
                        • {formatFileSize(attachedDoc.size)}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAttachedDoc(null)}
                style={styles.removeDocBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons (Non-sticky, bottom of content) */}
        <View style={[styles.bottomActionBar, isDark && styles.bottomActionBarDark]}>
          <TouchableOpacity
            style={[styles.cancelBtn, isDark && styles.cancelBtnDark]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, isDark && styles.textDark]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.8 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.submitBtnText}>
              {isSubmitting ? 'Submitting...' : (isGstPayment ? 'Record GST Payment' : (stageId === 'final' ? 'Confirm Final Settlement' : 'Submit Payment'))}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bank Picker Modal */}
      <Modal
        visible={showBankPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBankPicker(false)}
        >
          <View style={[styles.modalSheet, isDark && styles.modalSheetDark]}>
            <View style={styles.modalDragHandle} />
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Select Bank Account</Text>
            {bankAccounts.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={[
                  styles.stageOptionRow,
                  selectedBankId === bank.id && styles.stageOptionRowSelected,
                ]}
                onPress={() => {
                  setSelectedBankId(bank.id);
                  setShowBankPicker(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stageOptionName, selectedBankId === bank.id && { color: '#1E488F', fontWeight: '700' }]}>
                    {bank.name}
                  </Text>
                  <Text style={styles.stageOptionMeta}>
                    A/C: {bank.accountNumber} • {bank.ifsc}
                  </Text>
                </View>
                {selectedBankId === bank.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#1E488F" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reference Image Upload Bottom Sheet Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUploadModal(false)}
        >
          <View style={[styles.uploadSheet, isDark && styles.modalSheetDark]}>
            <View style={styles.modalDragHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.uploadSheetTitle, isDark && styles.textDark]}>Add Reference Image</Text>
                <Text style={[styles.uploadSheetSub, isDark && styles.subtextDark]}>
                  Attach a receipt photo, transaction screenshot, cheque, or voucher to be verified by admin.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.uploadOptionBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
              <View style={styles.uploadOptionIconBox}>
                <Ionicons name="camera" size={22} color="#214A8F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadOptionTitle}>Take Photo</Text>
                <Text style={styles.uploadOptionDesc}>Capture receipt or proof directly using camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadOptionBtn} onPress={handlePickFromGallery} activeOpacity={0.8}>
              <View style={styles.uploadOptionIconBox}>
                <Ionicons name="images" size={22} color="#214A8F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.uploadOptionDesc}>Select payment screenshot or receipt from photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadOptionBtn} onPress={handleChooseFile} activeOpacity={0.8}>
              <View style={styles.uploadOptionIconBox}>
                <Ionicons name="folder-open" size={22} color="#214A8F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadOptionTitle}>Upload Document / File</Text>
                <Text style={styles.uploadOptionDesc}>Browse PDF or document file from device storage</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadCancelBtn}
              onPress={() => setShowUploadModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.uploadCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-Screen Reference Image Preview Modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setShowPreviewModal(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          {attachedDoc?.uri && (
            <Image
              source={{ uri: attachedDoc.uri }}
              style={styles.fullPreviewImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.previewCaptionBox}>
            <Text style={styles.previewCaptionText}>{attachedDoc?.name}</Text>
            <Text style={styles.previewSubCaptionText}>Reference Image to be verified by Admin</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  header: {
    backgroundColor: '#21498B',
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  clientSummaryBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  clientSummaryBarDark: {
    backgroundColor: '#1E293B',
    borderBottomColor: '#334155',
  },
  clientSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#1E488F',
    fontSize: 12,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  totalBadge: {
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  totalBadgeText: {
    color: '#1E488F',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  textDark: {
    color: '#FFFFFF',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  dropdownTrigger: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  gstToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  gstToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  gstToggleBtnActive: {
    backgroundColor: '#244B94',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  gstToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  gstToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  amountInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2F66D4',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInputBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  methodTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  methodTabActive: {
    backgroundColor: '#244B94',
    borderColor: '#244B94',
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  methodTabTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  bankDetailCard: {
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: 'rgba(36, 75, 148, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  bankDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E488F',
    flex: 1,
  },
  primaryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E488F',
  },
  bankDetailDivider: {
    height: 1,
    backgroundColor: '#BFDBFE',
  },
  bankDetailLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  bankDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  finalPaymentBadge: {
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  finalPaymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E488F',
  },
  helperSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  dashedUploadButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(36, 75, 148, 0.35)',
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedUploadButtonDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  uploadIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dashedUploadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E488F',
  },
  dashedUploadSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
  },
  attachedDocCard: {
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: 'rgba(36, 75, 148, 0.25)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#244B94',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  attachedDocName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachedDocStatus: {
    fontSize: 11,
    color: '#1E488F',
    fontWeight: '500',
  },
  attachedDocSize: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  removeDocBtn: {
    padding: 4,
  },
  bottomActionBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  bottomActionBarDark: {},
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#21498B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#21498B',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalSheetDark: {
    backgroundColor: '#1E293B',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  stageOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  stageOptionRowSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stageOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  stageOptionMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  uploadSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  uploadSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadSheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  uploadOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginBottom: 10,
  },
  uploadOptionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(36, 75, 148, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uploadOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  uploadCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  serviceInfoCard: {
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: 'rgba(36, 75, 148, 0.2)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  serviceInfoCardDark: {
    backgroundColor: '#1E2D4A',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  serviceInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E488F',
    flex: 1,
    marginRight: 8,
  },
  serviceInfoMeta: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  serviceBalanceRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  serviceBalanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  serviceBalanceDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  serviceBalanceLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 3,
  },
  serviceBalanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminVerifyBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adminVerifyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E488F',
  },
  attachedDocCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  attachedThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  pendingVerifyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 5,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '100%',
    height: '75%',
  },
  previewCaptionBox: {
    marginTop: 16,
    alignItems: 'center',
  },
  previewCaptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSubCaptionText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
});