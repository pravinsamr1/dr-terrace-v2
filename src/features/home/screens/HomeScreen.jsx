import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository } from '../../../features/appointments/api/appointmentRepository';
import { authRepository } from '../../../features/auth/api/authRepository';
import { employeeRepository } from '../../../features/employees/api/employeeRepository';
import { MaterialAlertModal } from '../../../shared/components/material';
import { notificationRepository } from '../../notifications/api/notificationRepository';
import { subscribeToIncomingNotifications } from '../../notifications/utils/pushNotifications';
import { MONTH_NAMES } from '../../../shared/constants/fallbackDefaults';
import HomeReportsCard from '../../reports/components/HomeReportsCard';
import {
  AccountGroupIcon3D,
  CalendarPlusIcon3D,
  ClipboardListIcon3D,
  FileSendIcon3D,
  ShieldCheckIcon3D,
  WalletIcon3D,
} from '../components/QuickActionIcons';


const QUICK_ACTIONS = [
  { label: 'New\nAppointment', Icon: CalendarPlusIcon3D, route: '/new-appointment' },
  { label: 'View All\nAppointment', Icon: ClipboardListIcon3D, route: '/all-appointments' },
  { label: 'Our\nClients', Icon: AccountGroupIcon3D, route: '/clients' },
  { label: 'Send\nQuote', Icon: FileSendIcon3D, route: '/send-quote' },
  { label: 'Outstanding\nPayments', Icon: WalletIcon3D, route: { pathname: '/collections', params: { tab: 'payments' } } },
  // Only admins verify payments
  {
    label: 'Pending\nVerification',
    Icon: ShieldCheckIcon3D,
    route: { pathname: '/notifications', params: { filter: 'verification' } },
    adminOnly: true,
  },
];

const getAppointmentDateBadge = (app) => {
  let month = app.month || app.displayMonth;
  let day = app.day || app.displayDay;

  if (!month || !day) {
    const rawDate = app.appointmentDate || app.appointment_date || app.date || app.fixDate || '';
    if (rawDate) {
      const parts = String(rawDate).trim().split(/[-/]/);
      if (parts.length === 3) {
        let d, m;
        if (parts[0].length === 4) {
          m = parseInt(parts[1], 10) - 1;
          d = parseInt(parts[2], 10);
        } else {
          d = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10) - 1;
        }
        if (!isNaN(m) && m >= 0 && m < 12) {
          if (!month) month = MONTH_NAMES[m];
          if (!day) day = String(d).padStart(2, '0');
        }
      }
    }
  }

  return { month: month || '--', day: day || '--' };
};

