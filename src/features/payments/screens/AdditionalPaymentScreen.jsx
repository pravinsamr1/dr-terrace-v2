import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [workDescription, setWorkDescription] = useState(params.workDescription || params.description || '');
  const [area, setArea] = useState(params.area ? String(params.area) : '');
  const [rate, setRate] = useState(params.rate ? String(params.rate) : '');
  const [warranty, setWarranty] = useState(params.warranty || '');
  const [notes, setNotes] = useState(params.notes || '');
  const [paymentAmount, setPaymentAmount] = useState(params.amount != null && params.amount !== '' ? String(params.amount) : '');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);

  // API v2: Quotation ID & PayView
  const [quotationId, setQuotationId] = useState(params.quotationId || null);
  const [payView, setPayView] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'upi' | 'accounts' | 'cash'
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [showBankPickerModal, setShowBankPickerModal] = useState(false);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  // Load payView from API v2 when quotationId is available (provides bank accounts)
  useEffect(() => {
    if (!quotationId) return;
    let isMounted = true;
    paymentRepository.getPayView(quotationId).then((res) => {
      if (!isMounted) return;
      if (res?.success && res.data) {
        setPayView(res.data);
        const accounts = res.data.accounts;
        if (Array.isArray(accounts) && accounts.length > 0) {
          const normalized = accounts.map((a, i) => ({
            id: String(a.id || `bank_${i}`),
            name: a.accountName || a.bankName || a.name || `Account ${i + 1}`,
            isPrimary: Boolean(a.isPrimary || i === 0),
            accountNumber: String(a.accountNumber || ''),
            ifsc: String(a.ifscCode || a.ifsc || ''),
            beneficiary: a.accountName || '',
            branch: a.branchName || '',
          }));
          setBankAccounts(normalized);
          const primary = normalized.find((b) => b.isPrimary) || normalized[0];
          if (primary) setSelectedBankId(primary.id);
        }
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [quotationId]);



  // Document upload state
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    setPaymentDate(formatDateDDMMYY(new Date()));
  }, []);

  useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        const appt = res.appointment;
        setClient(appt);
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
            setClient(clientData);
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

  // Recalculate amount whenever area or rate changes (if not manually overridden)
  useEffect(() => {
    const numArea = parseFloat(area) || 0;
    const numRate = parseFloat(rate) || 0;
    const calculated = Math.round(numArea * numRate);
    if (!isAmountManuallyEdited) {
      setPaymentAmount(calculated > 0 ? String(calculated) : '');
    }
  }, [area, rate, isAmountManuallyEdited]);

  const numArea = parseFloat(area) || 0;
  const numRate = parseFloat(rate) || 0;
  const calculatedBase = Math.round(numArea * numRate);

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;

  const rawClientName = client?.clientName || client?.name || client?.customerName || params.clientName || params.customerName || '';
  const displayName = rawClientName.trim() ? `${rawClientName.trim()}` : '';
  const rawId = client?.id || params.id || '';
  const displayId = rawId ? `DR${rawId}` : '';
  const displayPhone = client?.phone || client?.mobile || client?.mobileNumber || params.phone || '';
  const displayArea = client?.area || client?.location || client?.city || params.area || '';
  const totalProjectCost = Number(params.totalCost) || Number(client?.totalPayment) || Number(client?.totalCost) || Number(client?.cost) || 0;

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
        Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || `proof_photo_${Date.now()}.jpg`;
        setAttachedDoc({
          uri: asset.uri,
          name: filename,
          type: 'image',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open camera.');
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
        setAttachedDoc({
          uri: asset.uri,
          name: asset.name || 'attachment_proof.pdf',
          type: asset.mimeType?.includes('pdf') ? 'pdf' : 'file',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!workDescription.trim()) {
      Alert.alert('Missing Field', 'Please enter a payment title or work description.');
      return;
    }
    const cleanAmtStr = String(paymentAmount ?? '').trim().replace(/[^0-9.]/g, '');
    const numericAmt = parseFloat(cleanAmtStr) || 0;
    if (isNaN(numericAmt) || numericAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (paymentMethod === 'cash' && !voucherNumber.trim()) {
      Alert.alert('Missing Field', 'Please enter cash voucher / receipt number.');
      return;
    }
    if (paymentMethod === 'upi' && !upiTransactionId.trim()) {
      Alert.alert('Missing Field', 'Please enter UPI transaction ID or UTR number.');
      return;
    }

    const appId = client?.id || params.id;
    setIsSubmitting(true);

    try {
      if (quotationId) {
        // ── API v2 Path: Atomic Service Creation + Inline Payment (Endpoint 3 & Rule 17) ──
        let methodFields = {};
        if (paymentMethod === 'cash') {
          methodFields = { paymentMethod: 'CASH', voucher: voucherNumber.trim() };
        } else if (paymentMethod === 'accounts') {
          const selBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0];
          methodFields = { paymentMethod: 'ACCOUNT', accountId: selBank ? Number(selBank.id) || selBank.id : undefined };
        } else if (paymentMethod === 'upi') {
          methodFields = { paymentMethod: 'UPI', upiId: upiTransactionId.trim() };
        }

        const servicePayload = {
          title: workDescription.trim(),
          sqft: numArea || undefined,
          rate: numRate || undefined,
          totalPrice: numericAmt,
          warranty: warranty.trim() || undefined,
          notes: (paymentDate ? `${paymentDate} - ` : '') + (notes.trim() || ''),
          // Inline payment fields for atomic creation & ledger linking
          amount: numericAmt,
          ...methodFields,
          ...(attachedDoc ? { proofImage: attachedDoc } : {}),
        };

        const createRes = await paymentRepository.createAdditionalService(quotationId, servicePayload);
        if (!createRes?.success) throw new Error(createRes?.message || 'Could not create variation service.');

        // Update local appointment cache so the record is immediately visible on return
        if (appId) {
          try {
            const additionalRecord = {
              id: createRes?.data?.id || createRes?.data?.additionalService?.id || Date.now(),
              type: 'additional',
              title: workDescription.trim(),
              area: numArea,
              rate: numRate,
              warranty: warranty.trim(),
              notes: notes.trim(),
              amount: numericAmt,
              totalPrice: numericAmt,
              paymentMethod,
              voucherNumber: paymentMethod === 'cash' ? voucherNumber.trim() : null,
              transactionId: paymentMethod === 'upi' ? upiTransactionId.trim() : null,
              paymentDate: paymentDate || formatDateDDMMYY(new Date()),
              document: attachedDoc ? attachedDoc.name : null,
              status: 'paid',
            };
            const currentAdditionals = client?.additionalPayments || [];
            await appointmentRepository.updateAppointment(appId, {
              additionalPayments: [...currentAdditionals, additionalRecord],
            });
          } catch (_e) {
            // Non-blocking local cache update
          }
        }
      } else {
        // ── Legacy Path ─────────────────────────────────────────────────────
        if (appId) {
          const additionalRecord = {
            id: Date.now(),
            type: 'additional',
            title: workDescription.trim(),
            area: numArea,
            rate: numRate,
            warranty: warranty.trim(),
            notes: notes.trim(),
            amount: numericAmt,
            paymentMethod,
            voucherNumber: paymentMethod === 'cash' ? voucherNumber.trim() : null,
            transactionId: paymentMethod === 'upi' ? upiTransactionId.trim() : null,
            paymentDate: paymentDate || formatDateDDMMYY(new Date()),
            document: attachedDoc ? attachedDoc.name : null,
            status: 'paid',
          };
          const currentAdditionals = client?.additionalPayments || [];
          await appointmentRepository.updateAppointment(appId, {
            additionalPayments: [...currentAdditionals, additionalRecord],
          });
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      const displayMsg = extractApiErrorMessage(err, 'Could not record additional payment. Please try again.');
      Alert.alert('Submission Failed', displayMsg);
      return;
    } finally {
      setIsSubmitting(false);
    }



    Alert.alert(
      'Additional Payment Submitted',
      `Successfully recorded additional payment of ₹${numericAmt.toLocaleString()} for "${workDescription.trim()}".`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({
                pathname: '/customer-detail',
                params: { id: client?.id || params.id, initialTab: 'payment' },
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

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Additional Payment</Text>
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
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>₹{totalProjectCost.toLocaleString()} Total</Text>
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
        {/* 1. Payment Title / Work Description */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Payment Title / Work Description <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <TextInput
              style={[styles.textInput, isDark && styles.textDark]}
              placeholder="Enter payment title / work description"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={workDescription}
              onChangeText={setWorkDescription}
            />
          </View>
        </View>

        {/* 2. Area & Rate 2-Column Row */}
        <View style={styles.rowTwoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Area (Sq. Ft) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainerWithBadge, isDark && styles.inputContainerDark]}>
              <TextInput
                style={[styles.numericInput, isDark && styles.textDark]}
                placeholder="0"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="numeric"
                value={area}
                onChangeText={(val) => {
                  setArea(val);
                  setIsAmountManuallyEdited(false);
                }}
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>sq.ft</Text>
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Rate per Sq. Ft (₹) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainerWithBadge, isDark && styles.inputContainerDark]}>
              <TextInput
                style={[styles.numericInput, isDark && styles.textDark]}
                placeholder="0"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="numeric"
                value={rate}
                onChangeText={(val) => {
                  setRate(val);
                  setIsAmountManuallyEdited(false);
                }}
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
              Calculated: {numArea} sq.ft × ₹{numRate} ={' '}
              <Text style={{ fontWeight: '700' }}>₹{calculatedBase.toLocaleString()}</Text>
            </Text>
          </View>
          <View style={styles.calcHelperTag}>
            <Text style={styles.calcHelperTagText}>Base</Text>
          </View>
        </View>

        {/* 3b. Warranty Period */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Warranty Period
          </Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, isDark && styles.textDark]}
              placeholder="e.g. 2 Years or None"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={warranty}
              onChangeText={setWarranty}
            />
          </View>
        </View>

        {/* 3c. Notes */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.textDark]}>
            Notes
          </Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, { alignItems: 'flex-start', paddingVertical: 10 }]}>
            <TextInput
              style={[styles.textInput, isDark && styles.textDark, { minHeight: 52 }]}
              placeholder="Optional notes about this work order"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        {/* 4. Payment Amount Input */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>
              Payment Amount (₹) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.autoCalcPill}>
              <Text style={styles.autoCalcPillText}>Auto-calculated</Text>
            </View>
          </View>

          <View style={[styles.amountInputBox, isDark && styles.amountInputBoxDark]}>
            <Ionicons name="cash-outline" size={24} color="#2557C7" style={{ marginRight: 10 }} />
            <Text style={[styles.currencyPrefix, isDark && styles.textDark]}>Rs.</Text>
            <TextInput
              style={[styles.amountInput, isDark && styles.textDark]}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={paymentAmount}
              onChangeText={(val) => {
                const filtered = val.replace(/[^0-9.]/g, '');
                const parts = filtered.split('.');
                const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : filtered;
                setPaymentAmount(sanitized);
                setIsAmountManuallyEdited(true);
              }}
            />
          </View>
        </View>

        {/* 5. Payment Method Tabs */}
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
              style={[styles.methodTab, paymentMethod === 'accounts' && styles.methodTabActive]}
              onPress={() => setPaymentMethod('accounts')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="card-outline"
                size={16}
                color={paymentMethod === 'accounts' ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
              />
              <Text style={[styles.methodTabText, paymentMethod === 'accounts' && styles.methodTabTextActive]}>
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

        {paymentMethod === 'accounts' && bankAccounts.length > 0 && selectedBank && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.textDark]}>
              Select Bank Account <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.selectAccountTrigger, isDark && styles.inputContainerDark]}
              onPress={() => setShowBankPickerModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="business-outline" size={18} color="#2557C7" style={{ marginRight: 8 }} />
              <Text style={[styles.selectAccountText, isDark && styles.textDark]} numberOfLines={1}>
                {selectedBank?.name}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* Bank Details Card */}
            <View style={styles.bankDetailCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.bankDetailTitle} numberOfLines={1}>{selectedBank?.name}</Text>
                {selectedBank?.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                )}
              </View>
              <View style={styles.bankDetailDivider} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankDetailLabel}>Account Number</Text>
                  <Text style={styles.bankDetailValue}>{selectedBank?.accountNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankDetailLabel}>IFSC Code</Text>
                  <Text style={styles.bankDetailValue}>{selectedBank?.ifsc}</Text>
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <Text style={styles.bankDetailLabel}>Beneficiary Name & ID</Text>
                <Text style={styles.bankDetailValue}>{selectedBank?.beneficiary}</Text>
              </View>
            </View>
          </View>
        )}

        {paymentMethod === 'accounts' && bankAccounts.length === 0 && (
          <View style={styles.formGroup}>
            <View style={[styles.bankDetailCard, { paddingVertical: 14, alignItems: 'center' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#64748B" style={{ marginBottom: 6 }} />
              <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' }}>
                No company bank accounts configured.
              </Text>
            </View>
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

        {/* 6. Payment Date */}
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

        {/* 7. Additional Work Proof / Attachment (Optional) */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.label, isDark && styles.textDark, { marginBottom: 0 }]}>
              Additional Work Proof / Attachment
            </Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>Optional</Text>
            </View>
          </View>
          <Text style={[styles.helperSubtext, isDark && styles.subtextDark]}>
            Attach measurement sheet, site photos, or signed approval note.
          </Text>

          {!attachedDoc ? (
            <TouchableOpacity
              style={styles.dashedUploadButton}
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#1E488F" style={{ marginRight: 6 }} />
              <Text style={styles.dashedUploadText}>Attach Measurement Sheet / Photo</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.attachedDocCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={styles.docIconBox}>
                  <Ionicons
                    name={attachedDoc.type === 'pdf' ? 'document-text-outline' : 'image-outline'}
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachedDocName} numberOfLines={1}>{attachedDoc.name}</Text>
                  <Text style={styles.attachedDocStatus}>Ready for settlement</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setAttachedDoc(null)}
                style={styles.removeDocBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
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
              {isSubmitting ? 'Submitting...' : 'Submit Additional Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bank Account Selection Modal */}
      <Modal
        visible={showBankPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBankPickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBankPickerModal(false)}
        >
          <View style={[styles.modalSheet, isDark && styles.modalSheetDark]}>
            <View style={styles.modalDragHandle} />
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Select Bank Account</Text>
            {bankAccounts.length === 0 ? (
              <Text style={{ textAlign: 'center', color: isDark ? '#94A3B8' : '#64748B', paddingVertical: 16 }}>
                No bank accounts available
              </Text>
            ) : (
              bankAccounts.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[
                    styles.bankOptionRow,
                    selectedBankId === bank.id && styles.bankOptionRowSelected,
                  ]}
                  onPress={() => {
                    setSelectedBankId(bank.id);
                    setShowBankPickerModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bankOptionName, selectedBankId === bank.id && { color: '#1E488F', fontWeight: '700' }]}>
                      {bank.name}
                    </Text>
                    <Text style={styles.bankOptionMeta}>
                      A/C: {bank.accountNumber} • {bank.ifsc}
                    </Text>
                  </View>
                  {selectedBankId === bank.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#1E488F" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Upload Document Modal */}
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
                <Text style={[styles.uploadSheetTitle, isDark && styles.textDark]}>Upload Document</Text>
                <Text style={[styles.uploadSheetSub, isDark && styles.subtextDark]}>
                  Attach measurement sheet, site photos, or signed approval note.
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
                <Text style={styles.uploadOptionDesc}>Capture document directly using phone camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadOptionBtn} onPress={handleChooseFile} activeOpacity={0.8}>
              <View style={styles.uploadOptionIconBox}>
                <Ionicons name="folder-open" size={22} color="#214A8F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadOptionTitle}>Upload Document from Phone</Text>
                <Text style={styles.uploadOptionDesc}>Browse PDF, DOC, or image files from device storage</Text>
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
    padding: 0,
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
    padding: 0,
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
    marginTop: 2,
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
});
