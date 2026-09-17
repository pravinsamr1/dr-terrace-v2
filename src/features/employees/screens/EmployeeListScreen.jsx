import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../../core/config/config';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { MaterialListSkeleton, MaterialProgressBar } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

// Define preloaded avatar mappings
const PRESETS_AVATARS = {
  employee_ganesh: require('../../../../assets/images/employee_ganesh.png'),
  technician_avatar: require('../../../../assets/images/technician_avatar.png'),
};

export default function EmployeeListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const isDark = colorScheme === 'dark';

  // State to filter employee list: 'Field Employee' or 'Office Employee'
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('Field Employee');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstMountRef = useRef(true);

  // Delete confirmation modal state
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  const fetchEmployeesFromApi = useCallback(async () => {
    try {
      const res = await employeeService.getEmployees();
      if (res && res.success && Array.isArray(res.data)) {
        setEmployees(res.data);
      } else {
        setEmployees([]);
      }
    } catch (_err) {
      setEmployees([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        setIsLoading(true);
        fetchEmployeesFromApi().finally(() => setIsLoading(false));
      } else {
        fetchEmployeesFromApi();
      }
    }, [fetchEmployeesFromApi])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployeesFromApi();
    setRefreshing(false);
  };

  const getAvatarSource = (id) => {
    if (!id) return require('../../../../assets/images/technician_avatar.png');
    if (typeof id === 'string') {
      if (
        id.startsWith('file://') ||
        id.startsWith('content://') ||
        id.startsWith('http://') ||
        id.startsWith('https://') ||
        id.startsWith('ph://') ||
        id.startsWith('data:')
      ) {
        return { uri: id };
      }
      if (id.startsWith('/')) {
        const baseUrl = API_BASE_URL.split('/api')[0];
        return { uri: `${baseUrl}${id}` };
      }
    }
    return PRESETS_AVATARS[id] || require('../../../../assets/images/technician_avatar.png');
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    const targetId = employeeToDelete.id || employeeToDelete._id;
    setIsDeleting(true);
    try {
      const res = await employeeService.deleteEmployee(targetId);
      if (res && res.success) {
        Alert.alert('Success', 'Employee deleted successfully.');
      } else {
        Alert.alert('Error', res?.message || 'Failed to delete employee');
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to delete employee');
    } finally {
      setEmployeeToDelete(null);
      setIsDeleting(false);
      await fetchEmployeesFromApi();
    }
  };

  // Filter list of employees by Office vs Field
  const fieldEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const roleStr = String(emp?.employeeType || emp?.role || emp?.type || '').toLowerCase().trim();
      return !roleStr.includes('office');
    });
  }, [employees]);

  const officeEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const roleStr = String(emp?.employeeType || emp?.role || emp?.type || '').toLowerCase().trim();
      return roleStr.includes('office');
    });
  }, [employees]);

  const filteredEmployees = activeTab === 'Field Employee' ? fieldEmployees : officeEmployees;

  const handleNavigateToDetail = (empId) => {
    router.push({
      pathname: '/employee-detail',
      params: { id: empId },
    });
  };

  const handleNavigateToEdit = (empId) => {
    router.push({
      pathname: '/employee-edit',
      params: { id: empId },
    });
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Unable to open dialer.');
        }
      })
      .catch(() => Alert.alert('Error', 'An error occurred while trying to call.'));
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader
        title={activeTab === 'Field Employee' ? 'Field Employees' : 'Office Employees'}
        paddingTop={insets.top}
        isDark={isDark}
      />

      {/* Scrollable list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0052CC']}
            tintColor={isDark ? '#93C5FD' : '#0052CC'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        {/* Tab Selector Pills matching Figma design */}
        <View style={[styles.tabRowContainer, isDark && styles.tabRowContainerDark]}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'Field Employee' && styles.tabPillActive,
              activeTab === 'Field Employee' && isDark && styles.tabPillActiveDark,
            ]}
            onPress={() => setActiveTab('Field Employee')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'Field Employee' && styles.tabPillTextActive,
                activeTab !== 'Field Employee' && isDark && styles.subtextDark,
              ]}
            >
              Field Employee ({fieldEmployees.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'Office Employee' && styles.tabPillActive,
              activeTab === 'Office Employee' && isDark && styles.tabPillActiveDark,
            ]}
            onPress={() => setActiveTab('Office Employee')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'Office Employee' && styles.tabPillTextActive,
                activeTab !== 'Office Employee' && isDark && styles.subtextDark,
              ]}
            >
              Office Employee ({officeEmployees.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Progress Bar on background refresh */}
        {isLoading && filteredEmployees.length > 0 && (
          <MaterialProgressBar indeterminate visible={true} style={{ marginBottom: 10 }} />
        )}

        {/* Employee Cards List */}
        {isLoading && filteredEmployees.length === 0 ? (
          <MaterialListSkeleton count={5} isCardStyle={true} />
        ) : filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => (
            <TouchableOpacity
              key={emp.id}
              style={[styles.employeeCard, isDark && styles.employeeCardDark]}
              onPress={() => handleNavigateToDetail(emp.id)}
              activeOpacity={0.9}
            >
              <View style={styles.cardMainSection}>
                {/* Left Profile Avatar Image */}
                <Image source={getAvatarSource(emp.image || emp.employeeImage)} style={styles.avatarImage} />

                {/* Center Content column */}
                <View style={styles.detailsColumn}>
                  <Text style={[styles.employeeName, isDark && styles.textDark]}>
                    {(emp.name || emp.employeeName || 'Staff').trim()}
                  </Text>

                  {/* ID / Code Row */}
                  <View style={styles.infoRow}>
                    <Ionicons name="card-outline" size={16} color="#64748B" style={styles.infoIcon} />
                    <Text style={[styles.infoText, isDark && styles.subtextDark]}>
                      {emp.code || emp.employeeCode || `EMP-${emp.id}`}
                    </Text>
                  </View>

                  {/* Mobile Row */}
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={16} color="#64748B" style={styles.infoIcon} />
                    <Text style={[styles.infoText, isDark && styles.subtextDark]}>
                      {emp.mobile || emp.mobileNumber || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions row at the bottom with modern glassmorphic pill buttons */}
              <View style={[styles.actionsRow, isDark && styles.actionsRowDark]}>
                <TouchableOpacity
                  style={[styles.pillBtn, styles.callPill, isDark && styles.callPillDark]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCall(emp.mobile);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="call" size={13} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 5 }} />
                  <Text style={[styles.pillBtnText, styles.callPillText, isDark && styles.callPillTextDark]}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pillBtn, styles.editPill, isDark && styles.editPillDark]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleNavigateToEdit(emp.id);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="create-outline" size={14} color={isDark ? '#60A5FA' : '#2563EB'} style={{ marginRight: 5 }} />
                  <Text style={[styles.pillBtnText, styles.editPillText, isDark && styles.editPillTextDark]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pillBtn, styles.deletePill, isDark && styles.deletePillDark]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setEmployeeToDelete(emp);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={14} color={isDark ? '#F87171' : '#DC2626'} style={{ marginRight: 5 }} />
                  <Text style={[styles.pillBtnText, styles.deletePillText, isDark && styles.deletePillTextDark]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={isDark ? '#334155' : '#CBD5E1'} />
            <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
              No {activeTab.toLowerCase()}s found.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Dialog Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={employeeToDelete !== null}
        onRequestClose={() => !isDeleting && setEmployeeToDelete(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, isDark && styles.dialogCardDark]}>
            <Text style={[styles.dialogTitle, isDark && styles.textDark]}>
              Are You Sure To Delete
            </Text>
            {employeeToDelete && (
              <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', marginTop: 6, textAlign: 'center' }}>
                {employeeToDelete.name || employeeToDelete.employeeName || 'this employee'}
              </Text>
            )}

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, isDeleting && { opacity: 0.5 }]}
                onPress={() => setEmployeeToDelete(null)}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogDeleteBtn, isDeleting && { opacity: 0.7 }]}
                onPress={confirmDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  tabRowContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  tabRowContainerDark: {
    backgroundColor: '#1C1C1C',
  },
  tabPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: '#0052CC',
  },
  tabPillActiveDark: {
    backgroundColor: '#3B82F6',
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  employeeCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardMainSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  detailsColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  employeeName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    width: '100%',
  },
  actionsRowDark: {
    borderTopColor: '#334155',
  },
  pillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  callPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  callPillDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  callPillText: {
    color: '#059669',
  },
  callPillTextDark: {
    color: '#34D399',
  },
  editPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  editPillDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  editPillText: {
    color: '#2563EB',
  },
  editPillTextDark: {
    color: '#60A5FA',
  },
  deletePill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  deletePillDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  deletePillText: {
    color: '#DC2626',
  },
  deletePillTextDark: {
    color: '#F87171',
  },
  centerLoadingContainer: {
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Dialog styles
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  dialogCardDark: {
    backgroundColor: '#1C1C1C',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    backgroundColor: '#0052CC',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dialogDeleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Edit modal styles
  editModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  editModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  editModalCardDark: {
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
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 6,
  },
  labelDark: {
    color: '#E2E8F0',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    color: '#000000',
    fontSize: 14,
    marginBottom: 12,
  },
  editInputDark: {
    borderColor: '#475569',
    backgroundColor: '#080808',
    color: '#F8FAFC',
  },
  editDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  editDropdownHeaderDark: {
    borderColor: '#475569',
    backgroundColor: '#080808',
  },
  editDropdownHeaderText: {
    fontSize: 14,
    color: '#333333',
  },
  editDropdownList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  editDropdownListDark: {
    borderColor: '#475569',
    backgroundColor: '#080808',
  },
  editDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  editDropdownItemText: {
    fontSize: 14,
    color: '#333333',
  },
  avatarTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0052CC',
  },
  avatarOptionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarOptionItem: {
    padding: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 12,
  },
  avatarOptionItemSelected: {
    borderColor: '#2563EB',
  },
  optionAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  saveChangesBtn: {
    backgroundColor: '#4CA6F5',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  saveChangesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