const parseAppDate = (app) => {
  let month = app.month || app.displayMonth;
  let day = app.day || app.displayDay;
  let year = app.year || new Date().getFullYear();

  const rawDate = app.appointmentDate || app.appointment_date || app.date || app.fixDate || '';
  if (rawDate) {
    const parts = String(rawDate).trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
    }
  } else if (typeof month === 'string') {
    const mIndex = MONTH_NAMES.indexOf(month.toUpperCase().substring(0, 3));
    if (mIndex !== -1) month = mIndex;
    else month = new Date().getMonth();
  }

  if (isNaN(year)) year = new Date().getFullYear();
  if (isNaN(month)) month = new Date().getMonth();
  if (isNaN(day)) day = new Date().getDate();

  return new Date(year, month, day);
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [missedAppointments, setMissedAppointments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState('');
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Upcoming');

  const loadData = useCallback(async () => {
    try {
      const user = await authRepository.getUser();
      if (user) {
        setCurrentUser(user);
        if (!activeEmployee) {
          setActiveEmployee(user.name || user.username || '');
        }
      }

      const homeViewParams = {};
      const isFieldEmp =
        user?.employeeType === 'FieldEmployee' ||
        user?.role === 'field-employee' ||
        user?.role === 'employee';
      if (isFieldEmp && (user?.id || user?.employeeId)) {
        homeViewParams.employeeId = user.id || user.employeeId;
      }

      const [homeRes, empRes] = await Promise.all([
        appointmentRepository.getHomeView(homeViewParams),
        employeeRepository.getEmployees(),
      ]);

      if (homeRes?.success) {
        setUpcomingAppointments(Array.isArray(homeRes.upcoming) ? homeRes.upcoming : []);
        setMissedAppointments(Array.isArray(homeRes.missed) ? homeRes.missed : []);
      } else {
        // Fallback: If /home-view is unavailable, fetch general appointments and organize
        const fallbackRes = await appointmentRepository.getAppointments(1, 20);
        if (fallbackRes?.success && Array.isArray(fallbackRes.appointments)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const up = [];
          const mis = [];

          fallbackRes.appointments.forEach((app) => {
            const appDate = parseAppDate(app);
            appDate.setHours(0, 0, 0, 0);
            if (appDate.getTime() >= today.getTime()) {
              up.push(app);
            } else if (app.status !== 'Completed') {
              mis.push(app);
            }
          });

          setUpcomingAppointments(up.slice(0, 5));
          setMissedAppointments(mis.slice(0, 5));
        }
      }

      if (empRes?.success && Array.isArray(empRes.data)) {
        setEmployees(empRes.data);
      }
    } catch (err) {
      console.warn('[HomeScreen] Error loading data:', err);
    }
  }, [activeEmployee]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  // Unread notifications for the bell badge: refreshed on focus and when a push arrives while the app is open
  const [unreadCount, setUnreadCount] = useState(0);
  const loadUnreadCount = useCallback(async () => {
    setUnreadCount(await notificationRepository.getUnreadCount());
  }, []);
  useFocusEffect(useCallback(() => {
    loadUnreadCount();
  }, [loadUnreadCount]));
  useEffect(() => subscribeToIncomingNotifications(() => loadUnreadCount()), [loadUnreadCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const isDark = colorScheme === 'dark';
  const userRole = currentUser?.role || 'master';
  const isAdmin = userRole === 'ADMIN' || userRole === 'admin' || userRole === 'master';
  const employeeFirstName = currentUser?.name?.trim().split(/\s+/)[0] || currentUser?.username || 'there';

  // Re-apply correct StatusBar style every time Home comes into focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    }, [isDark])
  );

  const activeAppointments = activeTab === 'Upcoming' ? upcomingAppointments : missedAppointments;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {/* Scroll View for Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0052CC']}
            tintColor={isDark ? '#F8FAFC' : '#0052CC'}
            progressViewOffset={Math.max(insets.top + 10, 50)}
          />
        }
        style={Platform.OS === 'ios' ? { paddingTop: insets.top } : null}
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Platform.OS === 'ios' ? 10 : Math.max(insets.top + 10, 50),
            paddingBottom: 110,
          },
        ]}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            {/* Logo Wrapper */}
            <View
              style={[styles.logoContainer, isDark && styles.logoContainerDark]}
            >
              <Image
                source={require('../../../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            {/* Greeting */}
            <View
              style={styles.greetingContainer}
            >
              <Text
                style={[styles.greetingTitle, isDark && styles.textDark]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Hi, {employeeFirstName}
              </Text>
              <Text
                style={[styles.greetingSubtitle, isDark && styles.subtextDark]}
                numberOfLines={1}
              >
                Welcome Back to Nexa CRM
              </Text>
            </View>
          </View>

          {/* Header Action Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF' }]}
              activeOpacity={0.7}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={isDark ? '#F1F5F9' : '#1E293B'}
              />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Today's Appointments */}
        <View style={[styles.cardContainer, isDark && styles.cardContainerDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calendar-outline" size={20} color={isDark ? '#60A5FA' : '#0052CC'} style={{ marginRight: 6 }} />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Appointments</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/all-appointments')}
              activeOpacity={0.7}
              style={styles.viewAllHeaderBtn}
            >
              <Text style={[styles.viewAllHeaderText, isDark && styles.viewAllHeaderTextDark]}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? '#60A5FA' : '#0052CC'} />
            </TouchableOpacity>
          </View>

          <View style={[styles.tabsContainer, isDark && styles.tabsContainerDark]}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'Upcoming' && styles.activeTabButton,
                activeTab === 'Upcoming' && isDark && styles.activeTabButtonDark,
              ]}
              onPress={() => setActiveTab('Upcoming')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'Upcoming' && styles.activeTabText,
                  activeTab === 'Upcoming' && isDark && styles.activeTabTextDark,
                ]}
              >
                Upcoming
              </Text>
              <View
                style={[
                  styles.countBadge,
                  activeTab === 'Upcoming'
                    ? (isDark ? styles.countBadgeBlueDark : styles.countBadgeBlue)
                    : (isDark ? styles.countBadgeInactiveDark : styles.countBadgeInactive),
                ]}
              >
                <Text style={styles.countText}>{upcomingAppointments.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'Missed' && styles.activeTabButton,
                activeTab === 'Missed' && isDark && styles.activeTabButtonDark,
              ]}
              onPress={() => setActiveTab('Missed')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'Missed' && styles.activeTabText,
                  activeTab === 'Missed' && isDark && styles.activeTabTextDark,
                ]}
              >
                Missed
              </Text>
              <View
                style={[
                  styles.countBadge,
                  missedAppointments.length > 0
                    ? styles.countBadgeRed
                    : (isDark ? styles.countBadgeInactiveDark : styles.countBadgeInactive),
                ]}
              >
                <Text style={styles.countText}>{missedAppointments.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {activeAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'Upcoming' ? 'calendar-clear-outline' : 'checkmark-done-circle-outline'}
                size={42}
                color={activeTab === 'Missed' ? '#10B981' : (isDark ? '#475569' : '#CBD5E1')}
                style={{ marginBottom: 8 }}
              />
              <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
                {activeTab === 'Upcoming' ? 'No Upcoming Appointments' : 'No Missed Appointments'}
              </Text>
              <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
                {activeTab === 'Upcoming'
                  ? 'There are no pending appointments scheduled for today.'
                  : 'All appointments from previous days have been attended.'}
              </Text>
            </View>
          ) : (
            activeAppointments.map((app, index) => {
              const { month: displayMonth, day: displayDay } = getAppointmentDateBadge(app);
              const clientName = app.clientName || app.customerName || app.name || 'Client';
              const locationText =
                app.location ||
                (typeof app.address === 'string' ? app.address : '') ||
                (app.address && typeof app.address === 'object'
                  ? [app.address.area, app.address.city].filter(Boolean).join(', ')
                  : '') ||
                'Location N/A';
              const timeText = app.appointmentTime || app.time || 'Time N/A';
              const assignedEmployeeName = app.employeeName || app.assignedTo || 'Unassigned';
              const tagText = app.propertyName || app.serviceType || '';
              const isMissed = activeTab === 'Missed';

              return (
                <View key={app.id || index}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/customer-detail', params: { id: app.id } })}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.appointmentItem, isDark && styles.appointmentItemDark]}>
                      {/* Date Block */}
                      <View
                        style={[
                          styles.dateBlock,
                          isMissed
                            ? (isDark ? styles.dateBlockMissedDark : styles.dateBlockMissed)
                            : (app.status === 'Completed' ? styles.dateBlockGreen : styles.dateBlockBlue),
                          !isMissed && (app.status === 'Completed' ? isDark && styles.dateBlockGreenDark : isDark && styles.dateBlockBlueDark),
                        ]}
                      >
                        <Text
                          style={[
                            isMissed
                              ? (isDark ? styles.dateMonthMissedDark : styles.dateMonthMissed)
                              : (app.status === 'Completed' ? styles.dateMonthGreen : styles.dateMonthBlue),
                            !isMissed && (app.status === 'Completed' ? isDark && styles.dateMonthGreenDark : isDark && styles.dateMonthBlueDark),
                          ]}
                        >
                          {displayMonth}
                        </Text>
                        <Text
                          style={[
                            isMissed
                              ? (isDark ? styles.dateDayMissedDark : styles.dateDayMissed)
                              : (app.status === 'Completed' ? styles.dateDayGreen : styles.dateDayBlue),
                            !isMissed && (app.status === 'Completed' ? isDark && styles.dateDayGreenDark : isDark && styles.dateDayBlueDark),
                          ]}
                        >
                          {displayDay}
                        </Text>
                      </View>

                      <View style={styles.appointmentDetails}>
                        <Text style={[styles.clientName, isDark && styles.textDark]}>{clientName}</Text>

                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={styles.detailIcon} />
                          <Text style={[styles.detailText, isDark && styles.subtextDark]} numberOfLines={1}>{locationText}</Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Ionicons name="time-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={styles.detailIcon} />
                          <Text style={[styles.detailText, isDark && styles.subtextDark]}>{timeText}</Text>
                        </View>

                        {!!tagText && (
                          <View style={[styles.propertyTag, isDark && styles.propertyTagDark]}>
                            <Text style={[styles.propertyTagText, isDark && styles.propertyTagTextDark]} numberOfLines={1}>
                              {tagText}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.appointmentActions}>
                        <View
                          style={[
                            styles.statusBadge,
                            isMissed
                              ? (isDark ? styles.statusBadgeMissedDark : styles.statusBadgeMissed)
                              : (app.status === 'Completed' ? styles.statusBadgeGreen : styles.statusBadgeBlue),
                            !isMissed && (app.status === 'Completed' ? isDark && styles.statusBadgeGreenDark : isDark && styles.statusBadgeBlueDark),
                          ]}
                        >
                          <Text
                            style={[
                              isMissed
                                ? (isDark ? styles.statusTextMissedDark : styles.statusTextMissed)
                                : (app.status === 'Completed' ? styles.statusTextGreen : styles.statusTextBlue),
                              !isMissed && (app.status === 'Completed' ? isDark && styles.statusTextGreenDark : isDark && styles.statusTextBlueDark),
                            ]}
                          >
                            {assignedEmployeeName}
                          </Text>
                        </View>
                        {isAdmin && (
                        <TouchableOpacity
                          style={styles.reassignButton}
                          onPress={() => router.push({ pathname: '/reassign', params: { id: app.id } })}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.reassignText}>Reassign</Text>
                        </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  {index < activeAppointments.length - 1 && (
                    <View style={[styles.itemDivider, isDark && styles.itemDividerDark]} />
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Section: Quick Actions */}
        <Text style={[styles.sectionHeading, isDark && styles.textDark]}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.filter((action) => !action.adminOnly || isAdmin).map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickItem}
              onPress={() => router.push(action.route)}
              activeOpacity={0.8}
            >
              <View style={styles.quickCard}>
                <View style={styles.quickIconBox}>
                  <action.Icon size={54} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <HomeReportsCard />

        {isAdmin && (
        <>
        {/* Section: Employee's Management */}
        <Text style={[styles.sectionHeading, isDark && styles.textDark]}>{"Employee's Management"}</Text>
        <View style={[styles.employeeManagementContainer, isDark && styles.employeeManagementContainerDark]}>
          {/* Item 1: Add Employee */}
          <TouchableOpacity style={styles.employeeRow} onPress={() => router.push('/employee-add')} activeOpacity={0.7}>
            <View style={styles.employeeLeft}>
              <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#1C1C1C' : '#EBF4FE' }]}>
                <Ionicons name="person-add" size={20} color={isDark ? '#60A5FA' : '#0052CC'} />
              </View>
              <Text style={[styles.employeeLabel, isDark && styles.textDark]}>Add Employee</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

          {/* Item 2: Employee List */}
          <TouchableOpacity style={styles.employeeRow} onPress={() => router.push('/employee-list')} activeOpacity={0.7}>
            <View style={styles.employeeLeft}>
              <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#1C1C1C' : '#EBF4FE' }]}>
                <Ionicons name="people" size={20} color={isDark ? '#60A5FA' : '#0052CC'} />
              </View>
              <Text style={[styles.employeeLabel, isDark && styles.textDark]}>Employee List</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
          </TouchableOpacity>

          {/* Phase 2: Attendance & Leave, Salary Details, and Salary Advance (kept in code, hidden from view for now) */}
          {false && (
            <>
              {/* Item 3: Attendance & Leave Management (Site Selfie + GPS) */}
              <TouchableOpacity style={styles.employeeRow} onPress={() => router.push('/attendance-leave')} activeOpacity={0.7}>
                <View style={styles.employeeLeft}>
                  <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#1E293B' : '#F0F9FF' }]}>
                    <Ionicons name="calendar-outline" size={20} color={isDark ? '#38BDF8' : '#0284C7'} />
                  </View>
                  <Text style={[styles.employeeLabel, isDark && styles.textDark]}>Attendance & Leave Management</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

              {/* Item 4: Salary Details & Pay Slips */}
              <TouchableOpacity style={styles.employeeRow} onPress={() => router.push('/salary-details')} activeOpacity={0.7}>
                <View style={styles.employeeLeft}>
                  <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#1E293B' : '#F0FDF4' }]}>
                    <Ionicons name="cash-outline" size={20} color={isDark ? '#4ADE80' : '#16A34A'} />
                  </View>
                  <Text style={[styles.employeeLabel, isDark && styles.textDark]}>Salary Details & Slips</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

              {/* Item 5: Salary Advance Details */}
              <TouchableOpacity style={styles.employeeRow} onPress={() => router.push('/salary-advance')} activeOpacity={0.7}>
                <View style={styles.employeeLeft}>
                  <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#1E293B' : '#FFFBEB' }]}>
                    <Ionicons name="wallet-outline" size={20} color={isDark ? '#FBBF24' : '#D97706'} />
                  </View>
                  <Text style={[styles.employeeLabel, isDark && styles.textDark]}>Salary Advance Requests</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
              </TouchableOpacity>
            </>
          )}

          {isAdmin && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

              {/* Item 6: Send Google Review Link */}
              <TouchableOpacity
                style={styles.employeeRow}
                activeOpacity={0.75}
                onPress={() => setReviewModalVisible(true)}
              >
                <View style={styles.employeeLeft}>
                  <View style={[styles.employeeIconWrapper, { backgroundColor: isDark ? '#064E3B' : '#E8F5E9' }]}>
                    <Ionicons name="logo-google" size={20} color={isDark ? '#34D399' : '#2E7D32'} />
                  </View>
                  <Text style={[styles.employeeLabel, { color: isDark ? '#34D399' : '#2E7D32' }]}>
                    Send Google Review Link
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#34D399' : '#2E7D32'} />
              </TouchableOpacity>
            </>
          )}
        </View>
        </>
        )}
      </ScrollView>

      {/* Employee List Selector Modal (Frosted Backdrop + Card style) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={employeeModalVisible}
        onRequestClose={() => setEmployeeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEmployeeModalVisible(false)}
        >
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>Switch Active Employee</Text>
              <TouchableOpacity onPress={() => setEmployeeModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalDivider} />

            {employees.map((emp) => {
              const isActive = emp.name === activeEmployee;
              return (
                <TouchableOpacity
                  key={emp.id || emp.name}
                  style={[
                    styles.modalItem,
                    isActive && styles.modalItemSelected,
                    isActive && isDark && styles.modalItemSelectedDark
                  ]}
                  onPress={() => {
                    setActiveEmployee(emp.name);
                    setEmployeeModalVisible(false);
                  }}
                >
                  <View style={styles.dropdownItemLeft}>
                    <Ionicons
                      name="person-circle"
                      size={24}
                      color={isActive ? '#1E64B4' : (isDark ? '#94A3B8' : '#64748B')}
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      style={[
                        styles.modalItemText,
                        isDark && styles.textDark,
                        isActive && styles.modalItemTextActive,
                        isActive && isDark && styles.modalItemTextActiveDark
                      ]}
                    >
                      {emp.name}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color="#1E64B4" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <MaterialAlertModal
        visible={reviewModalVisible}
        type="info"
        title="Stay Tuned!"
        message="Google review automation and link sharing will be updated soon."
        buttonText="Got It"
        onClose={() => setReviewModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#090D16',
  },
  scrollContainer: {
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  logoContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoContainerDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  greetingContainer: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  greetingTitle: {
    fontSize: 18,
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: Platform.OS === 'android' ? 'normal' : '500',
    includeFontPadding: false,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  notificationBadge: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContainerDark: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    color: '#0F172A',
    marginLeft: 4,
    includeFontPadding: false,
  },
  sectionTitleDark: {
    color: '#F8FAFC',
  },
  viewAllHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  viewAllHeaderText: {
    fontSize: 13,
    color: '#2563EB',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    marginRight: 2,
    includeFontPadding: false,
  },
  viewAllHeaderTextDark: {
    color: '#60A5FA',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tabsContainerDark: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  activeTabButtonDark: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  activeTabText: {
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  activeTabTextDark: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  countBadgeBlue: {
    backgroundColor: '#0052CC',
  },
  countBadgeBlueDark: {
    backgroundColor: '#3B82F6',
  },
  countBadgeRed: {
    backgroundColor: '#EF4444',
  },
  countBadgeInactive: {
    backgroundColor: '#94A3B8',
  },
  countBadgeInactiveDark: {
    backgroundColor: '#475569',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  emptyContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    includeFontPadding: false,
  },
  appointmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  appointmentItemDark: {
    backgroundColor: '#161F33',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateBlock: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBlockBlue: {
    backgroundColor: '#EBF4FE',
  },
  dateBlockBlueDark: {
    backgroundColor: 'rgba(0, 82, 204, 0.22)',
    borderWidth: 1.5,
    borderColor: '#0052CC',
  },
  dateBlockGreen: {
    backgroundColor: '#DCFCE7',
  },
  dateBlockGreenDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  dateBlockMissed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dateBlockMissedDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  dateMonthBlue: {
    fontSize: 11,
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  dateMonthBlueDark: {
    color: '#93C5FD',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayBlue: {
    fontSize: 20,
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayBlueDark: {
    color: '#60A5FA',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateMonthGreen: {
    fontSize: 11,
    color: '#15803D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  dateMonthGreenDark: {
    color: '#6EE7B7',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayGreen: {
    fontSize: 20,
    color: '#15803D',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayGreenDark: {
    color: '#34D399',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateMonthMissed: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  dateMonthMissedDark: {
    color: '#F87171',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayMissed: {
    fontSize: 20,
    color: '#DC2626',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  dateDayMissedDark: {
    color: '#FCA5A5',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  appointmentDetails: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 6,
  },
  clientName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    color: '#1E293B',
    marginBottom: 4,
    includeFontPadding: false,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_400Regular',
    includeFontPadding: false,
  },
  propertyTag: {
    marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  propertyTagDark: {
    backgroundColor: '#1E293B',
  },
  propertyTagText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    includeFontPadding: false,
  },
  propertyTagTextDark: {
    color: '#94A3B8',
  },
  appointmentActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeBlue: {
    backgroundColor: '#EBF4FE',
    borderWidth: 1,
    borderColor: '#B9D7FB',
  },
  statusBadgeBlueDark: {
    backgroundColor: 'rgba(0, 82, 204, 0.25)',
    borderColor: '#0052CC',
    borderWidth: 1,
  },
  statusBadgeGreen: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeGreenDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  statusBadgeMissed: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  statusBadgeMissedDark: {
    backgroundColor: 'rgba(234, 88, 12, 0.22)',
    borderColor: '#EA580C',
    borderWidth: 1,
  },
  statusTextBlue: {
    fontSize: 11,
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  statusTextBlueDark: {
    color: '#93C5FD',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  statusTextGreen: {
    fontSize: 11,
    color: '#047857',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  statusTextGreenDark: {
    color: '#6EE7B7',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  statusTextMissed: {
    fontSize: 11,
    color: '#C2410C',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  statusTextMissedDark: {
    color: '#FB923C',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  reassignButton: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  reassignText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  viewDetailsButton: {
    backgroundColor: '#0052CC',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#0052CC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  viewDetailsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  itemDividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    color: '#0F172A',
    marginBottom: 16,
    marginTop: 8,
    includeFontPadding: false,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    marginHorizontal: -5,
    marginBottom: 24,
  },
  quickItem: {
    width: '33.33%',
    paddingHorizontal: 5,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  quickIconBox: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  cardIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNativeSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 9,
    marginTop: 2,
    lineHeight: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    includeFontPadding: false,
  },
  employeeManagementContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  employeeManagementContainerDark: {
    backgroundColor: 'transparent',
  },
  employeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  employeeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  employeeLabel: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    color: '#1E293B',
    includeFontPadding: false,
  },
  rowDivider: {
    height: 1,
  },
  googleReviewRow: {},

  // Custom Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
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
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    color: '#0F172A',
    includeFontPadding: false,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalItemSelected: {
    backgroundColor: '#E0F2FE',
  },
  modalItemSelectedDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.15)',
  },
  modalItemText: {
    fontSize: 15,
    color: '#333333',
    fontFamily: 'PlusJakartaSans_400Regular',
    includeFontPadding: false,
  },
  modalItemTextActive: {
    color: '#1E64B4',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  modalItemTextActiveDark: {
    color: '#60A5FA',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
});
