import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { MaterialFormSkeleton, MaterialOverlayLoader, MaterialSuccessModal } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

// Helper to parse date string (DD-MM-YYYY or YYYY-MM-DD) into Date object
const parseDateToDateObj = (dateStr) => {
  if (!dateStr) return new Date();
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(d.getTime())) return d;
    } else {
      // DD-MM-YYYY or DD-MM-YY
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      if (!isNaN(d.getTime())) return d;
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// Helper to parse time string (e.g. "10:00 AM" or "14:30") into Date object
const parseTimeToDateObj = (timeStr) => {
  if (!timeStr) return new Date();
  const d = new Date();
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, mins, 0, 0);
    return d;
  }
  return d;
};

export default function ReassignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [appointment, setAppointment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date/Time values (derived from appointment)
  const [fixDateValue, setFixDateValue] = useState(new Date());
  const [timeValue, setTimeValue] = useState(new Date());

  // Technician assignment dropdown states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Success & Error Modal states
  const [successModal, setSuccessModal] = useState({ visible: false, title: '', message: '' });
  const [errorModal, setErrorModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [appRes, empRes] = await Promise.all([
          id ? appointmentService.getAppointmentById(id) : Promise.resolve(null),
          employeeService.getEmployees(),
        ]);

        if (isMounted) {
          if (appRes?.success && appRes.appointment) {
            const app = appRes.appointment;
            setAppointment(app);
            setAssignedTechnician(app.assignedTo || '');
            setSelectedEmployeeId(app.assignedEmployeeId || app.employeeId || null);

            // Initialize date/time values from appointment's existing schedule
            const initialDate = app.appointmentDate || app.appointmentFixDate || app.fixDate || app.date;
            if (initialDate) {
              setFixDateValue(parseDateToDateObj(initialDate));
            }
            const initialTime = app.appointmentTime || app.time;
            if (initialTime) {
              setTimeValue(parseTimeToDateObj(initialTime));
            }
          }

          if (empRes?.success && Array.isArray(empRes.data)) {
            setEmployees(empRes.data);
          } else if (Array.isArray(empRes?.employees)) {
            setEmployees(empRes.employees);
          }
        }
      } catch (_e) {
        // Handled via loading state
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Date formatter DD-MM-YY (e.g. 12-12-26)
  const formatDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Time formatter HH:MM AM/PM
  const formatTime = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleReassign = async () => {
    if (!appointment) {
      setErrorModal({
        visible: true,
        title: 'Error',
        message: 'No appointment selected.',
      });
      return;
    }

    if (!assignedTechnician || !assignedTechnician.trim()) {
      setErrorModal({
        visible: true,
        title: 'Validation Error',
        message: 'Please select a technician to reassign this appointment to.',
      });
      return;
    }

    const newDateStr = formatDate(fixDateValue) || appointment.appointmentDate || appointment.fixDate || '';
    const newTimeStr = formatTime(timeValue) || appointment.appointmentTime || appointment.time || '';

    setIsSubmitting(true);
    try {
      const result = await appointmentService.updateAppointment(appointment.id, {
        ...appointment,
        appointmentDate: newDateStr,
        appointmentFixDate: newDateStr,
        appointmentTime: newTimeStr,
        assignedTo: assignedTechnician,
        assignedEmployeeId: selectedEmployeeId || appointment.assignedEmployeeId,
      });

      if (result && result.success !== false) {
        setSuccessModal({
          visible: true,
          title: 'Reassigned Successfully!',
          message: `Appointment has been successfully reassigned to ${assignedTechnician}.`,
        });
      } else {
        setErrorModal({
          visible: true,
          title: 'Reassignment Failed',
          message: result?.message || 'Failed to update appointment on server.',
        });
      }
    } catch (err) {
      setErrorModal({
        visible: true,
        title: 'Error',
        message: err.message || 'An unexpected error occurred while reassigning.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <InnerHeader title="Reassign" paddingTop={insets.top} isDark={isDark} />
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <MaterialFormSkeleton isDark={isDark} />
        </ScrollView>
      </View>
    );
  }

  // Dynamic values extracted from appointment
  const clientName = (appointment?.clientName || appointment?.customerName || appointment?.name || '').trim() || 'Client';
  const appointmentCode = appointment?.appointmentCode || appointment?.referenceNo || (appointment?.id ? `APP-${appointment.id}` : '--');
  const clientPhone = appointment?.mobileNumber || appointment?.phone || appointment?.clientPhone || appointment?.mobile || 'No Phone';
  const currentApptDate = appointment?.appointmentDate || appointment?.appointmentFixDate || appointment?.fixDate || appointment?.date || '--';
  const currentApptTime = appointment?.appointmentTime || appointment?.time || '--';

  const avatarSource = appointment?.avatar || appointment?.image
    ? (typeof (appointment.avatar || appointment.image) === 'string'
        ? { uri: appointment.avatar || appointment.image }
        : (appointment.avatar || appointment.image))
    : require('../../../../assets/images/technician_avatar.png');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDark && styles.containerDark]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader title="Reassign" paddingTop={insets.top} isDark={isDark} />

      {/* Form Card Overlay */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.cardContainer, isDark && styles.cardContainerDark]}>
          
          {/* Dynamic Profile Row */}
          <View style={styles.profileRow}>
            <Image
              source={avatarSource}
              style={styles.avatar}
              resizeMode="cover"
            />
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, isDark && styles.textDark]}>{clientName}</Text>
              
              <View style={styles.metaRow}>
                <Ionicons name="card-outline" size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                <Text style={[styles.metaText, isDark && styles.subtextDark]}>{appointmentCode}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                <Text style={[styles.metaText, isDark && styles.subtextDark]}>{clientPhone}</Text>
              </View>
            </View>
          </View>

          {/* Current Date & Time Stat Box */}
          <View style={[styles.statBox, isDark && styles.statBoxDark]}>
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>Appointment Date</Text>
              <Text style={[styles.statValue, isDark && styles.statValueDark]}>{currentApptDate}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>Attended Time</Text>
              <Text style={[styles.statValue, isDark && styles.statValueDark]}>{currentApptTime}</Text>
            </View>
          </View>



          {/* Assign To Dropdown selector */}
          <Text style={[styles.label, isDark && styles.labelDark]}>Assign to</Text>
          <View style={[styles.dropdownContainer, isDark && styles.dropdownContainerDark]}>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => setDropdownOpen(!dropdownOpen)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownHeaderText, isDark && styles.subtextDark]}>
                {assignedTechnician ? assignedTechnician : 'Select a Technician'}
              </Text>
              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDark ? '#94A3B8' : '#000000'}
              />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
                {employees.map((emp) => {
                  const empName = emp.name || emp.employeeName || 'Technician';
                  const isSelected = assignedTechnician === empName;
                  return (
                    <TouchableOpacity
                      key={emp.id || emp._id || empName}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                        isSelected && isDark && styles.dropdownItemSelectedDark,
                      ]}
                      onPress={() => {
                        setAssignedTechnician(empName);
                        setSelectedEmployeeId(emp.id || emp._id || null);
                        setDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <Ionicons 
                          name="person" 
                          size={18} 
                          color={isSelected ? '#0052CC' : (isDark ? '#94A3B8' : '#000000')} 
                          style={styles.dropdownItemIcon} 
                        />
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected && styles.dropdownItemTextSelected,
                            isDark && styles.textDark,
                            isSelected && isDark && styles.dropdownItemTextSelectedDark,
                          ]}
                        >
                          {empName}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#0052CC" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Reassign Action Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleReassign}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>Reassign</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Loading Overlay */}
      <MaterialOverlayLoader
        visible={isSubmitting}
        title="Reassigning Appointment..."
        subtitle="Updating schedule and technician"
      />

      {/* Animated Success Modal */}
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

      {/* Error Popup Modal */}
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
              {errorModal.title || 'Error'}
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
    paddingTop: 16,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
  },
  cardContainerDark: {
    backgroundColor: '#1C1C1C',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
  },
  profileDetails: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
  },
  statBox: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  statBoxDark: {
    backgroundColor: 'rgba(3, 105, 161, 0.2)',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#0369A1',
    marginBottom: 4,
    fontWeight: '500',
  },
  statLabelDark: {
    color: '#38BDF8',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  statValueDark: {
    color: '#7DD3FC',
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  inputWrapperDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  inputWrapperDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.85,
  },
  inputWrapperDisabledDark: {
    backgroundColor: '#141414',
    borderColor: '#262626',
    opacity: 0.8,
  },
  inputWithIcon: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    color: '#000000',
    fontSize: 15,
  },
  inputWithIconDark: {
    backgroundColor: '#1C1C1C',
    color: '#F8FAFC',
  },
  inputWithIconDisabled: {
    color: '#64748B',
    backgroundColor: 'transparent',
  },
  inputWithIconDisabledDark: {
    color: '#94A3B8',
    backgroundColor: 'transparent',
  },
  inputIcon: {
    paddingRight: 14,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
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
  dropdownListDark: {
    borderTopColor: '#334155',
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
    color: '#0052CC',
    fontWeight: '700',
  },
  dropdownItemTextSelectedDark: {
    color: '#38BDF8',
  },
  textDark: {
    color: '#F8FAFC',
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
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Error Modal Styles
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
