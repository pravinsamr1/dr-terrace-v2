import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { useOsmAreas, useOsmCities } from '../../../core/hooks/useOsmAreas';
import { getPincodeForArea } from '../../../shared/constants/chennai-areas';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal, MaterialFormSkeleton, MaterialOverlayLoader, MaterialSuccessModal } from '../../../shared/components/material';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { authRepository } from '../../auth/api/authRepository';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { isPastDate } from '../../../core/utils/validation';

const parseDateValue = (rawDate) => {
  if (!rawDate) return null;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
  const str = String(rawDate).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts.map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    } else {
      const d = Number(parts[0]);
      const m = Number(parts[1]);
      const y = Number(parts[2]);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const parseTimeValue = (rawTime) => {
  if (!rawTime) return null;
  if (rawTime instanceof Date && !isNaN(rawTime.getTime())) return rawTime;
  const str = String(rawTime).trim();
  if (!str) return null;
  const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[4] ? match[4].toLowerCase() : null;
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  return null;
};

const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : parseDateValue(date);
  if (!d || isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const formatTime = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : parseTimeValue(date);
  if (!d || isNaN(d.getTime())) return String(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

const toApiDateString = (dateVal, fallbackText) => {
  const target = dateVal || fallbackText;
  if (!target) return '';
  if (target instanceof Date && !isNaN(target.getTime())) {
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(target).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const yearPart = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${yearPart}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
};

const toApiTimeString = (timeVal, fallbackText) => {
  const target = timeVal || fallbackText;
  if (!target) return '';
  if (target instanceof Date && !isNaN(target.getTime())) {
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  const str = String(target).trim();
  const match = str.match(/(\d+):(\d+)\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2].padStart(2, '0');
    const ampm = match[3] ? match[3].toLowerCase() : null;
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return str;
};

const parseDateToBadge = (dateVal, fallbackText) => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const d = dateVal instanceof Date ? dateVal : parseDateValue(dateVal || fallbackText);
  if (!d || isNaN(d.getTime())) {
    return { month: '--', day: '--' };
  }
  return {
    month: months[d.getMonth()],
    day: String(d.getDate()).padStart(2, '0'),
  };
};

export default function EditAppointmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState('master');

  useEffect(() => {
    authRepository.getUser().then((u) => { if (u?.role) setUserRole(u.role); });
  }, []);

  const isDark = colorScheme === 'dark';
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
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

  // Date/Time picker value states (populated from API)
  const [dateValue, setDateValue] = useState(null);
  const [fixDateValue, setFixDateValue] = useState(null);
  const [timeValue, setTimeValue] = useState(null);

  // Text input states for date and time (populated from API)
  const [dateText, setDateText] = useState('');
  const [fixDateText, setFixDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  // Picker display toggle states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFixDatePicker, setShowFixDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState({});

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
        }
      } catch (_err) {
        // ignore
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    fetchEmployeesFromApi();
  }, []);

  // Load existing appointment data to edit
  useEffect(() => {
    let isMounted = true;
    const loadAppointmentData = async () => {
      setIsLoadingDetails(true);

      // Fetch from API directly (no context lookup)
      let existing = null;

      if (!existing && id) {
        try {
          const res = await appointmentService.getAppointmentById(id);
          if (res && res.success && res.appointment) {
            existing = res.appointment;
          }
        } catch (_err) { }
      }

      if (isMounted && existing) {
        setCustomerName(existing.clientName || existing.customerName || existing.name || '');
        setMobileNumber(existing.phone || existing.mobileNumber || existing.clientPhone || '');

        // Populate address fields
        if (existing.addressBreakdown) {
          setDoorNo(existing.addressBreakdown.doorNo || '');
          setStreetName(existing.addressBreakdown.street || existing.addressBreakdown.streetName || '');
          setAreaInput(existing.addressBreakdown.area || '');
          setCityInput(existing.addressBreakdown.city || 'Chennai');
          setStateInput(existing.addressBreakdown.state || existing.state || 'Tamil Nadu');
          setPincodeInput(existing.addressBreakdown.pincode || existing.pincode || '');
        } else if (existing.address && typeof existing.address === 'object') {
          setDoorNo(existing.address.doorNo || '');
          setStreetName(existing.address.streetName || existing.address.street || '');
          setAreaInput(existing.address.area || '');
          setCityInput(existing.address.city || 'Chennai');
          setStateInput(existing.address.state || 'Tamil Nadu');
          setPincodeInput(existing.address.pincode || '');
        } else if (existing.location) {
          setAreaInput(existing.location);
          setCityInput(existing.city || 'Chennai');
          setStateInput(existing.state || 'Tamil Nadu');
          setPincodeInput(existing.pincode || '');
        }

        setGoogleLocation(existing.googleLocation || existing.mapLocation || '');

        const rawDate = existing.appointmentDate || existing.date || '';
        const rawFixDate = existing.appointmentFixDate || existing.fixDate || rawDate || '';
        const rawTime = existing.appointmentTime || existing.time || '';

        const parsedDate = parseDateValue(rawDate);
        const parsedFixDate = parseDateValue(rawFixDate) || parsedDate;
        const parsedTime = parseTimeValue(rawTime);

        if (parsedDate) setDateValue(parsedDate);
        if (parsedFixDate) setFixDateValue(parsedFixDate);
        if (parsedTime) setTimeValue(parsedTime);

        setDateText(rawDate ? formatDate(parsedDate || rawDate) : '');
        setFixDateText(rawFixDate ? formatDate(parsedFixDate || rawFixDate) : '');
        setTimeText(rawTime ? formatTime(parsedTime || rawTime) : '');

        const techName = existing.assignedTo || existing.assignedTechnician || existing.employeeName || '';
        setAssignedTechnician(techName);
        setSelectedEmployeeId(existing.assignedEmployeeId || existing.employeeId || existing.employee_id || existing.technicianId || null);

        // Restore waterproof selection
        const rawWaterproof = existing.whereToWaterproofIds || existing.whereToWaterproof;
        if (Array.isArray(rawWaterproof) && rawWaterproof.length > 0) {
          const validIds = rawWaterproof
            .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
            .filter((n) => !isNaN(n) && n > 0);
          if (validIds.length > 0) {
            setSelectedWaterproofIds(validIds);
          }
        }
      }

      if (isMounted) {
        setIsLoadingDetails(false);
      }
    };

    loadAppointmentData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Filtered employees based on search query
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
    } else if (isPastDate(dateText)) {
      newErrors.date = 'Appointment Date cannot be in the past.';
    }

    if (!fixDateText.trim()) {
      newErrors.fixDate = 'Appointment Fix Date is required.';
    } else if (isPastDate(fixDateText)) {
      newErrors.fixDate = 'Appointment Fix Date cannot be in the past.';
    }

    if (!timeText.trim()) {
      newErrors.time = 'Appointment Time is required.';
    }

    const validWaterproofIds = (selectedWaterproofIds || [])
      .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
      .filter((n) => !isNaN(n) && n > 0);

    if (validWaterproofIds.length === 0) {
      newErrors.waterproof = 'Please select at least one waterproofing area.';
    }

    if (!selectedEmployeeId && !assignedTechnician) {
      newErrors.assignedTechnician = 'Please assign an employee.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [alertModal, setAlertModal] = React.useState({ visible: false, type: 'info', title: '', message: '', onConfirm: null });
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });

  const showModal = ({ type = 'info', title, message, onConfirm }) => {
    setAlertModal({ visible: true, type, title, message, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setAlertModal((prev) => ({ ...prev, visible: false }));
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      showModal({ type: 'warning', title: 'Validation Error', message: 'Please check highlighted fields and correct the errors.' });
      return;
    }

    const validIds = (selectedWaterproofIds || [])
      .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
      .filter((n) => !isNaN(n) && n > 0);

    const selectedServices = waterproofList
      .filter((item) => selectedWaterproofIds.includes(item.id))
      .map((item) => item.name);

    const fullAddress = [doorNo.trim(), streetName.trim(), areaInput.trim(), cityInput.trim(), stateInput.trim(), pincodeInput.trim()]
      .filter(Boolean)
      .join(', ');

    const appointmentPayload = {
      // Backend Contract
      customerName: customerName.trim(),
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
      appointmentDate: toApiDateString(dateValue, dateText),
      appointmentFixDate: toApiDateString(fixDateValue || dateValue, fixDateText || dateText),
      appointmentTime: toApiTimeString(timeValue, timeText),
      whereToWaterproof: validIds.length > 0 ? validIds : [1],
      assignedEmployeeId: Number(selectedEmployeeId) || (employeeList[0] ? Number(employeeList[0].id) : null),

      // Local context & UI helper fields
      clientName: customerName.trim(),
      name: customerName.trim(),
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
      timeBadge: parseDateToBadge(dateValue, dateText),
    };

    setIsSubmitting(true);
    try {
      const result = await appointmentService.updateAppointment(id, appointmentPayload);
      if (result && result.success === false) {
        showModal({ type: 'error', title: 'Update Failed', message: result.message || 'Failed to update appointment on server.' });
      } else {
        setSuccessModal({
          visible: true,
          title: 'Appointment Updated!',
          message: `Appointment details for ${customerName} have been updated successfully.`,
        });
      }
    } catch (err) {
      showModal({ type: 'error', title: 'Error', message: err.message || 'Failed to update appointment. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };



  if (isLoadingDetails) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <InnerHeader title="Edit Appointment" paddingTop={insets.top} isDark={isDark} />
        <MaterialFormSkeleton showHeader={false} />
      </View>
    );
  }

  return (
    <>
    <MaterialAlertModal
      visible={alertModal.visible}
      type={alertModal.type}
      title={alertModal.title}
      message={alertModal.message}
      onClose={() => {
        hideModal();
        if (alertModal.onConfirm) alertModal.onConfirm();
      }}
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader title="Edit Appointment" paddingTop={insets.top} isDark={isDark} />

      {/* Scrollable Form */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110), paddingTop: 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Customer Name <Text style={styles.star}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.customerName && styles.inputError]}
          placeholder="Enter full name"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={customerName}
          onChangeText={(val) => {
            setCustomerName(val);
            if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: null }));
          }}
        />
        {errors.customerName && <Text style={styles.errorText}>{errors.customerName}</Text>}

        {/* Mobile Number */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Mobile Number <Text style={styles.star}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark, errors.mobileNumber && styles.inputError]}
          placeholder="10-digit mobile number"
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={mobileNumber}
          onChangeText={(val) => {
            setMobileNumber(val);
            if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: null }));
          }}
          keyboardType="phone-pad"
          maxLength={10}
        />
        {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}

        {/* Address Header */}
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

        {/* 3. Area with OSM auto-suggest */}
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

          {/* Area Suggestions Dropdown */}
          {showAreaSuggestions && (filteredAreas.length > 0 || isLoadingOsm) && (
            <View style={[styles.suggestionsBox, isDark && styles.suggestionsBoxDark]}>
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
            </View>
          )}
        </View>
        {errors.areaInput && <Text style={styles.errorText}>{errors.areaInput}</Text>}

        {/* 4. City */}
        <View style={{ marginBottom: errors.cityInput ? 4 : 12, position: 'relative', zIndex: 20 }}>
          <View style={[styles.autocompleteInputContainer, isDark && styles.inputDark, errors.cityInput && styles.inputError]}>
            <TextInput
              style={[styles.autocompleteInput, isDark && styles.textDark]}
              placeholder="City (e.g. Chennai)"
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
              const p = parseDateValue(val);
              if (p) setDateValue(p);
              if (errors.date) setErrors((prev) => ({ ...prev, date: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.inputIcon}>
            <Ionicons name="calendar-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>
        {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

        {showDatePicker && (
          <DateTimePicker
            value={dateValue || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onValueChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setDateValue(selectedDate);
                setDateText(formatDate(selectedDate));
                if (errors.date) setErrors((prev) => ({ ...prev, date: null }));
              }
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        )}

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
              const p = parseDateValue(val);
              if (p) setFixDateValue(p);
              if (errors.fixDate) setErrors((prev) => ({ ...prev, fixDate: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowFixDatePicker(true)} style={styles.inputIcon}>
            <Ionicons name="calendar-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>
        {errors.fixDate && <Text style={styles.errorText}>{errors.fixDate}</Text>}

        {showFixDatePicker && (
          <DateTimePicker
            value={fixDateValue || dateValue || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onValueChange={(event, selectedDate) => {
              setShowFixDatePicker(false);
              if (selectedDate) {
                setFixDateValue(selectedDate);
                setFixDateText(formatDate(selectedDate));
                if (errors.fixDate) setErrors((prev) => ({ ...prev, fixDate: null }));
              }
            }}
            onDismiss={() => setShowFixDatePicker(false)}
          />
        )}

        {/* Appointment Time */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          Appointment Time <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark, errors.time && styles.inputError]}>
          <TextInput
            style={[styles.inputWithIcon, isDark && styles.inputWithIconDark]}
            placeholder="HH:MM am/pm"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={timeText}
            onChangeText={(val) => {
              setTimeText(val);
              const p = parseTimeValue(val);
              if (p) setTimeValue(p);
              if (errors.time) setErrors((prev) => ({ ...prev, time: null }));
            }}
          />
          <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.inputIcon}>
            <Ionicons name="time-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>
        {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}

        {showTimePicker && (
          <DateTimePicker
            value={timeValue || new Date()}
            mode="time"
            is24Hour={false}
            display="default"
            onValueChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                setTimeValue(selectedDate);
                setTimeText(formatTime(selectedDate));
                if (errors.time) setErrors((prev) => ({ ...prev, time: null }));
              }
            }}
            onDismiss={() => setShowTimePicker(false)}
          />
        )}

        {/* Where to Waterproof */}
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
          Where to Waterproof <Text style={styles.star}>*</Text>
        </Text>
        <View style={[styles.checkboxContainer, isDark && styles.checkboxContainerDark, errors.waterproof && styles.inputError]}>
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
              const isChecked = selectedWaterproofIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.checkboxRow}
                  onPress={() => toggleWaterproofId(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked, isDark && styles.checkboxDark]}>
                    {isChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.checkboxLabel, isDark && styles.textDark]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        {errors.waterproof && <Text style={styles.errorText}>{errors.waterproof}</Text>}

        {/* Assign To Dropdown */}
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
          Assign To <Text style={styles.star}>*</Text>
        </Text>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.dropdownButton, isDark && styles.dropdownButtonDark, errors.assignedTechnician && styles.inputError]}
            onPress={() => setDropdownOpen(!dropdownOpen)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.dropdownSelectedText, isDark && styles.textDark]}>
                {assignedTechnician || 'Select employee'}
              </Text>
              {selectedEmployeeId && (
                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                  ID: #{selectedEmployeeId}
                </Text>
              )}
            </View>
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          {errors.assignedTechnician && <Text style={styles.errorText}>{errors.assignedTechnician}</Text>}

          {dropdownOpen && (
            <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark]}>
              <View style={[styles.searchBoxContainer, isDark && styles.searchBoxContainerDark]}>
                <Ionicons name="search" size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchTextInput, isDark && styles.textDark]}
                  placeholder="Search employee by name..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={technicianSearch}
                  onChangeText={setTechnicianSearch}
                  autoCapitalize="none"
                />
                {technicianSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setTechnicianSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {isLoadingEmployees ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#0052CC" />
                  </View>
                ) : filteredEmployees.length === 0 ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B' }}>
                      No matching employees found
                    </Text>
                  </View>
                ) : (
                  filteredEmployees.map((emp, index) => {
                    const empName = emp.name || emp.employeeName || 'Unknown';
                    const empId = emp.id || emp._id;
                    const empRole = emp.role || emp.employeeType || 'Employee';
                    const isSelected = selectedEmployeeId === empId || assignedTechnician === empName;

                    return (
                      <TouchableOpacity
                        key={empId ? String(empId) : `emp-${index}`}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                          isDark && styles.dropdownItemDark,
                          isSelected && isDark && styles.dropdownItemSelectedDark,
                        ]}
                        onPress={() => {
                          setAssignedTechnician(empName);
                          setSelectedEmployeeId(empId);
                          if (errors.assignedTechnician) setErrors((prev) => ({ ...prev, assignedTechnician: null }));
                          setDropdownOpen(false);
                          setTechnicianSearch('');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownItemText, isDark && styles.textDark, isSelected && { fontWeight: '800', color: '#2563EB' }]}>
                            {empName}
                          </Text>
                          <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }}>
                            ID: #{empId} • {empRole}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Update Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
          onPress={handleUpdate}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <MaterialOverlayLoader
        visible={isSubmitting}
        title="Updating Appointment..."
        subtitle="Saving changes to appointment record"
      />
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  star: {
    color: '#EF4444',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  inputDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  inputWrapperDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  inputWithIcon: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  inputWithIconDark: {
    color: '#F8FAFC',
  },
  inputIcon: {
    marginLeft: 8,
  },
  autocompleteInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  autocompleteInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  suggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionItemDark: {
    borderBottomColor: '#334155',
  },
  suggestionText: {
    fontSize: 13,
    color: '#334155',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 10,
  },
  checkboxContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  checkboxContainerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#0052CC',
    borderColor: '#0052CC',
  },
  checkboxDark: {
    borderColor: '#64748B',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  dropdownWrapper: {
    marginBottom: 24,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  dropdownButtonDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    padding: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownMenuDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 38,
    marginBottom: 8,
  },
  searchBoxContainerDark: {
    backgroundColor: '#0F172A',
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemDark: {
    borderBottomColor: '#334155',
  },
  dropdownItemSelectedDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
  },
  submitButton: {
    backgroundColor: '#0052CC',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  textDark: {
    color: '#F8FAFC',
  },
});
