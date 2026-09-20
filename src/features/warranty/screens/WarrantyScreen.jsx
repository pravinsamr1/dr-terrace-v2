import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { isValidPositiveNumber } from '../../../core/utils/validation';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal } from '../../../shared/components/material';
import { WARRANTY_DEFAULTS } from '../constants/warrantyConstants';

export default function GenerateWarrantyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Custom Alert & Validation Modal state
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

  const [warrantyYears, setWarrantyYears] = useState(WARRANTY_DEFAULTS.DEFAULT_DURATION);
  const [serviceType, setServiceType] = useState(WARRANTY_DEFAULTS.DEFAULT_SERVICE);
  const [issueDate, setIssueDate] = useState(new Date());
  const [errors, setErrors] = useState({});

  // Picker toggles
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [yearsDropdownOpen, setYearsDropdownOpen] = useState(false);

  // Certificate Modal State
  const [certificateVisible, setCertificateVisible] = useState(false);
  const [certCode, setCertCode] = useState('');

  const services = WARRANTY_DEFAULTS.SERVICES;
  const durations = WARRANTY_DEFAULTS.DURATIONS;

  const formatDate = (date) => {
    return formatDateDDMMYY(date);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'Customer Name is required.';
    } else if (customerName.trim().length < 2) {
      newErrors.customerName = 'Customer Name must be at least 2 characters.';
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!phone.trim()) {
      newErrors.phone = 'Phone Number is required.';
    } else if (cleanPhone.length !== 10) {
      newErrors.phone = 'Enter a valid 10-digit mobile number.';
    }

    if (!address.trim()) {
      newErrors.address = 'Site Address is required.';
    }

    const cleanArea = area.replace(/[^0-9.]/g, '');
    if (!area.trim() || !isValidPositiveNumber(cleanArea)) {
      newErrors.area = 'Enter a valid total area (> 0).';
    }

    if (!invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Invoice Number is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerate = () => {
    if (!validateForm()) {
      showAlert('Validation Error', 'Please correct highlighted errors before generating warranty.', 'warning');
      return;
    }

    // Generate a random Certificate Code e.g. DTW-2026-9874
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setCertCode(`DTW-${issueDate.getFullYear()}-${randomNum}`);
    setCertificateVisible(true);
  };

  const handleDownload = () => {
    Alert.alert('Success', 'Warranty PDF downloaded to your device successfully.');
  };

  const handleShare = () => {
    Alert.alert('Shared', 'Warranty certificate PDF shared with client.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Generate Warranty" paddingTop={insets.top} isDark={isDark} />

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
        <Text style={[styles.subTitle, isDark && styles.textDark]}>
          Create Digital Warranty Certificate
        </Text>
        <Text style={[styles.description, isDark && styles.subtextDark]}>
          Enter the customer and project details below to issue a verified waterproofing warranty certificate.
        </Text>

        <View style={[styles.card, isDark && styles.cardDark]}>
          {/* Customer Name */}
          <Text style={[styles.label, isDark && styles.textDark]}>Customer Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.customerName && styles.inputWrapperError]}>
            <Ionicons name="person-outline" size={20} color={errors.customerName ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              placeholder="Enter Customer Name"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={customerName}
              onChangeText={(val) => {
                setCustomerName(val);
                if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: null }));
              }}
            />
          </View>
          {errors.customerName && <Text style={styles.errorText}>{errors.customerName}</Text>}

          {/* Phone Number */}
          <Text style={[styles.label, isDark && styles.textDark]}>Phone Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.phone && styles.inputWrapperError]}>
            <Ionicons name="call-outline" size={20} color={errors.phone ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              placeholder="Enter 10-digit Phone Number"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(val) => {
                setPhone(val);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
              }}
            />
          </View>
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

          {/* Site Address */}
          <Text style={[styles.label, isDark && styles.textDark]}>Site Address <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <View style={[styles.inputWrapper, styles.multilineInputWrapper, isDark && styles.inputWrapperDark, errors.address && styles.inputWrapperError]}>
            <Ionicons name="location-outline" size={20} color={errors.address ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')} style={[styles.inputIcon, { marginTop: 12 }]} />
            <TextInput
              style={[styles.input, styles.multilineInput, isDark && styles.textDark]}
              placeholder="Enter Waterproofing Site Address"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              numberOfLines={3}
              value={address}
              onChangeText={(val) => {
                setAddress(val);
                if (errors.address) setErrors((prev) => ({ ...prev, address: null }));
              }}
            />
          </View>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

          {/* Service Type Dropdown */}
          <Text style={[styles.label, isDark && styles.textDark]}>Service Type</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}
            onPress={() => setServiceDropdownOpen(!serviceDropdownOpen)}
            activeOpacity={0.8}
          >
            <Ionicons name="construct-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.inputIcon} />
            <Text style={[styles.dropdownValue, isDark && styles.textDark]}>{serviceType}</Text>
            <Ionicons name={serviceDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          {serviceDropdownOpen && (
            <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
              {services.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setServiceType(item);
                    setServiceDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, isDark && styles.textDark, serviceType === item && styles.boldItemText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Total Area & Invoice Number Row */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.label, isDark && styles.textDark]}>Total Area (Sq.ft) <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.area && styles.inputWrapperError]}>
                <TextInput
                  style={[styles.input, isDark && styles.textDark]}
                  placeholder="e.g. 1250"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardType="numeric"
                  value={area}
                  onChangeText={(val) => {
                    setArea(val);
                    if (errors.area) setErrors((prev) => ({ ...prev, area: null }));
                  }}
                />
              </View>
              {errors.area && <Text style={styles.errorText}>{errors.area}</Text>}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.label, isDark && styles.textDark]}>Invoice Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.invoiceNumber && styles.inputWrapperError]}>
                <TextInput
                  style={[styles.input, isDark && styles.textDark]}
                  placeholder="e.g. INV-1002"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={invoiceNumber}
                  onChangeText={(val) => {
                    setInvoiceNumber(val);
                    if (errors.invoiceNumber) setErrors((prev) => ({ ...prev, invoiceNumber: null }));
                  }}
                />
              </View>
              {errors.invoiceNumber && <Text style={styles.errorText}>{errors.invoiceNumber}</Text>}
            </View>
          </View>

          {/* Warranty Duration Dropdown */}
          <Text style={[styles.label, isDark && styles.textDark]}>Warranty Duration</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}
            onPress={() => setYearsDropdownOpen(!yearsDropdownOpen)}
            activeOpacity={0.8}
          >
            <Ionicons name="ribbon-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.inputIcon} />
            <Text style={[styles.dropdownValue, isDark && styles.textDark]}>{warrantyYears}</Text>
            <Ionicons name={yearsDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          {yearsDropdownOpen && (
            <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
              {durations.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setWarrantyYears(item);
                    setYearsDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, isDark && styles.textDark, warrantyYears === item && styles.boldItemText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Issue Date Picker */}
          <Text style={[styles.label, isDark && styles.textDark]}>Issue Date</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.inputIcon} />
            <Text style={[styles.dropdownValue, isDark && styles.textDark]}>{formatDate(issueDate)}</Text>
            <Ionicons name="calendar" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={issueDate}
              mode="date"
              display="default"
              onValueChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setIssueDate(selectedDate);
                }
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}

          {/* Generate Button */}
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
            <Text style={styles.btnText}>Generate Warranty Certificate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Certificate Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={certificateVisible}
        onRequestClose={() => setCertificateVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.certificateCard, isDark && styles.certificateCardDark]}>
            
            {/* Elegant Certificate Border Wrapper */}
            <View style={styles.certificateBorder}>
              {/* Seal Image/Icon */}
              <View style={styles.sealContainer}>
                <Ionicons name="ribbon" size={48} color="#D4AF37" />
              </View>

              <Text style={styles.certTitle}>CERTIFICATE OF WARRANTY</Text>
              <Text style={styles.certSub}>Issued by Dr.Terrace Waterproofing</Text>

              <View style={styles.certDivider} />

              <Text style={styles.certBody}>
                This certificate hereby guarantees that the waterproofing treatments executed at the premises listed below have been completed using premium technology and are warranted against leaks for the specified period from the date of issue.
              </Text>

              <View style={styles.certDetailsList}>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Certificate No:</Text>
                  <Text style={styles.certDetailVal}>{certCode}</Text>
                </View>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Client Name:</Text>
                  <Text style={styles.certDetailVal}>{customerName}</Text>
                </View>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Service Type:</Text>
                  <Text style={styles.certDetailVal}>{serviceType}</Text>
                </View>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Site Area:</Text>
                  <Text style={styles.certDetailVal}>{area} Sq.ft</Text>
                </View>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Warranty Period:</Text>
                  <Text style={[styles.certDetailVal, { color: '#059669', fontWeight: 'bold' }]}>{warrantyYears}</Text>
                </View>
                <View style={styles.certDetailRow}>
                  <Text style={styles.certDetailLabel}>Date of Issue:</Text>
                  <Text style={styles.certDetailVal}>{formatDate(issueDate)}</Text>
                </View>
              </View>

              <View style={styles.certDivider} />

              <View style={styles.certFooter}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLine}>___________________</Text>
                  <Text style={styles.signatureTitle}>Authorized Signature</Text>
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLine}>___________________</Text>
                  <Text style={styles.signatureTitle}>Technical Supervisor</Text>
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.downloadBtn]} onPress={handleDownload}>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalBtnText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.modalBtn, styles.shareBtn]} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setCertificateVisible(false)}>
              <Text style={styles.closeModalBtnText}>Close Certificate</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Custom Material Alert & Validation Modal */}
      <MaterialAlertModal
        visible={alertModalConfig.visible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        type={alertModalConfig.type}
        buttonText={alertModalConfig.buttonText}
        onClose={() => setAlertModalConfig((prev) => ({ ...prev, visible: false }))}
      />
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

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 20,
  },
  subTitle: {
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    },
  cardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  label: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 48,
    paddingHorizontal: 12,
  },
  inputWrapperDark: {
    backgroundColor: '#080808',
    borderColor: '#334155',
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    paddingLeft: 2,
  },
  multilineInputWrapper: {
    height: 80,
    alignItems: 'flex-start',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#0F172A',
    fontSize: 14,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  dropdownValue: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    paddingVertical: 8,
    zIndex: 100,
  },
  dropdownListDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
  },
  boldItemText: {
    color: '#0052CC',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  generateBtn: {
    backgroundColor: '#0052CC',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Modal styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  certificateCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    },
  certificateCardDark: {
    backgroundColor: '#1C1C1C',
  },
  certificateBorder: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#D4AF37', // Gold border
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFDF0', // Parchment color
    alignItems: 'center',
  },
  sealContainer: {
    marginBottom: 10,
    alignItems: 'center',
  },
  certTitle: {
    fontSize: 18,
    color: '#8A6F27',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  certSub: {
    fontSize: 11,
    color: '#B49342',
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },
  certDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#E5C060',
    marginVertical: 12,
  },
  certBody: {
    fontSize: 12,
    color: '#4A3E1E',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  certDetailsList: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
    padding: 12,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
  },
  certDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
  },
  certDetailLabel: {
    fontSize: 11,
    color: '#7D6A35',
  },
  certDetailVal: {
    fontSize: 11,
    color: '#1E293B',
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
  },
  signatureBox: {
    alignItems: 'center',
    width: '45%',
  },
  signatureLine: {
    fontSize: 10,
    color: '#8A6F27',
  },
  signatureTitle: {
    fontSize: 9,
    color: '#8A6F27',
    marginTop: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadBtn: {
    backgroundColor: '#D4AF37',
  },
  shareBtn: {
    backgroundColor: '#0052CC',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  closeModalBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  closeModalBtnText: {
    fontSize: 14,
    color: '#64748B',
  },
});
