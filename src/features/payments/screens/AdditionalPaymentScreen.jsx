import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { useTabBar } from '../../../core/context/TabBarContext';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { quotationPaymentRepository } from '../api/quotationPaymentRepository';
import { extractApiErrorMessage } from '../../../core/api/apiClient';

/**
 * Tier matching helper from MakeQuotationScreen
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
 * Extracts a normalized tier label ('Economic' | 'Premium' | 'Elite' | null) from a
 * quotation object. Mirrors the tier-detection logic used in CustomerDetailScreen's
 * getQuoteTierCategory, so a confirmed quotation's tier is read the same way everywhere.
 */
const getQuoteTierLabel = (quote) => {
  if (!quote) return null;
  const pkgId = quote.packageId != null ? Number(quote.packageId) : null;
  if (pkgId === 3) return 'Elite';
  if (pkgId === 2) return 'Premium';
  if (pkgId === 1) return 'Economic';

  const pkg = String(
    quote.tier || quote.packages || quote.packageName || quote.quoteFor || quote.tierName || quote.service || ''
  ).toLowerCase().trim();
  if (pkg === '3' || pkg.includes('elite') || pkg.includes('luxury') || pkg.includes('polyurea')) return 'Elite';
  if (pkg === '2' || pkg.includes('premium') || pkg.includes('polyurethane')) return 'Premium';
  if (pkg === '1' || pkg.includes('econom')) return 'Economic';
  return null;
};



