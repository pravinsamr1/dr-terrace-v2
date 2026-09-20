import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Text as RNText,
  TextInput as RNTextInput,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';
import { isPastDate } from '../../../core/utils/validation';
import { formatDateDDMMYY, toApiDateString, parseDateToDateObj } from '../../../core/utils/dateFormat';
import InnerHeader from '../../../shared/components/InnerHeader';
import {
  MaterialAlertModal,
  MaterialFormSkeleton,
  MaterialOverlayLoader,
  MaterialSuccessModal,
} from '../../../shared/components/material';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { authRepository } from '../../auth/api/authRepository';
import { clientRepository as clientService } from '../../clients/api/clientRepository';
import { quotationRepository as quotationService } from '../../quotations/api/quotationRepository';

// Shared Redesigned Components
import QuotationCustomerBanner from '../components/QuotationCustomerBanner';
import SelectServicesModal from '../components/SelectServicesModal';
import ServiceConfigCard from '../components/ServiceConfigCard';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

const TextInput = React.forwardRef((props, ref) => (
  <RNTextInput ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
TextInput.displayName = 'TextInput';

/**
 * Tier matching helper that seamlessly handles 'Economy' vs 'Economic'
 */
const isTierMatch = (t1, t2) => {
  if (!t1 || !t2) return false;
  const s1 = String(t1).toLowerCase().trim();
  const s2 = String(t2).toLowerCase().trim();
  if (/^econom/i.test(s1) && /^econom/i.test(s2)) return true;
  if (/^prem/i.test(s1) && /^prem/i.test(s2)) return true;
  if (/^elit/i.test(s1) && /^elit/i.test(s2)) return true;
  return s1 === s2;
};

/**
 * Case-insensitive, whitespace-tolerant service lookup helper
 */
const findServiceInMap = (map, serviceName) => {
  if (!serviceName || !map) return null;
  if (map[serviceName]) return map[serviceName];
  const sLower = serviceName.toLowerCase().trim();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase().trim() === sLower) return map[k];
  }
  const sClean = sLower.replace(/\s+/g, '');
  for (const k of Object.keys(map)) {
    if (k.toLowerCase().replace(/\s+/g, '') === sClean) return map[k];
  }
  return null;
};

/**
 * Normalizes packages from GET /quotations/page-view or /quotations/{id}/edit-view.
 */
const normalizePackages = (rawPackages) => {
  if (!Array.isArray(rawPackages)) return [];
  const flattened = [];

  rawPackages.forEach((entry) => {
    if (!entry) return;
    if (Array.isArray(entry.data)) {
      let tierName = entry.package || 'None';
      if (/^econom/i.test(tierName)) tierName = 'Economic';
      else if (/^prem/i.test(tierName)) tierName = 'Premium';
      else if (/^elite|^lux/i.test(tierName)) tierName = 'Elite';

      entry.data.forEach((item) => {
        if (!item) return;
        const itemWarranty = item.warranty || item.services?.[0]?.subtitles?.[0]?.warranty || (tierName === 'Economic' ? '5 Years' : null);
        flattened.push({
          ...item,
          id: item.id || item.packageId,
          packageId: item.packageId != null ? item.packageId : item.id,
          packageName: item.packageName || item.name || '',
          name: item.packageName || item.name || '',
          packages: tierName,
          tier: tierName.toLowerCase(),
          warranty: itemWarranty,
          services: Array.isArray(item.services) ? item.services : [],
        });
      });
    } else {
      let tierName = entry.packages || entry.tier || 'None';
      if (/^econom/i.test(tierName)) tierName = 'Economic';
      else if (/^prem/i.test(tierName)) tierName = 'Premium';
      else if (/^elite|^lux/i.test(tierName)) tierName = 'Elite';

      const itemWarranty = entry.warranty || entry.services?.[0]?.subtitles?.[0]?.warranty || (tierName === 'Economic' ? '5 Years' : null);
      flattened.push({
        ...entry,
        id: entry.id || entry.packageId,
        packageId: entry.packageId != null ? entry.packageId : entry.id,
        packageName: entry.packageName || entry.name || '',
        name: entry.packageName || entry.name || '',
        packages: tierName,
        tier: tierName.toLowerCase(),
        warranty: itemWarranty,
        services: Array.isArray(entry.services) ? entry.services : [],
      });
    }
  });

  return flattened;
};

const formatToApiDate = (dateStr) => {
  return toApiDateString(dateStr);
};

const formatFromApiDate = (dateStr) => {
  return formatDateDDMMYY(dateStr);
};

const getPackageKey = (val) => {
  if (!val || val === '-select-') return 'economic';
  const v = String(val).toLowerCase();
  if (v.includes('elite') || v.includes('polyurea') || v.includes('luxury') || v === '3') return 'elite';
  if (v.includes('premium') || v.includes('polyurethane') || v === '2') return 'premium';
  if (v.includes('econom') || v.includes('elastomeric') || v.includes('basic') || v === '1') return 'economic';
  if (v.includes('none') || v.includes('single')) return 'none';
  return 'premium';
};

