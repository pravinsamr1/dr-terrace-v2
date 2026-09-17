import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Image,
  Modal,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getInfoAsync } from 'expo-file-system/legacy';
import { useOsmAreas, useOsmCities } from '../../../core/hooks/useOsmAreas';
import { getPincodeForArea } from '../../../shared/constants/chennai-areas';
import { MaterialOverlayLoader, MaterialSuccessModal } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

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

// Define a list of pre-bundled avatar options for a high-fidelity visual experience
const PRESETS_AVATARS = [
  { id: 'employee_ganesh', source: require('../../../../assets/images/employee_ganesh.png'), label: 'Ganesh' },
  { id: 'technician_avatar', source: require('../../../../assets/images/technician_avatar.png'), label: 'Technician' },
];

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

export default function EmployeeAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Form states
  const [employeeName, setEmployeeName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 4 Address input states: 1. Door No, 2. Street Name, 3. Area with auto-suggest, 4. City with auto-suggest, 5. Pincode
  const [doorNo, setDoorNo] = useState('');
  const [streetName, setStreetName] = useState('');
  const [areaInput, setAreaInput] = useState('');
  const [cityInput, setCityInput] = useState('Chennai');
  const [stateInput] = useState('Tamil Nadu');
  const [pincodeInput, setPincodeInput] = useState('600053');
  
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  
  // Validation errors
  const [errors, setErrors] = useState({});

  // Live OpenStreetMap Nominatim Area suggestions
  const {
    suggestions: filteredAreas,
    isLoading: isLoadingOsm,
    showSuggestions: showAreaSuggestions,
    setShowSuggestions: setShowAreaSuggestions,
  } = useOsmAreas(areaInput, cityInput);

  // Live OpenStreetMap Nominatim City suggestions
  const {
    citySuggestions: filteredCities,
    showCitySuggestions,
    setShowCitySuggestions,
  } = useOsmCities(cityInput);
  
  // Salary state fields
  const [monthlySalary, setMonthlySalary] = useState('25000');
  const [conveyanceAllowance, setConveyanceAllowance] = useState('2000');
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState('26');
  
  // Dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Field Employee'); // Default role
  
  // Image picker state
  const [selectedAvatarId, setSelectedAvatarId] = useState('technician_avatar');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Error & Success Modal States
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is required to take an employee photo. Please enable it in your device settings.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
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
        setSelectedAvatarId(asset.uri);
        setAvatarModalOpen(false);
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'Camera Error',
        message: err?.message || 'Unable to access camera.',
      });
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Gallery access is required to choose an employee photo. Please enable it in your device settings.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
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
        setSelectedAvatarId(asset.uri);
        setAvatarModalOpen(false);
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'Gallery Error',
        message: err?.message || 'Unable to pick image from gallery.',
      });
    }
  };

  const handlePickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'image/jpeg', 'image/png', 'image/heic'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const isUnderLimit = await checkFileSizeUnderLimit(asset.uri, asset.size);
        if (!isUnderLimit) {
          setErrorModal({
            visible: true,
            title: 'File Size Too Large',
            message: MAX_IMAGE_SIZE_MESSAGE,
          });
          return;
        }
        setSelectedAvatarId(asset.uri);
        setAvatarModalOpen(false);
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'File Selection Error',
        message: err?.message || 'Unable to select file.',
      });
    }
  };

  const getAvatarSource = (id) => {
    if (!id) return require('../../../../assets/images/technician_avatar.png');
    if (
      typeof id === 'string' &&
      (id.startsWith('/') ||
        id.startsWith('file://') ||
        id.startsWith('content://') ||
        id.startsWith('http://') ||
        id.startsWith('https://') ||
        id.startsWith('ph://') ||
        id.startsWith('data:'))
    ) {
      return { uri: id };
    }
    const found = PRESETS_AVATARS.find((a) => a.id === id || a.source === id);
    return found ? found.source : (typeof id === 'number' ? id : require('../../../../assets/images/technician_avatar.png'));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!employeeName.trim()) {
      newErrors.employeeName = 'Employee Name is required.';
    } else if (employeeName.trim().length < 2) {
      newErrors.employeeName = 'Name must be at least 2 characters.';
    }

    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile Number is required.';
    } else {
      const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
      if (cleanMobile.length !== 10) {
        newErrors.mobileNumber = 'Enter a valid 10-digit mobile number.';
      }
    }

    if (!password.trim()) {
      newErrors.password = 'Employee Password is required.';
    } else if (password.trim().length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }

    if (!doorNo.trim()) {
      newErrors.doorNo = 'Door / Flat No is required.';
    }
    if (!streetName.trim()) {
      newErrors.streetName = 'Street Name is required.';
    }
    if (!areaInput.trim()) {
      newErrors.areaInput = 'Area is required.';
    }
    if (!cityInput.trim()) {
      newErrors.cityInput = 'City is required.';
    }

    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
    if (!cleanAadhaar) {
      newErrors.aadhaarNumber = 'Aadhaar Number is required.';
    } else if (cleanAadhaar.length !== 12) {
      newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits.';
    }

    if (pincodeInput.trim() && pincodeInput.trim().length !== 6) {
      newErrors.pincode = 'Pincode must be 6 digits.';
    }

    if (!monthlySalary.trim() || Number(monthlySalary) <= 0) {
      newErrors.monthlySalary = 'Valid monthly salary (> 0) is required.';
    }

    if (conveyanceAllowance.trim() && Number(conveyanceAllowance) < 0) {
      newErrors.conveyanceAllowance = 'Conveyance allowance cannot be negative.';
    }

    if (workingDaysPerMonth.trim()) {
      const days = Number(workingDaysPerMonth);
      if (isNaN(days) || days < 1 || days > 31) {
        newErrors.workingDaysPerMonth = 'Working days must be between 1 and 31.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || isSubmitting) {
      if (!validateForm()) {
        setErrorModal({
          visible: true,
          title: 'Validation Error',
          message: 'Please correct the highlighted errors before submitting.',
        });
      }
      return;
    }
    
    const finalArea = areaInput.trim();
    const finalCity = cityInput.trim();
    const finalState = stateInput.trim() || 'Tamil Nadu';
    const finalPincode = pincodeInput.trim() || '600053';
    const fullAddress = `${doorNo.trim()}, ${streetName.trim()}, ${finalArea}, ${finalCity} - ${finalPincode}`;

    if (selectedAvatarId && (selectedAvatarId.startsWith('file://') || selectedAvatarId.startsWith('content://') || selectedAvatarId.startsWith('ph://') || selectedAvatarId.startsWith('/'))) {
      const isUnderLimit = await checkFileSizeUnderLimit(selectedAvatarId);
      if (!isUnderLimit) {
        setErrorModal({
          visible: true,
          title: 'File Size Too Large',
          message: MAX_IMAGE_SIZE_MESSAGE,
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = await employeeService.addEmployee({
        name: employeeName.trim(),
        employeeName: employeeName.trim(),
        mobileNumber: mobileNumber.replace(/[^0-9]/g, ''),
        mobile: mobileNumber.replace(/[^0-9]/g, ''),
        password: password.trim(),
        address: {
          doorNo: doorNo.trim(),
          streetName: streetName.trim(),
          area: finalArea,
          city: finalCity,
          state: finalState,
          pincode: finalPincode,
        },
        doorNo: doorNo.trim(),
        streetName: streetName.trim(),
        area: finalArea,
        city: finalCity,
        state: finalState,
        pincode: finalPincode,
        aadhaarNumber: aadhaarNumber.replace(/\D/g, ''),
        monthlyBase: Number(monthlySalary) || 25000,
        conveyanceAllowance: conveyanceAllowance.trim() ? Number(conveyanceAllowance) : null,
        monthlyWorkingDay: workingDaysPerMonth.trim() ? Number(workingDaysPerMonth) : null,
        employeeType: selectedRole === 'Office Employee' ? 'OfficeEmployee' : 'FieldEmployee',
        role: selectedRole,
        fullAddress,
        image: selectedAvatarId,
      });

      if (result && result.success) {
        setSuccessModal({
          visible: true,
          title: 'Employee Added!',
          message: `Employee ${employeeName} has been added successfully.`,
        });
      } else {
        const isFileSize = result?.isFileSizeError ||
          (result?.message || '').toLowerCase().includes('413') ||
          (result?.message || '').toLowerCase().includes('file size') ||
          (result?.message || '').toLowerCase().includes('large');
        const friendlyMessage = formatErrorMessage(result?.message);
        setErrorModal({
          visible: true,
          title: isFileSize ? 'File Size Too Large' : 'Failed to Add Employee',
          message: isFileSize ? MAX_IMAGE_SIZE_MESSAGE : friendlyMessage,
        });
      }
    } catch (err) {
      const isFileSize = (err?.message || '').toLowerCase().includes('413') ||
        (err?.message || '').toLowerCase().includes('file size') ||
        (err?.message || '').toLowerCase().includes('large');
      const friendlyMessage = formatErrorMessage(err?.message || 'An unexpected error occurred while adding the employee.');
      setErrorModal({
        visible: true,
        title: isFileSize ? 'File Size Too Large' : 'Failed to Add Employee',
        message: isFileSize ? MAX_IMAGE_SIZE_MESSAGE : friendlyMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAnyDropdownOpen = showAreaSuggestions || showCitySuggestions || roleDropdownOpen;

  const closeAllDropdowns = () => {
    setShowAreaSuggestions(false);
    setShowCitySuggestions(false);
    setRoleDropdownOpen(false);
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader title="Employee Add" paddingTop={insets.top} isDark={isDark} />

      {/* Global 1-Tap Outside Dismiss Backdrop */}
      {isAnyDropdownOpen && (
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      )}

      {/* Form Fields */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 140) }, // leaves space for bottom tab bar
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollBeginDrag={closeAllDropdowns}
      >
        {/* Name Input */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Employee Name <Text style={styles.star}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.employeeName && styles.inputError, { marginBottom: errors.employeeName ? 4 : 20 }]}
          placeholder="Enter Full Name"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={employeeName}
          onChangeText={(val) => {
            setEmployeeName(val);
            if (errors.employeeName) setErrors((prev) => ({ ...prev, employeeName: null }));
          }}
        />
        {errors.employeeName && <Text style={styles.errorText}>{errors.employeeName}</Text>}

        {/* Mobile Number */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Mobile Number <Text style={styles.star}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.mobileNumber && styles.inputError, { marginBottom: errors.mobileNumber ? 4 : 20 }]}
          placeholder="Enter 10-digit Mobile Number"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          keyboardType="phone-pad"
          maxLength={10}
          value={mobileNumber}
          onChangeText={(val) => {
            setMobileNumber(val);
            if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: null }));
          }}
        />
        {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}

        {/* Password */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Employee Password <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.passwordWrapper, isDark && styles.passwordWrapperDark, errors.password && styles.passwordWrapperError, { marginBottom: errors.password ? 4 : 20 }]}>
          <TextInput
            style={[styles.passwordInput, isDark && styles.textDark]}
            placeholder="Enter Employee Password (min 4 chars)"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
            }}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

        {/* Address: 4 Input Boxes */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Address <Text style={styles.star}>*</Text>
        </Text>
        
        {/* 1. Door No */}
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.doorNo && styles.inputError, { marginBottom: errors.doorNo ? 4 : 12 }]}
          placeholder="Door No / Flat No"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={doorNo}
          onChangeText={(val) => {
            setDoorNo(val);
            if (errors.doorNo) setErrors((prev) => ({ ...prev, doorNo: null }));
          }}
        />
        {errors.doorNo && <Text style={styles.errorText}>{errors.doorNo}</Text>}

        {/* 2. Street Name */}
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.streetName && styles.inputError, { marginBottom: errors.streetName ? 4 : 12 }]}
          placeholder="Street Name / Road"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={streetName}
          onChangeText={(val) => {
            setStreetName(val);
            if (errors.streetName) setErrors((prev) => ({ ...prev, streetName: null }));
          }}
        />
        {errors.streetName && <Text style={styles.errorText}>{errors.streetName}</Text>}

        {/* 3. Area with 3-letter Auto-suggest (OpenStreetMap Nominatim) */}
        <View style={{ marginBottom: errors.areaInput ? 4 : 12, position: 'relative', zIndex: 30 }}>
          <View style={[styles.autocompleteInputContainer, isDark && styles.inputDark, errors.areaInput && styles.inputError]}>
            <TextInput
              style={[styles.autocompleteInput, isDark && styles.textDark]}
              placeholder="Enter Area (e.g. Ambattur)"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={areaInput}
              onChangeText={(text) => {
                setAreaInput(text);
                if (errors.areaInput) setErrors((prev) => ({ ...prev, areaInput: null }));
              }}
              onFocus={() => {
                if (areaInput.trim().length >= 3) {
                  setShowAreaSuggestions(true);
                }
              }}
            />
            {isLoadingOsm && (
              <ActivityIndicator size="small" color="#0052CC" style={{ marginRight: 6 }} />
            )}
            {areaInput.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setAreaInput('');
                  setShowAreaSuggestions(false);
                }}
                style={{ padding: 6 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Area Suggestions Dropdown (Shows when >= 3 letters typed) */}
          {showAreaSuggestions && (filteredAreas.length > 0 || isLoadingOsm) && (
            <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
              {isLoadingOsm && filteredAreas.length === 0 ? (
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#0052CC" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                    Searching OpenStreetMap...
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                  {filteredAreas.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.suggestionItem, isDark && styles.suggestionItemDark, { paddingVertical: 10 }]}
                      onPress={() => {
                        const selectedAreaName = item.name ?? item;
                        setAreaInput(selectedAreaName);
                        if (errors.areaInput) setErrors((prev) => ({ ...prev, areaInput: null }));

                        // Automatically take the pincode for the area
                        const detectedPin = item.pincode || getPincodeForArea(selectedAreaName);
                        if (detectedPin) {
                          setPincodeInput(detectedPin);
                          setErrors((prev) => ({ ...prev, pincode: null, pincodeInput: null }));
                        } else {
                          setPincodeInput('');
                          setErrors((prev) => ({ ...prev, pincode: 'Pincode not found for this area. Please enter your 6-digit pincode.', pincodeInput: 'Pincode not found for this area. Please enter your 6-digit pincode.' }));
                        }

                        setShowAreaSuggestions(false);
                        Keyboard.dismiss();
                      }}
                    >
                      <Ionicons name="location-sharp" size={16} color="#2563EB" style={{ marginRight: 8, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestionText, isDark && styles.textDark, { fontWeight: '700' }]}>
                          {item.name || item}
                        </Text>
                        {item.displayName && item.displayName !== item.name && (
                          <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }} numberOfLines={1}>
                            {item.displayName}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
        {errors.areaInput && <Text style={styles.errorText}>{errors.areaInput}</Text>}

        {/* 4. City with 3-letter Auto-suggest (Default: Chennai) */}
        <View style={{ marginBottom: errors.cityInput ? 4 : 20, position: 'relative', zIndex: 20 }}>
          <View style={[styles.autocompleteInputContainer, isDark && styles.inputDark, errors.cityInput && styles.inputError]}>
            <TextInput
              style={[styles.autocompleteInput, isDark && styles.textDark]}
              placeholder="City (Default: Chennai)"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={cityInput}
              onChangeText={(text) => {
                setCityInput(text);
                if (errors.cityInput) setErrors((prev) => ({ ...prev, cityInput: null }));
                setShowCitySuggestions(text.trim().length >= 3);
              }}
              onFocus={() => {
                if (cityInput.trim().length >= 3) {
                  setShowCitySuggestions(true);
                }
              }}
            />
            {cityInput.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setCityInput('');
                  setShowCitySuggestions(false);
                }}
                style={{ padding: 6 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>
            )}
          </View>

          {/* City Suggestions Dropdown (Shows when >= 3 letters typed) */}
          {showCitySuggestions && filteredCities.length > 0 && (
            <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {filteredCities.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.suggestionItem, isDark && styles.suggestionItemDark]}
                    onPress={() => {
                      setCityInput(item);
                      if (errors.cityInput) setErrors((prev) => ({ ...prev, cityInput: null }));
                      setShowCitySuggestions(false);
                      Keyboard.dismiss();
                    }}
                  >
                    <Ionicons name="business-outline" size={15} color="#2563EB" style={{ marginRight: 8 }} />
                    <Text style={[styles.suggestionText, isDark && styles.textDark]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        {errors.cityInput && <Text style={[styles.errorText, { marginBottom: 12 }]}>{errors.cityInput}</Text>}

        {/* 5. Pincode */}
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.pincode && styles.inputError, { marginBottom: errors.pincode ? 4 : 20 }]}
          placeholder="Pincode (e.g. 600053)"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          keyboardType="number-pad"
          maxLength={6}
          value={pincodeInput}
          onChangeText={(val) => {
            setPincodeInput(val);
            if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: null }));
          }}
        />
        {errors.pincode && <Text style={styles.errorText}>{errors.pincode}</Text>}

        {/* Aadhaar Number */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Aadhaar Number <Text style={styles.star}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.aadhaarNumber && styles.inputError]}
          placeholder="Enter 12 Digit Aadhaar Number"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          keyboardType="number-pad"
          maxLength={14}
          value={aadhaarNumber}
          onChangeText={(text) => {
            const cleanText = text.replace(/\D/g, '');
            let formatted = '';
            for (let i = 0; i < cleanText.length && i < 12; i++) {
              if (i > 0 && i % 4 === 0) formatted += ' ';
              formatted += cleanText[i];
            }
            setAadhaarNumber(formatted);
            if (errors.aadhaarNumber) setErrors((prev) => ({ ...prev, aadhaarNumber: null }));
          }}
        />
        {errors.aadhaarNumber && <Text style={styles.errorText}>{errors.aadhaarNumber}</Text>}

        {/* Salary Details Section */}
        <View style={{ marginTop: 8, marginBottom: 16, padding: 16, backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="cash-outline" size={20} color="#2563EB" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>Salary & Pay Details</Text>
          </View>

          <Text style={[styles.label, isDark && styles.labelDark]}>Monthly Base Salary (₹) <Text style={styles.star}>*</Text></Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark, { marginBottom: errors.monthlySalary ? 4 : 12 }, errors.monthlySalary && styles.inputError]}
            placeholder="e.g. 25000"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            keyboardType="number-pad"
            value={monthlySalary}
            onChangeText={(val) => {
              setMonthlySalary(val);
              if (errors.monthlySalary) setErrors((prev) => ({ ...prev, monthlySalary: null }));
            }}
          />
          {errors.monthlySalary && <Text style={[styles.errorText, { marginBottom: 12 }]}>{errors.monthlySalary}</Text>}

          <Text style={[styles.label, isDark && styles.labelDark]}>Site / Conveyance Allowance (₹)</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark, { marginBottom: errors.conveyanceAllowance ? 4 : 12 }, errors.conveyanceAllowance && styles.inputError]}
            placeholder="e.g. 2000"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            keyboardType="number-pad"
            value={conveyanceAllowance}
            onChangeText={(val) => {
              setConveyanceAllowance(val);
              if (errors.conveyanceAllowance) setErrors((prev) => ({ ...prev, conveyanceAllowance: null }));
            }}
          />
          {errors.conveyanceAllowance && <Text style={[styles.errorText, { marginBottom: 12 }]}>{errors.conveyanceAllowance}</Text>}

          <Text style={[styles.label, isDark && styles.labelDark]}>Monthly Working Days</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark, errors.workingDaysPerMonth && styles.inputError]}
            placeholder="Default 26 Days"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            keyboardType="number-pad"
            value={workingDaysPerMonth}
            onChangeText={(val) => {
              setWorkingDaysPerMonth(val);
              if (errors.workingDaysPerMonth) setErrors((prev) => ({ ...prev, workingDaysPerMonth: null }));
            }}
          />
          {errors.workingDaysPerMonth && <Text style={styles.errorText}>{errors.workingDaysPerMonth}</Text>}
        </View>

        {/* Technician Role Dropdown Selector */}
        <View style={[styles.dropdownContainer, isDark && styles.dropdownContainerDark]}>
          <TouchableOpacity
            style={styles.dropdownHeader}
            onPress={() => setRoleDropdownOpen(!roleDropdownOpen)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dropdownHeaderText, isDark && styles.textDark]}>
              {selectedRole ? selectedRole : 'Select a Technician Role'}
            </Text>
            <Ionicons
              name={roleDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#94A3B8' : '#000000'}
            />
          </TouchableOpacity>

          {roleDropdownOpen && (
            <View style={styles.dropdownList}>
              {['Field Employee', 'Office Employee'].map((role) => {
                const isSelected = selectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.dropdownItem,
                      isSelected && styles.dropdownItemSelected,
                      isSelected && isDark && styles.dropdownItemSelectedDark,
                    ]}
                    onPress={() => {
                      setSelectedRole(role);
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
                      {role}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color="#2B4C99" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Employee Image Section */}
        <Text style={[styles.label, isDark && styles.labelDark]}>Employee Image</Text>
        <View style={styles.imageSelectionRow}>
          {/* Add Image Button */}
          <TouchableOpacity 
            style={[styles.addImageBtn, isDark && styles.addImageBtnDark]} 
            onPress={() => setAvatarModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.addImageText, isDark && styles.subtextDark]}>+ Add Image</Text>
          </TouchableOpacity>

          {/* Current Selection Preview */}
          {selectedAvatarId && (
            <View style={styles.avatarPreviewContainer}>
              <Image 
                source={getAvatarSource(selectedAvatarId)} 
                style={styles.avatarPreview} 
              />
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
              </View>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar Selection Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={avatarModalOpen}
        onRequestClose={() => setAvatarModalOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setAvatarModalOpen(false)}
        >
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>Select Employee Photo</Text>
              <TouchableOpacity onPress={() => setAvatarModalOpen(false)}>
                <Ionicons name="close-circle" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalDivider} />

            {/* Photo Action Buttons */}
            <View style={styles.photoOptionsContainer}>
              <TouchableOpacity 
                style={[styles.photoOptionButton, { backgroundColor: '#2563EB' }]}
                onPress={handleTakePhoto}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={styles.photoOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.photoOptionButton, { backgroundColor: '#059669' }]}
                onPress={handlePickFromGallery}
                activeOpacity={0.85}
              >
                <Ionicons name="images" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={styles.photoOptionText}>Upload from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.photoOptionButton, { backgroundColor: '#7C3AED' }]}
                onPress={handlePickFromFiles}
                activeOpacity={0.85}
              >
                <Ionicons name="folder-open" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={styles.photoOptionText}>Upload from Files</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetSectionDivider}>
              <Text style={[styles.presetSectionTitle, isDark && styles.subtextDark]}>Or Choose Preset Avatar</Text>
            </View>

            <View style={styles.avatarGrid}>
              {PRESETS_AVATARS.map((avatar) => {
                const isSelected = selectedAvatarId === avatar.id;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarGridItem,
                      isSelected && styles.avatarGridItemSelected
                    ]}
                    onPress={() => {
                      setSelectedAvatarId(avatar.id);
                      setAvatarModalOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Image source={avatar.source} style={styles.gridAvatarImage} />
                    <Text style={[styles.avatarLabel, isDark && styles.textDark]}>{avatar.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
              {errorModal.title || 'Failed to Add Employee'}
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

      <MaterialOverlayLoader
        visible={isSubmitting}
        title="Creating Employee..."
        subtitle="Uploading details and saving record"
      />

      <MaterialSuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        buttonText="OK"
        onClose={() => {
          setSuccessModal({ visible: false, title: '', message: '' });
          router.back();
        }}
      />
    </KeyboardAvoidingView>
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

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  labelDark: {
    color: '#E2E8F0',
  },
  star: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    color: '#000000',
    fontSize: 15,
    marginBottom: 20,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
    paddingLeft: 2,
  },
  inputDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
    color: '#F8FAFC',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  passwordWrapperDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  passwordWrapperError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: '#000000',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  dropdownContainerDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
  },
  dropdownHeaderText: {
    fontSize: 15,
    color: '#333333',
  },
  dropdownList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dropdownItemSelected: {
    backgroundColor: '#E0F2FE',
  },
  dropdownItemSelectedDark: {
    backgroundColor: 'rgba(3, 105, 161, 0.25)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333333',
  },
  dropdownItemTextSelected: {
    color: '#2B4C99',
    fontWeight: '700',
  },
  dropdownItemTextSelectedDark: {
    color: '#38BDF8',
  },
  textDark: {
    color: '#F8FAFC',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  imageSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 35,
    marginTop: 8,
  },
  addImageBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    backgroundColor: '#FAFAFA',
  },
  addImageBtnDark: {
    borderColor: '#475569',
    backgroundColor: '#1C1C1C',
  },
  addImageText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  avatarPreviewContainer: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
  },
  saveButton: {
    backgroundColor: '#4CA6F5',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 45,
  },
  modalCardDark: {
    backgroundColor: '#1C1C1C',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  avatarGridItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '45%',
    marginBottom: 16,
  },
  avatarGridItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  gridAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  photoOptionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  photoOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  photoOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  presetSectionDivider: {
    alignItems: 'center',
    marginVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 8,
  },
  presetSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  autocompleteInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  autocompleteInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%',
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionsBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  suggestionItemDark: {
    borderBottomColor: '#334155',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
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
    backgroundColor: '#4CA6F5',
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
