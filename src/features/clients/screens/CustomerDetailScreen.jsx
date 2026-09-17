import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import SelectQuotationTiersModal from '../../quotations/components/SelectQuotationTiersModal';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';
import { isPastDate } from '../../../core/utils/validation';

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

  const confirmAndLockQuotation = (appId, quotationId) => {
    setClientData(prev => {
      if (!prev) return prev;
      const isAlreadyLocked = prev.confirmedQuoteId === quotationId;
      const newConfirmedId = isAlreadyLocked ? null : quotationId;
      const confirmedQuote = (prev.quotations || []).find(q => q.id === newConfirmedId);
      return {
        ...prev,
        confirmedQuoteId: newConfirmedId,
        activeQuotationId: newConfirmedId || prev.activeQuotationId,
        totalPayment: confirmedQuote ? (confirmedQuote.total || prev.totalPayment) : prev.totalPayment,
        serviceType: confirmedQuote ? (confirmedQuote.service || prev.serviceType) : prev.serviceType,
        unlockRequested: false,
        unlockRequestStatus: null,
      };
    });
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

  const resolveQuotationUnlockRequest = (appId, approved = true) => {
    setClientData(prev => prev ? {
      ...prev,
      confirmedQuoteId: approved ? null : prev.confirmedQuoteId,
      unlockRequested: false,
      unlockRequestStatus: approved ? 'approved' : 'rejected',
    } : prev);
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

  const addExtraCharge = (appId, chargeDetails) => {
    setClientData(prev => prev ? {
      ...prev,
      extraCharges: [...(prev.extraCharges || []), { id: Date.now(), ...chargeDetails, isPaid: false }]
    } : prev);
  };

  const toggleExtraChargePayment = (appId, chargeId) => {
    setClientData(prev => prev ? {
      ...prev,
      extraCharges: (prev.extraCharges || []).map(c => c.id === chargeId ? { ...c, isPaid: !c.isPaid } : c)
    } : prev);
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
  const app = React.useMemo(() => {
    if (clientData) {
      return clientData;
    }
    return params.id ? { id: params.id, appointmentId: params.id, quotations: [] } : null;
  }, [clientData, params.id]);

  const loadCustomerData = useCallback(async () => {
    const targetId = params.id;
    if (!targetId) {
      setIsLoadingClient(false);
      setIsLoadingQuotations(false);
      return;
    }
    setIsLoadingClient(true);
    setIsLoadingQuotations(true);

    const cleanId = String(targetId).replace(/^DR/i, '').trim();

    try {
      const clientRes = await clientService.getClientById(cleanId);
      if (clientRes && clientRes.success && clientRes.data) {
        setClientData(clientRes.data);
      } else {
        const appRes = await appointmentService.getAppointmentById(cleanId);
        if (appRes && appRes.success && appRes.appointment) {
          setClientData(appRes.appointment);
        }
      }
    } catch (err) {
      console.warn('Failed to load client details from API:', err?.message);
    } finally {
      setIsLoadingClient(false);
    }

    try {
      const quotsRes = await clientService.getCustomerQuotations(cleanId);
      if (quotsRes && quotsRes.success) {
        if (Array.isArray(quotsRes.packages)) {
          setApiPackages(quotsRes.packages);
        }
        if (Array.isArray(quotsRes.quotations)) {
          setApiQuotations(quotsRes.quotations);
        }
      }
    } catch (err) {
      console.warn('Failed to load customer quotations from API:', err?.message);
    } finally {
      setIsLoadingQuotations(false);
    }
  }, [params.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCustomerData();
    } catch (err) {
      console.warn('CustomerDetailScreen refresh error:', err?.message);
    } finally {
      setRefreshing(false);
    }
  };

  // useFocusEffect handles both the initial mount and every subsequent re-focus,
  // so no separate useEffect is needed (that would cause a duplicate parallel request).
  useFocusEffect(
    useCallback(() => {
      loadCustomerData();
    }, [loadCustomerData])
  );

  // Lump Sum & Extra Service Charges Modal State
  const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

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
    quoteId: null,
    confirmText: 'Confirm & Lock',
    cancelText: 'Cancel',
  });

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
      Alert.alert(
        'Project Locked',
        'A quotation is currently confirmed and locked for this project. Do you want to unlock it to create a new quotation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlock & Create',
            onPress: () => {
              confirmAndLockQuotation(app.id, app.confirmedQuoteId);
              setModalInitialTiers(targetTiers);
              setIsSelectTiersModalVisible(true);
            },
          },
        ]
      );
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

  // Active section tab anchor focus (Payments & Warranty hidden)
  const getInitialTab = (tabParam) => {
    if (tabParam === 'quotation' || tabParam === 'quotations') return 'quotation';
    return 'profile';
  };

  const [activeTabSection, setActiveTabSection] = useState(getInitialTab(params.initialTab || params.tab));

  useEffect(() => {
    const targetTab = getInitialTab(params.initialTab || params.tab);
    if (params.initialTab || params.tab) {
      setActiveTabSection(targetTab);
    }
  }, [params.initialTab, params.tab]);
  // Edit Customer Modal State
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

  // Check if initial advance payment has been received (locks quotations and customer editing)
  const isInitialPaymentReceived = Boolean(app?.initialPaymentReceived || app?.initialPaid);

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
        'Project Locked 🔒',
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
    // Merge: start with API quotations, then overlay any local-only entries
    const mergedMap = new Map();
    apiQuotations.forEach((q) => {
      const k = String(q.id || q.quotationId || '');
      if (k) mergedMap.set(k, q);
    });
    localQuotes.forEach((q) => {
      const qKey = String(q.id || q.quotationId || '');
      if (qKey) {
        if (mergedMap.has(qKey)) {
          mergedMap.set(qKey, { ...mergedMap.get(qKey), ...q });
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

  // Packages list mapped from API packages and default tiers (only showing packages that have quotations)
  const displayPackages = React.useMemo(() => {
    const tierMap = new Map();

    if (Array.isArray(apiPackages) && apiPackages.length > 0) {
      apiPackages.forEach((pkg) => {
        const rawPkgName = pkg.packages || pkg.packageName || pkg.name || pkg.tier || '';
        const lowerName = rawPkgName.toLowerCase();
        const pId = pkg.packageId != null ? Number(pkg.packageId) : null;

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
          tierId = 'Economic';
        }

        const base = DEFAULT_TIERS_CONFIG.find(t => t.id === tierId) || DEFAULT_TIERS_CONFIG[0];

        tierMap.set(tierId.toLowerCase(), {
          ...base,
          packageId: pId != null ? pId : base.packageId,
          packages: pkg.packages || base.packages,
          packageName: pkg.packageName || base.packageName,
          warranty: pkg.warranty || base.warranty,
          subtitle: pkg.packageName && pkg.packageName !== tierId ? `${pkg.packageName} (${pkg.warranty || base.warranty})` : base.subtitle,
        });
      });
    }

    // Also populate from quotationsList if any quotation matches a tier
    quotationsList.forEach((q) => {
      const tierId = getQuoteTierCategory(q);
      if (!tierMap.has(tierId.toLowerCase())) {
        const base = DEFAULT_TIERS_CONFIG.find(t => t.id === tierId) || DEFAULT_TIERS_CONFIG[0];
        tierMap.set(tierId.toLowerCase(), { ...base });
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
  }, [apiPackages, quotationsList]);

  const activeQuotationId = app?.activeQuotationId;
  const activeQuote = quotationsList.find(q => q.id === chosenCategory) || (quotationsList.length > 0 ? quotationsList[quotationsList.length - 1] : null);

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
          // DD-MM-YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
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

  // Formatter for date: DD-MM-YYYY
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
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
      const initialAttendedDate = app.attendedDate || '';
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
  const prefix = rawClientName.toLowerCase().startsWith('mr.') ? '' : 'Mr. ';
  const displayName = `${prefix}${rawClientName}`;
  const displayId = `DR${app.appointmentId || app.customerId || app.id || ''}`;
  const displayPhone = app.mobileNumber || app.clientPhone || app.phone || app.mobile || 'No Phone Number';

  const displayAppDate = app.appointmentDate || app.date || app.appointmentFixDate || 'Not Set';
  const displayFixDate = app.appointmentFixDate || app.appointmentFixedDate || app.fixDate || 'Not Set';
  const displayAppTime = app.appointmentTime || app.time || 'Not Set';
  const displayAttendedBy = app.employeeName || app.attendedBy || app.assignedTo || app.technician || app.assignedTechnician || 'Unassigned';
  const displayServiceType = app.serviceType || app.services || app.service || 'Waterproofing';

  // Attended date & time is locked once saved
  const isAttendedLocked = Boolean(
    isLocallySaved ||
    isInitialPaymentReceived ||
    (app?.attendedDate && app?.attendedTime && app.attendedDate !== 'Not Set') ||
    Boolean(app?.appointmentAttend?.date && app?.appointmentAttend?.time) ||
    app?.siteVisited === true
  );

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
      const empId = app.employeeId || app.assignedEmployeeId || app.appointmentAttend?.employeeId || 100;

      await appointmentService.saveAttendedDetails(cleanAppId, {
        attendedDate,
        attendedTime,
        date: attendedDate,
        time: attendedTime,
        appointmentId: cleanAppId,
        customerId: cleanCustId,
        employeeId: empId,
        totalArea,
      });

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

        {/* Navigation Cards Bar (Site Info, Quotations) - Payments & Warranty hidden */}
        <View style={{ marginBottom: 18, flexDirection: 'row', gap: 8 }}>
          {[
            { id: 'profile', label: 'Site Info', icon: 'person-outline', activeIcon: 'person', color: '#2563EB', bg: '#DBEAFE' },
            { id: 'quotation', label: 'Quotations', icon: 'document-text-outline', activeIcon: 'document-text', color: '#16A34A', bg: '#DCFCE7' },
          ].map((tab) => {
            const isQuotationLocked = tab.id === 'quotation' && !isAttendedLocked;
            const isActive = activeTabSection === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  {
                    flex: 1,
                    height: 82,
                    borderRadius: 14,
                    padding: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? (isDark ? '#1E293B' : '#EFF6FF') : (isDark ? '#1C1C1C' : '#FFFFFF'),
                    borderWidth: 1,
                    borderColor: isActive ? '#93C5FD' : (isDark ? '#334155' : '#E2E8F0'),
                    opacity: isQuotationLocked ? 0.65 : 1,
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
                  setActiveTabSection(tab.id);
                }}
                activeOpacity={0.8}
              >
                {/* Top Center Vector Icon */}
                <View style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isQuotationLocked ? (isDark ? '#1E293B' : '#F1F5F9') : (isActive ? tab.bg : (isDark ? '#080808' : '#F8FAFC')),
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 5,
                }}>
                  <Ionicons
                    name={isQuotationLocked ? 'lock-closed' : (isActive ? tab.activeIcon : tab.icon)}
                    size={18}
                    color={isQuotationLocked ? '#94A3B8' : (isActive ? tab.color : (isDark ? '#94A3B8' : '#64748B'))}
                  />
                </View>

                {/* Bottom Center Text Label */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      {
                        fontSize: 11,
                        fontWeight: isActive ? '700' : '600',
                        color: isQuotationLocked ? '#94A3B8' : (isActive ? '#0F172A' : (isDark ? '#94A3B8' : '#64748B')),
                      },
                      isDark && isActive && !isQuotationLocked && { color: '#FFFFFF' }
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isQuotationLocked && (
                    <Ionicons name="lock-closed" size={10} color="#94A3B8" style={{ marginLeft: 2 }} />
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
                {app?.confirmedQuoteId && (
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
                            {quotationsList.find(q => q.id === app.confirmedQuoteId)?.quoteFor || 'Confirmed Package'} • {quotationsList.find(q => q.id === app.confirmedQuoteId)?.revisionLabel || 'Revision #1'}
                          </Text>
                        </View>
                      </View>

                      {!isInitialPaymentReceived && (
                        isAdminOrMaster ? (
                          /* Admin can unlock directly */
                          <TouchableOpacity
                            onPress={() => {
                              setLockConfirmModal({
                                visible: true,
                                actionType: 'unlock',
                                title: 'Unlock Quotation?',
                                message: 'Do you want to unlock this quotation to allow selecting or editing other package tiers and revisions?',
                                quoteId: app.confirmedQuoteId,
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
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309' }}>⏳ Edit Requested</Text>
                          </TouchableOpacity>
                        ) : (
                          /* Employee: Request to Edit Button */
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Request to Edit',
                                'This quotation is confirmed and locked. Only Admin or Master can unlock it. Would you like to submit a request to edit?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Submit Request',
                                    onPress: () => {
                                      requestQuotationUnlock(app.id, app.confirmedQuoteId, currentUser?.name || 'Technician');
                                      showAlert('Request Submitted', 'Your request to edit this quotation has been sent to Admin/Master.', 'success');
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
                        )
                      )}
                    </View>
                  )
                )}

                {/* Render Tier Sections Separated by Packages from API */}
                {displayPackages.map((tierCfg) => {
                  const tierQuotes = quotationsList.filter(q => getQuoteTierCategory(q).toLowerCase() === tierCfg.id.toLowerCase());
                  const sortedTierQuotes = [...tierQuotes].sort((a, b) => {
                    if (a.id === app?.confirmedQuoteId) return -1;
                    if (b.id === app?.confirmedQuoteId) return 1;
                    return (Number(b.revisionNo || b.revision || 0)) - (Number(a.revisionNo || a.revision || 0));
                  });
                  const currentQuote = sortedTierQuotes[0];
                  const previousRevisions = sortedTierQuotes.slice(1);

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
                            opacity: isInitialPaymentReceived ? 0.4 : 1,
                          }}
                          onPress={() => {
                            if (isInitialPaymentReceived) {
                              showAlert('Quotation Locked 🔒', 'Initial payment has been received for this project. New quotations cannot be added.', 'lock');
                              return;
                            }
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
                            const isConfirmed = app?.confirmedQuoteId === quote.id;
                            const isAnyConfirmed = Boolean(app?.confirmedQuoteId);
                            const isLocked = isAnyConfirmed && !isConfirmed;
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

                                  {!isInitialPaymentReceived && !isConfirmed && (
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
                                  {isInitialPaymentReceived ? (
                                    <TouchableOpacity
                                      style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 9,
                                        paddingHorizontal: 12,
                                        backgroundColor: '#10B981',
                                        borderRadius: 8,
                                      }}
                                      onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: quote.id } })}
                                      activeOpacity={0.85}
                                    >
                                      <Ionicons name="document-text" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>View PDF</Text>
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
                                          opacity: isLocked ? 0.5 : 1,
                                        }}
                                        onPress={() => {
                                          if (isLocked) {
                                            if (isAdminOrMaster) {
                                              setLockConfirmModal({
                                                visible: true,
                                                actionType: 'switch',
                                                title: 'Quotation Locked',
                                                message: 'Another quotation is currently confirmed and locked for this customer. Unlock it first or switch confirmation to this quote.',
                                                quoteId: quote.id,
                                                confirmText: 'Switch Confirmation',
                                                cancelText: 'Cancel',
                                              });
                                            } else if (app?.unlockRequested) {
                                              Alert.alert(
                                                'Request Pending ⏳',
                                                'Your request to edit this project has been submitted to Admin/Master and is awaiting approval.'
                                              );
                                            } else {
                                              Alert.alert(
                                                'Quotation Locked',
                                                'A quotation is currently confirmed and locked for this customer. Only Admin or Master can unlock it. Would you like to submit a request to edit?',
                                                [
                                                  { text: 'Cancel', style: 'cancel' },
                                                  {
                                                    text: 'Request to Edit',
                                                    onPress: () => {
                                                      requestQuotationUnlock(app.id, quote.id, currentUser?.name || 'Technician');
                                                      showAlert('Request Submitted', 'Your request to edit has been sent to Admin.', 'success');
                                                    }
                                                  }
                                                ]
                                              );
                                            }
                                          } else {
                                            const targetQId = quote.id || quote.quotationId;
                                            router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                                          }
                                        }}
                                        activeOpacity={0.8}
                                      >
                                        <Ionicons name={isLocked ? "lock-closed" : "pencil"} size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>{isLocked ? 'Locked' : 'Edit'}</Text>
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

                                        {!isInitialPaymentReceived && (
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

                                      {!isInitialPaymentReceived && (
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
                                          onPress={() => {
                                            const targetQId = revQuote.id || revQuote.quotationId;
                                            router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                                          }}
                                          activeOpacity={0.8}
                                        >
                                          <Ionicons name="pencil-outline" size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>Revise</Text>
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
                })}

                {/* Bottom Action: Initial Payment Received Button / Locked Status Banner */}
                <View style={{ marginTop: 10, marginBottom: 16 }}>
                  {!isInitialPaymentReceived ? (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#10B981',
                        borderRadius: 14,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        elevation: 3,
                      }}
                      onPress={handleConfirmInitialPayment}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                        Initial Payment Received
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={{
                        backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1.5,
                        borderColor: isDark ? '#059669' : '#10B981',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#10B981',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#A7F3D0' : '#065F46' }}>
                            Initial Payment Received ✅ (Locked)
                          </Text>
                          <Text style={{ fontSize: 12, color: isDark ? '#6EE7B7' : '#047857', marginTop: 2 }}>
                            Quotation & customer details locked. Only PDF viewing is allowed.
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

              </>
            )}
          </View>
        )}

        {/* TAB 3: PAYMENTS & CASH RECEIPTS */}
        {activeTabSection === 'payment' && (
          <View style={{ marginBottom: 20 }}>
            {currentServicesList.length === 0 ? (
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
                  style={{ backgroundColor: '#0052CC', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', }}
                  onPress={() => handleOpenSelectTiersModal(['economic', 'premium', 'elite'])}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Create Quotation Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ACTIVE PAYMENTS BREAKDOWN & EXTRA CHARGES */
              (() => {
                const dynamicCategoryTotal = calculateCategoryTotal(chosenCategory) || app.totalPayment || 118000;

                // If fullPaid is true, we just set the paid amount to the full amount
                const isFullPaid = Boolean(app.fullPaid);
                const fullPaidAmt = isFullPaid ? Number(app.fullPaidDetails?.amount || dynamicCategoryTotal) : 0;

                const baseM1 = Math.round(dynamicCategoryTotal * 0.5);
                const baseM2 = Math.round(dynamicCategoryTotal * 0.4);

                // M1 (Initial 50%) - use custom paid amount if paid
                const m1Amt = app.initialPaid && !isFullPaid
                  ? Number(app.initialPaidAmount || app.initialPaidDetails?.amount || baseM1)
                  : baseM1;

                const expectedM1 = app.initialPaid && !isFullPaid ? m1Amt : baseM1;
                const expectedRemainingAfterM1 = Math.max(0, dynamicCategoryTotal - expectedM1);

                // M2 (Mid-Term 40%) - capped at remaining balance after M1
                const m2Amt = app.midTermPaid && !isFullPaid
                  ? Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || Math.min(baseM2, expectedRemainingAfterM1))
                  : Math.min(baseM2, expectedRemainingAfterM1);

                const expectedM2 = m2Amt;
                const expectedRemainingAfterM2 = Math.max(0, expectedRemainingAfterM1 - expectedM2);

                // M3 (Final 10%) - whatever is left after M1 and M2
                const m3Amt = app.finalPaid && !isFullPaid
                  ? Number(app.finalPaidAmount || app.finalPaidDetails?.amount || expectedRemainingAfterM2)
                  : expectedRemainingAfterM2;

                const totalPaidSoFar = isFullPaid ? fullPaidAmt : ((app.initialPaid ? m1Amt : 0) + (app.midTermPaid ? m2Amt : 0) + (app.finalPaid ? m3Amt : 0));
                const remainingBalance = Math.max(0, dynamicCategoryTotal - totalPaidSoFar);
                const paidPercentage = Math.min(100, Math.round((totalPaidSoFar / dynamicCategoryTotal) * 100));

                return (
                  <>
                    {/* Header Title Bar */}
                    <View style={{ marginBottom: 14, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: '500', color: isDark ? '#FFFFFF' : '#0F172A', flex: 1, marginRight: 8 }}>
                          Payment Breakdown
                        </Text>

                        <TouchableOpacity
                          style={{ backgroundColor: '#0052CC', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', }}
                          onPress={() => router.push({ pathname: '/payment-form', params: { id: app.id, totalCost: dynamicCategoryTotal } })}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>Add Payment</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Cumulative Payment Progress Card */}
                      <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                            Total Project Cost: <Text style={{ fontSize: '15', fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>₹{dynamicCategoryTotal.toLocaleString()}</Text>
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: paidPercentage === 100 ? '#10B981' : '#0052CC' }}>
                            {paidPercentage}% Paid
                          </Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={{ height: 6, backgroundColor: isDark ? '#334155' : '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                          <View style={{ height: '100%', width: `${paidPercentage}%`, backgroundColor: paidPercentage === 100 ? '#10B981' : '#0052CC', borderRadius: 3 }} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>
                            Paid So Far: ₹{totalPaidSoFar.toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 11, color: remainingBalance > 0 ? '#D97706' : '#16A34A', fontWeight: '700' }}>
                            {remainingBalance > 0 ? `Remaining: ₹${remainingBalance.toLocaleString()}` : 'Bill Cleared ✅'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Milestones List */}
                    {isFullPaid ? (
                      <View
                        style={{
                          backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                          borderRadius: 16,
                          padding: 14,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: isDark ? '#334155' : '#E2E8F0',
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', paddingBottom: 2, color: isDark ? '#FFFFFF' : '#0F172A' }}>
                              1. Full Project Payment (100%)
                            </Text>
                            <Text style={{ fontSize: 16, fontWeight: '500', color: '#0052CC', marginTop: 3 }}>
                              ₹{fullPaidAmt.toLocaleString()}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end' }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', }}
                              onPress={() => router.push({ pathname: '/receipt', params: { id: app.id, milestone: 'fullPaid', amount: fullPaidAmt, stage: 'Full Project Payment (100%)' } })}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="receipt-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Receipt</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : (
                      [
                        {
                          id: 'initialPaid',
                          num: '1',
                          title: 'Initial Advance (50%)',
                          amount: m1Amt,
                          isPaid: Boolean(app.initialPaid),
                        },
                        {
                          id: 'midTermPaid',
                          num: '2',
                          title: 'Mid-Term Completion (40%)',
                          amount: m2Amt,
                          isPaid: Boolean(app.midTermPaid),
                        },
                        {
                          id: 'finalPaid',
                          num: '3',
                          title: 'Final Settlement (10%)',
                          amount: m3Amt,
                          isPaid: Boolean(app.finalPaid),
                        },
                      ].map((m) => (
                        <View
                          key={m.id}
                          style={{
                            backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                            borderRadius: 16,
                            padding: 14,
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: '500', paddingBottom: 2, color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                  {m.num}. {m.title}
                                </Text>
                                {m.isPaid && (
                                  <View style={{ backgroundColor: '#DCFCE7', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                                    <Text style={{ color: '#16A34A', fontSize: 10, fontWeight: '700' }}>Paid</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 16, fontWeight: '500', color: '#0052CC', marginTop: 3 }}>
                                ₹{m.amount.toLocaleString()}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={{ backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                                onPress={() => router.push({ pathname: '/receipt', params: { id: app.id, milestone: m.id, amount: m.amount, stage: m.title } })}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="receipt-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Receipt</Text>
                              </TouchableOpacity>

                              {!m.isPaid && (
                                <TouchableOpacity
                                  style={{ backgroundColor: '#0052CC', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                                  onPress={() => router.push({ pathname: '/payment-form', params: { id: app.id, amount: m.amount, milestone: m.id } })}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="card-outline" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Pay Now</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                    )}

                    {/* SECTION 2: LUMP SUM & EXTRA SERVICES CHARGES */}
                    <View style={{ marginTop: 14, marginBottom: 12, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                            Extra & Lump Sum Charges
                          </Text>
                          <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 10 }}>
                            Cleaning, scaffolding, prep & extra service fees
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={{ backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', }}
                          onPress={() => setShowExtraChargeModal(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Add Extra</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Extra Charges Cards List */}
                    {(!app.extraCharges || app.extraCharges.length === 0) ? (
                      <View style={{ backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B' }}>No lump sum extra charges added yet.</Text>
                      </View>
                    ) : (
                      app.extraCharges.map((chg) => (
                        <View
                          key={chg.id}
                          style={{
                            backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                            borderRadius: 16,
                            padding: 14,
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                {chg.title}
                              </Text>
                              {chg.notes ? (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                                  {chg.notes}
                                </Text>
                              ) : null}
                              <Text style={{ fontSize: 16, fontWeight: '900', color: '#10B981', marginTop: 3 }}>
                                ₹{chg.amount.toLocaleString()}
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              {chg.isPaid ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <View style={{ backgroundColor: '#DCFCE7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" style={{ marginRight: 3 }} />
                                    <Text style={{ color: '#16A34A', fontSize: 10, fontWeight: '800' }}>PAID</Text>
                                  </View>

                                  <TouchableOpacity
                                    style={{ backgroundColor: '#10B981', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => router.push({ pathname: '/receipt', params: { id: app.id, amount: chg.amount, stage: chg.title } })}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="receipt-outline" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Receipt</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={{ backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                                  onPress={() => toggleExtraChargePayment(app.id, chg.id)}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="card-outline" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Mark Paid</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                    )}

                    {/* FULL SERVICE & SETTLEMENT RECEIPT BUTTON */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#0052CC',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 14,
                        marginBottom: 4,
                      }}
                      onPress={() =>
                        router.push({
                          pathname: '/receipt',
                          params: { id: app.id, isFullServiceReceipt: 'true' },
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <Ionicons name="document-text" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                        Generate Full Service Receipt
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })())}
          </View>
        )}

        {/* TAB 4: WARRANTY TRACKER & CLAIMS (MAX 2 LIMIT) */}
        {activeTabSection === 'warranty' && (() => {
          const certNo = app.warranty?.certificateNo || `DTW-${new Date().getFullYear()}-${String(app.id || '1001').slice(-4).padStart(4, '0')}`;
          const validDuration = app.warranty?.validYears || '10 Years';
          const issuedOn = app.warranty?.completedDate || (app.attendedDate ? `${app.attendedDate}` : new Date().toLocaleDateString('en-GB'));
          const isGen = Boolean(app.warranty?.generated);

          return (
            <View style={[{ borderRadius: 20, padding: 18, marginBottom: 20, backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    Warranty & Claims Tracker
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                    Maximum 2 Warranty Claims Allowed Per Period
                  </Text>
                </View>
                <Ionicons name="shield-checkmark" size={26} color="#4F46E5" />
              </View>

              {/* Certificate Banner Card - Always Visible */}
              <View style={{ backgroundColor: isDark ? '#080808' : '#EEF2FF', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#C7D2FE' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#3730A3' }}>
                    {certNo}
                  </Text>
                  <View style={{ backgroundColor: isGen ? '#10B981' : '#4F46E5', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                      {validDuration} {isGen ? 'Active' : 'Standard'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: isDark ? '#CBD5E1' : '#4338CA' }}>
                  Issued on {issuedOn}. Covers all selected services under warranty terms.
                </Text>
              </View>

              {/* Claims Counter Progress Bar */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1E293B' }}>
                    Warranty Claims Capacity:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: (app.warrantyClaims || []).length >= 2 ? '#EF4444' : '#4F46E5' }}>
                    {(app.warrantyClaims || []).length} / 2 Claims Used
                  </Text>
                </View>

                <View style={{ height: 10, width: '100%', backgroundColor: isDark ? '#334155' : '#E2E8F0', borderRadius: 5, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${((app.warrantyClaims || []).length / 2) * 100}%`,
                      backgroundColor: (app.warrantyClaims || []).length >= 2 ? '#EF4444' : ((app.warrantyClaims || []).length === 1 ? '#F59E0B' : '#10B981')
                    }}
                  />
                </View>
              </View>

              {/* Claims History */}
              {(!app.warrantyClaims || app.warrantyClaims.length === 0) ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>No claims logged yet.</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1E293B', marginBottom: 10 }}>
                    Warranty Claim Tickets Log
                  </Text>
                  {app.warrantyClaims.map((claim, idx) => (
                    <View key={claim.id || idx} style={{ backgroundColor: isDark ? '#080808' : '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                          Claim Ticket #{idx + 1} ({claim.claimDate})
                        </Text>
                        <View style={{ backgroundColor: '#DCFCE7', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 }}>
                          <Text style={{ color: '#16A34A', fontSize: 10, fontWeight: '700' }}>{claim.status || 'Resolved'}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#475569' }}>
                        Issue: {claim.issue}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#4F46E5', flex: 1 }]}
                  onPress={() => router.push({ pathname: '/warranty-letter', params: { id: app.id } })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>View Certificate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: (app.warrantyClaims || []).length >= 2 ? '#94A3B8' : '#2563EB', flex: 1 }
                  ]}
                  onPress={() => {
                    if ((app.warrantyClaims || []).length >= 2) {
                      showAlert('Claim Limit Reached', 'Maximum 2 warranty claims allowed for this warranty period.', 'warning');
                    } else {
                      setShowClaimModal(true);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>
                    {(app.warrantyClaims || []).length >= 2 ? 'Max Claims (2/2)' : 'Log Claim'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#059669', flex: 1 }]}
                  onPress={() => setShowDurationModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="options-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>Configure</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}




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

      {/* 5. ADD LUMP SUM EXTRA CHARGE MODAL */}
      <Modal
        visible={showExtraChargeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExtraChargeModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowExtraChargeModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ width: '100%', maxWidth: 400, backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderRadius: 20, padding: 20 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                + Add Lump Sum Charge
              </Text>
              <TouchableOpacity onPress={() => setShowExtraChargeModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Service Title Quick Presets */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 6 }}>
              Service / Reason Title
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: 10, padding: 12, color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 10, fontSize: 14 }}
              placeholder="e.g. Building Cleaning, Scaffolding Fee..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={extraTitle}
              onChangeText={setExtraTitle}
            />

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {['Debris Cleaning', 'Scaffolding Setup', 'Pressure Wash', 'Crack Injection', 'Extra Material'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={{ backgroundColor: extraTitle === preset ? '#0052CC' : (isDark ? '#334155' : '#F1F5F9'), paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}
                  onPress={() => setExtraTitle(preset)}
                >
                  <Text style={{ color: extraTitle === preset ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#475569'), fontSize: 11, fontWeight: '700' }}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lump Sum Amount */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 6 }}>
              Lump Sum Amount (₹)
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: 10, padding: 12, color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 14, fontSize: 16, fontWeight: '800' }}
              placeholder="Enter Amount (e.g. 5000)"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="numeric"
              value={extraAmount}
              onChangeText={setExtraAmount}
            />

            {/* Notes */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginBottom: 6 }}>
              Notes & Service Remarks
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1', borderRadius: 10, padding: 12, color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 16, fontSize: 13, height: 60 }}
              placeholder="Details of cleaning or extra work..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              value={extraNotes}
              onChangeText={setExtraNotes}
            />

            {/* Action Button */}
            <TouchableOpacity
              style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
              onPress={() => {
                if (!extraTitle.trim() || !extraAmount.trim()) {
                  showAlert('Validation Error', 'Please enter both service title and amount.', 'warning');
                  return;
                }
                addExtraCharge(app.id, {
                  title: extraTitle,
                  amount: Number(extraAmount),
                  notes: extraNotes,
                  isPaid: false,
                });
                setShowExtraChargeModal(false);
                setExtraTitle('');
                setExtraAmount('');
                setExtraNotes('');
                showAlert('Success', 'Lump Sum Extra Charge recorded successfully!', 'success');
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Save Extra Charge</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => {
                    const qId = selectedHistoryQuote.id;
                    setSelectedHistoryQuote(null);
                    router.push({ pathname: '/edit-quotation', params: { id: qId, quoteId: qId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                  }}
                >
                  <Ionicons name="create" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Edit / Revise</Text>
                </TouchableOpacity>
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
                placeholder="DD-MM-YYYY"
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
        onRequestClose={() => setLockConfirmModal((prev) => ({ ...prev, visible: false }))}
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
                      lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
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
                      lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
                        ? (isDark ? '#064E3B' : '#DCFCE7')
                        : lockConfirmModal.actionType === 'unlock'
                          ? (isDark ? '#451A03' : '#FEF3C7')
                          : (isDark ? '#1E293B' : '#EFF6FF'),
                  },
                ]}
              >
                <Ionicons
                  name={
                    lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
                      ? 'shield-checkmark'
                      : lockConfirmModal.actionType === 'unlock'
                        ? 'lock-open-outline'
                        : 'swap-horizontal'
                  }
                  size={30}
                  color={
                    lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
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
            <Text style={[styles.customModalMessage, isDark && styles.subtextDark]}>
              {lockConfirmModal.message}
            </Text>

            {/* Dual Action Buttons */}
            <View style={styles.customModalButtonRow}>
              <TouchableOpacity
                style={[styles.customModalCancelBtn, isDark && styles.customModalCancelBtnDark]}
                onPress={() => setLockConfirmModal((prev) => ({ ...prev, visible: false }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.customModalCancelText, isDark && styles.textDark]}>
                  {lockConfirmModal.cancelText || 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.customModalConfirmBtn,
                  {
                    backgroundColor:
                      lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
                        ? '#059669'
                        : lockConfirmModal.actionType === 'unlock'
                          ? '#D97706'
                          : '#2563EB',
                  },
                ]}
                onPress={() => {
                  const targetId = lockConfirmModal.quoteId;
                  const action = lockConfirmModal.actionType;
                  setLockConfirmModal((prev) => ({ ...prev, visible: false }));

                  if (action === 'initial_payment') {
                    const chosenQuote = quotationsList.find(q => q.id === app?.confirmedQuoteId) || quotationsList[0];
                    const quoteTotal = Number(chosenQuote?.total || 0);
                    const advance50 = Math.round(quoteTotal * 0.5);

                    updateAppointment(app.id, {
                      initialPaymentReceived: true,
                      initialPaid: true,
                      initialPaidAmount: advance50,
                      initialPaidDetails: {
                        amount: advance50,
                        date: new Date().toLocaleDateString('en-GB'),
                        paymentDate: new Date().toLocaleDateString('en-GB'),
                        method: 'Advance Received',
                        status: 'Completed',
                      },
                      confirmedQuoteId: app.confirmedQuoteId || chosenQuote?.id,
                      projectStatus: 'In Progress',
                    });

                    showAlert(
                      'Payment Confirmed ✅',
                      'Initial advance payment recorded successfully. The quotation is now locked and protected from any edits.',
                      'success',
                      'Done'
                    );
                    return;
                  }

                  if (targetId) {
                    confirmAndLockQuotation(app.id, targetId);
                    if (action === 'lock') {
                      showAlert(
                        'Quotation Locked',
                        'This quotation has been confirmed and locked for this project.',
                        'success',
                        'Done'
                      );
                    } else if (action === 'unlock') {
                      showAlert(
                        'Quotation Unlocked',
                        'The quotation has been unlocked. You can now select or edit other tiers.',
                        'info',
                        'OK'
                      );
                    } else if (action === 'switch') {
                      showAlert(
                        'Quotation Switched',
                        'The project has been switched and locked to this quotation.',
                        'success',
                        'Done'
                      );
                    }
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={
                    lockConfirmModal.actionType === 'lock' || lockConfirmModal.actionType === 'initial_payment'
                      ? 'shield-checkmark'
                      : lockConfirmModal.actionType === 'unlock'
                        ? 'lock-open-outline'
                        : 'checkmark'
                  }
                  size={15}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.customModalConfirmText}>
                  {lockConfirmModal.confirmText || 'Confirm & Lock'}
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