export default function EditQuotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [existingQuotation, setExistingQuotation] = useState(null);
  const isQuoteLocked = Boolean(
    existingQuotation?.isConfirmed ||
    existingQuotation?.isLocked ||
    existingQuotation?.status === 'CONFIRMED' ||
    existingQuotation?.status === 'LOCKED'
  );
  const [propertiesList, setPropertiesList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [dynamicServicesMap, setDynamicServicesMap] = useState({});

  // Target quoteId from route params
  const targetQuoteId = params.quoteId || params.id;

  // Dropdowns & Modal States
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [isServicesModalVisible, setIsServicesModalVisible] = useState(false);

  // Form Fields
  const [quotationDate, setQuotationDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  const onQuotationDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDatePickerValue(selectedDate);
      setQuotationDate(formatDateDDMMYY(selectedDate));
    }
  };
  const [propertyType, setPropertyType] = useState('');
  const [quoteFor, setQuoteFor] = useState('');
  const [selectedServicesMap, setSelectedServicesMap] = useState({});
  const [servicesConfig, setServicesConfig] = useState({});
  const [siteArea, setSiteArea] = useState('');

  // Tax & Discount States
  const [gstAdded, setGstAdded] = useState(false);
  const [gstPercent, setGstPercent] = useState('18');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);

  // Milestone Terms & Clauses
  const [advancePercent, setAdvancePercent] = useState('60');
  const [midPercent, setMidPercent] = useState('30');
  const [finalPercent, setFinalPercent] = useState('10');
  const [validityText, setValidityText] = useState('');
  const [negotiationNote, setNegotiationNote] = useState('PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER');
  const [workStartNote, setWorkStartNote] = useState('Work can be started 48hrs from the time of payment received');
  const [withRegards, setWithRegards] = useState('Mr. SRIRAM');
  const [warrantyText, setWarrantyText] = useState('');

  // Success & Alert Modals
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '', custId: null });
  const [alertModalConfig, setAlertModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'Got It',
  });

  const showAlert = useCallback((title, message, type = 'warning', buttonText = 'Got It') => {
    setAlertModalConfig({
      visible: true,
      title,
      message,
      type,
      buttonText,
    });
  }, []);

  useEffect(() => {
    authRepository.getUser().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;

  // Fetch Client & Appointment Information (runs at most ONCE per customerId)
  const customerId = params.appointmentId
    || existingQuotation?.appointmentId
    || existingQuotation?.customerId
    || params.customerId
    || params.id;

  const fetchedClientIdRef = useRef(null);

  useEffect(() => {
    if (!customerId) return;
    const cleanId = String(customerId).replace(/^DR/i, '').trim();
    if (!cleanId || fetchedClientIdRef.current === cleanId) return;
    fetchedClientIdRef.current = cleanId;

    const fetchClient = async () => {
      try {
        const aRes = await appointmentService.getAppointmentById(cleanId);
        if (aRes && aRes.success && (aRes.appointment || aRes.data)) {
          const d = aRes.appointment || aRes.data;
          setClientData({
            ...d,
            id: d.id || cleanId,
            appointmentId: d.appointmentId || d.id || cleanId,
            customerId: d.customerId || d.id || cleanId,
            clientName: d.customerName || d.clientName || d.name,
            customerName: d.customerName || d.clientName || d.name,
            phone: d.mobileNumber || d.phone || d.mobile,
            mobileNumber: d.mobileNumber || d.phone || d.mobile,
          });
          return;
        }
        const cRes = await clientService.getClientById(cleanId);
        if (cRes && cRes.success && (cRes.client || cRes.data)) {
          setClientData(cRes.client || cRes.data);
        }
      } catch (_e) { }
    };
    fetchClient();
  }, [customerId]);

  const app = useMemo(() => {
    if (clientData) return clientData;
    if (existingQuotation) {
      return {
        id: existingQuotation.appointmentId || existingQuotation.customerId,
        appointmentId: existingQuotation.appointmentId || existingQuotation.customerId,
        customerId: existingQuotation.customerId || existingQuotation.appointmentId,
        clientName: existingQuotation.clientName || existingQuotation.customerName || 'Client',
        customerName: existingQuotation.customerName || existingQuotation.clientName || 'Client',
        mobileNumber: existingQuotation.mobileNumber || existingQuotation.phone || '',
        phone: existingQuotation.mobileNumber || existingQuotation.phone || '',
      };
    }
    const cleanId = String(customerId || '').replace(/^DR/i, '').trim();
    return {
      id: cleanId,
      appointmentId: cleanId,
      customerId: cleanId,
      clientName: 'Client',
      customerName: 'Client',
      mobileNumber: '',
      phone: '',
    };
  }, [clientData, existingQuotation, customerId]);

  // Current Active Tier of the Edited Quotation
  const currentTier = useMemo(() => {
    return getPackageKey(quoteFor);
  }, [quoteFor]);

  const currentTierLabel = useMemo(() => {
    if (currentTier === 'elite') return 'ELITE';
    if (currentTier === 'economic') return 'ECONOMIC';
    if (currentTier === 'none') return 'STANDARD';
    return 'PREMIUM';
  }, [currentTier]);

  // Helpers for Dynamic Subtitles, Specs, and Rates
  const getDynamicSubtitles = useCallback((serviceName, tierName) => {
    if (!serviceName) return [];
    const dynService = findServiceInMap(dynamicServicesMap, serviceName);
    if (!dynService) return [];

    if (dynService.tierType === 'SingleTier') {
      return dynService.subtitles?.['none']
        || dynService.subtitles?.['singletier']
        || dynService.subtitles?.['single tier services']
        || Object.values(dynService.subtitles || {})[0]
        || [];
    }

    const tKey = String(tierName || 'premium').toLowerCase();
    const pkgKey = getPackageKey(tierName).toLowerCase();
    let subs = dynService.subtitles?.[tKey] || dynService.subtitles?.[pkgKey] || dynService.subtitles?.[tierName];
    if ((!subs || subs.length === 0) && /^econom/i.test(tKey)) {
      subs = dynService.subtitles?.['economic'] || dynService.subtitles?.['economy'];
    }
    return Array.isArray(subs) ? subs : [];
  }, [dynamicServicesMap]);

  const getDynamicSpec = useCallback((serviceName, tierName) => {
    if (!serviceName) return '';
    const dynService = findServiceInMap(dynamicServicesMap, serviceName);
    if (!dynService) return '';

    if (dynService.tierType === 'SingleTier') {
      return (
        dynService.descriptions?.['single tier services'] ||
        dynService.descriptions?.['singletier'] ||
        dynService.descriptions?.['none'] ||
        Object.values(dynService.descriptions || {})[0] ||
        ''
      );
    }

    const tKey = String(tierName || 'premium').toLowerCase();
    const pkgKey = getPackageKey(tierName).toLowerCase();
    let specVal = dynService.descriptions?.[tKey]
      || dynService.descriptions?.[pkgKey]
      || dynService.descriptions?.[tierName];
    if (!specVal && /^econom/i.test(tKey)) {
      specVal = dynService.descriptions?.['economic'] || dynService.descriptions?.['economy'];
    }
    if (!specVal) {
      specVal = Object.values(dynService.descriptions || {})[0] || '';
    }
    return specVal;
  }, [dynamicServicesMap]);

  const getDynamicRate = useCallback((serviceName, tierName) => {
    if (!serviceName) return '0';
    const dynService = findServiceInMap(dynamicServicesMap, serviceName);
    if (!dynService) return '0';

    if (dynService.tierType === 'SingleTier') {
      const rateVal = dynService.rates?.['single tier services']
        ?? dynService.rates?.['singletier']
        ?? dynService.rates?.['none']
        ?? Object.values(dynService.rates || {})[0];
      return rateVal != null ? String(rateVal) : '0';
    }

    const tKey = String(tierName || 'premium').toLowerCase();
    const pkgKey = getPackageKey(tierName).toLowerCase();
    let rateVal = dynService.rates?.[tKey]
      ?? dynService.rates?.[pkgKey]
      ?? dynService.rates?.[tierName];
    if (rateVal == null && /^econom/i.test(tKey)) {
      rateVal = dynService.rates?.['economic'] ?? dynService.rates?.['economy'];
    }
    if (rateVal == null) {
      rateVal = Object.values(dynService.rates || {})[0];
    }
    return rateVal != null ? String(rateVal) : '0';
  }, [dynamicServicesMap]);

  // Load Edit View Data from Server
  const loadEditView = useCallback(async () => {
    if (!targetQuoteId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await quotationService.getQuotationEditView(targetQuoteId);
      if (res && res.success && res.quotation) {
        setExistingQuotation(res.quotation);
        const q = res.quotation;

        if (Array.isArray(res.properties) && res.properties.length > 0) {
          setPropertiesList(res.properties);
        }

        const sMap = {};
        if (Array.isArray(res.packages) && res.packages.length > 0) {
          const normalized = normalizePackages(res.packages);
          setPackagesList(normalized);

          normalized.forEach((pkg) => {
            const rawTier = String(pkg.tier || pkg.packages || '').toLowerCase();
            const pkgName = pkg.packageName || pkg.name || '';
            const pkgId = pkg.packageId != null ? String(pkg.packageId) : null;
            const warranty = pkg.warranty || null;

            (pkg.services || []).forEach((srv) => {
              const rawSName = srv.serviceName;
              if (!rawSName) return;

              const existingEntryKey = Object.keys(sMap).find((k) => {
                const kClean = k.toLowerCase().replace(/\s+/g, '');
                const sClean = rawSName.toLowerCase().replace(/\s+/g, '');
                return kClean === sClean || (srv.serviceId && sMap[k].serviceId === srv.serviceId);
              });
              const sName = existingEntryKey || rawSName;

              if (!sMap[sName]) {
                sMap[sName] = {
                  serviceId: srv.serviceId,
                  serviceName: sName,
                  tierType: srv.tierType,
                  descriptions: {},
                  rates: {},
                  subtitles: {},
                  warranties: {},
                };
              }

              const tierAliases = [rawTier];
              if (/^econom/i.test(rawTier)) {
                tierAliases.push('economic', 'economy');
              } else if (/^prem/i.test(rawTier)) {
                tierAliases.push('premium');
              } else if (/^elite|^lux/i.test(rawTier)) {
                tierAliases.push('elite');
              }

              const srvWarranty = warranty || srv.warranty || srv.subtitles?.[0]?.warranty || (tierAliases.includes('economic') ? '5 Years' : null);
              if (srvWarranty) {
                tierAliases.forEach((tKey) => {
                  sMap[sName].warranties[tKey] = srvWarranty;
                });
                if (pkgName) sMap[sName].warranties[pkgName.toLowerCase()] = srvWarranty;
                if (pkgId) sMap[sName].warranties[pkgId] = srvWarranty;
              }

              if (Array.isArray(srv.subtitles) && srv.subtitles.length > 0) {
                tierAliases.forEach((tKey) => {
                  sMap[sName].subtitles[tKey] = srv.subtitles;
                });
                if (pkgName) sMap[sName].subtitles[pkgName.toLowerCase()] = srv.subtitles;
                if (pkgId) sMap[sName].subtitles[pkgId] = srv.subtitles;

                if (srv.tierType === 'SingleTier') {
                  sMap[sName].subtitles['none'] = srv.subtitles;
                  sMap[sName].subtitles['singletier'] = srv.subtitles;
                  sMap[sName].subtitles['single tier services'] = srv.subtitles;
                }

                const defaultSub = srv.subtitles.find(
                  (s) => String(s.subtitle || '').toLowerCase() === 'default'
                ) || srv.subtitles[0];

                if (defaultSub) {
                  const desc = defaultSub.description;
                  const rate = defaultSub.rate;

                  tierAliases.forEach((tKey) => {
                    sMap[sName].descriptions[tKey] = desc;
                    sMap[sName].rates[tKey] = rate;
                  });
                  if (pkg.packages) {
                    sMap[sName].descriptions[pkg.packages.toLowerCase()] = desc;
                    sMap[sName].rates[pkg.packages.toLowerCase()] = rate;
                  }
                  if (pkgName) {
                    sMap[sName].descriptions[pkgName.toLowerCase()] = desc;
                    sMap[sName].rates[pkgName.toLowerCase()] = rate;
                  }
                  if (pkgId) {
                    sMap[sName].descriptions[pkgId] = desc;
                    sMap[sName].rates[pkgId] = rate;
                  }
                  if (srv.tierType === 'SingleTier') {
                    sMap[sName].descriptions['none'] = desc;
                    sMap[sName].rates['none'] = rate;
                    sMap[sName].descriptions['singletier'] = desc;
                    sMap[sName].rates['singletier'] = rate;
                  }
                }
              } else {
                const desc = srv.description || '';
                const rate = srv.rate != null ? srv.rate : 0;

                tierAliases.forEach((tKey) => {
                  sMap[sName].descriptions[tKey] = desc;
                  sMap[sName].rates[tKey] = rate;
                });
                if (pkg.packages) {
                  sMap[sName].descriptions[pkg.packages.toLowerCase()] = desc;
                  sMap[sName].rates[pkg.packages.toLowerCase()] = rate;
                }
                if (pkgName) {
                  sMap[sName].descriptions[pkgName.toLowerCase()] = desc;
                  sMap[sName].rates[pkgName.toLowerCase()] = rate;
                }
                if (pkgId) {
                  sMap[sName].descriptions[pkgId] = desc;
                  sMap[sName].rates[pkgId] = rate;
                }
                if (srv.tierType === 'SingleTier') {
                  sMap[sName].descriptions['none'] = desc;
                  sMap[sName].rates['none'] = rate;
                  sMap[sName].descriptions['singletier'] = desc;
                  sMap[sName].rates['singletier'] = rate;
                }
              }
            });
          });
          setDynamicServicesMap(sMap);
        }

        // Pre-fill Date
        setQuotationDate(formatFromApiDate(q.quotationDate) || formatDateDDMMYY(new Date()));

        // Pre-fill Property Type
        let matchedPropName = q.propertyName;
        if (!matchedPropName && Array.isArray(res.properties)) {
          const matchedProp = res.properties.find(
            (p) => (p.id != null && p.id === q.propertyId) ||
              (p.propertyId != null && p.propertyId === q.propertyId)
          );
          if (matchedProp) matchedPropName = matchedProp.name;
        }
        if (!matchedPropName) {
          matchedPropName = q.propertyId === 2 ? 'Apartment' : q.propertyId === 3 ? 'Industries' : (q.propertyId === 200 ? 'Apartment' : q.propertyId === 201 ? 'Industries' : 'House');
        }
        setPropertyType(matchedPropName);

        // Pre-fill Quote For / Title
        let matchedPkgName = null;
        if (Array.isArray(res.packages)) {
          const normalized = normalizePackages(res.packages);
          const matchedPkg = normalized.find(
            (p) => (p.packageId != null && (p.packageId === q.packageId || p.packageId === q.quoteFor)) ||
              (p.packages && (p.packages === q.packages || p.packages === q.packageName || p.packages === q.packageTier)) ||
              (p.packageName && q.packageName && String(p.packageName).toLowerCase() === String(q.packageName).toLowerCase())
          );
          if (matchedPkg) {
            const tierLabel = matchedPkg.packages || '';
            const pName = matchedPkg.packageName || matchedPkg.name || '';
            matchedPkgName = (tierLabel && tierLabel.toLowerCase() !== 'none' && !pName.toLowerCase().includes(`(${tierLabel.toLowerCase()})`))
              ? `${pName} (${tierLabel})`
              : pName;
          }
        }
        if (!matchedPkgName) {
          if (q.quoteFor === 3 || q.packageId === 3 || String(q.packageName || '').toLowerCase().includes('elite') || String(q.packages || '').toLowerCase().includes('elite') || String(q.packageTier || '').toLowerCase().includes('elite')) {
            matchedPkgName = 'Polyurethane based Polyurea coating (Elite)';
          } else if (q.quoteFor === 2 || q.packageId === 2 || String(q.packageName || '').toLowerCase().includes('premium') || String(q.packages || '').toLowerCase().includes('premium') || String(q.packageTier || '').toLowerCase().includes('premium')) {
            matchedPkgName = 'Pure Flexible Polyurethane coating (Premium)';
          } else {
            matchedPkgName = 'Acrylic Elastomeric Coating (Economic)';
          }
        }
        setQuoteFor(matchedPkgName);

        const activeQuoteTier = getPackageKey(matchedPkgName);

        // Pre-fill Services
        const initialSelected = {};
        const initialConfig = {};
        let initialArea = q.area ? String(q.area) : '';

        const flatServices = Array.isArray(q.services) ? q.services.flat(Infinity) : [];

        if (flatServices.length > 0) {
          flatServices.forEach((srv) => {
            if (!srv || typeof srv !== 'object') return;
            const sName = srv.serviceName || srv.title || srv.name || 'Terrace WaterProofing';
            initialSelected[sName] = true;
            const areaStr = String(srv.area != null ? srv.area : (initialArea || ''));
            if (areaStr && !initialArea) initialArea = areaStr;

            const availableSubs = sMap[sName]?.subtitles?.[activeQuoteTier] || sMap[sName]?.subtitles?.['none'] || [];
            const defaultSub = availableSubs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || availableSubs[0];

            const curSubtitle = srv.subtitle || defaultSub?.subtitle || '';
            const matchedSub = availableSubs.find((s) => String(s.subtitle || '').toLowerCase() === String(curSubtitle).toLowerCase());

            const resolvedRate = srv.rate != null ? String(srv.rate) : String(matchedSub?.rate ?? defaultSub?.rate ?? sMap[sName]?.rates?.[activeQuoteTier] ?? '42');
            const resolvedSpec = srv.description || srv.spec || matchedSub?.description || defaultSub?.description || sMap[sName]?.descriptions?.[activeQuoteTier] || 'Standard Waterproofing Treatment';
            const resolvedDetailId = srv.serviceDetailId ?? matchedSub?.serviceDetailId ?? defaultSub?.serviceDetailId ?? null;
            const resolvedWarranty = srv.warranty || matchedSub?.warranty || defaultSub?.warranty || q.warranty || '';

            initialConfig[sName] = {
              area: areaStr,
              rate: resolvedRate,
              spec: resolvedSpec,
              specs: [resolvedSpec],
              selectedSubtitle: curSubtitle,
              serviceDetailId: resolvedDetailId,
              warranty: resolvedWarranty,
            };
          });
        } else {
          const firstServiceName = Object.keys(sMap)[0] || 'Terrace WaterProofing';
          initialSelected[firstServiceName] = true;
          const availableSubs = sMap[firstServiceName]?.subtitles?.[activeQuoteTier] || [];
          const defaultSub = availableSubs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || availableSubs[0];

          initialConfig[firstServiceName] = {
            area: initialArea || '',
            rate: String(defaultSub?.rate ?? sMap[firstServiceName]?.rates?.[activeQuoteTier] ?? '42'),
            spec: defaultSub?.description || sMap[firstServiceName]?.descriptions?.[activeQuoteTier] || 'Standard Waterproofing Treatment',
            specs: [defaultSub?.description || sMap[firstServiceName]?.descriptions?.[activeQuoteTier] || 'Standard Waterproofing Treatment'],
            selectedSubtitle: defaultSub?.subtitle || '',
            serviceDetailId: defaultSub?.serviceDetailId || null,
            warranty: defaultSub?.warranty || q.warranty || '',
          };
        }

        setSelectedServicesMap(initialSelected);
        setServicesConfig(initialConfig);
        setSiteArea(initialArea);

        // Pre-fill Terms: Fixed 60 / 30 / 10 by default - not dynamically corrupted
        let rawAdvP = parseFloat(q.advancePercent != null ? q.advancePercent : q.paymentTerms?.advance);
        let rawMidP = parseFloat(q.midPercent != null ? q.midPercent : q.paymentTerms?.mid);
        let rawFinP = parseFloat(q.finalPercent != null ? q.finalPercent : q.paymentTerms?.final);

        if (
          !isNaN(rawAdvP) &&
          !isNaN(rawMidP) &&
          rawAdvP > 0 &&
          rawMidP > 0 &&
          rawAdvP + rawMidP < 100
        ) {
          // Snap near-default values (e.g. 59 or 61 from rounding) to standard 60 / 30 / 10
          if (Math.abs(rawAdvP - 60) <= 2 && Math.abs(rawMidP - 30) <= 2) {
            rawAdvP = 60;
            rawMidP = 30;
            rawFinP = 10;
          } else {
            rawFinP = Math.max(0, 100 - rawAdvP - rawMidP);
          }
          setAdvancePercent(String(rawAdvP));
          setMidPercent(String(rawMidP));
          setFinalPercent(String(rawFinP));
        } else {
          setAdvancePercent('60');
          setMidPercent('30');
          setFinalPercent('10');
        }

        setValidityText(q.quoteValidateDate || 'Quote Valid till 30 Days');
        setNegotiationNote(q.negotiation != null ? String(q.negotiation) : 'PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER');
        setWorkStartNote(q.workCommencement != null ? String(q.workCommencement) : 'Work can be started 48hrs from the time of payment received');

        const matchedPkgWarranty = (res.packages || []).find((p) => p.packageId === q.packageId || p.packageName === matchedPkgName)?.warranty;
        setWarrantyText(q.warranty || matchedPkgWarranty || (activeQuoteTier === 'elite' ? '15 Years' : activeQuoteTier === 'premium' ? '10 Years' : '5 Years'));

        // Discount
        const existingDiscountPct = q.discountPercentage != null
          ? q.discountPercentage
          : (q.discountPercent != null
            ? q.discountPercent
            : (q.discount_percentage != null
              ? q.discount_percentage
              : (q.discount_percent != null
                ? q.discount_percent
                : '')));

        if (existingDiscountPct !== '' && existingDiscountPct !== null && existingDiscountPct !== undefined) {
          setDiscountPercent(String(existingDiscountPct));
        } else if (Number(q.discountAmount || q.discount_amount || (Number(q.discount) > 100 ? q.discount : 0) || 0) > 0 && Number(q.subTotal || q.subtotal || 0) > 0) {
          const rupeeDisc = Number(q.discountAmount || q.discount_amount || q.discount);
          const calculatedPct = Math.round((rupeeDisc / Number(q.subTotal || q.subtotal)) * 100);
          setDiscountPercent(String(calculatedPct));
        } else if (q.discount != null && Number(q.discount) <= 100 && Number(q.discount) >= 0) {
          setDiscountPercent(String(q.discount));
        } else {
          setDiscountPercent('0');
        }

        // With Regards / Signatory
        const assignedEmpName = q.employeeName
          || q.employee?.name
          || q.assignedEmployeeName
          || q.assignedEmployee?.name
          || q.assignedTo
          || clientDataRef.current?.assignedEmployeeName
          || clientDataRef.current?.assignedEmployee?.name
          || clientDataRef.current?.assignedTo
          || currentUserRef.current?.name;

        const defaultWithRegardsName = assignedEmpName
          ? (/^(mr\.|mrs\.|ms\.|dr\.)/i.test(String(assignedEmpName).trim())
            ? String(assignedEmpName).trim()
            : `Mr. ${String(assignedEmpName).trim().toUpperCase()}`)
          : 'Mr. SRIRAM';

        if (q.withRegards && q.withRegards !== 'Mr. SRIRAM') {
          setWithRegards(q.withRegards);
        } else if (q.withRegardsName && q.withRegardsName !== 'Mr. SRIRAM') {
          setWithRegards(q.withRegardsName);
        } else {
          setWithRegards(defaultWithRegardsName);
        }

        // GST
        const gstAddedRaw = q.gstAdded;
        const isGstRaw = q.isGst;
        const gstAmountRaw = Number(q.gstAmount || 0);
        const gstPercentageRaw = Number(q.gstPercentage || 0);

        let isExistingGst = false;
        if (gstAddedRaw === true || isGstRaw === true) {
          isExistingGst = true;
        } else if (gstAddedRaw === false || isGstRaw === false) {
          isExistingGst = false;
        } else if (gstPercentageRaw > 0 || gstAmountRaw > 0) {
          isExistingGst = true;
        } else if (typeof q.gst === 'string' && q.gst !== '0%' && q.gst !== '0' && q.gst !== '') {
          isExistingGst = true;
        }

        const rawGstRate = q.gstRate ?? q.gstPercentage;
        const parsedGstRate = typeof rawGstRate === 'number'
          ? rawGstRate
          : (typeof rawGstRate === 'string' ? parseFloat(rawGstRate.replace('%', '')) : NaN);
        const gstVal = (!isNaN(parsedGstRate) && parsedGstRate > 0)
          ? String(parsedGstRate)
          : (gstPercentageRaw > 0 ? String(gstPercentageRaw)
            : (typeof q.gst === 'string' ? String(q.gst).replace('%', '') : '18'));

        setGstAdded(isExistingGst);
        setGstPercent(isExistingGst && gstVal && gstVal !== '0' ? gstVal : '18');
      } else {
        const pvRes = await quotationService.getPageView();
        if (pvRes && pvRes.success) {
          setPropertiesList(pvRes.properties || []);
          setPackagesList(normalizePackages(pvRes.packages || []));
        }
      }
    } catch (err) {
      console.warn('Failed to load edit view:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [targetQuoteId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEditView();
    } catch (e) {
      console.warn('Refresh error:', e?.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEditView();
  }, [loadEditView]);

  // Dynamic Options
  const propertyOptions = useMemo(() => {
    if (propertiesList.length > 0) return propertiesList.map((p) => p.name);
    return ['House', 'Apartment', 'Industries'];
  }, [propertiesList]);

  const serviceOptions = useMemo(() => {
    const list = Object.keys(dynamicServicesMap);
    if (list.length > 0) return list;
    return ['Terrace WaterProofing', 'Terrace Cool Coating'];
  }, [dynamicServicesMap]);

  // Subtitle Selection on Service Card
  const handleSelectSubtitle = useCallback((serviceName, subItem) => {
    setServicesConfig((prev) => {
      const cur = prev[serviceName] || {};
      return {
        ...prev,
        [serviceName]: {
          ...cur,
          rate: String(subItem.rate ?? cur.rate ?? ''),
          spec: subItem.description || cur.spec || '',
          specs: [subItem.description || cur.spec || ''],
          selectedSubtitle: subItem.subtitle || '',
          serviceDetailId: subItem.serviceDetailId || cur.serviceDetailId,
          warranty: subItem.warranty || cur.warranty || '',
        },
      };
    });
  }, []);

  // Update Individual Service Field (area, rate, spec)
  const handleUpdateServiceField = (serviceName, field, value) => {
    setServicesConfig((prev) => {
      const subs = getDynamicSubtitles(serviceName, currentTier);
      const hasSubs = subs.length > 0;
      const defaultSub = hasSubs
        ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
        : null;
      const current = prev[serviceName] || {
        area: siteArea || '',
        rate: defaultSub ? String(defaultSub.rate ?? '') : (getDynamicRate(serviceName, currentTier) || '45'),
        spec: defaultSub ? (defaultSub.description || '') : getDynamicSpec(serviceName, currentTier),
        specs: defaultSub ? [defaultSub.description || ''] : [getDynamicSpec(serviceName, currentTier)],
        selectedSubtitle: defaultSub ? (defaultSub.subtitle || '') : '',
        serviceDetailId: defaultSub ? defaultSub.serviceDetailId : null,
      };
      return {
        ...prev,
        [serviceName]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // Remove Service
  const handleRemoveService = (serviceName) => {
    setSelectedServicesMap((prev) => {
      const updated = { ...prev };
      delete updated[serviceName];
      return updated;
    });
  };

  // Apply Selection from SelectServicesModal
  const handleApplyServicesModal = (newSelectedMap) => {
    setSelectedServicesMap(newSelectedMap);
    setServicesConfig((prevCfg) => {
      const updated = { ...prevCfg };
      Object.keys(newSelectedMap).forEach((sName) => {
        if (newSelectedMap[sName] && !updated[sName]) {
          const subs = getDynamicSubtitles(sName, currentTier);
          const hasSubs = subs.length > 0;
          const defaultSub = hasSubs
            ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
            : null;
          const dynRate = defaultSub ? String(defaultSub.rate ?? '') : getDynamicRate(sName, currentTier);
          const dynSpec = defaultSub ? (defaultSub.description || '') : getDynamicSpec(sName, currentTier);
          updated[sName] = {
            area: siteArea || '',
            rate: dynRate || '',
            spec: dynSpec || '',
            specs: dynSpec ? [dynSpec] : [],
            selectedSubtitle: defaultSub ? (defaultSub.subtitle || '') : '',
            serviceDetailId: defaultSub ? defaultSub.serviceDetailId : null,
            warranty: defaultSub?.warranty || '',
          };
        }
      });
      return updated;
    });
    setIsServicesModalVisible(false);
  };

  // Calculation Engine
  const handleCalculate = useCallback(() => {
    let sub = 0;
    Object.keys(selectedServicesMap).forEach((sName) => {
      if (selectedServicesMap[sName]) {
        const cfg = servicesConfig[sName] || {};
        const areaVal = parseFloat(cfg.area || siteArea) || 0;
        const rate = parseFloat(cfg.rate || 0) || 0;
        sub += areaVal * rate;
      }
    });

    setSubtotal(sub);

    const gstMultiplier = parseFloat(gstPercent) || 0;
    const taxFactor = gstAdded ? gstMultiplier / 100 : 0;
    const tax = Math.round(sub * taxFactor);
    const baseWithGst = sub + (gstAdded ? tax : 0);

    const discPct = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
    const discAmt = discPct > 0 ? (baseWithGst * discPct) / 100 : 0;
    setDiscountAmount(discAmt);

    const calculatedTotal = Math.max(0, baseWithGst - discAmt);
    setTotal(calculatedTotal);
  }, [siteArea, gstAdded, gstPercent, discountPercent, selectedServicesMap, servicesConfig]);

  useEffect(() => {
    handleCalculate();
  }, [handleCalculate]);

  // Validation
  const validateForm = () => {
    if (!quotationDate?.trim()) {
      showAlert('Validation Error', 'Quotation Date is required.', 'warning');
      return false;
    }

    if (isPastDate(quotationDate)) {
      showAlert('Validation Error', 'Quotation Date cannot be in the past.', 'warning');
      return false;
    }

    if (!propertyType || propertyType === '-select-') {
      showAlert('Validation Error', 'Please select a Property Type.', 'warning');
      return false;
    }

    if (!quoteFor || quoteFor === '-select-') {
      showAlert('Validation Error', 'Please select a Quote Title package.', 'warning');
      return false;
    }

    const activeServices = Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]);
    if (activeServices.length === 0) {
      showAlert('Validation Error', 'Please select at least one service.', 'warning');
      return false;
    }

    for (const sName of activeServices) {
      const cfg = servicesConfig[sName] || {};
      const areaNum = parseFloat(cfg.area || siteArea);
      if (isNaN(areaNum) || areaNum <= 0) {
        showAlert('Validation Error', `Area for "${sName}" must be a valid positive number.`, 'warning');
        return false;
      }
      const rateNum = parseFloat(cfg.rate);
      if (isNaN(rateNum) || rateNum <= 0) {
        showAlert('Validation Error', `Rate for "${sName}" must be a valid positive number.`, 'warning');
        return false;
      }
    }

    if (!validityText?.trim()) {
      showAlert('Validation Error', 'Quote Validity Date is required.', 'warning');
      return false;
    }

    return true;
  };

  // Save / Update Single Quotation
  const handleSaveQuotation = async () => {
    Keyboard.dismiss();
    if (isQuoteLocked) {
      showAlert('Quotation Locked', 'This quotation is confirmed and locked. It cannot be edited.', 'error');
      return;
    }
    if (!validateForm()) return;

    setIsSaving(true);

    const activeServices = Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]);

    const selectedProp = propertiesList.find((p) => {
      const pName = String(p.name || '').toLowerCase();
      const cur = String(propertyType || '').toLowerCase();
      return pName === cur || (pName.includes('house') && cur.includes('house')) || (pName.includes('apartment') && cur.includes('apartment')) || (pName.includes('industr') && cur.includes('industr'));
    });
    const propertyId = Number(selectedProp?.id || selectedProp?.propertyId || (propertyType === 'Apartment' || propertyType === 'Appartment' ? 2 : propertyType?.toLowerCase()?.includes('industr') ? 3 : 1));

    const selectedPkg = packagesList.find((p) => {
      if (!p) return false;
      const optLabelWithTier = `${p.packageName} (${p.packages || ''})`.toLowerCase();
      const pNameLower = String(p.packageName || '').toLowerCase();
      const qLower = String(quoteFor || '').toLowerCase();
      return (
        qLower === optLabelWithTier ||
        qLower === pNameLower ||
        qLower.includes(pNameLower) ||
        (qLower.includes('elastomeric') && pNameLower.includes('elastomeric'))
      );
    }) || packagesList.find((p) => {
      return isTierMatch(p.tier, currentTier)
        || isTierMatch(p.packages, currentTier)
        || (isTierMatch(currentTier, 'economic') && (p.packageId === 1 || p.packageId === 4))
        || (isTierMatch(currentTier, 'premium') && (p.packageId === 2 || p.packageId === 5))
        || (isTierMatch(currentTier, 'elite') && p.packageId === 3);
    });

    let quoteForId = Number(selectedPkg?.packageId || selectedPkg?.id);
    if (!quoteForId || isNaN(quoteForId)) {
      if (currentTier === 'elite') quoteForId = 3;
      else if (currentTier === 'premium') quoteForId = 2;
      else quoteForId = 1;
    }

    const quotationServicesRequest = activeServices.map((sName, index) => {
      const cfg = servicesConfig[sName] || {};
      const dynService = findServiceInMap(dynamicServicesMap, sName);

      const sAreaVal = parseFloat(cfg.area || siteArea || 0);
      const sRateVal = parseFloat(cfg.rate || 0);
      const sSpec = cfg.spec || (Array.isArray(cfg.specs) && cfg.specs.length > 0 ? cfg.specs.join(', ') : 'Standard Waterproofing');
      const sDetailId = cfg.serviceDetailId != null ? Number(cfg.serviceDetailId) : null;
      const sSubtitle = cfg.selectedSubtitle || cfg.subtitle || 'Default';
      const sWarranty = cfg.warranty || selectedPkg?.warranty || warrantyText || (isTierMatch(currentTier, 'economic') ? '5 Years' : '');

      return {
        serviceId: Number(dynService?.serviceId || index + 1),
        serviceDetailId: sDetailId,
        title: sName,
        serviceName: sName,
        subtitle: sSubtitle,
        tierType: dynService?.tierType || 'MultiTier',
        description: sSpec,
        area: sAreaVal,
        rate: sRateVal,
        totalPrice: Math.round(sAreaVal * sRateVal),
        warranty: sWarranty,
      };
    });

    let advP = parseFloat(advancePercent ?? 60);
    let midP = parseFloat(midPercent ?? 30);
    let finP = parseFloat(finalPercent ?? 10);
    if (isNaN(advP) || isNaN(midP) || isNaN(finP) || Math.abs((advP + midP + finP) - 100) > 0.5) {
      advP = 60;
      midP = 30;
      finP = 10;
    }
    const advanceAmount = Math.round((total * advP) / 100);
    const midCostAmount = Math.round((total * midP) / 100);
    const finalAmountVal = Math.round(total - advanceAmount - midCostAmount);

    const empId = Number(existingQuotation?.employeeId || currentUser?.id || currentUser?.employeeId || app?.assignedEmployeeId || app?.employeeId) || 2;
    const appId = Number(existingQuotation?.appointmentId || params.appointmentId || app?.id) || null;
    const custId = Number(existingQuotation?.customerId || params.customerId || params.appointmentId || app?.id) || appId;
    const nextRevision = (Number(existingQuotation?.revision) || 1) + 1;

    const parsedGst = parseFloat(gstPercent);
    const editGstRate = !isNaN(parsedGst) ? parsedGst : 18;
    const editGstAmount = gstAdded ? Math.round(subtotal * (editGstRate / 100)) : 0;
    const editCgstAmount = Math.round(editGstAmount / 2);
    const editSgstAmount = editGstAmount - editCgstAmount;

    const gstPayloadFields = gstAdded
      ? {
        gstPercentage: editGstRate,
        gstRate: editGstRate,
        gstAmount: editGstAmount,
        cgstPercentage: editGstRate / 2,
        sgstPercentage: editGstRate / 2,
        cgstAmount: editCgstAmount,
        sgstAmount: editSgstAmount,
        isGst: true,
        gstAdded: true,
      }
      : {
        gstPercentage: 0,
        gstRate: 0,
        gstAmount: 0,
        cgstPercentage: 0,
        sgstPercentage: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        isGst: false,
        gstAdded: false,
      };

    const baseWithGst = subtotal + (gstAdded ? editGstAmount : 0);

    const discPct = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
    const discAmt = discPct > 0 ? Math.round((baseWithGst * discPct) / 100) : 0;
    const discountedSubtotal = Math.max(0, baseWithGst - discAmt);
    const withRegardsVal = withRegards?.trim() || 'Mr. SRIRAM';

    const propNameVal = selectedProp?.name || propertyType || 'House';
    const pkgNameVal = selectedPkg?.packageName || selectedPkg?.name || (isTierMatch(currentTier, 'economic') ? 'Acrylic Elastomeric Coating' : 'Waterproofing Treatment');
    const pkgTierVal = selectedPkg?.packages && !isTierMatch(selectedPkg.packages, 'economic')
      ? selectedPkg.packages
      : (isTierMatch(currentTier, 'economic') ? 'Economic' : currentTier === 'elite' ? 'Elite' : currentTier === 'premium' ? 'Premium' : 'None');

    const apiPayload = {
      quotationDate: formatToApiDate(quotationDate),
      propertyId,
      propertyName: propNameVal,
      packageId: quoteForId,
      quoteFor: quoteForId,
      packageName: pkgNameVal,
      packageTier: pkgTierVal,
      employeeId: empId,
      appointmentId: appId,
      customerId: custId,
      withRegards: withRegardsVal,
      withRegardsName: withRegardsVal,
      isGst: Boolean(gstAdded),
      gstAdded: Boolean(gstAdded),
      services: quotationServicesRequest,
      advance: advanceAmount,
      midCost: midCostAmount,
      final: finalAmountVal,
      advancePercent: advP,
      midPercent: midP,
      finalPercent: finP,
      paymentTerms: {
        advance: advP,
        mid: midP,
        final: finP,
        validity: validityText.trim(),
        negotiation: negotiationNote?.trim() || null,
        workStart: workStartNote?.trim() || null,
      },
      discount: discPct,
      discountPercentage: discPct,
      discountPercent: discPct,
      discountAmount: discAmt,
      subTotal: Math.round(subtotal),
      totalAmount: Math.round(discountedSubtotal),
      grandTotal: Math.round(total),
      totalWithGst: Math.round(total),
      quoteValidateDate: validityText.trim(),
      negotiation: negotiationNote?.trim() || null,
      workCommencement: workStartNote?.trim() || null,
      warranty: warrantyText?.trim() || selectedPkg?.warranty || null,
      revision: nextRevision,
      isConfirmed: false,
      ...gstPayloadFields,
    };

    try {
      const quoteIdToUpdate = targetQuoteId || existingQuotation?.id;
      const apiRes = quoteIdToUpdate
        ? await quotationService.updateQuotation(quoteIdToUpdate, apiPayload)
        : await quotationService.createQuotation(apiPayload);

      if (apiRes.success) {
        setSuccessModal({
          visible: true,
          title: 'Quotation Updated! 🎉',
          message: apiRes.message || `Quotation for ${pkgTierVal} has been updated successfully.`,
          custId: custId || appId,
        });
      } else {
        showAlert('Save Error', apiRes.message || 'Failed to update quotation on the server.', 'error');
      }
    } catch (err) {
      showAlert('Error', err?.message || 'An unexpected error occurred while saving.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !existingQuotation) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialFormSkeleton headerTitle="Edit Quotation" />
      </View>
    );
  }

  const rawClientName = app?.customerName || app?.clientName || app?.name || existingQuotation?.customerName || existingQuotation?.clientName || '';
  const customerInitial = (() => {
    const cleaned = rawClientName.replace(/^(mr\.|mrs\.|ms\.|dr\.)\s+/i, '').trim();
    return (cleaned || rawClientName).slice(0, 2).toUpperCase() || 'MR';
  })();
  const prefix = (rawClientName && !rawClientName.trim().toLowerCase().startsWith('mr.')) ? 'Mr. ' : '';
  const displayName = rawClientName ? `${prefix}${rawClientName.trim()}` : `Customer #${customerId || ''}`;
  const displayId = `DR${app?.customerId || app?.appointmentId || app?.id || existingQuotation?.customerId || customerId || ''}`.replace(/^DRDR/i, 'DR');
  const displayPhone = app?.mobileNumber || app?.phone || existingQuotation?.mobileNumber || existingQuotation?.phone || 'N/A';
  const revisionStatus = existingQuotation?.revision ? `Revision #${existingQuotation.revision}` : 'Editing';

  const selectedServicesCount = Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader title="Edit Quotation" paddingTop={insets.top} isDark={isDark} />

      {/* Scrollable Form Content */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2B59A2']}
            tintColor={isDark ? '#FFFFFF' : '#2B59A2'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 80, 120) },
        ]}
      >
        {/* Customer Banner */}
        <QuotationCustomerBanner
          displayName={displayName}
          customerInitial={customerInitial}
          displayId={displayId}
          displayPhone={displayPhone}
          status={revisionStatus}
          isDark={isDark}
        />

        {/* Quotation Locked Banner */}
        {isQuoteLocked && (
          <View style={{
            backgroundColor: isDark ? '#7F1D1D25' : '#FEF2F2',
            borderWidth: 1,
            borderColor: isDark ? '#991B1B' : '#FECACA',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="lock-closed" size={20} color="#DC2626" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FCA5A5' : '#991B1B' }}>
                Quotation Locked
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? '#F87171' : '#B91C1C', marginTop: 2 }}>
                This quotation is confirmed and locked. It cannot be edited.
              </Text>
            </View>
          </View>
        )}

        {/* Card 1: Quotation Setup */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardHeading, isDark && styles.textDark]}>
            Quotation Setup
          </Text>

          {/* Quotation Date */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Quotation Date</Text>
            <View style={[styles.inputFieldWrap, isDark && styles.inputFieldWrapDark]}>
              <TextInput
                style={[styles.textInput, isDark && styles.textDark]}
                value={quotationDate}
                onChangeText={setQuotationDate}
                placeholder="DD-MM-YY"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />
              <TouchableOpacity
                onPress={() => {
                  if (quotationDate) {
                    const parsed = parseDateToDateObj(quotationDate);
                    if (parsed && !isNaN(parsed.getTime())) {
                      setDatePickerValue(parsed);
                    }
                  }
                  setShowDatePicker(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="calendar-outline" size={17} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Property Type Dropdown */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Property Type</Text>
            <TouchableOpacity
              style={[styles.dropdownHeader, isDark && styles.inputFieldWrapDark, !propertyType && styles.dropdownHeaderUnselected]}
              onPress={() => {
                setPropertyDropdownOpen(!propertyDropdownOpen);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dropdownHeaderText,
                  isDark && styles.textDark,
                  !propertyType && (isDark ? styles.subtextDark : styles.placeholderText),
                ]}
              >
                {propertyType || 'Select Property Type'}
              </Text>
              <Ionicons
                name={propertyDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>

            {propertyDropdownOpen && (
              <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
                {propertyOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.dropdownItem,
                      isDark && styles.dropdownItemDark,
                      propertyType === opt && { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
                    ]}
                    onPress={() => {
                      setPropertyType(opt);
                      setPropertyDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isDark && styles.textDark,
                        propertyType === opt && { color: '#2563EB', fontWeight: '700' },
                      ]}
                    >
                      {opt}
                    </Text>
                    {propertyType === opt && (
                      <Ionicons name="checkmark" size={16} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Quote Title / Package (Disabled in Edit Mode) */}
          <View style={[styles.inputGroup, { marginBottom: 2 }]}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Quote Title</Text>
            <View
              style={[
                styles.dropdownHeader,
                styles.dropdownHeaderDisabled,
                isDark && styles.dropdownHeaderDisabledDark,
              ]}
            >
              <Text
                style={[
                  styles.dropdownHeaderText,
                  styles.dropdownHeaderTextDisabled,
                  isDark && styles.dropdownHeaderTextDisabledDark,
                ]}
                numberOfLines={1}
              >
                {quoteFor || 'Select Quote Title'}
              </Text>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={isDark ? '#64748B' : '#94A3B8'}
              />
            </View>
          </View>
        </View>

        {/* Card 2: Select Services Trigger Card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.servicesHeaderRow}>
            <View>
              <Text style={[styles.cardHeading, isDark && styles.textDark, { marginBottom: 2 }]}>
                Selected Services
              </Text>
              <Text style={[styles.helperSubtext, isDark && styles.subtextDark]}>
                {selectedServicesCount > 0 ? `${selectedServicesCount} selected · Tap to edit` : 'No services selected'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editServicesBtn}
              onPress={() => setIsServicesModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={14} color="#2B59A2" style={{ marginRight: 2 }} />
              <Text style={styles.editServicesBtnText}>
                {selectedServicesCount > 0 ? 'Edit Services' : 'Add Services'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Empty Prompt */}
          {selectedServicesCount === 0 && (
            <TouchableOpacity
              style={[styles.noServicesPrompt, isDark && styles.noServicesPromptDark]}
              onPress={() => setIsServicesModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="layers-outline" size={22} color="#2563EB" style={{ marginBottom: 4 }} />
              <Text style={[styles.noServicesPromptTitle, isDark && styles.textDark]}>
                No Services Selected
              </Text>
              <Text style={[styles.noServicesPromptSubtext, isDark && styles.subtextDark]}>
                {'Tap "+ Add Services" to choose services for this quotation'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick List of Selected Services */}
          {selectedServicesCount > 0 && (
            <View style={styles.activeServicesQuickList}>
              {Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]).map((sName, idx) => (
                <View key={sName} style={[styles.quickServiceRow, isDark && styles.quickServiceRowDark]}>
                  <View style={styles.quickServiceLeft}>
                    <View style={styles.quickIndexBadge}>
                      <Text style={styles.quickIndexBadgeText}>{idx + 1}</Text>
                    </View>
                    <Text style={[styles.quickServiceName, isDark && styles.textDark]} numberOfLines={1}>
                      {sName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveService(sName)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Card 3: Dedicated Per-Service Configuration Cards */}
        {Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]).map((serviceName, index) => {
          const subs = getDynamicSubtitles(serviceName, currentTier);
          const hasSubs = subs.length > 0;
          const cfg = servicesConfig[serviceName] || {
            area: siteArea || '',
            rate: hasSubs ? '' : (getDynamicRate(serviceName, currentTier) || '55'),
            spec: hasSubs ? '' : getDynamicSpec(serviceName, currentTier),
            selectedSubtitle: '',
          };

          return (
            <ServiceConfigCard
              key={serviceName}
              serviceName={serviceName}
              index={index}
              area={cfg.area}
              rate={cfg.rate}
              spec={cfg.spec}
              tierLabel={currentTierLabel}
              subtitles={subs}
              selectedSubtitle={cfg.selectedSubtitle || ''}
              onSelectSubtitle={handleSelectSubtitle}
              onUpdateField={handleUpdateServiceField}
              onRemove={handleRemoveService}
              isDark={isDark}
            />
          );
        })}

        {/* Card 4: Amount & GST Controls */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardHeading, isDark && styles.textDark]}>
            Amount & GST Controls
          </Text>

          {/* Subtotal Display Box */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>
              Subtotal Amount (Sq.ft × Rate)
            </Text>
            <View style={[styles.displayBox, isDark && styles.displayBoxDark]}>
              <Text style={[styles.displayText, isDark && styles.textDark]}>
                Rs. {Math.round(subtotal).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Include GST Row */}
          <View style={styles.gstToggleRow}>
            <Text style={[styles.gstLabelText, isDark && styles.textDark]}>Include GST</Text>
            <TouchableOpacity
              style={[styles.gstBtn, gstAdded ? styles.gstBtnActive : styles.gstBtnInactive]}
              onPress={() => setGstAdded(!gstAdded)}
              activeOpacity={0.8}
            >
              <Text style={styles.gstBtnText}>
                {gstAdded ? 'Remove GST' : 'Add GST'}
              </Text>
            </TouchableOpacity>
          </View>

          {gstAdded && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>GST Percentage (%)</Text>
              <View style={[styles.inputFieldWrap, isDark && styles.inputFieldWrapDark]}>
                <TextInput
                  style={[styles.textInput, isDark && styles.textDark]}
                  keyboardType="numeric"
                  value={gstPercent}
                  onChangeText={setGstPercent}
                  placeholder="18"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
                <Text style={[styles.inputSuffix, isDark && styles.subtextDark]}>%</Text>
              </View>
            </View>
          )}

          {/* Discount Percentage */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRowBetween}>
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>
                Discount Percentage (%)
              </Text>
              {parseFloat(discountPercent) > 0 && (
                <Text style={styles.discountTagText}>
                  - Rs.{Math.round(discountAmount).toLocaleString()} ({discountPercent}%)
                </Text>
              )}
            </View>
            <View style={styles.discountInputRow}>
              <View style={[styles.inputFieldWrap, isDark && styles.inputFieldWrapDark, { flex: 1 }]}>
                <TextInput
                  style={[styles.textInput, isDark && styles.textDark]}
                  keyboardType="numeric"
                  value={discountPercent}
                  onChangeText={(val) => {
                    const num = parseFloat(val);
                    if (val === '' || (!isNaN(num) && num >= 0 && num <= 100)) {
                      setDiscountPercent(val);
                    }
                  }}
                  placeholder="0 (e.g. 5, 10)"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
              </View>
              <View style={[styles.percentSquare, isDark && styles.percentSquareDark]}>
                <Text style={[styles.percentSquareText, isDark && styles.textDark]}>%</Text>
              </View>
            </View>
          </View>

          {/* Final Total Amount Display Box */}
          <View style={[styles.inputGroup, { marginBottom: 2 }]}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>
              Final Total Amount {gstAdded ? `(Includes GST ${gstPercent}%)` : '(Without GST)'}
            </Text>
            <View style={[styles.displayBoxTotal, isDark && styles.displayBoxTotalDark]}>
              <Text style={styles.displayTotalText}>
                Rs. {Math.round(total).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 5: Terms & Negotiation Details */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeaderWithIcon}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="wallet-outline" size={17} color="#2B59A2" />
            </View>
            <View>
              <Text style={[styles.cardHeading, isDark && styles.textDark, { marginBottom: 1 }]}>
                Terms & Negotiation Details
              </Text>
              <Text style={[styles.helperSubtext, isDark && styles.subtextDark]}>
                Validity, negotiation & work commencement notes
              </Text>
            </View>
          </View>

          {/* Quote Validity */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIconRow}>
              <Ionicons name="calendar-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Quote Validity Date / Note</Text>
            </View>
            <View style={[styles.inputFieldWrap, isDark && styles.inputFieldWrapDark]}>
              <TextInput
                style={[styles.textInput, isDark && styles.textDark]}
                value={validityText}
                onChangeText={setValidityText}
                placeholder="Quote Valid till..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />
            </View>
          </View>

          {/* Negotiation Banner Note */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIconRow}>
              <Ionicons name="pricetag-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Negotiation Banner Note</Text>
            </View>
            <TextInput
              style={[styles.textArea, isDark && styles.textAreaDark]}
              multiline
              numberOfLines={2}
              value={negotiationNote}
              onChangeText={setNegotiationNote}
              placeholder="Enter negotiation banner note..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
          </View>

          {/* Work Commencement Clause */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIconRow}>
              <Ionicons name="time-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Work Commencement Clause</Text>
            </View>
            <TextInput
              style={[styles.textArea, isDark && styles.textAreaDark]}
              multiline
              numberOfLines={2}
              value={workStartNote}
              onChangeText={setWorkStartNote}
              placeholder="Work start clause details..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
          </View>

          {/* With Regards Signatory */}
          <View style={[styles.inputGroup, { marginBottom: 4 }]}>
            <View style={styles.labelWithIconRow}>
              <Ionicons name="person-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={[styles.inputLabel, isDark && styles.labelDark]}>With Regards (Signatory Name)</Text>
            </View>
            <View style={[styles.inputFieldWrap, isDark && styles.inputFieldWrapDark]}>
              <TextInput
                style={[styles.textInput, isDark && styles.textDark]}
                value={withRegards}
                onChangeText={setWithRegards}
                placeholder="e.g. Mr. SRIRAM"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              />
            </View>
          </View>
        </View>

        {/* Bottom Save Action CTA */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, isQuoteLocked && { backgroundColor: isDark ? '#334155' : '#94A3B8', opacity: 0.7 }]}
            onPress={() => {
              Keyboard.dismiss();
              if (isQuoteLocked) {
                showAlert('Quotation Locked', 'This quotation is confirmed and locked. It cannot be edited.', 'error');
                return;
              }
              handleSaveQuotation();
            }}
            disabled={isSaving || isQuoteLocked}
            activeOpacity={isQuoteLocked ? 1 : 0.85}
          >
            <Text style={styles.saveBtnText}>{isQuoteLocked ? 'Quotation Locked' : 'Save Changes'}</Text>
            <Ionicons name={isQuoteLocked ? "lock-closed" : "checkmark-circle"} size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Select Services Bottom Sheet Modal */}
      <SelectServicesModal
        visible={isServicesModalVisible}
        availableServices={serviceOptions}
        selectedMap={selectedServicesMap}
        onClose={() => setIsServicesModalVisible(false)}
        onApply={handleApplyServicesModal}
        isDark={isDark}
      />

      {/* Saving Overlay Loader */}
      <MaterialOverlayLoader
        visible={isSaving}
        title="Saving Changes..."
        subtitle="Updating quotation on server"
      />

      {/* Custom Material Alert & Validation Modal */}
      <MaterialAlertModal
        visible={alertModalConfig.visible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        type={alertModalConfig.type}
        buttonText={alertModalConfig.buttonText}
        onClose={() => setAlertModalConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* Success Modal */}
      <MaterialSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        buttonText="View Quotation"
        onClose={() => {
          const targetId = successModal.custId || customerId;
          setSuccessModal({ visible: false, title: '', message: '', custId: null });
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace({
              pathname: '/customer-detail',
              params: { id: targetId, initialTab: 'quotation' },
            });
          }
        }}
      />

      {/* Quotation Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Quotation Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={onQuotationDateChange}
              />
            </View>
          </View>
        </Modal>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onQuotationDateChange}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EFF5FC',
    borderWidth: 1,
    borderColor: '#BFD7F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  helperSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  labelDark: {
    color: '#CBD5E1',
  },
  labelWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  discountTagText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  inputFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  inputFieldWrapDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },
  inputSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 8,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#0F172A',
    minHeight: 52,
    textAlignVertical: 'top',
  },
  textAreaDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  dropdownHeaderUnselected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  placeholderText: {
    color: '#64748B',
    fontWeight: '500',
  },
  dropdownHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  dropdownHeaderDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  dropdownHeaderDisabledDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dropdownHeaderTextDisabled: {
    color: '#64748B',
  },
  dropdownHeaderTextDisabledDark: {
    color: '#94A3B8',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownListDark: {
    backgroundColor: '#1E1E1E',
    borderColor: '#334155',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemDark: {
    borderBottomColor: '#262626',
  },
  dropdownItemText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#1E293B',
  },
  servicesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF5FC',
    borderWidth: 1,
    borderColor: '#BFD7F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editServicesBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2B59A2',
  },
  activeServicesQuickList: {
    marginTop: 10,
    gap: 6,
  },
  noServicesPrompt: {
    marginTop: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noServicesPromptDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  noServicesPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  noServicesPromptSubtext: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  quickServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  quickServiceRowDark: {
    backgroundColor: '#141414',
    borderColor: '#262626',
  },
  quickServiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  quickIndexBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2B59A2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  quickIndexBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickServiceName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  displayBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayBoxDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  displayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  displayBoxTotal: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayBoxTotalDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  displayTotalText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2B59A2',
  },
  gstToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    marginBottom: 8,
  },
  gstLabelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  gstBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gstBtnActive: {
    backgroundColor: '#EF4444',
  },
  gstBtnInactive: {
    backgroundColor: '#2B59A2',
  },
  gstBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentSquare: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentSquareDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  percentSquareText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#475569',
  },
  bottomContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#2B59A2',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
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
});
