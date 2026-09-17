import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../core/config/config';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { useOsmAreas, useOsmCities } from '../../../core/hooks/useOsmAreas';
import { getPincodeForArea } from '../../../shared/constants/chennai-areas';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { MaterialFormSkeleton, MaterialOverlayLoader, MaterialSuccessModal } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

import * as ImagePicker from 'expo-image-picker';
import { getInfoAsync } from 'expo-file-system/legacy';

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB max
const MAX_IMAGE_SIZE_MESSAGE = 'File size too large. Add photo up to 3MB.';

const checkFileSizeUnderLimit = async (uri, assetSize) => {
  if (typeof assetSize === 'number' && assetSize > 0) {
    return assetSize <= MAX_IMAGE_SIZE_BYTES;
  }
  if (!uri) return true;
  try {
    const info = await getInfoAsync(uri);
    if (info && info.exists && typeof info.size === 'number') {
      return info.size <= MAX_IMAGE_SIZE_BYTES;
    }
  } catch (_) {}
  return true;
};

const PRESETS_AVATARS = {
  employee_ganesh: require('../../../../assets/images/employee_ganesh.png'),
  technician_avatar: require('../../../../assets/images/technician_avatar.png'),
};

const formatErrorMessage = (rawMessage) => {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Something went wrong. Please try again.';
  }

  const msg = rawMessage.toLowerCase();

  if (
    msg.includes('413') ||
    msg.includes('payload too large') ||
    msg.includes('entity too large') ||
    msg.includes('maxuploadsize') ||
    msg.includes('file size') ||
    msg.includes('filesize') ||
    msg.includes('multipart')
  ) {
    return MAX_IMAGE_SIZE_MESSAGE;
  }

  if (
    msg.includes('employees_mobile_number_key') ||
    msg.includes('mobile_number_key') ||
    (msg.includes('duplicate key') && msg.includes('mobile')) ||
    (msg.includes('unique constraint') && msg.includes('mobile'))
  ) {
    return 'An employee with this mobile number already exists. Please use a different mobile number.';
  }

  if (
    msg.includes('aadhaar') &&
    (msg.includes('duplicate') || msg.includes('unique constraint') || msg.includes('key'))
  ) {
    return 'An employee with this Aadhaar number already exists. Please verify the Aadhaar number.';
  }

  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    return 'An employee with these details already exists. Please check the entered information.';
  }

  return rawMessage;
};

