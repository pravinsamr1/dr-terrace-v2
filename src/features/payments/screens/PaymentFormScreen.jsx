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
import { paymentRepository } from '../api/paymentRepository';
import { quotationPaymentRepository } from '../api/quotationPaymentRepository';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { compressImage, formatFileSize } from '../../../core/utils/imageUtils';

// Format ISO date string to YYYY-MM-DD for API
function toISODate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? new Date().toISOString().slice(0, 10) : dt.toISOString().slice(0, 10);
}

// Format number as DD/MM/YYYY for display
function toDisplayDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

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

  // ─── Determine if this is a final-settlement form ───────────────────────
  const isFinalSettlement = Boolean(
    params.isFinalSettlement === 'true' ||
    params.stage === 'final' ||
    (params.milestone && String(params.milestone).toLowerCase().includes('final'))
  );

  // ─── Quotation context ───────────────────────────────────────────────────
  const quotationId = params.quotationId ? String(params.quotationId) : null;

  // ─── Payment summary from quotation-payments API ─────────────────────────
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(Boolean(quotationId));

  // Bank accounts for ACCOUNT method — sourced from quotation-payments or legacy pay-view
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');

  // ─── Form state ──────────────────────────────────────────────────────────
  const [paymentAmount, setPaymentAmount] = useState(
    params.amount != null && params.amount !== '' ? String(params.amount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'UPI' | 'ACCOUNT' | 'CASH'
  const [upiId, setUpiId] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Payment date (default today)
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ─── GST decision (final settlement only) ───────────────────────────────
  const [applyGst, setApplyGst] = useState(false);
  const [customerGstNumber, setCustomerGstNumber] = useState('');

  // ─── Proof image ─────────────────────────────────────────────────────────
  const [proofImage, setProofImage] = useState(null); // { uri, name, type, size? }
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ─── Bank account picker ─────────────────────────────────────────────────
  const [showBankPicker, setShowBankPicker] = useState(false);

  // ─── Submit state ────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ─── Upload progress (bytes sent vs total) ───────────────────────────────
  const [uploadProgress, setUploadProgress] = useState(null); // { loaded, total, percent }

  // ─── Computed display values from params (client info) ──────────────────
  const clientName = params.clientName || params.customerName || '';
  const mobileNumber = params.mobileNumber || params.phone || '';
  const displayQuoteId = quotationId ? `#${quotationId}` : '';

  // ─── Load payment summary ────────────────────────────────────────────────
  useEffect(() => {
    if (!quotationId) {
      setIsLoadingSummary(false);
      return;
    }
    let isMounted = true;
    setIsLoadingSummary(true);
    quotationPaymentRepository
      .getPaymentSummary(quotationId)
      .then((res) => {
        if (!isMounted) return;
        setIsLoadingSummary(false);
        if (res?.success && res.data) {
          setPaymentSummary(res.data);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingSummary(false);
      });
    return () => {
      isMounted = false;
    };
  }, [quotationId]);

  // ─── Load bank accounts (from pay-view, since quotation-payments may not include them) ──
  useEffect(() => {
    if (!quotationId) return;
    paymentRepository
      .getBankAccounts()
      .then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setBankAccounts(res.data);
          const primary = res.data.find((b) => b.isPrimary) || res.data[0];
          if (primary) setSelectedBankId(String(primary.id));
        }
      })
      .catch(() => {});
  }, [quotationId]);

  // ─── Pre-fill remaining balance into amount field ───────────────────────
  useEffect(() => {
    if (params.amount != null && params.amount !== '') return; // already set from params
    if (!paymentSummary) return;
    const progress = paymentSummary.progress || {};
    if (isFinalSettlement) {
      // Pre-fill the without-GST balance; user can toggle applyGst to see the GST amount
      const bal = Number(applyGst
        ? progress.withGstBalance
        : progress.withoutGstBalance) || 0;
      if (bal > 0) setPaymentAmount(String(bal));
    }
  }, [paymentSummary, isFinalSettlement]);

  // ─── Recalculate final amount when applyGst changes ────────────────────
  useEffect(() => {
    if (!isFinalSettlement || !paymentSummary) return;
    const progress = paymentSummary.progress || {};
    const bal = Number(applyGst ? progress.withGstBalance : progress.withoutGstBalance) || 0;
    if (bal > 0) setPaymentAmount(String(bal));
  }, [applyGst, paymentSummary, isFinalSettlement]);

  // ─── Proof image handlers ─────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    setShowUploadModal(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture payment proof.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const { uri: compressedUri, size: compressedSize } = await compressImage(asset.uri);
        setProofImage({
          uri: compressedUri,
          name: asset.fileName || `proof_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: compressedSize || asset.fileSize || 0,
        });
      }
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handlePickFromGallery = async () => {
    setShowUploadModal(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const { uri: compressedUri, size: compressedSize } = await compressImage(asset.uri);
        setProofImage({
          uri: compressedUri,
          name: asset.fileName || `proof_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: compressedSize || asset.fileSize || 0,
        });
      }
    } catch {
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
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const isPdf = asset.mimeType?.includes('pdf');
        let finalUri = asset.uri;
        let finalSize = asset.size || 0;
        if (!isPdf) {
          const compressed = await compressImage(asset.uri);
          finalUri = compressed.uri;
          finalSize = compressed.size || asset.size || 0;
        }
        setProofImage({
          uri: finalUri,
          name: asset.name || `proof_${Date.now()}`,
          type: isPdf ? 'application/pdf' : 'image/jpeg',
          size: finalSize,
        });
      }
    } catch {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const amt = parseFloat(String(paymentAmount).trim().replace(/[^0-9.]/g, '')) || 0;

    if (amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
      return false;
    }

    if (paymentMethod === 'CASH' && !voucherNumber.trim()) {
      Alert.alert('Missing Voucher', 'Please enter the cash receipt / voucher number for CASH payments.');
      return false;
    }

    if (paymentMethod === 'UPI' && !upiId.trim()) {
      Alert.alert('Missing UPI ID', 'Please enter the UPI ID or UTR number.');
      return false;
    }

    if (paymentMethod === 'ACCOUNT' && !selectedBankId) {
      Alert.alert('No Account Selected', 'Please select a bank account for ACCOUNT payments.');
      return false;
    }

    if (!proofImage) {
      Alert.alert(
        'Payment Proof Required',
        'Every payment requires a proof image (receipt, bank screenshot, or voucher). Please attach one.',
        [{ text: 'Attach Proof', onPress: () => setShowUploadModal(true) }]
      );
      return false;
    }

    if (isFinalSettlement && applyGst && !customerGstNumber.trim()) {
      Alert.alert(
        'GST Number Required',
        'A customer GSTIN is required when applying GST to the final settlement.'
      );
      return false;
    }

    return true;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    if (!quotationId) {
      Alert.alert('Missing Quotation', 'This payment requires a quotation ID. Please go back and try again.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUploadProgress(null);

    const onUploadProgress = ({ loaded, total, lengthComputable }) => {
      if (lengthComputable && total > 0) {
        setUploadProgress({
          loaded,
          total,
          percent: Math.min(Math.round((loaded / total) * 100), 100),
        });
      } else {
        // Total unknown — show indeterminate bytes sent
        setUploadProgress({ loaded, total: 0, percent: -1 });
      }
    };

    const amt = Math.round(parseFloat(String(paymentAmount).trim().replace(/[^0-9.]/g, '')) || 0);

    try {
      const basePayload = {
        amount: amt,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        paymentDate: toISODate(dateObj),
        notes: notes.trim() || undefined,
        ...(proofImage ? { proofImage } : {}),
      };

      if (paymentMethod === 'CASH') {
        basePayload.voucher = voucherNumber.trim();
      } else if (paymentMethod === 'UPI') {
        basePayload.upiId = upiId.trim();
      } else if (paymentMethod === 'ACCOUNT') {
        const selectedBank = bankAccounts.find((b) => String(b.id) === String(selectedBankId));
        basePayload.accountId = selectedBank ? Number(selectedBank.id) : undefined;
      }

      let result;
      if (isFinalSettlement) {
        const finalPayload = {
          ...basePayload,
          applyGst,
          customerGstNumber: applyGst ? customerGstNumber.trim() : undefined,
        };
        result = await quotationPaymentRepository.recordFinalSettlement(
          quotationId,
          finalPayload,
          { onUploadProgress }
        );
      } else {
        result = await quotationPaymentRepository.recordPayment(
          quotationId,
          basePayload,
          { onUploadProgress }
        );
      }

      if (result?.success) {
        const summary = result.data?.summary || {};
        const paymentStatus = summary?.progress?.paymentStatus || '';
        const gstDecision = summary?.gstDecision || '';

        const isFullyPaidNow = paymentStatus === 'FULLY_PAID' || isFinalSettlement;
        const alertButtons = isFullyPaidNow
          ? [
              {
                text: 'Done',
                onPress: () => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                },
              },
            ]
          : [
              {
                text: 'Done',
                onPress: () => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                },
              },
            ];

        Alert.alert(
          isFinalSettlement ? 'Final Settlement Recorded' : 'Payment Recorded',
          result.message ||
            (isFinalSettlement
              ? `Final settlement completed. GST: ${gstDecision || (applyGst ? 'APPLIED' : 'OPTED_OUT')}. Status: ${paymentStatus || 'FULLY_PAID'}.`
              : 'Payment recorded successfully. Awaiting Admin verification.'),
          alertButtons
        );
      } else {
        Alert.alert(
          'Payment Failed',
          result?.message || 'Failed to record payment. Please try again.'
        );
      }
    } catch (err) {
      Alert.alert('Error', extractApiErrorMessage(err, 'Failed to record payment'));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  // ─── Derived display values ──────────────────────────────────────────────
  const pricing = paymentSummary?.pricing || {};
  const progress = paymentSummary?.progress || {};
  const withoutGstTotal = Math.round(Number(pricing.withoutGstTotal ?? params.withoutGstTotal ?? 0));
  const withGstTotal = Math.round(Number(pricing.withGstTotal ?? params.withGstBalance ?? 0));
  const totalPaid = Math.round(Number(progress.totalPaid ?? 0));
  const withoutGstBalance = Math.round(Number(progress.withoutGstBalance ?? params.remainingBalance ?? 0));
  const withGstBalance = Math.round(Number(progress.withGstBalance ?? params.withGstBalance ?? 0));
  const paymentStatus = progress.paymentStatus || 'UNPAID';
  const hasUnverifiedPayments = Boolean(paymentSummary?.hasUnverifiedPayments);
  const gstDecision = paymentSummary?.gstDecision || 'PENDING';

  const selectedBank = bankAccounts.find((b) => String(b.id) === String(selectedBankId)) || bankAccounts[0] || null;

  const formTitle = isFinalSettlement ? 'Final Settlement' : 'Record Payment';
  const formSubtitle = isFinalSettlement
    ? 'Choose GST treatment and settle the remaining balance'
    : 'Record an intermediate payment against the quotation';

  const C = {
    bg: isDark ? '#0F172A' : '#F4F8FC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    text: isDark ? '#F1F5F9' : '#0F172A',
    sub: isDark ? '#94A3B8' : '#64748B',
    primary: '#2557C7',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    inputBg: isDark ? '#0F172A' : '#F8FAFC',
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.primary,
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={{ padding: 4 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>{formTitle}</Text>
        </View>
        {isFinalSettlement && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>FINAL</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom + 24, 48) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loading indicator */}
          {isLoadingSummary && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={C.primary} />
              <Text style={{ color: C.sub, fontSize: 13, marginTop: 8 }}>Loading payment information…</Text>
            </View>
          )}

          {/* Client info card */}
          {(clientName || displayQuoteId) ? (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="person" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  {clientName ? (
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{clientName}</Text>
                  ) : null}
                  {mobileNumber ? (
                    <Text style={{ fontSize: 13, color: C.sub, marginTop: 1 }}>{mobileNumber}</Text>
                  ) : null}
                  {displayQuoteId ? (
                    <Text style={{ fontSize: 12, color: C.primary, marginTop: 2, fontWeight: '600' }}>
                      Quotation {displayQuoteId}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Payment summary card (from API) */}
          {paymentSummary && (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Payment Progress
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: C.sub }}>Without GST Total</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
                  ₹{withoutGstTotal.toLocaleString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: C.sub }}>Total Paid</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.success }}>
                  ₹{totalPaid.toLocaleString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: C.sub }}>Remaining Balance</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: withoutGstBalance > 0 ? C.danger : C.success }}>
                  ₹{withoutGstBalance.toLocaleString()}
                </Text>
              </View>
              {/* {withGstBalance > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: C.sub }}>Balance with GST</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
                    ₹{withGstBalance.toLocaleString()}
                  </Text>
                </View>
              )} */}
            </View>
          )}

          {/* Fully Paid Status & Create Full Receipt banner */}
          {(paymentStatus === 'FULLY_PAID' || (withoutGstBalance <= 0 && totalPaid > 0)) && (
            <View style={[styles.card, { backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#DCFCE7', borderColor: '#86EFAC', marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                    Quotation Fully Paid
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#15803D' }}>
                  All scheduled payments for this quotation have been settled.
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: '#059669',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
                onPress={() => {
                  router.push({
                    pathname: '/receipt',
                    params: {
                      id: params.id,
                      quotationId: quotationId,
                      isFullServiceReceipt: 'true',
                      hasGst: (gstDecision === 'APPLIED' || params.hasGst === 'true') ? 'true' : 'false',
                    },
                  });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                  Create Full Receipt
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sequential verification guard warning */}
          {hasUnverifiedPayments && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB', borderColor: '#FDE68A', marginBottom: 14 }]}>
              <Ionicons name="shield-outline" size={20} color={C.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FBBF24' : '#92400E' }}>
                  Previous Payment Awaiting Verification
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? '#FDE68A' : '#B45309', marginTop: 2 }}>
                  The Admin must verify the last payment before a new payment can be recorded.
                </Text>
              </View>
            </View>
          )}

          {/* GST Decision section (final settlement only) */}
          {isFinalSettlement && (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 }}>
                GST Treatment
              </Text>
              <Text style={{ fontSize: 13, color: C.sub, marginBottom: 14, lineHeight: 18 }}>
                Choose how GST applies to the final settlement. This decision is permanent once submitted.
              </Text>

              {/* Without GST option */}
              <TouchableOpacity
                style={[
                  styles.gstOption,
                  {
                    borderColor: !applyGst ? C.primary : C.border,
                    backgroundColor: !applyGst ? (isDark ? '#1E3A8A22' : '#EFF6FF') : C.inputBg,
                  },
                ]}
                onPress={() => setApplyGst(false)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.radioOuter, { borderColor: !applyGst ? C.primary : C.border }]}>
                    {!applyGst && <View style={[styles.radioInner, { backgroundColor: C.primary }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Without GST</Text>
                    <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                      Settle ₹{withoutGstBalance.toLocaleString()} · Quotation: OPTED_OUT
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* With GST option */}
              <TouchableOpacity
                style={[
                  styles.gstOption,
                  {
                    borderColor: applyGst ? C.success : C.border,
                    backgroundColor: applyGst ? (isDark ? '#06402B22' : '#DCFCE7') : C.inputBg,
                    marginTop: 10,
                  },
                ]}
                onPress={() => setApplyGst(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.radioOuter, { borderColor: applyGst ? C.success : C.border }]}>
                    {applyGst && <View style={[styles.radioInner, { backgroundColor: C.success }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>With 18% GST</Text>
                    <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                      Settle ₹{withGstBalance.toLocaleString()} · Quotation: APPLIED
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Customer GSTIN (required when applyGst = true) */}
              {applyGst && (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.label, { color: C.sub }]}>Customer GSTIN *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
                    value={customerGstNumber}
                    onChangeText={setCustomerGstNumber}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    placeholderTextColor={C.sub}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
              )}
            </View>
          )}

          {/* Amount */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
            <Text style={[styles.label, { color: C.sub }]}>
              Payment Amount (₹) *
            </Text>
            <TextInput
              style={[styles.inputLarge, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.sub}
              editable={!isSubmitting}
            />
            {isFinalSettlement && (
              <Text style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>
                {applyGst
                  ? `With GST balance: ₹${withGstBalance.toLocaleString()}`
                  : `Without GST balance: ₹${withoutGstBalance.toLocaleString()}`}
              </Text>
            )}
          </View>

          {/* Payment method */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
            <Text style={[styles.label, { color: C.sub, marginBottom: 10 }]}>Payment Method *</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['CASH', 'UPI', 'ACCOUNT'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodBtn,
                    {
                      flex: 1,
                      borderColor: paymentMethod === method ? C.primary : C.border,
                      backgroundColor: paymentMethod === method
                        ? (isDark ? '#1E3A8A22' : '#EFF6FF')
                        : C.inputBg,
                    },
                  ]}
                  onPress={() => setPaymentMethod(method)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={method === 'CASH' ? 'cash-outline' : method === 'UPI' ? 'phone-portrait-outline' : 'card-outline'}
                    size={16}
                    color={paymentMethod === method ? C.primary : C.sub}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: paymentMethod === method ? C.primary : C.sub, marginTop: 3 }}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Method-specific fields */}
            {paymentMethod === 'CASH' && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: C.sub }]}>Voucher Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
                  value={voucherNumber}
                  onChangeText={setVoucherNumber}
                  placeholder="Cash receipt / voucher number"
                  placeholderTextColor={C.sub}
                  editable={!isSubmitting}
                />
              </View>
            )}

            {paymentMethod === 'UPI' && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: C.sub }]}>UPI ID / UTR Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="e.g. client@upi or UPI12345678"
                  placeholderTextColor={C.sub}
                  editable={!isSubmitting}
                />
              </View>
            )}

            {paymentMethod === 'ACCOUNT' && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: C.sub }]}>Bank Account *</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => bankAccounts.length > 0 ? setShowBankPicker(true) : Alert.alert('No Accounts', 'No bank accounts found. Please configure bank accounts first.')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, color: selectedBank ? C.text : C.sub, flex: 1 }}>
                    {selectedBank
                      ? `${selectedBank.name}${selectedBank.accountNumber ? ` ····${selectedBank.accountNumber.slice(-4)}` : ''}`
                      : 'Select bank account'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.sub} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Reference Number */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
            <Text style={[styles.label, { color: C.sub }]}>Reference Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="Bank ref / transaction ID (optional)"
              placeholderTextColor={C.sub}
              editable={!isSubmitting}
            />

            {/* Payment Date */}
            <Text style={[styles.label, { color: C.sub, marginTop: 14 }]}>Payment Date *</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, color: C.text }}>{toDisplayDate(dateObj) || 'Select date'}</Text>
              <Ionicons name="calendar-outline" size={16} color={C.sub} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setDateObj(selected);
                }}
              />
            )}
          </View>

          {/* Notes */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 14 }]}>
            <Text style={[styles.label, { color: C.sub }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text, minHeight: 72, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes about this payment…"
              placeholderTextColor={C.sub}
              multiline
              numberOfLines={3}
              editable={!isSubmitting}
            />
          </View>

          {/* Proof Image — MANDATORY */}
          <View style={[styles.card, { backgroundColor: C.card, borderColor: proofImage ? C.border : C.danger + '88', marginBottom: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="image-outline" size={18} color={proofImage ? C.success : C.danger} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                Payment Proof *
              </Text>
              <View style={{ backgroundColor: C.danger + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.danger }}>REQUIRED</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: C.sub, marginBottom: 12, lineHeight: 17 }}>
              Attach a receipt, bank screenshot, or voucher. Required for Admin verification.
            </Text>

            {proofImage ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: C.success + '22', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons
                      name={proofImage.type?.includes('pdf') ? 'document-outline' : 'image-outline'}
                      size={20}
                      color={C.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }} numberOfLines={1}>
                      {proofImage.name}
                    </Text>
                    {proofImage.size > 0 && (
                      <Text style={{ fontSize: 11, color: C.sub }}>{formatFileSize(proofImage.size)}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setProofImage(null)} style={{ padding: 6 }}>
                    <Ionicons name="close-circle" size={22} color={C.danger} />
                  </TouchableOpacity>
                </View>
                {proofImage.uri && !proofImage.type?.includes('pdf') && (
                  <TouchableOpacity onPress={() => setShowPreviewModal(true)} activeOpacity={0.85}>
                    <Image
                      source={{ uri: proofImage.uri }}
                      style={{ width: '100%', height: 160, borderRadius: 10, backgroundColor: C.border }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadBtn, { borderColor: C.danger + '88', backgroundColor: C.danger + '08' }]}
                onPress={() => setShowUploadModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={C.danger} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.danger, marginTop: 6 }}>
                  Attach Proof Image
                </Text>
                <Text style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                  Photo, Gallery, or PDF
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: isSubmitting || hasUnverifiedPayments
                  ? (isDark ? '#334155' : '#CBD5E1')
                  : (isFinalSettlement ? C.success : C.primary),
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || hasUnverifiedPayments}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={isFinalSettlement ? 'checkmark-done' : 'add-circle-outline'}
                  size={20}
                  color={hasUnverifiedPayments ? '#94A3B8' : '#FFFFFF'}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: hasUnverifiedPayments ? '#94A3B8' : '#FFFFFF',
                    marginLeft: 8,
                  }}
                >
                  {isFinalSettlement ? 'Submit Final Settlement' : 'Record Payment'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {hasUnverifiedPayments && (
            <Text style={{ fontSize: 12, color: C.warning, textAlign: 'center', marginTop: 8, fontWeight: '600' }}>
              Admin must verify the previous payment before recording a new one.
            </Text>
          )}

          {/* ── Inline Upload Progress Monitor ───────────────────────────── */}
          {isSubmitting && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: C.card,
                  borderColor: C.primary + '55',
                  marginTop: 12,
                  padding: 14,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                  {uploadProgress?.percent === 100
                    ? 'Processing on server…'
                    : 'Uploading payment…'}
                </Text>
                {uploadProgress && uploadProgress.percent >= 0 && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, marginLeft: 'auto' }}>
                    {uploadProgress.percent}%
                  </Text>
                )}
              </View>

              {/* Progress bar track */}
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isDark ? '#334155' : '#E2E8F0',
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: uploadProgress?.percent === 100 ? C.success : C.primary,
                    width: uploadProgress && uploadProgress.percent >= 0
                      ? `${uploadProgress.percent}%`
                      : '30%',  // indeterminate placeholder width
                  }}
                />
              </View>

              {/* Byte counter */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: C.sub }}>
                  {uploadProgress
                    ? `${formatFileSize(uploadProgress.loaded)} sent`
                    : 'Preparing…'}
                </Text>
                {uploadProgress?.total > 0 && (
                  <Text style={{ fontSize: 11, color: C.sub }}>
                    of {formatFileSize(uploadProgress.total)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Upload source modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowUploadModal(false)}
        >
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: 'center' }}>
              Attach Proof
            </Text>
            {[
              { icon: 'camera-outline', label: 'Take Photo', onPress: handleTakePhoto },
              { icon: 'images-outline', label: 'Choose from Gallery', onPress: handlePickFromGallery },
              { icon: 'document-outline', label: 'Choose File / PDF', onPress: handleChooseFile },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 14 }}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={item.icon} size={20} color={C.primary} />
                </View>
                <Text style={{ fontSize: 15, color: C.text, fontWeight: '600' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={{ marginTop: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={{ fontSize: 15, color: C.danger, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image preview modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10 }}
            onPress={() => setShowPreviewModal(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {proofImage?.uri && (
            <Image
              source={{ uri: proofImage.uri }}
              style={{ width: '90%', height: '70%', borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Bank account picker modal */}
      <Modal
        visible={showBankPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowBankPicker(false)}
        >
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 16, maxHeight: '60%' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 }}>Select Bank Account</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {bankAccounts.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                    gap: 12,
                  }}
                  onPress={() => {
                    setSelectedBankId(String(bank.id));
                    setShowBankPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: String(bank.id) === String(selectedBankId) ? C.primary + '22' : C.border + '55',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons
                      name="card-outline"
                      size={18}
                      color={String(bank.id) === String(selectedBankId) ? C.primary : C.sub}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{bank.name}</Text>
                    {bank.accountNumber ? (
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                        ····{bank.accountNumber.slice(-4)}
                        {bank.ifsc ? ` · ${bank.ifsc}` : ''}
                      </Text>
                    ) : null}
                    {bank.isPrimary && (
                      <Text style={{ fontSize: 10, color: C.primary, fontWeight: '700', marginTop: 2 }}>PRIMARY</Text>
                    )}
                  </View>
                  {String(bank.id) === String(selectedBankId) && (
                    <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputLarge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
  },
  methodBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  gstOption: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2557C7',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});