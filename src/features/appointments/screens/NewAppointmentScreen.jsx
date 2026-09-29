import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Modal,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { authRepository } from '../../auth/api/authRepository';
import { useOsmAreas, useOsmCities } from '../../../core/hooks/useOsmAreas';
import { getPincodeForArea } from '../../../shared/constants/chennai-areas';
import { isValidDateString, isPastDate } from '../../../core/utils/validation';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { MaterialAlertModal, MaterialOverlayLoader, MaterialSuccessModal } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';
import TitleDropdown from '../../../shared/components/TitleDropdown';

// Date formatter DD-MM-YY (e.g. 12-12-26)
const formatDate = (date) => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

// Date formatter YYYY-MM-DD for backend API
const toApiDateString = (dateInput) => {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const yearPart = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${yearPart}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
};

// Time formatter HH:MM for backend API
const toApiTimeString = (timeInput) => {
  if (!timeInput) return '10:30';
  if (timeInput instanceof Date && !isNaN(timeInput.getTime())) {
    const h = String(timeInput.getHours()).padStart(2, '0');
    const min = String(timeInput.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }
  const str = String(timeInput).trim();
  const match = str.match(/(\d+):(\d+)\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2].padStart(2, '0');
    const ampm = match[3] ? match[3].toLowerCase() : null;
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return '10:30';
};

// Time formatter for display: HH:MM AM/PM
const formatTime = (date) => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

// Parse date string to badge object { day, month }
const parseDateToBadge = (date) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  if (!date || isNaN(date.getTime())) {
    const today = new Date();
    return { day: String(today.getDate()), month: months[today.getMonth()] };
  }
  return {
    day: String(date.getDate()),
    month: months[date.getMonth()],
  };
};