export default function EmployeeEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });

  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [state] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [role, setRole] = useState('Field Employee');
  const [avatarId, setAvatarId] = useState('technician_avatar');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [conveyanceAllowance, setConveyanceAllowance] = useState('');
  const [workingDays, setWorkingDays] = useState('');

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // OSM Area suggestions
  const {
    suggestions: filteredAreas,
    isLoading: isLoadingOsm,
    showSuggestions: showAreaSuggestions,
    setShowSuggestions: setShowAreaSuggestions,
  } = useOsmAreas(area, city);

  // OSM City suggestions
  const {
    citySuggestions: filteredCities,
    showCitySuggestions,
    setShowCitySuggestions,
  } = useOsmCities(city);

  useEffect(() => {
    loadEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadEmployeeData = async () => {
    setIsLoading(true);
    try {
      if (id) {
        const res = await employeeService.getEmployeeById(id);
        if (res.success && res.employee) {
          const emp = res.employee;
          setName(emp.name || emp.employeeName || '');
          setMobile(emp.mobileNumber || emp.mobile || '');
          setPassword(emp.password || '');
          setDoorNo(emp.doorNo || emp.address?.doorNo || '');
          setStreet(emp.streetName || emp.street || emp.address?.street || '');
          setArea(emp.area || emp.address?.area || '');
          setCity(emp.city || emp.address?.city || '');
          setPincode(emp.pincode || emp.address?.pincode || '');
          setAadhaar(emp.aadhaarNumber || emp.aadhaar || '');
          const isOffice = String(emp.employeeType || emp.role || '').toLowerCase().includes('office');
          setRole(isOffice ? 'Office Employee' : 'Field Employee');
          setAvatarId(emp.image || emp.employeeImage || 'technician_avatar');
          setMonthlySalary(emp.monthlyBase != null ? String(emp.monthlyBase) : (emp.monthlySalary != null ? String(emp.monthlySalary) : ''));
          setConveyanceAllowance(emp.conveyanceAllowance != null ? String(emp.conveyanceAllowance) : '');
          setWorkingDays(emp.monthlyWorkingDay != null ? String(emp.monthlyWorkingDay) : (emp.workingDaysPerMonth != null ? String(emp.workingDaysPerMonth) : ''));
        }
      }
    } catch (_err) {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarSource = (val) => {
    if (!val) return require('../../../../assets/images/technician_avatar.png');
    if (typeof val === 'string') {
      if (
        val.startsWith('file://') ||
        val.startsWith('content://') ||
        val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('ph://') ||
        val.startsWith('data:')
      ) {
        return { uri: val };
      }
      if (
        val.startsWith('/data/') ||
        val.startsWith('/var/') ||
        val.startsWith('/storage/') ||
        val.startsWith('/private/')
      ) {
        return { uri: `file://${val}` };
      }
      if (val.startsWith('/')) {
        const baseUrl = API_BASE_URL.split('/api')[0];
        return { uri: `${baseUrl}${val}` };
      }
    }
    return PRESETS_AVATARS[val] || (typeof val === 'number' ? val : require('../../../../assets/images/technician_avatar.png'));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Employee Name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }

    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (!mobile.trim()) {
      newErrors.mobile = 'Mobile Number is required.';
    } else if (cleanMobile.length !== 10) {
      newErrors.mobile = 'Enter a valid 10-digit mobile number.';
    }

    if (password.trim() && password.trim().length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }

    if (aadhaar.trim()) {
      const cleanAadhaar = aadhaar.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        newErrors.aadhaar = 'Aadhaar must be exactly 12 digits.';
      }
    }

    if (monthlySalary.trim() && Number(monthlySalary) <= 0) {
      newErrors.monthlySalary = 'Salary must be greater than 0.';
    }

    if (workingDays.trim()) {
      const days = Number(workingDays);
      if (isNaN(days) || days < 1 || days > 31) {
        newErrors.workingDays = 'Working days must be between 1 and 31.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveChanges = async () => {
    if (!validateForm() || isSubmitting) {
      if (!validateForm()) {
        setErrorModal({
          visible: true,
          title: 'Validation Error',
          message: 'Please check highlighted fields before submitting.',
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const fullAddress = `${doorNo.trim()}, ${street.trim()}, ${area.trim()}, ${city.trim()} - ${pincode.trim()}`;
      const isOfficeRole = String(role || '').toLowerCase().includes('office');
      const empType = isOfficeRole ? 'OfficeEmployee' : 'FieldEmployee';
      const roleStr = isOfficeRole ? 'Office Employee' : 'Field Employee';

      const payload = {
        name: name.trim(),
        employeeName: name.trim(),
        mobileNumber: mobile.replace(/[^0-9]/g, ''),
        mobile: mobile.replace(/[^0-9]/g, ''),
        password: password.trim(),
        address: {
          doorNo: doorNo.trim(),
          streetName: street.trim(),
          area: area.trim(),
          city: city.trim(),
          state,
          pincode: pincode.trim(),
        },
        doorNo: doorNo.trim(),
        streetName: street.trim(),
        area: area.trim(),
        city: city.trim(),
        state,
        pincode: pincode.trim(),
        aadhaarNumber: aadhaar.replace(/\D/g, ''),
        monthlyBase: monthlySalary.trim() ? Number(monthlySalary) : null,
        conveyanceAllowance: conveyanceAllowance.trim() ? Number(conveyanceAllowance) : null,
        monthlyWorkingDay: workingDays.trim() ? Number(workingDays) : null,
        employeeType: empType,
        role: roleStr,
        fullAddress,
        image: avatarId,
      };

      if (avatarId && (avatarId.startsWith('file://') || avatarId.startsWith('content://') || avatarId.startsWith('ph://') || avatarId.startsWith('/'))) {
        const isUnderLimit = await checkFileSizeUnderLimit(avatarId);
        if (!isUnderLimit) {
          setErrorModal({
            visible: true,
            title: 'File Size Too Large',
            message: MAX_IMAGE_SIZE_MESSAGE,
          });
          return;
        }
      }

      const result = await employeeService.updateEmployee(id, payload);

      if (result && result.success !== false) {
        setSuccessModal({
          visible: true,
          title: 'Success',
          message: 'Employee details updated successfully.',
        });
      } else {
        const isFileSize = result?.isFileSizeError ||
          (result?.message || '').toLowerCase().includes('413') ||
          (result?.message || '').toLowerCase().includes('file size') ||
          (result?.message || '').toLowerCase().includes('large');
        const friendlyMessage = formatErrorMessage(result?.message);
        setErrorModal({
          visible: true,
          title: isFileSize ? 'File Size Too Large' : 'Update Failed',
          message: isFileSize ? MAX_IMAGE_SIZE_MESSAGE : friendlyMessage,
        });
      }
    } catch (err) {
      const isFileSize = (err?.message || '').toLowerCase().includes('413') ||
        (err?.message || '').toLowerCase().includes('file size') ||
        (err?.message || '').toLowerCase().includes('large');
      const friendlyMessage = formatErrorMessage(err?.message || 'An unexpected error occurred.');
      setErrorModal({
        visible: true,
        title: isFileSize ? 'File Size Too Large' : 'Update Failed',
        message: isFileSize ? MAX_IMAGE_SIZE_MESSAGE : friendlyMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const isUnderLimit = await checkFileSizeUnderLimit(asset.uri, asset.fileSize);
        if (!isUnderLimit) {
          setErrorModal({
            visible: true,
            title: 'File Size Too Large',
            message: MAX_IMAGE_SIZE_MESSAGE,
          });
          return;
        }
        setAvatarId(asset.uri);
        setAvatarPickerOpen(false);
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'Camera Error',
        message: err?.message || 'Unable to take photo.',
      });
    }
  };

  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const isUnderLimit = await checkFileSizeUnderLimit(asset.uri, asset.fileSize);
        if (!isUnderLimit) {
          setErrorModal({
            visible: true,
            title: 'File Size Too Large',
            message: MAX_IMAGE_SIZE_MESSAGE,
          });
          return;
        }
        setAvatarId(asset.uri);
        setAvatarPickerOpen(false);
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'Gallery Error',
        message: err?.message || 'Unable to pick photo from gallery.',
      });
    }
  };

  const isAnyDropdownOpen = showAreaSuggestions || showCitySuggestions || roleDropdownOpen;

  const closeAllDropdowns = () => {
    setShowAreaSuggestions(false);
    setShowCitySuggestions(false);
    setRoleDropdownOpen(false);
    Keyboard.dismiss();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <InnerHeader title="Edit Employee" paddingTop={insets.top} isDark={isDark} />
        <MaterialFormSkeleton showHeader={false} />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader title="Edit Employee" paddingTop={insets.top} isDark={isDark} />

      {/* Backdrop */}
      {isAnyDropdownOpen && (
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={closeAllDropdowns}
        >
          {/* Avatar Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
              <Image source={getAvatarSource(avatarId)} style={styles.largeAvatar} />
              <TouchableOpacity
                style={styles.editAvatarBtn}
                onPress={() => setAvatarPickerOpen(!avatarPickerOpen)}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {avatarPickerOpen && (
            <View style={styles.avatarPickerRow}>
              <TouchableOpacity style={styles.pickerBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera-outline" size={20} color="#0052CC" />
                <Text style={styles.pickerBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerBtn} onPress={handlePickGallery}>
                <Ionicons name="images-outline" size={20} color="#0052CC" />
                <Text style={styles.pickerBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            <SectionHeader title="Basic Information" icon="person-outline" isDark={isDark} />
            <FormInput
              label="Full Name"
              value={name}
              onChange={(val) => {
                setName(val);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              error={errors.name}
              isDark={isDark}
            />
            <FormInput
              label="Mobile Number"
              value={mobile}
              onChange={(val) => {
                setMobile(val);
                if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: null }));
              }}
              keyboard="phone-pad"
              error={errors.mobile}
              isDark={isDark}
            />
            <FormInput
              label="Aadhaar Number"
              value={aadhaar}
              onChange={(val) => {
                setAadhaar(val);
                if (errors.aadhaar) setErrors((prev) => ({ ...prev, aadhaar: null }));
              }}
              keyboard="numeric"
              error={errors.aadhaar}
              isDark={isDark}
            />
            <FormInput
              label="Account Password"
              value={password}
              onChange={(val) => {
                setPassword(val);
                if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              }}
              isPassword
              error={errors.password}
              isDark={isDark}
            />

            {/* Role Dropdown */}
            <Text style={[styles.label, isDark && styles.labelDark]}>Employee Role</Text>
            <View style={[styles.dropdownContainer, isDark && styles.dropdownContainerDark]}>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => setRoleDropdownOpen(!roleDropdownOpen)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownHeaderText, isDark && styles.textDark]}>{role}</Text>
                <Ionicons
                  name={roleDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={isDark ? '#94A3B8' : '#000000'}
                />
              </TouchableOpacity>

              {roleDropdownOpen && (
                <View style={styles.dropdownList}>
                  {['Field Employee', 'Office Employee'].map((r) => {
                    const isSelected = role === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                          isSelected && isDark && styles.dropdownItemSelectedDark,
                        ]}
                        onPress={() => {
                          setRole(r);
                          setRoleDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected && styles.dropdownItemTextSelected,
                            isDark && styles.textDark,
                            isSelected && isDark && styles.dropdownItemTextSelectedDark,
                          ]}
                        >
                          {r}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#2B4C99" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <SectionHeader title="Address Details" icon="location-outline" isDark={isDark} />
            <FormInput label="Door / Flat No" value={doorNo} onChange={setDoorNo} isDark={isDark} />
            <FormInput label="Street Name" value={street} onChange={setStreet} isDark={isDark} />

            {/* Area Auto-suggest */}
            <View style={{ zIndex: 30, marginBottom: 12 }}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Area</Text>
              <View style={[styles.autocompleteInputContainer, isDark && styles.inputDark]}>
                <TextInput
                  style={[styles.autocompleteInput, isDark && styles.textDark]}
                  value={area}
                  onChangeText={setArea}
                  onFocus={() => area.trim().length >= 3 && setShowAreaSuggestions(true)}
                  placeholder="Enter Area"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
                {isLoadingOsm && <ActivityIndicator size="small" color="#0052CC" />}
              </View>
              {showAreaSuggestions && (filteredAreas.length > 0 || isLoadingOsm) && (
                <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                    {filteredAreas.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.suggestionItem, isDark && styles.suggestionItemDark]}
                        onPress={() => {
                          const selectedAreaName = item.name ?? item;
                          setArea(selectedAreaName);

                          // Automatically take the pincode for the area
                          const detectedPin = item.pincode || getPincodeForArea(selectedAreaName);
                          if (detectedPin) {
                            setPincode(detectedPin);
                            if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: null }));
                          } else {
                            setPincode('');
                            setErrors((prev) => ({ ...prev, pincode: 'Pincode not found for this area. Please enter your 6-digit pincode.' }));
                          }

                          setShowAreaSuggestions(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={[styles.suggestionText, isDark && styles.textDark]}>{item.name || item}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* City Auto-suggest */}
            <View style={{ zIndex: 20, marginBottom: 12 }}>
              <Text style={[styles.label, isDark && styles.labelDark]}>City</Text>
              <View style={[styles.autocompleteInputContainer, isDark && styles.inputDark]}>
                <TextInput
                  style={[styles.autocompleteInput, isDark && styles.textDark]}
                  value={city}
                  onChangeText={(text) => {
                    setCity(text);
                    setShowCitySuggestions(text.trim().length >= 3);
                  }}
                  onFocus={() => city.trim().length >= 3 && setShowCitySuggestions(true)}
                  placeholder="Enter City"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
              </View>
              {showCitySuggestions && filteredCities.length > 0 && (
                <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                    {filteredCities.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.suggestionItem, isDark && styles.suggestionItemDark]}
                        onPress={() => {
                          setCity(item);
                          setShowCitySuggestions(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={[styles.suggestionText, isDark && styles.textDark]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <FormInput
              label="Pincode"
              value={pincode}
              onChange={(val) => {
                setPincode(val);
                if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: null }));
              }}
              keyboard="numeric"
              error={errors.pincode}
              isDark={isDark}
            />

            <SectionHeader title="Salary & Pay Details" icon="cash-outline" isDark={isDark} />
            <FormInput
              label="Monthly Base Salary (₹)"
              value={monthlySalary}
              onChange={(val) => {
                setMonthlySalary(val);
                if (errors.monthlySalary) setErrors((prev) => ({ ...prev, monthlySalary: null }));
              }}
              keyboard="numeric"
              error={errors.monthlySalary}
              isDark={isDark}
            />
            <FormInput
              label="Conveyance Allowance (₹)"
              value={conveyanceAllowance}
              onChange={setConveyanceAllowance}
              keyboard="numeric"
              isDark={isDark}
            />
            <FormInput
              label="Monthly Working Days"
              value={workingDays}
              onChange={(val) => {
                setWorkingDays(val);
                if (errors.workingDays) setErrors((prev) => ({ ...prev, workingDays: null }));
              }}
              keyboard="numeric"
              error={errors.workingDays}
              isDark={isDark}
            />

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSaveChanges}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MaterialOverlayLoader
        visible={isSubmitting}
        title="Saving Changes..."
        subtitle="Updating employee information"
      />

      {/* Custom Error Popup Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModal.visible}
        onRequestClose={() => setErrorModal({ visible: false, title: '', message: '' })}
      >
        <View style={styles.errorModalBackdrop}>
          <View style={[styles.errorModalCard, isDark && styles.errorModalCardDark]}>
            <View style={styles.errorIconWrapper}>
              <Ionicons name="alert-circle" size={38} color="#EF4444" />
            </View>
            <Text style={[styles.errorModalTitle, isDark && styles.textDark]}>
              {errorModal.title || 'Update Failed'}
            </Text>
            <Text style={[styles.errorModalMessage, isDark && styles.subtextDark]}>
              {errorModal.message}
            </Text>
            <TouchableOpacity
              style={styles.errorModalOkBtn}
              activeOpacity={0.85}
              onPress={() => setErrorModal({ visible: false, title: '', message: '' })}
            >
              <Text style={styles.errorModalOkBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Success Popup Modal */}
      <MaterialSuccessModal
        visible={successModal.visible}
        title={successModal.title || 'Success'}
        message={successModal.message || 'Employee details updated successfully.'}
        buttonText="OK"
        onClose={() => {
          setSuccessModal({ visible: false, title: '', message: '' });
          router.back();
        }}
      />
    </View>
  );
}

function SectionHeader({ title, icon, isDark }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color="#0052CC" style={{ marginRight: 8 }} />
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
    </View>
  );
}

function FormInput({ label, value, onChange, keyboard = 'default', isPassword = false, error, isDark }) {
  const [showPass, setShowPass] = useState(false);

  return (
    <View style={styles.formField}>
      <Text style={[styles.label, isDark && styles.labelDark]}>{label}</Text>
      {isPassword ? (
        <View style={[styles.passwordWrapper, isDark && styles.passwordWrapperDark, error && styles.inputError]}>
          <TextInput
            style={[styles.passwordInput, isDark && styles.textDark]}
            value={value}
            onChangeText={onChange}
            secureTextEntry={!showPass}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`Enter ${label}`}
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPass(!showPass)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPass ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[styles.input, isDark && styles.inputDark, error && styles.inputError]}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          placeholder={`Enter ${label}`}
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#080808',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#0052CC',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0052CC',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F1FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pickerBtnText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#0052CC',
  },
  form: {
    gap: 12,
  },
  formField: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  labelDark: {
    color: '#E2E8F0',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  passwordWrapperDark: {
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 12,
  },
  dropdownContainerDark: {
    zIndex: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  dropdownHeaderText: {
    fontSize: 15,
    color: '#0F172A',
  },
  dropdownList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemSelectedDark: {
    backgroundColor: '#1E293B',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#334155',
  },
  dropdownItemTextSelected: {
    fontWeight: '700',
    color: '#2563EB',
  },
  dropdownItemTextSelectedDark: {
    color: '#60A5FA',
  },
  autocompleteInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  autocompleteInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
  },
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionsBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionItemDark: {
    borderBottomColor: '#334155',
  },
  suggestionText: {
    fontSize: 14,
    color: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#0052CC',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Custom Error Modal Styles
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  errorModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  errorModalCardDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  errorModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorModalMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 22,
  },
  errorModalOkBtn: {
    backgroundColor: '#0052CC',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  errorModalOkBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
