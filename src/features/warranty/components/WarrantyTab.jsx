import React, { useState } from 'react';
import {
  View,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';
import { useWarranty } from '../hooks/useWarranty';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

const TextInput = React.forwardRef((props, ref) => (
  <RNTextInput ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
TextInput.displayName = 'TextInput';

/**
 * Modern, production-grade Warranty Tab component based on API v2 specifications.
 * 
 * Supports 4 lifecycle states:
 * 1. Ineligible: Explains why warranty is locked (receipt must be generated first)
 * 2. Eligible & Unconfigured: Allows configuring start date and per-service warranty years
 * 3. Configured: Displays saved configuration, supports editing via PATCH, and generating certificate
 * 4. Generated / Active: Shows official verified warranty card, itemized coverage, and 3-day deletion window for Admins
 */
export default function WarrantyTab({
  quotationId,
  app,
  payView,
  isAdmin = false,
  onNavigatePaymentTab,
}) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    isLoading,
    isSubmitting,
    eligibility,
    config,
    availableServices,
    warranty,
    saveConfig,
    updateConfig,
    generate,
    removeWarranty,
  } = useWarranty(quotationId);

  // Form states for Unconfigured & Edit mode
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const startDate = customStartDate || config?.warrantyStartDate || new Date().toISOString().split('T')[0];
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  // Mapping of service key -> duration in years override
  const [serviceYears, setServiceYears] = useState({});

  // Track which service keys have been excluded (deleted) from the config form
  const [excludedServiceKeys, setExcludedServiceKeys] = useState(new Set());

  // Track which service key is pending delete confirmation popup
  const [deleteConfirmKey, setDeleteConfirmKey] = useState(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');

  const getYearsForService = (key, fallbackYears) => {
    if (key in serviceYears) return serviceYears[key];
    if (fallbackYears !== undefined && fallbackYears !== null) return String(fallbackYears);
    return '5';
  };

  // Adjust duration by delta (+0.5 or -0.5)
  const adjustYears = (key, delta, fallbackYears) => {
    const current = parseFloat(getYearsForService(key, fallbackYears)) || 0;
    const nextVal = Math.max(1, Math.round((current + delta) * 10) / 10);
    setServiceYears((prev) => ({
      ...prev,
      [key]: String(nextVal),
    }));
  };

  // Show delete confirmation popup for a given service card
  const handleRequestDeleteService = (key, title) => {
    setDeleteConfirmKey(key);
    setDeleteConfirmTitle(title);
  };

  // Confirm deletion – exclude service from form
  const handleConfirmDeleteService = () => {
    if (deleteConfirmKey) {
      setExcludedServiceKeys((prev) => new Set([...prev, deleteConfirmKey]));
    }
    setDeleteConfirmKey(null);
    setDeleteConfirmTitle('');
  };

  // Cancel deletion popup
  const handleCancelDeleteService = () => {
    setDeleteConfirmKey(null);
    setDeleteConfirmTitle('');
  };

  // Re-add an excluded service back to the form
  const handleReaddService = (key) => {
    setExcludedServiceKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Handle Save (Create or Update)
  const handleSaveConfig = async () => {
    const activeServicesList = config?.services?.length ? config.services : availableServices;
    if (!activeServicesList || activeServicesList.length === 0) {
      Alert.alert('No Services', 'No services found to configure warranty for.');
      return;
    }

    // Filter out services the user excluded
    const filteredServices = activeServicesList.filter((s) => {
      const key = `${s.serviceId}_${Boolean(s.isAdditional)}`;
      return !excludedServiceKeys.has(key);
    });

    if (filteredServices.length === 0) {
      Alert.alert('No Services Selected', 'Please include at least one service in the warranty configuration.');
      return;
    }

    const payloadServices = filteredServices.map((s) => {
      const key = `${s.serviceId}_${Boolean(s.isAdditional)}`;
      const rawY = getYearsForService(key, s.years ?? s.suggestedYears);
      const parsedY = parseFloat(rawY);
      return {
        serviceId: Number(s.serviceId),
        isAdditional: Boolean(s.isAdditional),
        years: isNaN(parsedY) || parsedY < 1 ? 1 : Math.round(parsedY * 100) / 100,
      };
    });

    const payload = {
      warrantyStartDate: startDate,
      services: payloadServices,
    };

    if (config?.id || eligibility?.hasConfig) {
      const res = await updateConfig(payload);
      if (res.success) {
        setIsEditingConfig(false);
        Alert.alert('Success', 'Warranty configuration updated successfully.');
      } else {
        Alert.alert('Update Failed', res.message || 'Could not update configuration.');
      }
    } else {
      const res = await saveConfig(payload);
      if (res.success) {
        setIsEditingConfig(false);
        Alert.alert('Success', 'Warranty configuration saved successfully. You can now generate the official certificate.');
      } else {
        Alert.alert('Save Failed', res.message || 'Could not save configuration.');
      }
    }
  };

  // Handle Generate
  const handleGenerateWarranty = () => {
    Alert.alert(
      'Generate Warranty Certificate',
      'This will snapshot the current configuration into an official immutable warranty record with specific start and end dates. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'default',
          onPress: async () => {
            const res = await generate();
            if (res.success) {
              Alert.alert('Warranty Generated! 🛡️', 'Official digital warranty certificate created successfully.');
            } else {
              Alert.alert('Generation Failed', res.message || 'Could not generate warranty certificate.');
            }
          },
        },
      ]
    );
  };

  // Handle Delete within 3-day window (Admin only)
  const handleDeleteWarranty = () => {
    Alert.alert(
      'Delete Warranty Certificate',
      'Are you sure you want to delete this warranty certificate? This action will reset the warranty back to the editable Configured state. Only permitted within 3 days of creation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Warranty',
          style: 'destructive',
          onPress: async () => {
            const res = await removeWarranty();
            if (res.success) {
              Alert.alert('Warranty Deleted', 'Warranty cleared. The configuration is preserved and can be edited.');
            } else {
              Alert.alert('Deletion Failed', res.message || 'Could not delete warranty.');
            }
          },
        },
      ]
    );
  };

  // Loading State
  if (isLoading) {
    return (
      <View style={{
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDark ? '#334155' : '#E2E8F0',
        marginBottom: 20,
      }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 12, fontSize: 14, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>
          Checking warranty eligibility & details...
        </Text>
      </View>
    );
  }

  // 1. Ineligible State
  if (!eligibility?.isEligible && !warranty) {
    const reasonText = eligibility?.reason ||
      'Official warranty can only be configured and generated once the final settlement is confirmed and the official final receipt is generated.';

    return (
      <View style={{
        width: '100%',
        backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: isDark ? '#334155' : '#E2E8F0',
        marginBottom: 20,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="lock-closed" size={22} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
              Warranty Locked (Post-Receipt Only)
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }}>
              Step 4: Post-Settlement Clearance
            </Text>
          </View>
        </View>

        {/* Reason banner */}
        <View style={{
          backgroundColor: isDark ? '#080808' : '#FFF7ED',
          borderWidth: 1,
          borderColor: isDark ? '#78350F' : '#FED7AA',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 13, color: isDark ? '#FDBA74' : '#9A3412', lineHeight: 18 }}>
              {reasonText}
            </Text>
          </View>
        </View>

        {/* Checklist */}
        <View style={{
          backgroundColor: isDark ? '#080808' : '#F8FAFC',
          borderRadius: 14,
          padding: 14,
          gap: 10,
          borderWidth: 1,
          borderColor: isDark ? '#334155' : '#E2E8F0',
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Warranty Unlock Criteria
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={payView?.isConfirmed ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={payView?.isConfirmed ? '#10B981' : '#94A3B8'}
            />
            <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#1E293B' }}>
              Quotation Confirmed & Work Completed
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={payView?.balanceAmount === 0 ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={payView?.balanceAmount === 0 ? '#10B981' : '#94A3B8'}
            />
            <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#1E293B' }}>
              Zero Balance Dues & All Payments Admin-Verified
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={eligibility?.receiptNumber ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={eligibility?.receiptNumber ? '#10B981' : '#94A3B8'}
            />
            <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#1E293B' }}>
              Official Final Settlement Receipt Generated & Locked
            </Text>
          </View>
        </View>

        {/* Action to Jump to Payments */}
        {onNavigatePaymentTab && (
          <TouchableOpacity
            style={{
              backgroundColor: '#4F46E5',
              height: 48,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={onNavigatePaymentTab}
            activeOpacity={0.85}
          >
            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
              Go to Payments & Generate Receipt
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 4. Generated State (Active Digital Warranty Certificate)
  if (warranty && !isEditingConfig) {
    const isDeletable = Boolean(warranty.isDeletable);
    const deletableUntilStr = warranty.deletableUntil ? formatDateDDMMYY(warranty.deletableUntil) : null;
    const items = warranty.items || [];

    return (
      <View style={{ width: '100%', paddingBottom: 24 }}>
        {/* Certificate Card Header */}
        <View style={{
          backgroundColor: isDark ? '#1C1C1C' : '#EEF2FF',
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: isDark ? '#334155' : '#C7D2FE',
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Ionicons name="shield-checkmark" size={18} color="#4F46E5" />
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Verified Certificate
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#1E1B4B' }}>
                {warranty.receiptNumber || 'Official Warranty'}
              </Text>
            </View>
            <View style={{
              backgroundColor: '#10B981',
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 8,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                ACTIVE COVERAGE
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
            <View>
              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>Effective Start Date</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                {formatDateDDMMYY(warranty.warrantyStartDate)}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>Issued By</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                {warranty.generatedBy || 'Authorized Officer'}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>Issued Date</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                {formatDateDDMMYY(warranty.generatedAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Itemized Covered Services */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 10, paddingHorizontal: 2 }}>
          Covered Services & Validity Periods
        </Text>

        <View style={{ gap: 10, marginBottom: 16 }}>
          {items.map((item, idx) => (
            <View
              key={item.id || idx}
              style={{
                backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {item.serviceTitle}
                  </Text>
                  {item.isAdditional && (
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>
                      Additional Variation Work Order
                    </Text>
                  )}
                </View>
                <View style={{
                  backgroundColor: '#EEF2FF',
                  borderColor: '#C7D2FE',
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#4F46E5' }}>
                    {item.years} {item.years === 1 ? 'Year' : 'Years'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="calendar-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#475569' }}>
                  Valid: <Text style={{ fontWeight: '700' }}>{formatDateDDMMYY(item.warrantyStartDate)}</Text> to <Text style={{ fontWeight: '700', color: '#16A34A' }}>{formatDateDDMMYY(item.warrantyEndDate)}</Text>
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 3-Day Deletion Window Notice */}
        {isDeletable ? (
          <View style={{
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
            borderColor: isDark ? '#78350F' : '#FDE68A',
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Ionicons name="timer-outline" size={18} color="#D97706" />
            <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#FBBF24' : '#B45309' }}>
              Warranty can be deleted/reconfigured by Admin until {deletableUntilStr || '3 days from generation'}.
            </Text>
          </View>
        ) : (
          <View style={{
            backgroundColor: isDark ? '#080808' : '#F1F5F9',
            borderRadius: 10,
            padding: 10,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Ionicons name="lock-closed" size={15} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
              Permanent Warranty: 3-day deletion window has expired. This certificate is permanently locked.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#4F46E5',
              height: 48,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={() => {
              router.push({
                pathname: '/warranty-letter',
                params: {
                  id: app?.id || quotationId,
                  quotationId: quotationId,
                },
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
              View & Print Warranty Letter
            </Text>
          </TouchableOpacity>

          {/* Admin Deletion Action (Only within 3 days) */}
          {isDeletable && isAdmin && (
            <TouchableOpacity
              style={{
                borderColor: '#EF4444',
                borderWidth: 1.5,
                height: 46,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
              }}
              onPress={handleDeleteWarranty}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              )}
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                Delete Warranty (Unlock Configuration)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // 3. Configured State (hasConfig === true, but warranty not yet generated)
  if (config && !isEditingConfig) {
    const services = config.services || [];

    return (
      <View style={{ width: '100%', paddingBottom: 24 }}>
        {/* Banner */}
        <View style={{
          backgroundColor: isDark ? '#1C1C1C' : '#FEF3C7',
          borderRadius: 18,
          padding: 16,
          borderWidth: 1,
          borderColor: isDark ? '#78350F' : '#FDE68A',
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' }}>
              Warranty Configured
            </Text>
            <View style={{ backgroundColor: '#D97706', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>AWAITING GENERATION</Text>
            </View>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#FFFFFF' : '#78350F' }}>
            Receipt: {config.receiptNumber || eligibility?.receiptNumber || 'N/A'}
          </Text>
          <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#92400E', marginTop: 4 }}>
            Configured by {config.configuredBy || 'Staff'} • Start Date: {formatDateDDMMYY(config.warrantyStartDate)}
          </Text>
        </View>

        {/* Configured Services List */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 10, paddingHorizontal: 2 }}>
          Assigned Service Durations
        </Text>

        <View style={{ gap: 10, marginBottom: 18 }}>
          {services.map((item, idx) => (
            <View
              key={item.id || idx}
              style={{
                backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', lineHeight: 20 }}>
                  {item.serviceTitle || `Service #${item.serviceId}`}
                </Text>
                {item.isAdditional && (
                  <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600', marginTop: 2 }}>Variation Order</Text>
                )}
              </View>
              <View style={{
                backgroundColor: '#EEF2FF',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#4F46E5' }}>
                  {item.years} {item.years === 1 ? 'Year' : 'Years'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#4F46E5',
              height: 50,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#4F46E5',
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={handleGenerateWarranty}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              Generate Official Warranty Certificate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              height: 44,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: isDark ? '#334155' : '#CBD5E1',
              backgroundColor: isDark ? '#080808' : '#FFFFFF',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            onPress={() => setIsEditingConfig(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={isDark ? '#CBD5E1' : '#475569'} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
              Edit Warranty Configuration
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. Unconfigured State OR Edit Mode (Form to configure warranty)
  const targetServicesList = config?.services?.length && isEditingConfig
    ? config.services.map((s) => ({
        serviceId: s.serviceId,
        isAdditional: s.isAdditional,
        title: s.serviceTitle || `Service #${s.serviceId}`,
        suggestedYears: s.years,
      }))
    : availableServices;

  return (
    <View style={{ width: '100%', paddingBottom: 24 }}>
      {/* Config Header & Start Date Card */}
      <View style={{
        backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: isDark ? '#334155' : '#E2E8F0',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 1,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
              {isEditingConfig ? 'Edit Warranty Configuration' : 'Configure Warranty'}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
              Receipt: <Text style={{ fontWeight: '700', color: '#4F46E5' }}>{eligibility?.receiptNumber || 'Locked Receipt'}</Text>
            </Text>
          </View>
          <Ionicons name="shield-outline" size={24} color="#4F46E5" />
        </View>

        {/* Start Date Picker Section */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#CBD5E1' : '#334155', marginBottom: 6 }}>
            Warranty Start Date <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: isDark ? '#080808' : '#F8FAFC',
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#CBD5E1',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onPress={() => {
              try {
                setDatePickerValue(new Date(startDate));
              } catch (_e) {
                setDatePickerValue(new Date());
              }
              setShowDatePicker(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
              {startDate}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#4F46E5" />
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
            Each service warranty end date will be calculated from this start date.
          </Text>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_evt, selDate) => {
            setShowDatePicker(false);
            if (selDate) {
              setDatePickerValue(selDate);
              setCustomStartDate(selDate.toISOString().split('T')[0]);
            }
          }}
        />
      )}

      {/* Per-Service Warranty Duration Form */}
      <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 10, paddingHorizontal: 2 }}>
        Service Warranty Coverage (in Years) <Text style={{ color: '#EF4444' }}>*</Text>
      </Text>

      {targetServicesList.length === 0 ? (
        <View style={{
          backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: isDark ? '#334155' : '#E2E8F0',
          marginBottom: 16,
        }}>
          <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>
            No quotation services found to configure.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginBottom: 20 }}>
          {targetServicesList.map((service, idx) => {
            const key = `${service.serviceId}_${Boolean(service.isAdditional)}`;
            const isExcluded = excludedServiceKeys.has(key);
            if (isExcluded) return null;

            const defaultYears = service.years ?? service.suggestedYears ?? 5;
            const currentYearsStr = getYearsForService(key, defaultYears);

            return (
              <View
                key={key || idx}
                style={{
                  backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 12,
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  shadowColor: '#000',
                  shadowOpacity: 0.03,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                {/* ── Row 1: Service Heading ── */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', lineHeight: 22 }}>
                    {idx + 1}. {service.title}
                  </Text>
                  {service.isAdditional ? (
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600', marginTop: 2 }}>
                      Additional Variation Service
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                      Base Scope Service
                    </Text>
                  )}
                </View>

                {/* ── Row 2: Years Stepper ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', flex: 1 }}>
                    Warranty Duration
                  </Text>
                  <TouchableOpacity
                    onPress={() => adjustYears(key, -0.5, defaultYears)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: isDark ? '#334155' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: isDark ? '#475569' : '#E2E8F0',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
                  </TouchableOpacity>

                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? '#475569' : '#CBD5E1',
                    backgroundColor: isDark ? '#080808' : '#F8FAFC',
                    paddingHorizontal: 8,
                    minWidth: 60,
                  }}>
                    <TextInput
                      style={{
                        minWidth: 26,
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        paddingVertical: 0,
                      }}
                      keyboardType="numeric"
                      value={currentYearsStr}
                      onChangeText={(val) => {
                        setServiceYears((prev) => ({
                          ...prev,
                          [key]: val,
                        }));
                      }}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginLeft: 2 }}>
                      Yrs
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => adjustYears(key, 0.5, defaultYears)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: isDark ? '#334155' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: isDark ? '#475569' : '#E2E8F0',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
                  </TouchableOpacity>
                </View>

                {/* ── Divider ── */}
                <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#F1F5F9', marginBottom: 10 }} />

                {/* ── Row 3: Delete Button ── */}
                <TouchableOpacity
                  onPress={() => handleRequestDeleteService(key, service.title)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#FEF2F2',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FECACA',
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>
                    Remove from Warranty
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Excluded Services ── */}
      {excludedServiceKeys.size > 0 && (
        <View style={{
          backgroundColor: isDark ? '#1C1C1C' : '#FFFBEB',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: isDark ? '#78350F' : '#FDE68A',
          marginBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FBBF24' : '#B45309' }}>
              Removed Services ({excludedServiceKeys.size})
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: isDark ? '#92400E' : '#78350F', marginBottom: 10, lineHeight: 16 }}>
            These services will not be covered under this warranty. Tap to re-include them.
          </Text>
          {targetServicesList.filter(s => excludedServiceKeys.has(`${s.serviceId}_${Boolean(s.isAdditional)}`)).map((service) => {
            const key = `${service.serviceId}_${Boolean(service.isAdditional)}`;
            return (
              <View
                key={key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isDark ? '#080808' : '#FFFFFF',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B', lineHeight: 18 }}>
                    {service.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#475569' : '#94A3B8', marginTop: 1 }}>
                    {service.isAdditional ? 'Additional Variation Service' : 'Base Scope Service'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleReaddService(key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: '#EEF2FF',
                    borderWidth: 1,
                    borderColor: '#C7D2FE',
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#4F46E5" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>Re-add</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Save Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {isEditingConfig && (
          <TouchableOpacity
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: isDark ? '#334155' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => setIsEditingConfig(false)}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#CBD5E1' : '#64748B' }}>
              Cancel
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{
            flex: 2,
            backgroundColor: '#4F46E5',
            height: 48,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onPress={handleSaveConfig}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
            {isEditingConfig ? 'Update Configuration' : 'Save Configuration'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Delete Service Confirmation Modal (full-screen overlay) ── */}
      <Modal
        visible={deleteConfirmKey !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancelDeleteService}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
          activeOpacity={1}
          onPress={handleCancelDeleteService}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
              borderRadius: 24,
              padding: 28,
              width: '100%',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 12 },
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            {/* Icon */}
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: '#FEF2F2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              alignSelf: 'center',
            }}>
              <Ionicons name="trash-outline" size={30} color="#EF4444" />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', textAlign: 'center', marginBottom: 8 }}>
              Remove from Warranty?
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 6 }}>
              <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>{deleteConfirmTitle}</Text>{' '}
              will be excluded from this warranty configuration.
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#64748B' : '#94A3B8', textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>
              You can re-add it anytime before saving.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleCancelDeleteService}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 13,
                  borderWidth: 1.5,
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#080808' : '#F8FAFC',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
                  Keep It
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDeleteService}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 13,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