export default function NewAppointmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState('master');

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    authRepository.getUser().then((u) => {
      if (u) {
        setCurrentUser(u);
        if (u.role) setUserRole(u.role);
        const isFieldEmp = u.isFieldEmployee || u.role === 'FIELD_EMPLOYEE' || u.role === 'field-employee' || u.role === 'employee';
        if (isFieldEmp) {
          setAssignedTechnician(u.name || 'Self');
          setSelectedEmployeeId(u.id);
        }
      }
    });
  }, []);

  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [customerTitle, setCustomerTitle] = useState('Mr');
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  
  // 6 Address input states
  const [doorNo, setDoorNo] = useState('');
  const [streetName, setStreetName] = useState('');
  const [areaInput, setAreaInput] = useState('');
  const [cityInput, setCityInput] = useState('Chennai');
  const [stateInput, setStateInput] = useState('Tamil Nadu');
  const [pincodeInput, setPincodeInput] = useState('');
  const [googleLocation, setGoogleLocation] = useState('');

  // Live OpenStreetMap Nominatim Area suggestions (min 3 letters)
  const {
    suggestions: filteredAreas,
    isLoading: isLoadingOsm,
    showSuggestions: showAreaSuggestions,
    setShowSuggestions: setShowAreaSuggestions,
  } = useOsmAreas(areaInput, cityInput);

  // Live OpenStreetMap Nominatim City suggestions (min 3 letters)
  const {
    citySuggestions: filteredCities,
    showCitySuggestions,
    setShowCitySuggestions,
  } = useOsmCities(cityInput);

  // Date/Time picker value states
  const [dateValue, setDateValue] = useState(new Date());
  const [fixDateValue, setFixDateValue] = useState(new Date());
  const [timeValue, setTimeValue] = useState(new Date());

  // Text input states for date and time
  const [dateText, setDateText] = useState(formatDate(new Date()));
  const [fixDateText, setFixDateText] = useState(formatDate(new Date()));
  const [timeText, setTimeText] = useState(formatTime(new Date()));

  // Picker display toggle states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFixDatePicker, setShowFixDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState({});

  // Success Modal State
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });

  // Dynamic Waterproof categories from API
  const [waterproofList, setWaterproofList] = useState([]);
  const [selectedWaterproofIds, setSelectedWaterproofIds] = useState([]);
  const [isLoadingWaterproof, setIsLoadingWaterproof] = useState(false);

  // Technician assignment dropdown states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeList, setEmployeeList] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

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

  // Fetch dynamic waterproof categories from API on mount
  useEffect(() => {
    const fetchWaterproof = async () => {
      setIsLoadingWaterproof(true);
      try {
        const res = await appointmentService.getWaterproofOptions();
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setWaterproofList(res.data);
        }
      } catch (_e) {
      } finally {
        setIsLoadingWaterproof(false);
      }
    };
    fetchWaterproof();
  }, []);

  // Fetch employees from API on mount
  useEffect(() => {
    const fetchEmployeesFromApi = async () => {
      setIsLoadingEmployees(true);
      try {
        const res = await employeeService.getEmployees();
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setEmployeeList(res.data);
          if (!assignedTechnician) {
            const firstEmp = res.data[0];
            setAssignedTechnician(firstEmp.name || firstEmp.employeeName);
            setSelectedEmployeeId(firstEmp.id || firstEmp._id);
          }
        }
      } catch (_err) {
        // ignore
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    fetchEmployeesFromApi();
  }, []);

  // Filtered employees based on search query (name, id, code, role)
  const filteredEmployees = useMemo(() => {
    const query = (technicianSearch || '').trim().toLowerCase();
    if (!query) {
      return employeeList;
    }
    return employeeList.filter((emp) => {
      const name = (emp.name || emp.employeeName || '').toLowerCase();
      const idStr = String(emp.id || emp._id || '');
      const code = (emp.code || emp.employeeCode || '').toLowerCase();
      const role = (emp.role || emp.employeeType || '').toLowerCase();
      return name.includes(query) || idStr.includes(query) || code.includes(query) || role.includes(query);
    });
  }, [technicianSearch, employeeList]);

  const toggleWaterproofId = (id) => {
    setSelectedWaterproofIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
    if (errors.waterproof) {
      setErrors((prev) => ({ ...prev, waterproof: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'Customer Name is required.';
    } else if (customerName.trim().length < 2) {
      newErrors.customerName = 'Name must be at least 2 characters.';
    }

    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    if (!cleanMobile) {
      newErrors.mobileNumber = 'Mobile Number is required.';
    } else if (cleanMobile.length !== 10) {
      newErrors.mobileNumber = 'Enter a valid 10-digit mobile number.';
    }

    if (pincodeInput.trim() && !/^[1-9][0-9]{5}$/.test(pincodeInput.trim())) {
      newErrors.pincodeInput = 'Enter a valid 6-digit pincode.';
    }

    if (!googleLocation.trim()) {
      newErrors.googleLocation = 'Google Location is required.';
    }

    if (!dateText.trim()) {
      newErrors.date = 'Appointment Date is required.';
    } else if (!isValidDateString(dateText) && !/custom/i.test(dateText)) {
      newErrors.date = 'Invalid date format (use DD-MM-YY).';
    } else if (isPastDate(dateText)) {
      newErrors.date = 'Appointment Date cannot be in the past.';
    }

    if (!fixDateText.trim()) {
      newErrors.fixDate = 'Appointment Fix Date is required.';
    } else if (!isValidDateString(fixDateText) && !/custom/i.test(fixDateText)) {
      newErrors.fixDate = 'Invalid date format (use DD-MM-YY).';
    } else if (isPastDate(fixDateText)) {
      newErrors.fixDate = 'Appointment Fix Date cannot be in the past.';
    }

    if (!timeText.trim()) {
      newErrors.time = 'Appointment Time is required.';
    }

    if (!selectedWaterproofIds || selectedWaterproofIds.length === 0) {
      newErrors.waterproof = 'Please select at least one waterproofing area.';
    }

    if (!selectedEmployeeId && !assignedTechnician) {
      newErrors.assignedTechnician = 'Please assign an employee.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showAlert('Validation Error', 'Please check highlighted fields and correct the errors.', 'warning');
      return;
    }

    const selectedServices = waterproofList
      .filter((item) => selectedWaterproofIds.includes(item.id))
      .map((item) => item.name);

    const fullAddress = [doorNo.trim(), streetName.trim(), areaInput.trim(), cityInput.trim(), stateInput.trim(), pincodeInput.trim()]
      .filter(Boolean)
      .join(', ');

    const trimmedCustomerName = customerName.trim();
    const alreadyHasCustomerPrefix = /^(mr|mrs|ms|m\/s)\b/i.test(trimmedCustomerName);
    const finalCustomerName = alreadyHasCustomerPrefix
      ? trimmedCustomerName
      : `${customerTitle} ${trimmedCustomerName}`;

    const appointmentPayload = {
      // Exact Backend Payload Contract
      customerName: finalCustomerName,
      customerTitle,
      title: customerTitle,
      prefix: customerTitle,
      salutation: customerTitle,
      mobileNumber: mobileNumber.replace(/[^0-9]/g, ''),
      address: {
        doorNo: doorNo.trim(),
        streetName: streetName.trim(),
        area: areaInput.trim(),
        city: cityInput.trim(),
        state: stateInput.trim(),
        pincode: pincodeInput.trim(),
      },
      googleLocation: googleLocation.trim(),
      appointmentDate: toApiDateString(dateValue || dateText),
      appointmentFixDate: toApiDateString(fixDateValue || fixDateText || dateValue || dateText),
      appointmentTime: toApiTimeString(timeValue || timeText),
      whereToWaterproof: (selectedWaterproofIds || [])
        .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
        .filter((n) => !isNaN(n) && n > 0),
      assignedEmployeeId: Number(selectedEmployeeId) || (employeeList[0] ? Number(employeeList[0].id) : null),

      // App context & UI display fields
      clientName: finalCustomerName,
      name: finalCustomerName,
      phone: mobileNumber.replace(/[^0-9]/g, ''),
      mobile: mobileNumber.replace(/[^0-9]/g, ''),
      clientPhone: mobileNumber.replace(/[^0-9]/g, ''),
      doorNo: doorNo.trim(),
      streetName: streetName.trim(),
      street: streetName.trim(),
      area: areaInput.trim(),
      location: areaInput.trim(),
      city: cityInput.trim(),
      state: stateInput.trim(),
      pincode: pincodeInput.trim(),
      addressBreakdown: {
        doorNo: doorNo.trim(),
        street: streetName.trim(),
        area: areaInput.trim(),
        city: cityInput.trim(),
        state: stateInput.trim(),
        pincode: pincodeInput.trim(),
      },
      fullAddress,
      date: dateText,
      fixDate: fixDateText,
      time: timeText,
      status: 'Site Visit',
      services: selectedServices,
      serviceType: selectedServices.length > 0 ? selectedServices.join(', ') : 'Waterproofing',
      assignedTo: assignedTechnician,
      assignedTechnician: assignedTechnician,
      employeeId: Number(selectedEmployeeId) || null,
      timeBadge: parseDateToBadge(dateValue),
    };

    setIsSubmitting(true);
    try {
      const result = await appointmentService.addAppointment(appointmentPayload);
      if (result && result.success === false) {
        showAlert('Booking Failed', result.message || 'Failed to create appointment on server.', 'error');
      } else {
        setSuccessModal({
          visible: true,
          title: 'Appointment Booked!',
          message: `Appointment for ${finalCustomerName} has been booked successfully.`,
        });
      }
    } catch (err) {
      showAlert('Error', err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader title="New Appointment" paddingTop={insets.top} isDark={isDark} />

      {/* Form Fields */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 140) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Customer Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Customer Name <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.nameRow, { marginBottom: errors.customerName ? 4 : 20 }]}>
          <TitleDropdown
            value={customerTitle}
            onChange={(val) => setCustomerTitle(val)}
            isDark={isDark}
          />
          <TextInput
            style={[
              styles.input,
              styles.nameInputWithDropdown,
              isDark && styles.inputDark,
              errors.customerName && styles.inputError,
            ]}
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

        {/* Address: 4 Input Boxes */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Address
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
                          setErrors((prev) => ({ ...prev, pincodeInput: null }));
                        } else {
                          setPincodeInput('');
                          setErrors((prev) => ({ ...prev, pincodeInput: 'Pincode not found for this area. Please enter your 6-digit pincode.' }));
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

        {/* 5. State & 6. Pincode Row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: (errors.stateInput || errors.pincodeInput) ? 4 : 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.labelDark, { fontSize: 13 }]}>
              State
            </Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark, errors.stateInput && styles.inputError]}
              placeholder="State (e.g. Tamil Nadu)"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={stateInput}
              onChangeText={(val) => {
                setStateInput(val);
                if (errors.stateInput) setErrors((prev) => ({ ...prev, stateInput: null }));
              }}
            />
            {errors.stateInput && <Text style={styles.errorText}>{errors.stateInput}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, isDark && styles.labelDark, { fontSize: 13 }]}>
              Pincode
            </Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark, errors.pincodeInput && styles.inputError]}
              placeholder="6-digit Pincode"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={pincodeInput}
              onChangeText={(val) => {
                setPincodeInput(val);
                if (errors.pincodeInput) setErrors((prev) => ({ ...prev, pincodeInput: null }));
              }}
              keyboardType="numeric"
              maxLength={6}
            />
            {errors.pincodeInput && <Text style={styles.errorText}>{errors.pincodeInput}</Text>}
          </View>
        </View>

        {/* Google Location */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Google Location <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.googleLocation && styles.inputError]}>
          <TextInput
            style={[styles.inputWithIcon, isDark && styles.inputWithIconDark]}
            placeholder="Paste Google Maps URL here"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={googleLocation}
            onChangeText={(val) => {
              setGoogleLocation(val);
              if (errors.googleLocation) setErrors((prev) => ({ ...prev, googleLocation: null }));
            }}
          />
          <Ionicons name="location" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.inputIcon} />
        </View>
        {errors.googleLocation && <Text style={styles.errorText}>{errors.googleLocation}</Text>}

        {/* Appointment Date */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Appointment Date <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.date && styles.inputError]}>
          <TextInput
            style={[styles.inputWithIcon, isDark && styles.inputWithIconDark]}
            placeholder="DD-MM-YY"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={dateText}
            onChangeText={(val) => {
              setDateText(val);
              if (errors.date) setErrors((prev) => ({ ...prev, date: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={24} color={isDark ? '#94A3B8' : '#0052CC'} style={styles.inputIcon} />
          </TouchableOpacity>
        </View>
        {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

        {/* Appointment Fix Date */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Appointment Fix Date <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.fixDate && styles.inputError]}>
          <TextInput
            style={[styles.inputWithIcon, isDark && styles.inputWithIconDark]}
            placeholder="DD-MM-YY"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={fixDateText}
            onChangeText={(val) => {
              setFixDateText(val);
              if (errors.fixDate) setErrors((prev) => ({ ...prev, fixDate: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowFixDatePicker(true)}>
            <Ionicons name="calendar-outline" size={24} color={isDark ? '#94A3B8' : '#0052CC'} style={styles.inputIcon} />
          </TouchableOpacity>
        </View>
        {errors.fixDate && <Text style={styles.errorText}>{errors.fixDate}</Text>}

        {/* Appointment Time */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Appointment Time <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.time && styles.inputError]}>
          <TextInput
            style={[styles.inputWithIcon, isDark && styles.inputWithIconDark]}
            placeholder="HH:MM AM/PM"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={timeText}
            onChangeText={(val) => {
              setTimeText(val);
              if (errors.time) setErrors((prev) => ({ ...prev, time: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time-outline" size={24} color={isDark ? '#94A3B8' : '#0052CC'} style={styles.inputIcon} />
          </TouchableOpacity>
        </View>
        {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}

        {/* Where to Waterproof Checklist with Circular Checkboxes */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Where to Waterproof <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.checkboxesContainer, errors.waterproof && styles.inputError]}>
          {isLoadingWaterproof ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#0052CC" />
              <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 6 }}>
                Loading waterproof categories...
              </Text>
            </View>
          ) : waterproofList.length === 0 ? (
            <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', padding: 8 }}>
              No waterproofing categories available.
            </Text>
          ) : (
            waterproofList.map((item) => {
              const isSelected = selectedWaterproofIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.checkboxRow}
                  onPress={() => toggleWaterproofId(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? '#0052CC' : (isDark ? '#64748B' : '#94A3B8')}
                  />
                  <Text style={[styles.checkboxLabel, isDark && styles.checkboxLabelDark]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        {errors.waterproof && <Text style={styles.errorText}>{errors.waterproof}</Text>}

        {/* Assign To Searchable Autocomplete & Dropdown */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            Assign to <Text style={styles.star}>*</Text>
          </Text>
        </View>
        <View style={{ marginBottom: errors.assignedTechnician ? 4 : 20, position: 'relative', zIndex: 10 }}>
          <View style={[
            styles.autocompleteInputContainer, 
            isDark && styles.inputDark,
            errors.assignedTechnician && styles.inputError,
          ]}>
            <TextInput
              style={[styles.autocompleteInput, isDark && styles.textDark, (currentUser?.isFieldEmployee || userRole === 'FIELD_EMPLOYEE' || userRole === 'field-employee' || userRole === 'employee') && { opacity: 0.8 }]}
              placeholder="Search employee by name or ID"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={dropdownOpen ? technicianSearch : assignedTechnician}
              editable={!(currentUser?.isFieldEmployee || userRole === 'FIELD_EMPLOYEE' || userRole === 'field-employee' || userRole === 'employee')}
              onChangeText={(text) => {
                setTechnicianSearch(text);
                setDropdownOpen(true);
              }}
              onFocus={() => {
                setTechnicianSearch(assignedTechnician);
                setDropdownOpen(true);
              }}
            />
            {!(currentUser?.isFieldEmployee || userRole === 'FIELD_EMPLOYEE' || userRole === 'field-employee' || userRole === 'employee') && (assignedTechnician.length > 0 || technicianSearch.length > 0) && (
              <TouchableOpacity
                onPress={() => {
                  setTechnicianSearch('');
                  setAssignedTechnician('');
                  setSelectedEmployeeId(null);
                  setDropdownOpen(true);
                }}
                style={{ padding: 4, marginRight: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (!dropdownOpen) {
                  setTechnicianSearch('');
                }
                setDropdownOpen(!dropdownOpen);
              }}
              style={{ padding: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDark ? '#94A3B8' : '#0052CC'}
              />
            </TouchableOpacity>
          </View>

          {/* Employee Suggestions / Dropdown List */}
          {dropdownOpen && (
            <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {isLoadingEmployees ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#0F172A'} />
                    <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#0F172A', fontWeight: '500', marginTop: 6 }}>
                      Loading employees...
                    </Text>
                  </View>
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => {
                    const empName = emp.name || emp.employeeName || '';
                    const empId = emp.id || emp._id;
                    const isSelected = selectedEmployeeId !== null && String(selectedEmployeeId) === String(empId);
                    return (
                      <TouchableOpacity
                        key={String(empId || empName)}
                        style={[
                          styles.suggestionItem,
                          isDark && styles.suggestionItemDark,
                          isSelected && styles.dropdownItemSelected,
                          isSelected && isDark && styles.dropdownItemSelectedDark,
                        ]}
                        onPress={() => {
                          setAssignedTechnician(empName);
                          setSelectedEmployeeId(empId);
                          setTechnicianSearch('');
                          setDropdownOpen(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons
                            name="person"
                            size={16}
                            color={isSelected ? '#2563EB' : (isDark ? '#94A3B8' : '#64748B')}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.suggestionText,
                                isDark && styles.textDark,
                                isSelected && { color: '#2563EB', fontWeight: '700' },
                              ]}
                            >
                              {empName}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                              ID: {empId} • {emp.role || emp.employeeType || 'Field Employee'}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B' }}>
                      No matching employees found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Selected Employee ID Indicator */}
        {selectedEmployeeId && assignedTechnician ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -10, marginBottom: 20 }}>
            <View style={{ backgroundColor: isDark ? '#1E293B' : '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderColor: isDark ? '#334155' : '#DBEAFE', borderWidth: 1 }}>
              <Ionicons name="id-card-outline" size={13} color="#2563EB" style={{ marginRight: 5 }} />
              <Text style={{ fontSize: 12, color: isDark ? '#93C5FD' : '#1D4ED8', fontWeight: '600' }}>
                Assigned Employee ID: {selectedEmployeeId}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Book Appointment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Pickers & Time Pickers */}
      
      {/* 1. Appointment Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Appointment Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setDateValue(d);
                    setDateText(formatDate(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onValueChange={(e, d) => {
            setShowDatePicker(false);
            if (d) {
              setDateValue(d);
              setDateText(formatDate(d));
            }
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {/* 2. Appointment Fix Date Picker */}
      {showFixDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showFixDatePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Fix Date</Text>
                <TouchableOpacity onPress={() => setShowFixDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={fixDateValue}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setFixDateValue(d);
                    setFixDateText(formatDate(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showFixDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={fixDateValue}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onValueChange={(e, d) => {
            setShowFixDatePicker(false);
            if (d) {
              setFixDateValue(d);
              setFixDateText(formatDate(d));
            }
          }}
          onDismiss={() => setShowFixDatePicker(false)}
        />
      )}

      {/* 3. Appointment Time Picker */}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showTimePicker}>
          <View style={styles.pickerModalBackdrop}>
            <View style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, isDark && styles.textDark]}>Select Appointment Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={timeValue}
                mode="time"
                display="spinner"
                is24Hour={false}
                themeVariant={isDark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) {
                    setTimeValue(d);
                    setTimeText(formatTime(d));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={timeValue}
          mode="time"
          display="default"
          is24Hour={false}
          onValueChange={(e, d) => {
            setShowTimePicker(false);
            if (d) {
              setTimeValue(d);
              setTimeText(formatTime(d));
            }
          }}
          onDismiss={() => setShowTimePicker(false)}
        />
      )}

      <MaterialOverlayLoader
        visible={isSubmitting}
        title="Booking Appointment..."
        subtitle="Scheduling and creating record"
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 48,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  inputWrapperDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  inputWithIcon: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    color: '#000000',
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  inputWithIconDark: {
    color: '#F8FAFC',
  },
  inputIcon: {
    paddingRight: 14,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  serviceCardActive: {
    borderColor: '#0052CC',
    backgroundColor: '#EFF6FF',
    shadowColor: '#0052CC',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  serviceCardActiveDark: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceIconWrapDark: {
    backgroundColor: '#0F172A',
  },
  serviceIconWrapActive: {
    backgroundColor: '#0052CC',
  },
  serviceIconWrapActiveDark: {
    backgroundColor: '#3B82F6',
  },
  serviceCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  serviceCardTitleActive: {
    color: '#1E3A8A',
  },
  serviceCardTitleActiveDark: {
    color: '#93C5FD',
  },
  serviceCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  serviceCardSubtitleDark: {
    color: '#94A3B8',
  },
  serviceCardSubtitleActive: {
    color: '#2563EB',
  },
  serviceCardSubtitleActiveDark: {
    color: '#CBD5E1',
  },
  checkboxesContainer: {
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333333',
    marginLeft: 12,
  },
  checkboxLabelDark: {
    color: '#CBD5E1',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 30,
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
    color: '#666666',
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
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemIcon: {
    marginRight: 10,
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
  submitButton: {
    backgroundColor: '#0052CC',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  
  // Custom Date/Time Picker Modal Styles (iOS)
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInputWithDropdown: {
    flex: 1,
    marginBottom: 0,
    marginLeft: 8,
  },
});