export default function AdditionalPaymentScreen() {
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

  const [client, setClient] = useState(null);

  const [area, setArea] = useState(params.area ? String(params.area) : (params.sqft ? String(params.sqft) : ''));
  const [rate, setRate] = useState(params.rate ? String(params.rate) : '');
  const [warranty, setWarranty] = useState(params.warranty || '');
  const [notes, setNotes] = useState(params.notes || '');
  const [paymentAmount, setPaymentAmount] = useState(params.amount != null && params.amount !== '' ? String(params.amount) : (params.totalPrice != null ? String(params.totalPrice) : ''));

  // Canonical Quotation ID & Payment Summary State
  const [quotationId, setQuotationId] = useState(params.quotationId || null);
  const [summaryData, setSummaryData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dedicated API v2 Options: GET /api/v2/quotations/:id/services/options
  const [apiServiceOptions, setApiServiceOptions] = useState([]);
  const [apiTier, setApiTier] = useState(null);
  const [selectedOptionItem, setSelectedOptionItem] = useState(null);
  const [mode, setMode] = useState('add'); // 'add' | 'replace'

  const [userSelectedPackage, setUserSelectedPackage] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [subtitleDropdownOpen, setSubtitleDropdownOpen] = useState(false);

  // Package Type Options
  const packageTypeOptions = useMemo(() => [
    { label: 'Economic', tier: 'economic', warranty: '5 Years' },
    { label: 'Premium', tier: 'premium', warranty: '10 Years' },
    { label: 'Elite', tier: 'elite', warranty: '12 Years' },
  ], []);

  // The quotation that's confirmed/locked for this appointment (if any). Once a
  // quotation is confirmed, additional services must be added against that same
  // package tier only — no other tier should be selectable.
  const confirmedQuote = useMemo(() => {
    if (!client) return null;
    const quotes = Array.isArray(client.quotations) ? client.quotations : [];
    return (
      quotes.find(
        (q) =>
          q.isConfirmed ||
          q.status === 'CONFIRMED' ||
          (client.confirmedQuoteId != null && String(q.id) === String(client.confirmedQuoteId))
      ) || null
    );
  }, [client]);

  const targetQuoteId = quotationId || client?.confirmedQuoteId || client?.activeQuotationId;

  // Load additional service options from dedicated API v2: GET /api/v2/quotations/:id/services/options
  useEffect(() => {
    if (!targetQuoteId) return;
    let isMounted = true;
    quotationPaymentRepository
      .getAdditionalServiceOptions(targetQuoteId)
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && Array.isArray(res.services) && res.services.length > 0) {
          setApiServiceOptions(res.services);
          if (res.tier) {
            setApiTier(res.tier);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load additional service options:', err?.message || err);
      });
    return () => {
      isMounted = false;
    };
  }, [targetQuoteId]);

  const confirmedTierLabel = useMemo(() => {
    if (apiTier) {
      if (/^econom/i.test(apiTier)) return 'Economic';
      if (/^prem/i.test(apiTier)) return 'Premium';
      if (/^elit/i.test(apiTier)) return 'Elite';
      return apiTier;
    }
    return getQuoteTierLabel(confirmedQuote);
  }, [apiTier, confirmedQuote]);

  // The Package Type option matching the confirmed quotation's tier, if any.
  // When this is set, the Package Type selector is locked to it.
  const lockedPackage = useMemo(() => {
    if (!confirmedTierLabel) return null;
    if (packageTypeOptions.length > 0) {
      const match = packageTypeOptions.find(
        (opt) => isTierMatch(opt.tier, confirmedTierLabel) || isTierMatch(opt.label, confirmedTierLabel)
      );
      if (match) return match;
    }
    return {
      label: confirmedTierLabel,
      tier: confirmedTierLabel.toLowerCase(),
      warranty: confirmedTierLabel === 'Economic' ? '5 Years' : (confirmedTierLabel === 'Premium' ? '10 Years' : '12 Years'),
    };
  }, [confirmedTierLabel, packageTypeOptions]);

  const isPackageLocked = Boolean(lockedPackage);

  // Active / selected package (derives from user selection or client appointment tier).
  // A confirmed quotation's tier always wins — it can't be overridden by picking
  // a different package for additional services.
  const selectedPackage = useMemo(() => {
    if (lockedPackage) return lockedPackage;
    if (userSelectedPackage) return userSelectedPackage;
    const existingTier = client?.package || client?.tier || params.tier || params.package;
    if (existingTier && packageTypeOptions.length > 0) {
      const match = packageTypeOptions.find(
        (opt) => isTierMatch(opt.tier, existingTier) || isTierMatch(opt.label, existingTier)
      );
      if (match) return match;
    }
    return packageTypeOptions[0] || null;
  }, [lockedPackage, userSelectedPackage, client, params, packageTypeOptions]);

  // Dynamic Service Options:
  // Primary source: Dedicated API v2 options (GET /api/v2/quotations/:id/services/options)
  // Fallback: Page-view dynamicServicesMap
  const serviceTypeOptions = useMemo(() => {
    if (apiServiceOptions.length > 0) {
      const groups = new Map();
      apiServiceOptions.forEach((item) => {
        const key = item.serviceId != null ? item.serviceId : item.serviceName;
        if (!groups.has(key)) {
          groups.set(key, {
            label: item.serviceName,
            serviceName: item.serviceName,
            serviceId: item.serviceId,
            tierType: item.tierType,
            items: [],
            hasAlreadyAdded: false,
          });
        }
        const group = groups.get(key);
        group.items.push(item);
        if (item.alreadyAdded) {
          group.hasAlreadyAdded = true;
        }
      });

      return Array.from(groups.values()).map((g) => {
        const first = g.items[0];
        return {
          label: g.serviceName,
          serviceName: g.serviceName,
          serviceId: g.serviceId,
          tierType: g.tierType,
          rate: first?.rate || 0,
          rateStr: String(first?.rate || 0),
          warranty: first?.warranty || '',
          items: g.items,
          hasAlreadyAdded: g.hasAlreadyAdded,
        };
      });
    }

    return [];
  }, [apiServiceOptions]);

  // Available subtitles / variations for active service
  const subtitleOptions = useMemo(() => {
    if (selectedService?.items && Array.isArray(selectedService.items)) {
      return selectedService.items;
    }
    return [];
  }, [selectedService]);

  // Load payment summary for quotation (API v2 /api/v2/quotation-payments/:id)
  useEffect(() => {
    if (!quotationId) return;
    let isMounted = true;
    quotationPaymentRepository.getPaymentSummary(quotationId).then((res) => {
      if (!isMounted) return;
      if (res?.success && res.data) {
        setSummaryData(res.data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [quotationId]);

  useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        const appt = res.appointment;
        setClient(appt);
        if (!quotationId && !params.quotationId) {
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
            setClient(clientData);
            if (!quotationId && !params.quotationId) {
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
  }, [params.id, params.quotationId, quotationId]);

  const handleAreaChange = (val) => {
    setArea(val);
    const numA = parseFloat(val) || 0;
    const numR = parseFloat(rate) || 0;
    const calculated = Math.round(numA * numR);
    setPaymentAmount(calculated > 0 ? String(calculated) : '');
  };

  const handleRateChange = (val) => {
    setRate(val);
    const numA = parseFloat(area) || 0;
    const numR = parseFloat(val) || 0;
    const calculated = Math.round(numA * numR);
    setPaymentAmount(calculated > 0 ? String(calculated) : '');
  };

  const handleSelectSubtitle = (subItem) => {
    if (!subItem) return;
    setSelectedOptionItem(subItem);
    setSelectedSubtitle(subItem);
    setSubtitleDropdownOpen(false);

    if (subItem.rate != null && subItem.rate !== '') {
      handleRateChange(String(subItem.rate));
    }
    if (subItem.warranty) {
      setWarranty(subItem.warranty);
    }
    if (subItem.description && !notes) {
      setNotes(subItem.description);
    }
    setMode('add');
  };

  const numArea = parseFloat(area) || 0;
  const numRate = parseFloat(rate) || 0;
  const calculatedBase = Math.round(numArea * numRate);

  const isAlreadyAdded = Boolean(selectedOptionItem?.alreadyAdded || selectedOptionItem?.existingService);
  const existingService = selectedOptionItem?.existingService || null;

  const rawClientName = client?.clientName || client?.name || client?.customerName || params.clientName || params.customerName || '';
  const displayName = rawClientName.trim() ? `${rawClientName.trim()}` : '';
  const rawId = client?.id || params.id || '';
  const displayId = rawId ? `DR${rawId}` : '';
  const displayPhone = client?.phone || client?.mobile || client?.mobileNumber || params.phone || '';
  const displayArea = client?.area || client?.location || client?.city || params.area || '';

  const initials = (displayName || 'CU')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'CU';

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Derive title from selected service; fall back to a generic label
    const trimmedTitle = (
      selectedService?.serviceName ||
      selectedService?.label ||
      selectedSubtitle?.subtitle ||
      'Additional Service'
    ).trim();

    const cleanAmtStr = String(paymentAmount ?? '').trim().replace(/[^0-9.]/g, '');
    const numericAmt = parseFloat(cleanAmtStr) || 0;
    const numArea = parseFloat(area) || 0;
    const numRate = parseFloat(rate) || 0;

    // Backend rule:
    // totalPrice is optional if sqft and rate are supplied.
    // If totalPrice is supplied, must be greater than 0.
    if (numericAmt <= 0 && (numArea <= 0 || numRate <= 0)) {
      Alert.alert('Invalid Price', 'Please provide either square feet and rate, or a total price greater than 0.');
      return;
    }

    // Backend Guard checks
    if (summaryData && summaryData.isConfirmed === false) {
      Alert.alert(
        'Quotation Not Confirmed',
        'Additional services can only be added once this customer\'s quotation has been confirmed. Please confirm the quotation first.'
      );
      return;
    }

    if (summaryData && summaryData.hasUnverifiedPayments === true) {
      Alert.alert(
        'Unverified Payments Pending',
        'Cannot add additional services while prior payments are pending Admin verification. Please verify previous payments first.'
      );
      return;
    }

    const targetQuoteId = quotationId || client?.confirmedQuoteId || client?.activeQuotationId;
    if (!targetQuoteId) {
      Alert.alert('Missing Quotation', 'Could not find a valid quotation ID to attach the additional service.');
      return;
    }

    /** @type {import('../types/quotationPaymentTypes').AddAdditionalServiceRequest} */
    // Determine whether we have a master-data service selected (serviceId present)
    const masterServiceId = selectedOptionItem?.serviceId
      ? Number(selectedOptionItem.serviceId)
      : (selectedService?.serviceId ? Number(selectedService.serviceId) : null);

    // serviceDetailId comes from the selected option / subtitle
    const masterServiceDetailId = selectedOptionItem?.serviceDetailId != null
      ? Number(selectedOptionItem.serviceDetailId)
      : (selectedSubtitle?.serviceDetailId != null
        ? Number(selectedSubtitle.serviceDetailId)
        : (selectedSubtitle?.id ? Number(selectedSubtitle.id) : null));

    if (masterServiceId) {
      // ── New endpoint: POST /api/v2/quotations/:id/services ──
      const masterPayload = {
        serviceId: masterServiceId,
        ...(masterServiceDetailId ? { serviceDetailId: masterServiceDetailId } : {}),
        area: numArea > 0 ? numArea : 0,
        rate: numRate > 0 ? numRate : 0,
        ...(notes.trim() ? { description: notes.trim() } : {}),
        ...(isAlreadyAdded ? { mode } : {}),
      };

      setIsSubmitting(true);
      try {
        const createRes = await quotationPaymentRepository.addServiceFromExisting(targetQuoteId, masterPayload);
        if (!createRes?.success) {
          throw new Error(createRes?.message || 'Could not add service.');
        }
        const isUpdated = Boolean(
          createRes.isUpdated ||
          (isAlreadyAdded && mode === 'replace') ||
          createRes.message?.toLowerCase().includes('updated')
        );
        Alert.alert(
          isUpdated ? 'Service Updated' : 'Service Added',
          createRes.message || `Successfully ${isUpdated ? 'updated' : 'added'} "${trimmedTitle}" in quotation #${targetQuoteId}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace({
                    pathname: '/customer-detail',
                    params: { id: client?.id || params.id, initialTab: 'quotation' },
                  });
                }
              },
            },
          ]
        );
      } catch (err) {
        const displayMsg = extractApiErrorMessage(err, 'Could not add service. Please try again.');
        Alert.alert('Addition Failed', displayMsg);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Free-text fallback: POST /api/v2/quotation-payments/:id/additional-services ──
    const payload = {
      title: trimmedTitle,
      sqft: numArea >= 0 ? numArea : 0,
      rate: numRate >= 0 ? numRate : 0,
      ...(numericAmt > 0 ? { totalPrice: numericAmt } : {}),
      warranty: warranty.trim() ? warranty.trim() : '0',
      notes: notes.trim() ? notes.trim() : null,
      ...(selectedPackage?.label ? { packageType: selectedPackage.label } : {}),
      ...(selectedService?.label ? { serviceType: selectedService.label } : {}),
      ...(selectedSubtitle?.subtitle ? { subtitle: selectedSubtitle.subtitle } : {}),
    };

    setIsSubmitting(true);

    try {
      const createRes = await quotationPaymentRepository.addAdditionalService(targetQuoteId, payload);
      if (!createRes?.success) {
        throw new Error(createRes?.message || 'Could not add additional service.');
      }

      // Update local appointment cache so the new service is immediately reflected
      const appId = client?.id || params.id;
      if (appId) {
        try {
          const newService = createRes?.data?.additionalService || createRes?.data || {};
          const additionalRecord = {
            id: newService.id || Date.now(),
            quotationId: targetQuoteId,
            type: 'additional',
            title: trimmedTitle,
            packageType: selectedPackage?.label || null,
            serviceType: selectedService?.label || null,
            subtitle: selectedSubtitle?.subtitle || null,
            area: numArea,
            sqft: numArea,
            rate: numRate,
            warranty: warranty.trim() || '0',
            notes: notes.trim() || null,
            totalPrice: newService.totalPrice || numericAmt,
            amount: newService.totalPrice || numericAmt,
            createdAt: newService.createdAt || new Date().toISOString(),
          };
          const currentAdditionals = client?.additionalPayments || client?.additionalServices || [];
          await appointmentRepository.updateAppointment(appId, {
            additionalPayments: [...currentAdditionals, additionalRecord],
            additionalServices: [...currentAdditionals, additionalRecord],
          });
        } catch (_e) {
          // non-blocking cache update
        }
      }

      Alert.alert(
        'Additional Service Added',
        `Successfully added "${trimmedTitle}" to quotation #${targetQuoteId}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace({
                  pathname: '/customer-detail',
                  params: { id: client?.id || params.id, initialTab: 'quotation' },
                });
              }
            },
          },
        ]
      );
    } catch (err) {
      const displayMsg = extractApiErrorMessage(err, 'Could not add additional service. Please try again.');
      Alert.alert('Addition Failed', displayMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Additional Service</Text>
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
              {displayName}
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
        {/* 1. Package Type Dropdown */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Package Type
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              isDark && styles.dropdownTriggerDark,
              packageDropdownOpen && styles.dropdownTriggerActive,
              isPackageLocked && { opacity: 0.7 },
            ]}
            onPress={() => {
              if (isPackageLocked) {
                Alert.alert(
                  'Package Type Locked',
                  `This customer's quotation is confirmed under the ${lockedPackage.label} package. Additional services must be added under the same package.`
                );
                return;
              }
              Keyboard.dismiss();
              setPackageDropdownOpen((prev) => !prev);
              setServiceDropdownOpen(false);
            }}
            activeOpacity={isPackageLocked ? 1 : 0.8}
          >
            <View style={styles.dropdownTriggerLeft}>
              <Ionicons
                name={isPackageLocked ? 'lock-closed' : 'cube-outline'}
                size={18}
                color={selectedPackage ? '#2563EB' : (isDark ? '#94A3B8' : '#64748B')}
                style={{ marginRight: 10 }}
              />
              <Text
                style={[
                  styles.dropdownTriggerText,
                  isDark && styles.textDark,
                  !selectedPackage && (isDark ? styles.subtextDark : styles.placeholderText),
                ]}
                numberOfLines={1}
              >
                {selectedPackage ? selectedPackage.label : 'Select Package Type'}
              </Text>
            </View>
            {!isPackageLocked && (
              <Ionicons
                name={packageDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
            )}
          </TouchableOpacity>
          {isPackageLocked && (
            <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
              Locked to the confirmed quotation&apos;s package tier.
            </Text>
          )}

          {packageDropdownOpen && !isPackageLocked && (
            <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 200 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {packageTypeOptions.map((opt) => {
                  const isSelected = selectedPackage?.label === opt.label;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.dropdownMenuItem,
                        isDark && styles.dropdownMenuItemDark,
                        isSelected && (isDark ? styles.dropdownMenuItemSelectedDark : styles.dropdownMenuItemSelected),
                      ]}
                      onPress={() => {
                        setUserSelectedPackage(opt);
                        setPackageDropdownOpen(false);
                        setSubtitleDropdownOpen(false);
                        if (opt.warranty && !warranty) {
                          setWarranty(opt.warranty);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          isDark && styles.textDark,
                          isSelected && { color: '#2563EB', fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 2. Service Type Dropdown */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Service Type
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              isDark && styles.dropdownTriggerDark,
              serviceDropdownOpen && styles.dropdownTriggerActive,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setServiceDropdownOpen((prev) => !prev);
              setPackageDropdownOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownTriggerLeft}>
              <Ionicons
                name="construct-outline"
                size={18}
                color={selectedService ? '#2563EB' : (isDark ? '#94A3B8' : '#64748B')}
                style={{ marginRight: 10 }}
              />
              <Text
                style={[
                  styles.dropdownTriggerText,
                  isDark && styles.textDark,
                  !selectedService && (isDark ? styles.subtextDark : styles.placeholderText),
                ]}
                numberOfLines={1}
              >
                {selectedService ? selectedService.label : 'Select Service Type'}
              </Text>
            </View>
            <Ionicons
              name={serviceDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>

          {serviceDropdownOpen && (
            <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 220 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {serviceTypeOptions.map((opt) => {
                  const isSelected = selectedService?.label === opt.label;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.dropdownMenuItem,
                        isDark && styles.dropdownMenuItemDark,
                        isSelected && (isDark ? styles.dropdownMenuItemSelectedDark : styles.dropdownMenuItemSelected),
                      ]}
                      onPress={() => {
                        setSelectedService(opt);
                        setServiceDropdownOpen(false);
                        setPackageDropdownOpen(false);
                        setSubtitleDropdownOpen(false);

                        // Select chosen item from API v2 /services/options
                        if (opt.items && Array.isArray(opt.items) && opt.items.length > 0) {
                          const chosenItem =
                            opt.items.find((it) => String(it.subtitle || '').toLowerCase() === 'default') ||
                            opt.items[0];
                          setSelectedOptionItem(chosenItem);
                          setSelectedSubtitle(chosenItem);

                          if (chosenItem) {
                            if (chosenItem.rate != null && chosenItem.rate !== '') {
                              handleRateChange(String(chosenItem.rate));
                            }
                            if (chosenItem.warranty) {
                              setWarranty(chosenItem.warranty);
                            }
                            if (chosenItem.description && !notes) {
                              setNotes(chosenItem.description);
                            }
                            setMode('add');
                          }
                        }
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={[
                              styles.dropdownMenuItemText,
                              isDark && styles.textDark,
                              isSelected && { color: '#2563EB', fontWeight: '700' },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {opt.hasAlreadyAdded && (
                            <View style={styles.alreadyAddedBadge}>
                              <Text style={styles.alreadyAddedBadgeText}>In Quote</Text>
                            </View>
                          )}
                        </View>
                        {opt.rateStr && opt.rateStr !== '0' ? (
                          <Text style={[styles.dropdownMenuItemSubtext, isDark && styles.subtextDark]}>
                            ₹{opt.rateStr}/sq.ft {opt.warranty ? `• ${opt.warranty}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 3. Subtitle / Variation Dropdown (shown when subtitles exist for selected service) */}
        {subtitleOptions.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Variation / Subtitle
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                isDark && styles.dropdownTriggerDark,
                subtitleDropdownOpen && styles.dropdownTriggerActive,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setSubtitleDropdownOpen((prev) => !prev);
                setPackageDropdownOpen(false);
                setServiceDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownTriggerLeft}>
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={selectedSubtitle ? '#2563EB' : (isDark ? '#94A3B8' : '#64748B')}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    isDark && styles.textDark,
                    !selectedSubtitle && (isDark ? styles.subtextDark : styles.placeholderText),
                  ]}
                  numberOfLines={1}
                >
                  {selectedSubtitle
                    ? `${selectedSubtitle.subtitle || 'Default'}${selectedSubtitle.rate != null ? ` (₹${selectedSubtitle.rate}/sq.ft)` : ''}`
                    : 'Select Subtitle / Variation'}
                </Text>
              </View>
              <Ionicons
                name={subtitleDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>

            {subtitleDropdownOpen && (
              <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 220 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  {subtitleOptions.map((subItem, idx) => {
                    const isSelected =
                      (selectedOptionItem && subItem.serviceDetailId != null && selectedOptionItem.serviceDetailId === subItem.serviceDetailId) ||
                      (selectedSubtitle?.subtitle &&
                        String(selectedSubtitle.subtitle).toLowerCase() === String(subItem.subtitle || '').toLowerCase());
                    const subTitle = subItem.subtitle || `Variation #${idx + 1}`;
                    const isItemAlreadyAdded = Boolean(subItem.alreadyAdded || subItem.existingService);
                    return (
                      <TouchableOpacity
                        key={String(subItem.serviceDetailId || subTitle + idx)}
                        style={[
                          styles.dropdownMenuItem,
                          isDark && styles.dropdownMenuItemDark,
                          isSelected && (isDark ? styles.dropdownMenuItemSelectedDark : styles.dropdownMenuItemSelected),
                        ]}
                        onPress={() => handleSelectSubtitle(subItem)}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text
                              style={[
                                styles.dropdownMenuItemText,
                                isDark && styles.textDark,
                                isSelected && { color: '#2563EB', fontWeight: '700' },
                              ]}
                            >
                              {subTitle}
                            </Text>
                            {isItemAlreadyAdded && (
                              <View style={styles.alreadyAddedBadge}>
                                <Text style={styles.alreadyAddedBadgeText}>In Quote</Text>
                              </View>
                            )}
                          </View>
                          {subItem.rate != null && (
                            <Text style={[styles.dropdownMenuItemSubtext, isDark && styles.subtextDark]}>
                              ₹{subItem.rate}/sq.ft {subItem.warranty ? `• ${subItem.warranty}` : ''}
                              {isItemAlreadyAdded && subItem.existingService?.area ? ` • Current: ${subItem.existingService.area} sq.ft` : ''}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Existing Service Notification & Mode Selection Card */}
        {isAlreadyAdded && (
          <View style={[styles.existingServiceCard, isDark && styles.existingServiceCardDark]}>
            <View style={styles.existingServiceHeader}>
              <Ionicons name="alert-circle" size={20} color="#D97706" />
              <Text style={[styles.existingServiceTitle, isDark && { color: '#FCD34D' }]}>
                Service Already in Quotation
              </Text>
            </View>

            <Text style={[styles.existingServiceDesc, isDark && { color: '#FDE68A' }]}>
              This service is already part of this quotation with an area of{' '}
              <Text style={{ fontWeight: '700' }}>{existingService?.area || 0} sq.ft</Text>
              {existingService?.rate ? ` @ ₹${existingService.rate}/sq.ft` : ''}
              {existingService?.amount ? ` (Total: ₹${Number(existingService.amount).toLocaleString()})` : ''}.
            </Text>

            <Text style={[styles.modeSelectLabel, isDark && { color: '#FCD34D' }]}>
              Select Update Mode
            </Text>

            <View style={styles.modeButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  isDark && styles.modeBtnDark,
                  mode === 'add' && styles.modeBtnActive,
                ]}
                onPress={() => setMode('add')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle"
                  size={16}
                  color={mode === 'add' ? '#FFFFFF' : (isDark ? '#FCD34D' : '#92400E')}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    isDark && styles.modeBtnTextDark,
                    mode === 'add' && styles.modeBtnTextActive,
                  ]}
                >
                  Add Area (+)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  isDark && styles.modeBtnDark,
                  mode === 'replace' && styles.modeBtnActive,
                ]}
                onPress={() => setMode('replace')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="swap-horizontal"
                  size={16}
                  color={mode === 'replace' ? '#FFFFFF' : (isDark ? '#FCD34D' : '#92400E')}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    isDark && styles.modeBtnTextDark,
                    mode === 'replace' && styles.modeBtnTextActive,
                  ]}
                >
                  Replace Area (=)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modeExplanation, isDark && { color: '#FDE68A' }]}>
              {mode === 'add'
                ? `➕ Adds ${numArea || 0} sq.ft to existing ${existingService?.area || 0} sq.ft → New Total: ${(existingService?.area || 0) + (numArea || 0)} sq.ft`
                : `🔄 Directly overwrites existing ${existingService?.area || 0} sq.ft with ${numArea || 0} sq.ft`}
            </Text>
          </View>
        )}


        {/* 2. Square Feet & Rate 2-Column Row */}
        <View style={styles.rowTwoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Square Feet (Sq. Ft)
            </Text>
            <View style={[styles.inputContainerWithBadge, isDark && styles.inputContainerDark]}>
              <TextInput
                style={[styles.numericInput, isDark && styles.textDark]}
                placeholder="0"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="numeric"
                value={area}
                onChangeText={handleAreaChange}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>sq.ft</Text>
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Rate per Sq. Ft (₹)
            </Text>
            <View style={[styles.inputContainerWithBadge, isDark && styles.inputContainerDark]}>
              <TextInput
                style={[styles.numericInput, isDark && styles.textDark]}
                placeholder="0"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="numeric"
                value={rate}
                onChangeText={handleRateChange}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>₹/sq.ft</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Live Calculation Helper Card */}
        <View style={styles.calcHelperCard}>
          <View style={styles.calcHelperContent}>
            <Ionicons name="information-circle-outline" size={18} color="#1E488F" style={{ marginRight: 6 }} />
            <Text style={styles.calcHelperText} numberOfLines={1}>
              {isAlreadyAdded && mode === 'add' ? (
                <>
                  Add: {numArea} sq.ft × ₹{numRate} ={' '}
                  <Text style={{ fontWeight: '700' }}>₹{calculatedBase.toLocaleString()}</Text>
                  {' '}(New Total: {(existingService?.area || 0) + numArea} sq.ft)
                </>
              ) : isAlreadyAdded && mode === 'replace' ? (
                <>
                  Replace: {numArea} sq.ft × ₹{numRate} ={' '}
                  <Text style={{ fontWeight: '700' }}>₹{calculatedBase.toLocaleString()}</Text>
                </>
              ) : (
                <>
                  Calculated: {numArea} sq.ft × ₹{numRate} ={' '}
                  <Text style={{ fontWeight: '700' }}>₹{calculatedBase.toLocaleString()}</Text>
                </>
              )}
            </Text>
          </View>
          <View style={styles.calcHelperTag}>
            <Text style={styles.calcHelperTagText}>
              {isAlreadyAdded ? (mode === 'add' ? 'Add' : 'Replace') : 'Base'}
            </Text>
          </View>
        </View>

        {/* 4. Warranty Period */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Warranty Period
          </Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, isDark && styles.textDark]}
              placeholder="e.g. 2 Years"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={warranty}
              onChangeText={setWarranty}
            />
          </View>
        </View>

        {/* 5. Total Price Input */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>
              Total Price (₹)
            </Text>
            <View style={styles.autoCalcPill}>
              <Text style={styles.autoCalcPillText}>Auto-calculated</Text>
            </View>
          </View>

          <View style={[styles.amountInputBox, isDark && styles.amountInputBoxDark]}>
            <Ionicons name="cash-outline" size={24} color="#2557C7" style={{ marginRight: 10 }} />
            <Text style={[styles.currencyPrefix, isDark && styles.textDark]}>₹</Text>
            <TextInput
              style={[styles.amountInput, isDark && styles.textDark]}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={paymentAmount}
              onChangeText={(val) => {
                const filtered = val.replace(/[^0-9.]/g, '');
                const parts = filtered.split('.');
                const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : filtered;
                setPaymentAmount(sanitized);
              }}
            />
          </View>
        </View>

        {/* 6. Notes / Remarks (100% Optional) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Notes / Remarks <Text style={{ fontSize: 12, fontWeight: '400', color: isDark ? '#94A3B8' : '#64748B' }}>(Optional)</Text>
          </Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, { minHeight: 70, alignItems: 'flex-start', paddingVertical: 8 }]}>
            <TextInput
              style={[styles.textInput, isDark && styles.textDark, { textAlignVertical: 'top', minHeight: 54 }]}
              placeholder="e.g. Variation added on-site, special instructions"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
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
              {isSubmitting
                ? 'Saving Service...'
                : isAlreadyAdded
                ? (mode === 'replace' ? 'Replace Service Area' : 'Add Area to Service')
                : 'Add Additional Service'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
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
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainerWithBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numericInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    padding: 7,
  },
  unitBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  calcHelperCard: {
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: 'rgba(36, 75, 148, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calcHelperContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  calcHelperText: {
    fontSize: 12,
    color: '#1E488F',
    flex: 1,
  },
  calcHelperTag: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  calcHelperTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E488F',
  },
  autoCalcPill: {
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  autoCalcPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E488F',
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
    backgroundColor: '#214A8F',
    borderColor: '#214A8F',
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  methodTabTextActive: {
    color: '#FFFFFF',
  },
  selectAccountTrigger: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectAccountText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
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
  optionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  helperSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  dashedUploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(36, 75, 148, 0.35)',
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E488F',
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
    backgroundColor: '#214A8F',
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
  bankOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  bankOptionRowSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bankOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  bankOptionMeta: {
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
  dropdownTrigger: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dropdownTriggerActive: {
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownMenuDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownMenuItemDark: {
    borderBottomColor: '#334155',
  },
  dropdownMenuItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownMenuItemSelectedDark: {
    backgroundColor: '#172554',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  dropdownMenuItemSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  existingServiceCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  existingServiceCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#B45309',
  },
  existingServiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  existingServiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  existingServiceDesc: {
    fontSize: 12.5,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 12,
  },
  modeSelectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D97706',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  modeBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#78350F',
  },
  modeBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  modeBtnTextDark: {
    color: '#FDE68A',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  modeExplanation: {
    fontSize: 11.5,
    color: '#92400E',
    fontStyle: 'italic',
  },
  alreadyAddedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  alreadyAddedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
});