import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { isValidDateString } from '../../../core/utils/validation';
import InnerHeader from '../../../shared/components/InnerHeader';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { PAYMENT_DEFAULTS } from '../constants/paymentConstants';

export default function PaymentFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const isDark = colorScheme === 'dark';
  const [app, setApp] = useState(null);

  useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        setApp(res.appointment);
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            setApp(cRes.client || cRes.data);
          }
        });
      }
    });
  }, [params.id]);

  const totalProjectCost = Number(params.totalCost) || app?.totalPayment || PAYMENT_DEFAULTS.TOTAL_PROJECT_COST;

  const getAmountForStage = (stageName) => {
    const baseM1 = Math.round(totalProjectCost * PAYMENT_DEFAULTS.MILESTONE_RATIOS.INITIAL);
    const baseM2 = Math.round(totalProjectCost * PAYMENT_DEFAULTS.MILESTONE_RATIOS.MID_TERM);

    const m1PaidAmt = app?.initialPaid
      ? Number(app.initialPaidAmount || app.initialPaidDetails?.amount || baseM1)
      : baseM1;

    const expectedM1 = app?.initialPaid ? m1PaidAmt : baseM1;
    const expectedRemainingAfterM1 = Math.max(0, totalProjectCost - expectedM1);

    const m2PaidAmt = app?.midTermPaid
      ? Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || Math.min(baseM2, expectedRemainingAfterM1))
      : Math.min(baseM2, expectedRemainingAfterM1);

    if (stageName.includes('Initial') || stageName.includes('50%')) {
      return m1PaidAmt;
    }
    if (stageName.includes('Mid-Term') || stageName.includes('40%')) {
      return m2PaidAmt;
    }
    if (stageName.includes('Final') || stageName.includes('10%')) {
      return Math.max(0, totalProjectCost - m1PaidAmt - m2PaidAmt);
    }
    if (stageName.includes('Full') || stageName.includes('100%')) {
      return Math.max(0, totalProjectCost - (app?.initialPaid ? m1PaidAmt : 0) - (app?.midTermPaid ? m2PaidAmt : 0));
    }
    return m1PaidAmt;
  };

  let defaultStageName = PAYMENT_DEFAULTS.STAGES.INITIAL;
  let defaultMilestoneKey = 'initialPaid';

  if (app?.initialPaid) {
    defaultMilestoneKey = 'midTermPaid';
    defaultStageName = PAYMENT_DEFAULTS.STAGES.MID_TERM;
  }
  if (app?.initialPaid && app?.midTermPaid) {
    defaultMilestoneKey = 'finalPaid';
    defaultStageName = PAYMENT_DEFAULTS.STAGES.FINAL;
  }

  const milestoneKey = params.milestone || defaultMilestoneKey;

  let initialStageName = defaultStageName;
  if (params.milestone === 'initialPaid') initialStageName = PAYMENT_DEFAULTS.STAGES.INITIAL;
  else if (params.milestone === 'midTermPaid') initialStageName = PAYMENT_DEFAULTS.STAGES.MID_TERM;
  else if (params.milestone === 'finalPaid') initialStageName = PAYMENT_DEFAULTS.STAGES.FINAL;

  const initialAmount = params.amount && params.milestone ? Number(params.amount) : getAmountForStage(initialStageName);

  // Form State
  const [amountStr, setAmountStr] = useState(`Rs.${initialAmount.toLocaleString()}`);
  const [paymentStage, setPaymentStage] = useState(initialStageName);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_DEFAULTS.DEFAULT_PAYMENT_METHOD);
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Populate today's date formatted as DD-MM-YYYY
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setPaymentDate(`${dd}-${mm}-${yyyy}`);
  }, []);

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

  const prefix = app.clientName.trim().toLowerCase().startsWith('mr.') ? '' : 'Mr. ';
  const displayName = `${prefix}${app.clientName.trim()}`;
  const displayId = `DR${app.id}`;
  const displayPhone = app.phone || '+91 9123456789';

  const validateForm = () => {
    const newErrors = {};
    const numericAmount = Number(amountStr.replace(/[^0-9]/g, ''));

    if (!numericAmount || numericAmount <= 0) {
      newErrors.amount = 'Please enter a valid positive payment amount.';
    }

    if (paymentMethod === 'UPI' && !transactionId.trim()) {
      newErrors.transactionId = 'UPI Transaction ID is required.';
    }

    if (paymentDate.trim() && !isValidDateString(paymentDate)) {
      newErrors.paymentDate = 'Invalid payment date format (DD-MM-YYYY).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdatePayment = () => {
    if (!validateForm()) {
      return;
    }

    const numericAmount = Number(amountStr.replace(/[^0-9]/g, ''));

    // Save dynamic transaction details in context
    const transactionDetails = {
      amount: numericAmount,
      paymentStage,
      paymentMethod,
      transactionId: paymentMethod === 'UPI' ? transactionId.trim() : `CASH-${Math.floor(100000 + Math.random() * 900000)}`,
      paymentDate: paymentDate.trim(),
    };

    const isFullPayment = paymentStage.includes('100%') || paymentStage.includes('Full') || numericAmount >= totalProjectCost;
    const targetKey = isFullPayment ? 'fullPaid' : milestoneKey;

    Alert.alert(
      'Payment Updated',
      isFullPayment
        ? `Successfully processed 100% Full Payment of Rs. ${numericAmount.toLocaleString()}/-! All pending statuses closed.`
        : `Successfully processed Rs. ${numericAmount.toLocaleString()}/- milestone payment!`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({
                pathname: '/customer-detail',
                params: { id: app.id, initialTab: 'payments' },
              });
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Record Payment" paddingTop={insets.top} isDark={isDark} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 40, 80) },
        ]}
      >
        <View style={[styles.contentWrapper, isDark && styles.contentWrapperDark]}>
          {/* Customer Profile Banner */}
          <View style={[styles.profileBanner, isDark && styles.profileBannerDark]}>
            <Image
              source={require('../../../../assets/images/technician_avatar.png')}
              style={styles.avatarImage}
            />
            <View style={styles.profileTextCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.clientNameText, isDark && styles.textDark]}>
                  {displayName}
                </Text>
                <View style={{ backgroundColor: '#0052CC', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{displayId}</Text>
                </View>
              </View>

              <View style={styles.profileBadgeRow}>
                <Ionicons name="call-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={[styles.profileBadgeText, isDark && styles.subtextDark]}>{displayPhone}</Text>
              </View>

              {/* Cumulative Payment Status */}
              {(() => {
                const m1P = app?.initialPaid ? Number(app.initialPaidAmount || app.initialPaidDetails?.amount || Math.round(totalProjectCost * 0.50)) : 0;
                const m2P = app?.midTermPaid ? Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || Math.round((totalProjectCost - m1P) * 0.8)) : 0;
                const m3P = app?.finalPaid ? Number(app.finalPaidAmount || app.finalPaidDetails?.amount || Math.max(0, totalProjectCost - m1P - m2P)) : 0;
                const paidSoFar = m1P + m2P + m3P;
                const remBal = Math.max(0, totalProjectCost - paidSoFar);

                return (
                  <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#E2E8F0' }}>
                    <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                      Paid: <Text style={{ color: '#16A34A', fontWeight: '800' }}>₹{paidSoFar.toLocaleString()}</Text> • Rem: <Text style={{ color: remBal > 0 ? '#D97706' : '#16A34A', fontWeight: '800' }}>₹{remBal.toLocaleString()}</Text>
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>

          {/* 1. Payment Stage Selection Cards */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, isDark && styles.textDark]}>Select Payment Stage</Text>

            <View style={{ gap: 10 }}>
              {[
                { key: 'Initial Payment (50%)', title: 'Initial Advance', pct: '50%', icon: 'shield-checkmark', color: '#0052CC', isPaid: Boolean(app.initialPaid), isUnlocked: true },
                { key: 'Mid-Term Payment (40%)', title: 'Mid-Term Completion', pct: '40%', icon: 'stats-chart', color: '#2563EB', isPaid: Boolean(app.midTermPaid), isUnlocked: Boolean(app.initialPaid) },
                { key: 'Final Payment (10%)', title: 'Final Settlement', pct: '10%', icon: 'checkmark-circle', color: '#7C3AED', isPaid: Boolean(app.finalPaid), isUnlocked: Boolean(app.initialPaid && app.midTermPaid) },
                { key: 'Full Project Payment (100%)', title: 'Full Project Payment', pct: '100%', icon: 'ribbon', color: '#10B981', isPaid: Boolean(app.initialPaid && app.midTermPaid && app.finalPaid), isUnlocked: true },
              ].map((stg) => {
                const isSelected = paymentStage.includes(stg.pct) || paymentStage === stg.key;
                const stageAmt = getAmountForStage(stg.key);
                const isUnlocked = stg.isUnlocked;
                const isPaid = stg.isPaid;

                return (
                  <TouchableOpacity
                    key={stg.key}
                    style={[{
                      backgroundColor: isPaid
                        ? (isDark ? '#064E3B' : '#ECFDF5')
                        : (isUnlocked
                          ? (isSelected ? (isDark ? '#1E293B' : '#EFF6FF') : (isDark ? '#1C1C1C' : '#FFFFFF'))
                          : (isDark ? '#121212' : '#F1F5F9')),
                      borderWidth: isSelected || isPaid ? 2 : 1,
                      borderColor: isPaid ? '#10B981' : (isSelected ? stg.color : (isDark ? '#334155' : '#E2E8F0')),
                      borderRadius: 14,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isUnlocked ? 1 : 0.6,
                    }]}
                    onPress={() => {
                      if (isPaid) {
                        Alert.alert(
                          'Payment Settled ✅',
                          `This milestone (${stg.title}) of ₹${stageAmt.toLocaleString()} has already been completed and settled.`
                        );
                        return;
                      }
                      if (!isUnlocked) {
                        Alert.alert(
                          'Milestone Stage Locked',
                          'Please complete the previous milestone payment first, or select Full Project Payment (100%).'
                        );
                        return;
                      }
                      setPaymentStage(stg.key);
                      setAmountStr(`Rs.${stageAmt.toLocaleString()}`);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isPaid ? '#10B981' : (isUnlocked ? (isSelected ? stg.color : (isDark ? '#334155' : '#F1F5F9')) : (isDark ? '#334155' : '#CBD5E1')), justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name={isPaid ? 'checkmark-done' : (isUnlocked ? stg.icon : 'lock-closed')} size={18} color={isPaid ? '#FFFFFF' : (isUnlocked ? (isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B')) : (isDark ? '#94A3B8' : '#475569'))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: isPaid ? '#059669' : (isUnlocked ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? '#94A3B8' : '#64748B')) }}>
                            {stg.title} ({stg.pct})
                          </Text>
                          {isPaid ? (
                            <View style={{ backgroundColor: '#DCFCE7', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#16A34A' }}>SETTLED ✅</Text>
                            </View>
                          ) : !isUnlocked ? (
                            <View style={{ backgroundColor: isDark ? '#334155' : '#CBD5E1', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ fontSize: 11, color: isPaid ? '#059669' : (isDark ? '#94A3B8' : '#64748B'), marginTop: 2 }}>
                          {isPaid ? 'Payment received & settled' : (isUnlocked ? 'Calculated stage payment value' : 'Requires previous milestone payment')}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 16, fontWeight: '600', color: isPaid ? '#059669' : (isUnlocked ? (isSelected ? stg.color : (isDark ? '#FFFFFF' : '#0F172A')) : '#94A3B8') }}>
                      ₹{stageAmt.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2. Amount Input Box */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, isDark && styles.textDark]}>Payment Amount (₹) <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={[styles.inputBoxContainer, isDark && styles.inputBoxContainerDark, errors.amount && styles.inputBoxContainerError]}>
              <Ionicons name="cash-outline" size={20} color={errors.amount ? '#EF4444' : '#2563EB'} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.inputBoxValue, isDark && styles.textDark]}
                value={amountStr}
                onChangeText={(text) => {
                  setAmountStr(text);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
                }}
                keyboardType="numeric"
                placeholder="Rs. 0"
                placeholderTextColor="#94A3B8"
              />
            </View>
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
          </View>

          {/* 3. Payment Method Pills */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, isDark && styles.textDark]}>Payment Method</Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { id: 'UPI', label: 'UPI / QR', icon: 'qr-code-outline' },
                { id: 'Card', label: 'Card', icon: 'card-outline' },
                { id: 'Cash', label: 'Cash', icon: 'wallet-outline' },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={{
                      flex: 1,
                      backgroundColor: isSelected ? '#0052CC' : (isDark ? '#1C1C1C' : '#FFFFFF'),
                      borderWidth: 1,
                      borderColor: isSelected ? '#0052CC' : (isDark ? '#334155' : '#CBD5E1'),
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={() => {
                      setPaymentMethod(m.id);
                      if (errors.transactionId) setErrors((prev) => ({ ...prev, transactionId: null }));
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={m.icon} size={16} color={isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')} />
                    <Text style={{ color: isSelected ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#334155'), fontSize: 12, fontWeight: '600' }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. UPI Transaction ID Input */}
          {paymentMethod === 'UPI' && (
            <View style={styles.fieldSection}>
              <Text style={[styles.fieldLabel, isDark && styles.textDark]}>UPI Transaction ID / Ref No. <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, isDark && styles.fieldInputDark, isDark && styles.textDark, errors.transactionId && styles.fieldInputError]}
                value={transactionId}
                onChangeText={(text) => {
                  setTransactionId(text);
                  if (errors.transactionId) setErrors((prev) => ({ ...prev, transactionId: null }));
                }}
                placeholder="e.g. 319208471203"
                placeholderTextColor="#94A3B8"
              />
              {errors.transactionId && <Text style={styles.errorText}>{errors.transactionId}</Text>}
            </View>
          )}

          {/* 5. Payment Date Input */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, isDark && styles.textDark]}>Payment Date</Text>
            <TextInput
              style={[styles.fieldInput, isDark && styles.fieldInputDark, isDark && styles.textDark, errors.paymentDate && styles.fieldInputError]}
              value={paymentDate}
              onChangeText={(text) => {
                setPaymentDate(text);
                if (errors.paymentDate) setErrors((prev) => ({ ...prev, paymentDate: null }));
              }}
              placeholder="DD-MM-YYYY"
              placeholderTextColor="#94A3B8"
            />
            {errors.paymentDate && <Text style={styles.errorText}>{errors.paymentDate}</Text>}
          </View>

          {/* 6. Process Payment Submit Button */}
          <View style={{ marginTop: 10, marginBottom: 20 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#10B981',
                paddingVertical: 16,
                borderRadius: 14,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={handleUpdatePayment}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Update & Process Payment ({amountStr})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#080808',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  scrollContainer: {
    paddingTop: 12,
  },
  contentWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    minHeight: '100%',
  },
  contentWrapperDark: {
    backgroundColor: '#121212',
  },

  // Profile Banner
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileBannerDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  profileTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  clientNameText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    color: '#64748B',
  },

  // Amount input container
  inputBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputBoxContainerDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#3B82F6',
  },
  inputBoxValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },

  // Field sections
  fieldSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldInputDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  fieldInputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  inputBoxContainerError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    paddingLeft: 2,
  },
  textDark: {
    color: '#FFFFFF',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
