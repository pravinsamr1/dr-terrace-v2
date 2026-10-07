import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
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
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { employeeRepository as employeeService } from '../../employees/api/employeeRepository';
import { MaterialDetailSkeleton } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

const PRESETS_AVATARS = {
  employee_ganesh: require('../../../../assets/images/employee_ganesh.png'),
  technician_avatar: require('../../../../assets/images/technician_avatar.png'),
};

export default function EmployeeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

  useEffect(() => {
    setEmployee(null);
    setIsLoading(true);
  }, [id]);

  const fetchEmployee = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      if (id) {
        const res = await employeeService.getEmployeeById(id);
        if (res && res.success && res.employee) {
          setEmployee(res.employee);
        } else if (showLoader) {
          setEmployee(null);
        }
      }
    } catch (_err) {
      if (showLoader) {
        setEmployee(null);
      }
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchEmployee(!employee);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployee(false);
    setRefreshing(false);
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
      if (val.startsWith('/')) {
        const baseUrl = API_BASE_URL.split('/api')[0];
        return { uri: `${baseUrl}${val}` };
      }
    }
    return PRESETS_AVATARS[val] || require('../../../../assets/images/technician_avatar.png');
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

  const handleNavigateToEdit = () => {
    router.push({
      pathname: '/employee-edit',
      params: { id: employee?.id || id },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <InnerHeader title="Employee Details" paddingTop={insets.top} isDark={isDark} />
        <MaterialDetailSkeleton showHeader={false} />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <InnerHeader title="Employee Details" paddingTop={insets.top} isDark={isDark} />
        <View style={styles.centered}>
          <Ionicons name="person-circle-outline" size={64} color={isDark ? '#475569' : '#94A3B8'} />
          <Text style={[styles.emptyTitle, isDark && styles.textDark]}>Employee Not Found</Text>
          <TouchableOpacity style={styles.backBtnAction} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const grossSalary = (Number(employee.monthlySalary) || 0) + (Number(employee.conveyanceAllowance) || 0);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader
        title="Employee Details"
        paddingTop={insets.top}
        isDark={isDark}
        right={
          <TouchableOpacity onPress={handleNavigateToEdit} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={22} color={isDark ? '#CBD5E1' : '#FFFFFF'} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0052CC']}
            tintColor={isDark ? '#93C5FD' : '#0052CC'}
          />
        }
      >
        {/* Profile Card Header */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => setIsImageOpen(true)}
            activeOpacity={0.8}
          >
            <Image source={getAvatarSource(employee.image)} style={styles.largeAvatar} />
          </TouchableOpacity>
          <View style={styles.nameHeader}>
            <Text style={[styles.fullName, isDark && styles.textDark]}>{employee.name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleSubtext}>
                {String(employee.employeeType || employee.role || '').toLowerCase().includes('office') ? 'Office Employee' : 'Field Employee'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionBtn, styles.callBtn]}
            onPress={() => handleCall(employee.mobile)}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={18} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, styles.editBtn]}
            onPress={handleNavigateToEdit}
            activeOpacity={0.85}
          >
            <Ionicons name="create" size={18} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.editBtnText}>Edit Details</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Information Card */}
        <View style={[styles.detailsCard, isDark && styles.cardDark]}>
          <SectionHeader title="Basic Information" icon="person-outline" isDark={isDark} />
          <View style={styles.infoGrid}>
            <InfoRow icon="call-outline" label="Mobile" value={employee.mobileNumber || employee.mobile} isDark={isDark} />
            <InfoRow icon="card-outline" label="Employee ID / Code" value={employee.code || `EMP${employee.id}`} isDark={isDark} />
            <InfoRow icon="id-card-outline" label="Aadhaar Number" value={employee.aadhaarNumber || employee.aadhaar || 'N/A'} isDark={isDark} />
            <InfoRowPassword icon="key-outline" label="Account Password" value={employee.password} isDark={isDark} />
          </View>
        </View>

        {/* Address Details Card */}
        <View style={[styles.detailsCard, isDark && styles.cardDark, { marginTop: 16 }]}>
          <SectionHeader title="Address Details" icon="location-outline" isDark={isDark} />
          <View style={styles.infoGrid}>
            <InfoRow icon="home-outline" label="Door No" value={employee.doorNo || employee.address?.doorNo || '—'} isDark={isDark} />
            <InfoRow
              icon="navigate-outline"
              label="Street Name"
              value={employee.streetName || employee.street || employee.address?.streetName || employee.address?.street || '—'}
              isDark={isDark}
            />
            <InfoRow
              icon="location-outline"
              label="Area"
              value={employee.area || employee.address?.area || '—'}
              isDark={isDark}
            />
            <InfoRow icon="business-outline" label="City" value={employee.city || employee.address?.city || 'Chennai'} isDark={isDark} />
            <InfoRow icon="flag-outline" label="State" value={employee.state || employee.address?.state || 'Tamil Nadu'} isDark={isDark} />
            <InfoRow icon="mail-outline" label="Pincode" value={employee.pincode || employee.address?.pincode || '—'} isDark={isDark} />
          </View>
        </View>

        {/* Salary & Pay Details Card */}
        <View style={[styles.detailsCard, isDark && styles.cardDark, { marginTop: 16 }]}>
          <SectionHeader title="Salary & Pay Details" icon="cash-outline" isDark={isDark} />
          <View style={styles.infoGrid}>
            <InfoRow icon="wallet-outline" label="Base Salary" value={`₹${employee.monthlySalary || employee.monthlyBase || 0}`} isDark={isDark} />
            <InfoRow icon="bicycle-outline" label="Allowance" value={`₹${employee.conveyanceAllowance || 0}`} isDark={isDark} />
            <InfoRow icon="calendar-outline" label="Monthly Working Days" value={`${employee.workingDaysPerMonth || employee.monthlyWorkingDay || 26} Days`} isDark={isDark} />
            <InfoRow icon="trending-up-outline" label="Gross Total" value={`₹${grossSalary}`} isDark={isDark} />
          </View>
        </View>
      </ScrollView>

      {/* Full Screen Image Viewer */}
      <Modal
        visible={isImageOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsImageOpen(false)}
      >
        <TouchableOpacity
          style={styles.imageViewer}
          activeOpacity={1}
          onPress={() => setIsImageOpen(false)}
        >
          <Image
            source={getAvatarSource(employee.image)}
            style={styles.fullImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={[styles.imageViewerClose, { top: insets.top + 12 }]}
            onPress={() => setIsImageOpen(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

function InfoRow({ icon, label, value, isDark }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelContainer}>
        <Ionicons name={icon} size={16} color="#64748B" style={styles.infoIcon} />
        <Text style={[styles.infoLabel, isDark && styles.subtextDark]}>{label}</Text>
      </View>
      <Text
        style={[styles.infoValue, isDark && styles.textDark]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {value || '—'}
      </Text>
    </View>
  );
}

function InfoRowPassword({ icon, label, value, isDark }) {
  const [show, setShow] = useState(false);

  const displayVal = value ? (show ? value : '••••••••') : (show ? 'Encrypted / Hidden' : '••••••••');

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelContainer}>
        <Ionicons name={icon} size={16} color="#64748B" style={styles.infoIcon} />
        <Text style={[styles.infoLabel, isDark && styles.subtextDark]}>{label}</Text>
      </View>
      <View style={styles.passwordValueContainer}>
        <Text style={[styles.infoValue, isDark && styles.textDark, { marginRight: 8 }]}>
          {displayVal}
        </Text>
        <TouchableOpacity onPress={() => setShow(!show)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={18} color="#64748B" />
        </TouchableOpacity>
      </View>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  backBtnAction: {
    marginTop: 16,
    backgroundColor: '#0052CC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    marginBottom: 12,
  },
  largeAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#0052CC',
  },
  imageViewer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerClose: {
    position: 'absolute',
    right: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nameHeader: {
    alignItems: 'center',
  },
  fullName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  roleBadge: {
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleSubtext: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  callBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  callBtnText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 14,
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 16,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  passwordValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
