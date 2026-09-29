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
  View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';
import { isPastDate } from '../../../core/utils/validation';
import { formatDateDDMMYY, toApiDateString, parseDateToDateObj } from '../../../core/utils/dateFormat';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal, MaterialFormSkeleton, MaterialOverlayLoader } from '../../../shared/components/material';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { authRepository } from '../../auth/api/authRepository';
import { clientRepository as clientService } from '../../clients/api/clientRepository';
import { quotationRepository as quotationService } from '../../quotations/api/quotationRepository';

// Redesigned Subcomponents
import ConfirmQuotationTiersModal from '../components/ConfirmQuotationTiersModal';
import QuotationCustomerBanner from '../components/QuotationCustomerBanner';
import QuotationTierSwitcher from '../components/QuotationTierSwitcher';
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
 * Normalizes packages from GET /quotations/page-view.
 * Handles both:
 * 1) Grouped structure: [ { package: "Economic", data: [ { id, packageId, packageName, warranty, services: [...] } ] } ]
 * 2) Flat structure: [ { id, packageId, packageName, packages: "Economic", tier: "economic", services: [...] } ]
 */
const normalizePackages = (rawPackages) => {
  if (!Array.isArray(rawPackages)) return [];
  const flattened = [];

  rawPackages.forEach((entry) => {
    if (!entry) return;
    // Format A: Grouped by tier { package: "Economy" | "Economic", data: [ ... ] }
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
      // Format B: Flat package object { id, packageId, packageName, packages, ... }
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

export default function MakeQuotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic Page View Data from GET /quotations/page-view
  const [propertiesList, setPropertiesList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [dynamicServicesMap, setDynamicServicesMap] = useState({});

  // Active Tier State ('economic' | 'premium' | 'elite')
  const availableTiers = useMemo(() => {
    if (params.selectedTiers) {
      const parsed = String(params.selectedTiers)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
    const all = ['economic', 'premium', 'elite'];
    if (params.existingTiers) {
      const existing = String(params.existingTiers)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const filtered = all.filter((t) => !existing.includes(t));
      if (filtered.length > 0) return filtered;
    }
    return all;
  }, [params.selectedTiers, params.existingTiers]);

  const [activeTier, setActiveTier] = useState(() => {
    if (params.tier && availableTiers.includes(String(params.tier).toLowerCase())) {
      return String(params.tier).toLowerCase();
    }
    return availableTiers[0] || 'premium';
  });

  const prevParamsTierRef = useRef(params.tier);
  useEffect(() => {
    if (params.tier && params.tier !== prevParamsTierRef.current) {
      prevParamsTierRef.current = params.tier;
      if (availableTiers.includes(String(params.tier).toLowerCase())) {
        setActiveTier(String(params.tier).toLowerCase());
      }
    } else if (!availableTiers.includes(activeTier)) {
      setActiveTier(availableTiers[0] || 'premium');
    }
  }, [availableTiers, params.tier, activeTier]);

  // Services Modal State
  const [isServicesModalVisible, setIsServicesModalVisible] = useState(false);

  // Tier Drafts Store & Confirmation Modal States
  const [tierDraftsMap, setTierDraftsMap] = useState({});
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [tierTotalsMap, setTierTotalsMap] = useState({});

  // Custom Validation & Alert Modal State
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

  const getTodayFormatted = () => {
    return formatDateDDMMYY(new Date());
  };

  const getValidityFormatted = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return `Quote Valid till ${formatDateDDMMYY(d)}`;
  };

  // Dropdown States
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [quoteForDropdownOpen, setQuoteForDropdownOpen] = useState(false);

  // Form States - Initialize quotationDate with today's date so it is never empty
  const [quotationDate, setQuotationDate] = useState(getTodayFormatted);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [propertyType, setPropertyType] = useState('');
  const [quoteFor, setQuoteFor] = useState('');
  const [selectedServicesMap, setSelectedServicesMap] = useState({});
  const [servicesConfig, setServicesConfig] = useState({});
  const [siteArea, setSiteArea] = useState('');

  // Tax & Discount States (GST enabled by default as requested)
  const [gstAdded, setGstAdded] = useState(() => {
    if (params.isGst !== undefined) {
      return params.isGst === 'true' || params.isGst === true;
    }
    if (params.gstAdded !== undefined) {
      return params.gstAdded === 'true' || params.gstAdded === true;
    }
    return true;
  });
  const [gstPercent, setGstPercent] = useState('18');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);

  // Milestone Terms & Clauses
  const [advancePercent, setAdvancePercent] = useState('60');
  const [midPercent, setMidPercent] = useState('30');
  const [finalPercent, setFinalPercent] = useState('10');
  const [validityText, setValidityText] = useState(getValidityFormatted);
  const [negotiationNote, setNegotiationNote] = useState('PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER');
  const [workStartNote, setWorkStartNote] = useState('Work can be started 48hrs from the time of payment received');
  const [withRegards, setWithRegards] = useState('Mr. SRIRAM');

  useEffect(() => {
    authRepository.getUser().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  const onQuotationDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDatePickerValue(selectedDate);
      setQuotationDate(formatDateDDMMYY(selectedDate));
    }
  };

  // Fetch dynamic page-view config
  const loadPageView = useCallback(async () => {
    try {
      const res = await quotationService.getPageView();
      if (res && res.success) {
        if (Array.isArray(res.properties) && res.properties.length > 0) {
          setPropertiesList(res.properties);
        }
        if (Array.isArray(res.packages) && res.packages.length > 0) {
          const normalized = normalizePackages(res.packages);
          setPackagesList(normalized);

          const sMap = {};
          normalized.forEach((pkg) => {
            const rawTier = String(pkg.tier || pkg.packages || '').toLowerCase(); // 'economic', 'premium', 'elite', 'none'
            const pkgName = pkg.packageName || pkg.name || '';
            const pkgId = pkg.packageId != null ? String(pkg.packageId) : null;
            const warranty = pkg.warranty || null;

            (pkg.services || []).forEach((srv) => {
              const rawSName = srv.serviceName;
              if (!rawSName) return;

              // Canonicalize service name across packages to prevent duplicate or missing service entries
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

              // Collect tier aliases for indexing ('economic' and 'economy' both mapped)
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

              // Subtitles array from API
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

                // Pick "Default" subtitle, or first valid subtitle
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

          // Set default quote title for initial activeTier if empty
          setQuoteFor((prevTitle) => {
            if (prevTitle && prevTitle !== '-select-') return prevTitle;
            const curTier = activeTier || 'premium';
            const matched = normalized.find(
              (p) => isTierMatch(p.tier, curTier) || isTierMatch(p.packages, curTier)
            );
            if (matched) {
              const tierLabel = /^econom/i.test(matched.packages || matched.tier || '')
                ? 'Economic'
                : (matched.packages || (curTier.charAt(0).toUpperCase() + curTier.slice(1)));
              const tierSuffix = tierLabel && !matched.packageName.toLowerCase().includes(tierLabel.toLowerCase())
                ? ` (${tierLabel})`
                : '';
              return `${matched.packageName}${tierSuffix}`;
            }
            return /^econom/i.test(curTier)
              ? 'Acrylic Elastomeric Coating (Economic)'
              : curTier === 'elite'
                ? 'Polyurethane based  Polyurea coating (Elite)'
                : 'Pure Flexible Polyurethane coating (Premium)';
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load quotation page-view:', err?.message);
    }
  }, [activeTier]);

  useEffect(() => {
    loadPageView();
  }, [loadPageView]);

  // Fetch client & appointment details
  const fetchAppOrClient = useCallback(async () => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    setIsLoading(true);
    try {
      const appRes = await appointmentService.getAppointmentById(cleanId);
      if (appRes && appRes.success && (appRes.appointment || appRes.data)) {
        const d = appRes.appointment || appRes.data;
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
      const clientRes = await clientService.getClientById(cleanId);
      if (clientRes && clientRes.success && (clientRes.client || clientRes.data)) {
        const c = clientRes.client || clientRes.data;
        setClientData(c);
      }
    } catch (e) {
      console.warn('Failed to load client for make-quotation:', e?.message);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAppOrClient();
  }, [fetchAppOrClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadPageView(), fetchAppOrClient()]);
    } catch (err) {
      console.warn('Refresh error in MakeQuotationScreen:', err?.message);
    } finally {
      setRefreshing(false);
    }
  };

  const app = useMemo(() => {
    if (clientData) return clientData;
    const cleanId = String(params.id || '').replace(/^DR/i, '').trim();
    return {
      id: cleanId,
      appointmentId: cleanId,
      customerId: cleanId,
      clientName: params.customerName || params.clientName || '',
      customerName: params.customerName || params.clientName || '',
      phone: params.phone || params.mobileNumber || '',
      mobileNumber: params.phone || params.mobileNumber || '',
    };
  }, [clientData, params.id, params.customerName, params.clientName, params.phone, params.mobileNumber]);

  // Helpers for dynamic specs & rates
  const getPackageKey = useCallback((packageOrTier) => {
    if (!packageOrTier) return 'economic';
    const q = String(packageOrTier).toLowerCase();
    if (q.includes('econom') || q.includes('basic') || q === '1') return 'economic';
    if (q.includes('premium') || q.includes('polyurethane') || q.includes('mid') || q === '2') return 'premium';
    if (q.includes('elite') || q.includes('polyurea') || q.includes('luxury') || q === '3') return 'elite';
    if (q.includes('none') || q.includes('single')) return 'none';
    return 'premium';
  }, []);

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
  }, [dynamicServicesMap, getPackageKey]);

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
  }, [dynamicServicesMap, getPackageKey]);

  const serviceOptions = useMemo(() => {
    const list = Object.keys(dynamicServicesMap);
    if (list.length > 0) return list;
    return ['Terrace Waterproofing', 'Bathroom Waterproofing'];
  }, [dynamicServicesMap]);

  const propertyOptions = useMemo(() => propertiesList.map((p) => p.name), [propertiesList]);

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
  }, [dynamicServicesMap, getPackageKey]);

  const quoteForOptions = useMemo(() => {
    const curTier = String(activeTier || 'premium').toLowerCase();

    if (packagesList.length > 0) {
      // 1. Respective packages for the active tier (using isTierMatch for economic/economy compatibility)
      const tierPkgs = packagesList.filter((p) => {
        if (!p) return false;
        return isTierMatch(p.tier, curTier)
          || isTierMatch(p.packages, curTier)
          || (isTierMatch(curTier, 'economic') && (p.packageId === 1 || p.packageId === 4))
          || (isTierMatch(curTier, 'premium') && (p.packageId === 2 || p.packageId === 5))
          || (isTierMatch(curTier, 'elite') && p.packageId === 3);
      });

      // 2. Packages belonging to "None" (which should be shown in all tiers)
      const nonePkgs = packagesList.filter((p) => {
        if (!p) return false;
        const pTier = String(p.tier || '').toLowerCase();
        const pPkg = String(p.packages || '').toLowerCase();
        return pTier === 'none' || pPkg === 'none';
      });

      const options = [];

      tierPkgs.forEach((p) => {
        const tierLabel = isTierMatch(p.packages || p.tier, 'economic')
          ? 'Economic'
          : (p.packages || (curTier.charAt(0).toUpperCase() + curTier.slice(1)));
        const rawName = (p.packageName || p.name || '').replace(/\s*\(\s*none\s*\)/gi, '').trim();
        const hasSuffix = rawName.toLowerCase().includes(`(${tierLabel.toLowerCase()})`);
        const label = (tierLabel && tierLabel.toLowerCase() !== 'none' && !hasSuffix)
          ? `${rawName} (${tierLabel})`
          : rawName;
        if (label && !options.includes(label)) options.push(label);
      });

      nonePkgs.forEach((p) => {
        const pName = p.packageName || p.name || '';
        if (pName) {
          const cleanName = pName.replace(/\s*\(\s*none\s*\)/gi, '').trim();
          if (cleanName && !options.includes(cleanName)) options.push(cleanName);
        }
      });

      if (options.length > 0) {
        return options;
      }
    }

    // Fallbacks if packagesList is not yet loaded
    if (isTierMatch(curTier, 'economic')) {
      return ['Acrylic Elastomeric Coating (Economic)'];
    }
    if (curTier === 'elite') {
      return ['Polyurethane based  Polyurea coating (Elite)'];
    }
    return ['Pure Flexible Polyurethane coating (Premium)'];
  }, [packagesList, activeTier]);

  // Helper to snapshot current active tier's form state
  const getCurrentTierSnapshot = useCallback(() => {
    return {
      tierId: activeTier,
      quotationDate,
      quoteFor,
      propertyType,
      siteArea,
      selectedServicesMap: { ...selectedServicesMap },
      servicesConfig: { ...servicesConfig },
      discountPercent,
      discountAmount,
      gstAdded,
      gstPercent,
      advancePercent,
      midPercent,
      finalPercent,
      validityText,
      negotiationNote,
      workStartNote,
      withRegards,
      subtotal,
      total,
    };
  }, [
    activeTier,
    quotationDate,
    quoteFor,
    propertyType,
    siteArea,
    selectedServicesMap,
    servicesConfig,
    discountPercent,
    discountAmount,
    gstAdded,
    gstPercent,
    advancePercent,
    midPercent,
    finalPercent,
    validityText,
    negotiationNote,
    workStartNote,
    withRegards,
    subtotal,
    total,
  ]);

  // Estimate / read total for a specific tier
  const getCalculatedTotalForTier = useCallback((tierId, drafts) => {
    if (tierId === activeTier) {
      return total;
    }
    if (drafts && drafts[tierId]?.total != null) {
      return drafts[tierId].total;
    }

    // Estimate based on active services & rates for tierId
    let sub = 0;
    Object.keys(selectedServicesMap).forEach((sName) => {
      if (selectedServicesMap[sName]) {
        const cfg = servicesConfig[sName] || {};
        const aVal = parseFloat(cfg.area || siteArea) || 0;
        const rVal = parseFloat(getDynamicRate(sName, tierId)) || 0;
        sub += aVal * rVal;
      }
    });
    const gstFactor = gstAdded ? (parseFloat(gstPercent) || 0) / 100 : 0;
    const tax = Math.round(sub * gstFactor);
    const baseWithGst = sub + tax;
    const discPct = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
    const discAmt = discPct > 0 ? (baseWithGst * discPct) / 100 : 0;
    return Math.max(0, baseWithGst - discAmt);
  }, [activeTier, total, selectedServicesMap, servicesConfig, siteArea, getDynamicRate, gstAdded, gstPercent, discountPercent]);

  // Handle Switching Tiers (Economic / Premium / Elite)
  const handleSelectTier = useCallback((tierId, force = false) => {
    Keyboard.dismiss();
    if (!force && tierId === activeTier) return;

    // Snapshot current active tier
    const curSnap = getCurrentTierSnapshot();
    setTierDraftsMap((prevDrafts) => {
      const updatedDrafts = { ...prevDrafts, [activeTier]: curSnap };
      const targetDraft = updatedDrafts[tierId];

      if (targetDraft) {
        // Restore target tier state
        setActiveTier(tierId);
        if (targetDraft.quotationDate) setQuotationDate(targetDraft.quotationDate);
        if (targetDraft.quoteFor) setQuoteFor(targetDraft.quoteFor);
        if (targetDraft.propertyType) setPropertyType(targetDraft.propertyType);
        if (targetDraft.selectedServicesMap) setSelectedServicesMap(targetDraft.selectedServicesMap);
        if (targetDraft.servicesConfig) setServicesConfig(targetDraft.servicesConfig);
        if (targetDraft.discountPercent !== undefined) setDiscountPercent(targetDraft.discountPercent);
        if (targetDraft.gstAdded !== undefined) setGstAdded(targetDraft.gstAdded);
        let dAdv = parseFloat(targetDraft.advancePercent);
        let dMid = parseFloat(targetDraft.midPercent);
        let dFin = parseFloat(targetDraft.finalPercent);
        if (isNaN(dAdv) || isNaN(dMid) || isNaN(dFin) || Math.abs((dAdv + dMid + dFin) - 100) > 0.5) {
          dAdv = 60;
          dMid = 30;
          dFin = 10;
        }
        setAdvancePercent(String(dAdv));
        setMidPercent(String(dMid));
        setFinalPercent(String(dFin));
        if (targetDraft.validityText) setValidityText(targetDraft.validityText);
        if (targetDraft.negotiationNote) setNegotiationNote(targetDraft.negotiationNote);
        if (targetDraft.workStartNote) setWorkStartNote(targetDraft.workStartNote);
        if (targetDraft.withRegards) setWithRegards(targetDraft.withRegards);
      } else {
        // First visit to tierId: carry over selected services & area, adapt rates & subtitles
        setActiveTier(tierId);

        const matchingPkg = packagesList.find((p) => {
          return isTierMatch(p.tier, tierId)
            || isTierMatch(p.packages, tierId)
            || (isTierMatch(tierId, 'economic') && (p.packageId === 1 || p.packageId === 4))
            || (isTierMatch(tierId, 'premium') && (p.packageId === 2 || p.packageId === 5))
            || (isTierMatch(tierId, 'elite') && p.packageId === 3);
        });

        let resolvedTitle = matchingPkg?.packageName || matchingPkg?.name;
        if (resolvedTitle) {
          const tierLabel = isTierMatch(matchingPkg?.packages || matchingPkg?.tier, 'economic')
            ? 'Economic'
            : (matchingPkg?.packages || (tierId.charAt(0).toUpperCase() + tierId.slice(1)));
          if (!resolvedTitle.toLowerCase().includes(tierLabel.toLowerCase())) {
            resolvedTitle = `${resolvedTitle} (${tierLabel})`;
          }
        }
        if (!resolvedTitle) {
          if (isTierMatch(tierId, 'economic')) resolvedTitle = 'Acrylic Elastomeric Coating (Economic)';
          else if (tierId === 'elite') resolvedTitle = 'Polyurethane based  Polyurea coating (Elite)';
          else resolvedTitle = 'Pure Flexible Polyurethane coating (Premium)';
        }
        setQuoteFor(resolvedTitle);

        setServicesConfig((prevCfg) => {
          const updated = { ...prevCfg };
          Object.keys(updated).forEach((sName) => {
            const availableSubs = getDynamicSubtitles(sName, tierId);
            const hasSubs = availableSubs.length > 0;
            const curSubtitle = updated[sName]?.selectedSubtitle;
            const matchedSub = (hasSubs && curSubtitle)
              ? availableSubs.find((s) => String(s.subtitle || '').toLowerCase() === String(curSubtitle).toLowerCase())
              : null;

            if (hasSubs) {
              const chosenSub = matchedSub
                || availableSubs.find((s) => String(s.subtitle || '').toLowerCase() === 'default')
                || availableSubs[0];

              if (chosenSub) {
                updated[sName] = {
                  ...updated[sName],
                  rate: String(chosenSub.rate ?? ''),
                  spec: chosenSub.description || '',
                  specs: [chosenSub.description || ''],
                  selectedSubtitle: chosenSub.subtitle,
                  serviceDetailId: chosenSub.serviceDetailId || null,
                  warranty: chosenSub.warranty || matchingPkg?.warranty || (isTierMatch(tierId, 'economic') ? '5 Years' : ''),
                };
              }
            } else {
              const dynRate = getDynamicRate(sName, tierId);
              const dynSpec = getDynamicSpec(sName, tierId);
              updated[sName] = {
                ...updated[sName],
                rate: dynRate,
                spec: dynSpec,
                specs: [dynSpec],
                selectedSubtitle: '',
                serviceDetailId: null,
                warranty: matchingPkg?.warranty || (isTierMatch(tierId, 'economic') ? '5 Years' : ''),
              };
            }
          });
          return updated;
        });
      }

      return updatedDrafts;
    });
  }, [
    activeTier,
    getCurrentTierSnapshot,
    packagesList,
    getDynamicRate,
    getDynamicSpec,
    getDynamicSubtitles,
  ]);

  // Handle selecting a subtitle variation within a service
  const handleSelectSubtitle = useCallback((serviceName, subItem) => {
    if (!serviceName || !subItem) return;
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
        },
      };
    });
  }, []);

  // Pre-seed form defaults once on mount or when customer appointment changes
  const formInitializedRef = useRef(false);
  useEffect(() => {
    if (formInitializedRef.current) return;
    formInitializedRef.current = true;

    setQuotationDate(getTodayFormatted());
    setValidityText(getValidityFormatted());

    const initialAreaVal = params.totalArea ? String(params.totalArea) : (app?.totalArea ? String(app.totalArea) : '');
    setSiteArea(initialAreaVal);

    // Determine initial tier from availableTiers and route params
    let initialTier = availableTiers[0] || 'premium';
    if (params.tier) {
      const t = String(params.tier).toLowerCase();
      if (t.includes('econom') || t.includes('basic') || t === '1') initialTier = 'economic';
      else if (t.includes('elite') || t.includes('luxury') || t === '3') initialTier = 'elite';
      else if (t.includes('premium') || t.includes('mid') || t === '2') initialTier = 'premium';
    }
    if (!availableTiers.includes(initialTier)) {
      initialTier = availableTiers[0] || 'premium';
    }
    handleSelectTier(initialTier);

    const assignedEmp = app?.assignedEmployeeName || app?.assignedEmployee?.name || app?.assignedTo || currentUser?.name;
    const defaultSignatory = assignedEmp
      ? (/^(mr\.|mrs\.|ms\.|dr\.)/i.test(String(assignedEmp).trim())
        ? String(assignedEmp).trim()
        : `Mr. ${String(assignedEmp).trim().toUpperCase()}`)
      : 'Mr. SRIRAM';
    setWithRegards(defaultSignatory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Update specific service fields
  const handleUpdateServiceField = (serviceName, field, value) => {
    setServicesConfig((prev) => {
      const subs = getDynamicSubtitles(serviceName, activeTier);
      const hasSubs = subs.length > 0;
      const defaultSub = hasSubs
        ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
        : null;
      const current = prev[serviceName] || {
        area: siteArea || '',
        rate: defaultSub ? String(defaultSub.rate ?? '') : (getDynamicRate(serviceName, activeTier) || '45'),
        spec: defaultSub ? (defaultSub.description || '') : getDynamicSpec(serviceName, activeTier),
        specs: defaultSub ? [defaultSub.description || ''] : [getDynamicSpec(serviceName, activeTier)],
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

  // Remove a service
  const handleRemoveService = (serviceName) => {
    setSelectedServicesMap((prev) => {
      const updated = { ...prev };
      delete updated[serviceName];
      return updated;
    });
  };

  // Apply services from bottom sheet modal
  const handleApplyServicesModal = (newSelectedMap) => {
    setSelectedServicesMap(newSelectedMap);
    setServicesConfig((prevCfg) => {
      const updated = { ...prevCfg };
      Object.keys(newSelectedMap).forEach((sName) => {
        if (newSelectedMap[sName] && !updated[sName]) {
          const subs = getDynamicSubtitles(sName, activeTier);
          const hasSubs = subs.length > 0;
          const defaultSub = hasSubs
            ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
            : null;
          const dynRate = defaultSub ? String(defaultSub.rate ?? '') : getDynamicRate(sName, activeTier);
          const dynSpec = defaultSub ? (defaultSub.description || '') : getDynamicSpec(sName, activeTier);
          updated[sName] = {
            area: siteArea || '',
            rate: dynRate || '',
            spec: dynSpec || '',
            specs: dynSpec ? [dynSpec] : [],
            selectedSubtitle: defaultSub ? (defaultSub.subtitle || '') : '',
            serviceDetailId: defaultSub ? defaultSub.serviceDetailId : null,
            warranty: defaultSub?.warranty || (isTierMatch(activeTier, 'economic') ? '5 Years' : ''),
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
        const aVal = parseFloat(cfg.area || siteArea) || 0;
        const rVal = parseFloat(cfg.rate || 0) || 0;
        sub += aVal * rVal;
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

  // Validate current form before saving / opening confirm popup
  const validateCurrentTier = useCallback(() => {
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

    if (!quoteFor || !quoteFor.trim() || quoteFor === '-select-') {
      showAlert('Validation Error', 'Please select a Quote Title.', 'warning');
      return false;
    }

    const activeServicesList = Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]);
    if (activeServicesList.length === 0) {
      showAlert('Validation Error', 'Please select at least one service to create a quotation.', 'warning');
      return false;
    }

    for (const sName of activeServicesList) {
      const cfg = servicesConfig[sName] || {};
      const subs = getDynamicSubtitles(sName, activeTier);
      if (subs.length > 0 && (!cfg.selectedSubtitle || !cfg.selectedSubtitle.trim())) {
        showAlert('Validation Error', `Please choose a variation / subtitle for "${sName}".`, 'warning');
        return false;
      }
      const aVal = parseFloat(cfg.area);
      const rVal = parseFloat(cfg.rate);
      if (isNaN(aVal) || aVal <= 0) {
        showAlert('Validation Error', `Area for "${sName}" must be greater than 0.`, 'warning');
        return false;
      }
      if (isNaN(rVal) || rVal <= 0) {
        showAlert('Validation Error', `Price / sq.ft for "${sName}" must be greater than 0.`, 'warning');
        return false;
      }
    }

    if (!validityText?.trim()) {
      showAlert('Validation Error', 'Quote Validity Date / Note is required.', 'warning');
      return false;
    }

    return true;
  }, [
    quotationDate,
    propertyType,
    quoteFor,
    selectedServicesMap,
    servicesConfig,
    activeTier,
    getDynamicSubtitles,
    validityText,
    showAlert,
  ]);

  // Construct backend API payload for a specific tier draft
  const buildApiPayloadForTier = useCallback((tierId, draft) => {
    const formatToApiDate = (dateStr) => {
      return toApiDateString(dateStr);
    };

    const targetPropType = draft?.propertyType || propertyType;
    const selectedProp = propertiesList.find((p) => {
      const pName = String(p.name || '').toLowerCase();
      const cur = String(targetPropType).toLowerCase();
      return pName === cur || (pName.includes('house') && cur.includes('house')) || (pName.includes('apartment') && cur.includes('apartment')) || (pName.includes('industr') && cur.includes('industr'));
    });
    const propertyId = Number(selectedProp?.id || selectedProp?.propertyId) || 1;

    const targetQuoteTitle = draft?.quoteFor || quoteFor;
    const selectedPkg = packagesList.find((p) => {
      if (!p) return false;
      const optLabelWithTier = `${p.packageName} (${p.packages || ''})`.toLowerCase();
      const pNameLower = String(p.packageName || '').toLowerCase();
      const qLower = String(targetQuoteTitle || '').toLowerCase();
      return (
        qLower === optLabelWithTier ||
        qLower === pNameLower ||
        qLower.includes(pNameLower) ||
        (qLower.includes('elastomeric') && pNameLower.includes('elastomeric'))
      );
    }) || packagesList.find((p) => {
      return isTierMatch(p.tier, tierId)
        || isTierMatch(p.packages, tierId)
        || (isTierMatch(tierId, 'economic') && (p.packageId === 1 || p.packageId === 4))
        || (isTierMatch(tierId, 'premium') && (p.packageId === 2 || p.packageId === 5))
        || (isTierMatch(tierId, 'elite') && p.packageId === 3);
    });
    const resolvedPkgId = Number(selectedPkg?.packageId || selectedPkg?.id) || (isTierMatch(tierId, 'economic') ? 1 : tierId === 'elite' ? 3 : 2);
    const warrantyVal = selectedPkg?.warranty || (isTierMatch(tierId, 'economic') ? '5 Years' : tierId === 'elite' ? '15 Years' : '10 Years');

    const draftServicesMap = draft?.selectedServicesMap || selectedServicesMap || {};
    const activeServicesList = Object.keys(draftServicesMap).filter((k) => draftServicesMap[k]);
    const quotationServicesRequest = activeServicesList.map((sName, idx) => {
      const cfg = draft?.servicesConfig?.[sName] || servicesConfig[sName] || {};
      const dynService = findServiceInMap(dynamicServicesMap, sName);

      const areaVal = parseFloat(cfg.area || draft?.siteArea || siteArea || 0);
      const rateVal = parseFloat(cfg.rate || 0);
      const sDetailId = cfg.serviceDetailId != null ? Number(cfg.serviceDetailId) : null;
      const sSubtitle = cfg.selectedSubtitle || cfg.subtitle || 'Default';
      const sDesc = cfg.spec || (Array.isArray(cfg.specs) && cfg.specs.length > 0 ? cfg.specs.join(', ') : 'Standard Treatment');
      const sWarranty = cfg.warranty || selectedPkg?.warranty || warrantyVal || '';

      return {
        serviceId: Number(dynService?.serviceId || idx + 1),
        serviceDetailId: sDetailId,
        title: sName,
        serviceName: sName,
        subtitle: sSubtitle,
        tierType: dynService?.tierType || 'MultiTier',
        description: sDesc,
        area: areaVal,
        rate: rateVal,
        totalPrice: Math.round(areaVal * rateVal),
        warranty: sWarranty,
      };
    });

    const tierSubtotal = draft?.subtotal || 0;

    const gstRate = parseFloat(draft?.gstPercent || 0);
    const isGstOn = Boolean(draft?.gstAdded);
    const gstAmount = isGstOn ? Math.round(tierSubtotal * (gstRate / 100)) : 0;
    const baseWithGst = tierSubtotal + (isGstOn ? gstAmount : 0);

    const discPct = Math.max(0, Math.min(100, parseFloat(draft?.discountPercent || 0)));
    const discAmt = discPct > 0 ? Math.round((baseWithGst * discPct) / 100) : 0;
    const calculatedTierTotal = Math.max(0, baseWithGst - discAmt);
    const tierTotal = draft?.total != null ? draft.total : calculatedTierTotal;
    const discountedSubtotal = Math.max(0, baseWithGst - discAmt);

    let advPct = parseFloat(draft?.advancePercent ?? advancePercent ?? 60);
    let midPct = parseFloat(draft?.midPercent ?? midPercent ?? 30);
    let finPct = parseFloat(draft?.finalPercent ?? finalPercent ?? 10);
    if (isNaN(advPct) || isNaN(midPct) || isNaN(finPct) || Math.abs((advPct + midPct + finPct) - 100) > 0.5) {
      advPct = 60;
      midPct = 30;
      finPct = 10;
    } else {
      finPct = Math.round((100 - advPct - midPct) * 100) / 100;
    }
    const advanceAmount = Math.round((tierTotal * advPct) / 100);
    const midCostAmount = Math.round((tierTotal * midPct) / 100);
    const finalAmountVal = Math.round(tierTotal - advanceAmount - midCostAmount);

    const empId = Number(currentUser?.id || currentUser?.employeeId || app?.assignedEmployeeId || app?.employeeId) || 2;
    const appId = Number(app?.appointmentId || app?.id || params.id) || null;
    const custId = Number(app?.customerId || app?.id || params.id) || appId;

    const quoteValidateDateVal = draft?.validityText?.trim() || validityText?.trim() || 'Quote Valid till 30 days';
    const negotiationVal = draft?.negotiationNote?.trim() || negotiationNote?.trim() || 'Nil';
    const workCommencementVal = draft?.workStartNote?.trim() || workStartNote?.trim() || 'Within 2 days of advance payment';
    const withRegardsVal = draft?.withRegards?.trim() || withRegards?.trim() || 'Mr. SRIRAM';

    const propNameVal = selectedProp?.name || targetPropType || 'House';
    const pkgNameVal = selectedPkg?.packageName || selectedPkg?.name || (isTierMatch(tierId, 'economic') ? 'Acrylic Elastomeric Coating' : 'Waterproofing Treatment');
    const pkgTierVal = selectedPkg?.packages && !isTierMatch(selectedPkg.packages, 'economic')
      ? selectedPkg.packages
      : (isTierMatch(tierId, 'economic') ? 'Economic' : tierId === 'elite' ? 'Elite' : 'Premium');

    const cgstAmountVal = Math.round(gstAmount / 2);
    const sgstAmountVal = gstAmount - cgstAmountVal;

    const gstPayloadFields = isGstOn
      ? {
        gstPercentage: gstRate,
        gstRate: gstRate,
        gstAmount,
        cgstPercentage: gstRate / 2,
        sgstPercentage: gstRate / 2,
        cgstAmount: cgstAmountVal,
        sgstAmount: sgstAmountVal,
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

    return {
      quotationDate: formatToApiDate(draft?.quotationDate || quotationDate),
      propertyId,
      propertyName: propNameVal,
      packageId: resolvedPkgId,
      quoteFor: resolvedPkgId,
      packageName: pkgNameVal,
      packageTier: pkgTierVal,
      appointmentId: appId,
      employeeId: empId,
      customerId: custId,
      withRegards: withRegardsVal,
      withRegardsName: withRegardsVal,
      isGst: isGstOn,
      gstAdded: isGstOn,
      services: quotationServicesRequest,
      advance: advanceAmount,
      midCost: midCostAmount,
      final: finalAmountVal,
      advancePercent: advPct,
      midPercent: midPct,
      finalPercent: finPct,
      paymentTerms: {
        advance: advPct,
        mid: midPct,
        final: finPct,
        validity: quoteValidateDateVal,
        negotiation: negotiationVal,
        workStart: workCommencementVal,
      },
      discount: discPct,
      discountPercentage: discPct,
      discountPercent: discPct,
      discountAmount: discAmt,
      subTotal: Math.round(tierSubtotal),
      totalAmount: Math.round(discountedSubtotal),
      grandTotal: Math.round(tierTotal),
      totalWithGst: Math.round(tierTotal),
      quoteValidateDate: quoteValidateDateVal,
      negotiation: negotiationVal,
      workCommencement: workCommencementVal,
      warranty: warrantyVal,
      revision: 1,
      isConfirmed: false,
      ...gstPayloadFields,
    };
  }, [
    quoteFor,
    propertyType,
    propertiesList,
    packagesList,
    selectedServicesMap,
    servicesConfig,
    siteArea,
    dynamicServicesMap,
    currentUser,
    app,
    params.id,
    validityText,
    negotiationNote,
    workStartNote,
    withRegards,
    quotationDate,
    advancePercent,
    midPercent,
    finalPercent,
  ]);

  // Transition to next tier after saving current draft
  const handleSaveAndNext = () => {
    Keyboard.dismiss();
    if (!validateCurrentTier()) return;

    const curSnap = getCurrentTierSnapshot();
    setTierDraftsMap((prev) => ({
      ...prev,
      [activeTier]: curSnap,
    }));

    const curIndex = availableTiers.indexOf(activeTier);
    if (curIndex >= 0 && curIndex < availableTiers.length - 1) {
      const nextT = availableTiers[curIndex + 1];
      handleSelectTier(nextT);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Open the "Confirm Quotation Tiers" bottom sheet popup
  const handleOpenConfirmModal = () => {
    Keyboard.dismiss();
    if (!validateCurrentTier()) return;

    const curSnap = getCurrentTierSnapshot();
    const updatedDrafts = {
      ...tierDraftsMap,
      [activeTier]: curSnap,
    };
    setTierDraftsMap(updatedDrafts);

    const totals = {};
    availableTiers.forEach((t) => {
      totals[t] = getCalculatedTotalForTier(t, updatedDrafts);
    });
    setTierTotalsMap(totals);
    setIsConfirmModalVisible(true);
  };

  // User confirmed selection in the popup -> Send SINGLE POST request with array of all selected quotation details
  const handleFinalConfirm = async (selectedTierIds) => {
    Keyboard.dismiss();
    if (!selectedTierIds || selectedTierIds.length === 0) {
      showAlert('Selection Required', 'Please select at least one quotation tier to confirm.', 'warning');
      return;
    }

    setIsSubmittingFinal(true);

    try {
      const curSnap = getCurrentTierSnapshot();
      const allDrafts = {
        ...tierDraftsMap,
        [activeTier]: curSnap,
      };

      // Build array of quotation payloads for all selected tiers
      const quotationPayloads = selectedTierIds.map((tId) => {
        let draft = allDrafts[tId];
        if (!draft) {
          const adaptedConfig = {};
          let tierSubtotalVal = 0;
          Object.keys(selectedServicesMap).forEach((sName) => {
            if (selectedServicesMap[sName]) {
              const curCfg = servicesConfig[sName] || {};
              const subs = getDynamicSubtitles(sName, tId);
              const defaultSub = Array.isArray(subs) && subs.length > 0
                ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
                : null;
              const rVal = parseFloat(defaultSub ? defaultSub.rate : getDynamicRate(sName, tId)) || 0;
              const aVal = parseFloat(curCfg.area || siteArea || 0);
              tierSubtotalVal += aVal * rVal;
              adaptedConfig[sName] = {
                ...curCfg,
                area: curCfg.area || siteArea || '0',
                rate: String(rVal),
                spec: defaultSub?.description || getDynamicSpec(sName, tId),
                selectedSubtitle: defaultSub?.subtitle || curCfg.selectedSubtitle || 'Default',
                serviceDetailId: defaultSub ? defaultSub.serviceDetailId : (curCfg.serviceDetailId || null),
                warranty: defaultSub?.warranty || curCfg.warranty || '',
              };
            }
          });
          const tierTotalVal = tierTotalsMap[tId] || getCalculatedTotalForTier(tId, allDrafts);
          draft = {
            ...curSnap,
            tierId: tId,
            servicesConfig: adaptedConfig,
            subtotal: tierSubtotalVal,
            total: tierTotalVal,
          };
        }

        return buildApiPayloadForTier(tId, draft);
      });

      // Send in a SINGLE POST request as an array of all quotation details
      const res = await quotationService.createQuotation(quotationPayloads);

      if (res && res.success) {
        setIsConfirmModalVisible(false);
        const targetCustomerId = String(app?.customerId || app?.id || app?.appointmentId || params.id);

        router.replace({
          pathname: '/customer-detail',
          params: {
            id: targetCustomerId,
            initialTab: 'quotation',
            tab: 'quotation',
          },
        });
        return;
      }

      showAlert('Save Failed', res?.message || 'Failed to save quotations on server. Please try again.', 'error');
    } catch (e) {
      showAlert('Error', e?.message || 'Unexpected network error during quotation creation.', 'error');
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  if (isLoading && !app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialFormSkeleton headerTitle="Make Quotation" />
      </View>
    );
  }

  const rawClientName = app?.customerName || app?.clientName || app?.name || clientData?.customerName || '';
  const customerInitial = (() => {
    const cleaned = rawClientName.replace(/^(mr\.|mrs\.|ms\.|dr\.)\s+/i, '').trim();
    return (cleaned || rawClientName).slice(0, 2).toUpperCase() || 'MR';
  })();
  const displayName = rawClientName ? `${rawClientName.trim()}` : `Customer #${params.id || ''}`;
  const displayId = `DR${app?.customerId || app?.appointmentId || app?.id || params.id || ''}`.replace(/^DRDR/i, 'DR');
  const displayPhone = app?.mobileNumber || app?.phone || 'N/A';

  const selectedServicesCount = Object.keys(selectedServicesMap).filter((k) => selectedServicesMap[k]).length;
  const currentTierIndex = availableTiers.indexOf(activeTier);
  const hasNextTier = currentTierIndex >= 0 && currentTierIndex < availableTiers.length - 1;
  const nextTier = hasNextTier ? availableTiers[currentTierIndex + 1] : null;
  const nextTierLabel = nextTier ? (nextTier.charAt(0).toUpperCase() + nextTier.slice(1)) : '';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Primary Blue Top Header */}
      <InnerHeader title="Make Quotation" paddingTop={insets.top} isDark={isDark} />

      {/* Main Content */}
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
        {/* Customer Banner (Stitch Design) */}
        <QuotationCustomerBanner
          displayName={displayName}
          customerInitial={customerInitial}
          displayId={displayId}
          displayPhone={displayPhone}
          status="Active"
          isDark={isDark}
        />

        {/* Tier Switcher Segmented Control (Filtered by user choice) */}
        <QuotationTierSwitcher
          activeTier={activeTier}
          availableTiers={availableTiers}
          onSelectTier={handleSelectTier}
          isDark={isDark}
        />

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
                setQuoteForDropdownOpen(false);
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

          {/* Quote Title Dropdown */}
          <View style={[styles.inputGroup, { marginBottom: 2 }]}>
            <Text style={[styles.inputLabel, isDark && styles.labelDark]}>Quote Title</Text>
            <TouchableOpacity
              style={[styles.dropdownHeader, isDark && styles.inputFieldWrapDark, !quoteFor && styles.dropdownHeaderUnselected]}
              onPress={() => {
                setQuoteForDropdownOpen(!quoteForDropdownOpen);
                setPropertyDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dropdownHeaderText,
                  isDark && styles.textDark,
                  !quoteFor && (isDark ? styles.subtextDark : styles.placeholderText),
                ]}
                numberOfLines={1}
              >
                {quoteFor || 'Select Quote Title'}
              </Text>
              <Ionicons
                name={quoteForDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>

            {quoteForDropdownOpen && (
              <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
                {quoteForOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.dropdownItem,
                      isDark && styles.dropdownItemDark,
                      quoteFor === opt && { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
                    ]}
                    onPress={() => {
                      setQuoteFor(opt);
                      setQuoteForDropdownOpen(false);
                      const optLower = String(opt).toLowerCase();
                      if (optLower.includes('econom') && availableTiers.includes('economic')) {
                        handleSelectTier('economic');
                      } else if (optLower.includes('premium') && availableTiers.includes('premium')) {
                        handleSelectTier('premium');
                      } else if (optLower.includes('elite') && availableTiers.includes('elite')) {
                        handleSelectTier('elite');
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isDark && styles.textDark,
                        quoteFor === opt && { color: '#2563EB', fontWeight: '700' },
                      ]}
                    >
                      {opt}
                    </Text>
                    {quoteFor === opt && (
                      <Ionicons name="checkmark" size={16} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
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

          {/* Empty state prompt when no services are selected */}
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

          {/* Quick List of Active Services */}
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
          const subs = getDynamicSubtitles(serviceName, activeTier);
          const hasSubs = subs.length > 0;
          const defaultSub = hasSubs
            ? (subs.find((s) => String(s.subtitle || '').toLowerCase() === 'default') || subs[0])
            : null;
          const cfg = servicesConfig[serviceName] || {
            area: siteArea || '',
            rate: defaultSub ? String(defaultSub.rate ?? '') : (getDynamicRate(serviceName, activeTier) || '42'),
            spec: defaultSub ? (defaultSub.description || '') : getDynamicSpec(serviceName, activeTier),
            selectedSubtitle: defaultSub ? (defaultSub.subtitle || '') : '',
          };

          return (
            <ServiceConfigCard
              key={serviceName}
              serviceName={serviceName}
              index={index}
              area={cfg.area}
              rate={cfg.rate}
              spec={cfg.spec}
              tierLabel={activeTier.toUpperCase()}
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

        {/* Bottom Action CTAs */}
        {hasNextTier ? (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              Keyboard.dismiss();
              handleSaveAndNext();
            }}
            disabled={isSubmittingFinal}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>
              {`Save & Next: ${nextTierLabel}`}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              Keyboard.dismiss();
              handleOpenConfirmModal();
            }}
            disabled={isSubmittingFinal}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Confirm & Proceed</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
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

      {/* Confirm Quotation Tiers Popup Modal */}
      <ConfirmQuotationTiersModal
        visible={isConfirmModalVisible}
        availableTiers={availableTiers}
        tierTotals={tierTotalsMap}
        onClose={() => setIsConfirmModalVisible(false)}
        onConfirm={handleFinalConfirm}
        isSubmitting={isSubmittingFinal}
        isDark={isDark}
      />

      {/* Overlay Loading Modal */}
      <MaterialOverlayLoader
        visible={isSubmittingFinal}
        title="Saving Quotations..."
        subtitle="Finalizing quotation & saving selected tiers to server"
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
    borderColor: '#3B82F6',
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
  saveBtn: {
    backgroundColor: '#2B59A2',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomButtonsContainer: {
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
  },
  secondaryConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryConfirmBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  secondaryConfirmBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2563EB',
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
