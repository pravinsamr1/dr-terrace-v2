import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { authRepository, isAdminRole } from '../../auth/api/authRepository';
import { quotationRepository } from '../../quotations/api/quotationRepository';
import { notificationRepository } from '../api/notificationRepository';
import { subscribeToIncomingNotifications } from '../utils/pushNotifications';
import { getNotificationTarget, NOTIFICATION_TYPES } from '../utils/notificationMapper';

/** Helper to group notifications into Today, Yesterday, and Older */
function groupNotificationsByDate(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const groups = {
    today: [],
    yesterday: [],
    older: [],
  };

  items.forEach((item) => {
    const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    if (itemTime >= startOfToday) {
      groups.today.push(item);
    } else if (itemTime >= startOfYesterday) {
      groups.yesterday.push(item);
    } else {
      groups.older.push(item);
    }
  });

  return groups;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    const res = await notificationRepository.list({ limit: 50 });
    if (res.success) {
      // Only show unread notifications — opened ones disappear from the list.
      setNotifications((res.data || []).filter((n) => !n.read));
      setLoadError(null);
    } else {
      setLoadError(
        res.notAvailable
          ? 'Notifications are not available from the server yet.'
          : res.message || 'Could not load notifications.'
      );
    }
    setIsLoading(false);
  }, []);

  // Reload whenever the screen comes into view, and when a push arrives while the app is open
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );
  useEffect(() => subscribeToIncomingNotifications(() => loadNotifications()), [loadNotifications]);

  // Load user role to conditionally expose Admin notices
  useEffect(() => {
    authRepository.getUser().then((user) => {
      setIsAdmin(Boolean(user && (user.isAdmin === true || isAdminRole(user.role))));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  // Immediately removes a notification from the list and marks it read on the server.
  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationRepository.markRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications([]);
    await notificationRepository.markAllRead();
  };

  // Opens whatever the notification is about (an appointment, or a payment waiting for verification)
  const handleOpen = (notif) => {
    dismissNotification(notif.id);
    const target = getNotificationTarget({
      type: notif.rawType,
      appointmentId: notif.appointmentId,
      ...notif.data,
    });
    if (target.pathname === '/notifications') {
      router.push({ pathname: '/notification-detail', params: { id: notif.id } });
    } else {
      router.push(target);
    }
  };

  // "Details" on a payment notification: the backend only sends the quotation id, so look up its customer
  const handleOpenCustomer = async (notif) => {
    dismissNotification(notif.id);
    const res = await quotationRepository.getQuotationById(notif.quotationId);
    const quotation = res?.quotation;
    const appointmentId = quotation?.appointmentId ?? quotation?.appointment?.id;
    if (!appointmentId) {
      Alert.alert('Customer Not Found', 'Could not find the customer for this payment.');
      return;
    }
    router.push({ pathname: '/customer-detail', params: { id: String(appointmentId), initialTab: 'payments' } });
  };

  // Category filters
  const filterCategories = [
    { key: 'all', label: 'All', count: notifications.length },
    {
      key: 'payments',
      label: 'Payments',
      count: notifications.filter(
        (n) =>
          n.rawType === NOTIFICATION_TYPES.PAYMENT_PENDING ||
          n.rawType === NOTIFICATION_TYPES.PAYMENT_VERIFIED ||
          n.paymentId
      ).length,
    },
    {
      key: 'appointments',
      label: 'Appointments',
      count: notifications.filter(
        (n) =>
          n.rawType === NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED ||
          (n.appointmentId && !n.paymentId && !n.rawType?.includes('warranty'))
      ).length,
    },
    {
      key: 'warranty',
      label: 'Warranty',
      count: notifications.filter(
        (n) =>
          n.rawType === NOTIFICATION_TYPES.WARRANTY_GENERATED ||
          n.rawType === NOTIFICATION_TYPES.WARRANTY_VERIFIED ||
          n.rawType?.includes('warranty')
      ).length,
    },
    ...(isAdmin
      ? [
          {
            key: 'admin',
            label: 'Admin Notices',
            count: notifications.filter((n) => n.type === 'admin' || n.isActionRequest).length,
          },
        ]
      : []),
  ];

  // Apply active category filter
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'payments') {
      return (
        n.rawType === NOTIFICATION_TYPES.PAYMENT_PENDING ||
        n.rawType === NOTIFICATION_TYPES.PAYMENT_VERIFIED ||
        n.paymentId
      );
    }
    if (activeFilter === 'appointments') {
      return (
        n.rawType === NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED ||
        (n.appointmentId && !n.paymentId && !n.rawType?.includes('warranty'))
      );
    }
    if (activeFilter === 'warranty') {
      return (
        n.rawType === NOTIFICATION_TYPES.WARRANTY_GENERATED ||
        n.rawType === NOTIFICATION_TYPES.WARRANTY_VERIFIED ||
        n.rawType?.includes('warranty')
      );
    }
    if (activeFilter === 'admin') {
      return n.type === 'admin' || n.isActionRequest;
    }
    return true;
  });

  const dateGroups = groupNotificationsByDate(filteredNotifications);
  const sections = [
    { title: 'TODAY', data: dateGroups.today },
    { title: 'YESTERDAY', data: dateGroups.yesterday },
    { title: 'OLDER', data: dateGroups.older },
  ].filter((s) => s.data.length > 0);

  // Styling helper for card icon squircle badge based on notification type
  const getBadgeStyle = (notif) => {
    if (notif.rawType === NOTIFICATION_TYPES.PAYMENT_VERIFIED) {
      return {
        bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5',
        iconColor: '#059669',
        iconName: 'checkmark-circle',
      };
    }
    if (notif.isActionRequest || notif.rawType === NOTIFICATION_TYPES.PAYMENT_PENDING) {
      return {
        bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
        iconColor: '#DC2626',
        iconName: 'alert-circle',
      };
    }
    if (notif.rawType === NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED) {
      return {
        bg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#DBEAFE',
        iconColor: '#2563EB',
        iconName: 'calendar',
      };
    }
    if (
      notif.rawType === NOTIFICATION_TYPES.WARRANTY_GENERATED ||
      notif.rawType === NOTIFICATION_TYPES.WARRANTY_VERIFIED
    ) {
      return {
        bg: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE',
        iconColor: '#7C3AED',
        iconName: 'shield-checkmark',
      };
    }
    return {
      bg: isDark ? '#334155' : '#F1F5F9',
      iconColor: isDark ? '#94A3B8' : '#64748B',
      iconName: 'information-circle',
    };
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* BEGIN: Top Header with Brand Theme */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        {/* Navigation & Title Row */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.titleWithBadge}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </View>
          </View>

          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllRead}
              activeOpacity={0.75}
            >
              <Ionicons name="checkmark-done" size={14} color="#BFDBFE" style={{ marginRight: 4 }} />
              <Text style={styles.markAllButtonText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Categories Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScrollView}
        >
          {filterCategories.map((cat) => {
            const isActive = activeFilter === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                onPress={() => setActiveFilter(cat.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive ? styles.filterPillTextActive : styles.filterPillTextInactive,
                  ]}
                >
                  {cat.label}
                </Text>
                {cat.count > 0 && (
                  <View
                    style={[
                      styles.pillBadge,
                      isActive ? styles.pillBadgeActive : styles.pillBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        isActive ? styles.pillBadgeTextActive : styles.pillBadgeTextInactive,
                      ]}
                    >
                      {cat.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {/* END: Top Header */}

      {/* BEGIN: Feed */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollFeed,
          filteredNotifications.length === 0 && styles.scrollFeedEmpty,
          { paddingBottom: insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#F8FAFC' : '#0047B3'}
            colors={['#0047B3']}
          />
        }
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={isDark ? '#F8FAFC' : '#0047B3'} />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, isDark && styles.emptyIconCircleDark]}>
              <Ionicons
                name="checkmark"
                size={36}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
            </View>
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
              {loadError ? 'Could not load notifications' : "You're all caught up!"}
            </Text>
            <Text style={[styles.emptySubtitle, isDark && styles.subtextDark]}>
              {loadError
                ? `${loadError} Pull down to retry.`
                : activeFilter === 'all'
                ? 'No notifications right now.'
                : `No ${activeFilter} notifications right now.`}
            </Text>
          </View>
        ) : (
          <>
            {sections.map((section) => (
              <View key={section.title} style={styles.sectionWrap}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionCount}>{section.data.length} new</Text>
                </View>

                {/* Section Cards */}
                <View style={styles.cardsContainer}>
                  {section.data.map((notif) => {
                    const badge = getBadgeStyle(notif);

                    // Pending Verification Card (Action Request)
                    if (notif.isActionRequest) {
                      return (
                        <View
                          key={notif.id}
                          style={[styles.card, isDark && styles.cardDark]}
                        >
                          <View style={styles.cardMainRow}>
                            {/* Left Squircle Icon */}
                            <View style={[styles.iconSquircle, { backgroundColor: badge.bg }]}>
                              <Ionicons name={badge.iconName} size={24} color={badge.iconColor} />
                            </View>

                            {/* Main Info */}
                            <View style={styles.cardInfoCol}>
                              <View style={styles.cardTitleRow}>
                                <Text
                                  style={[styles.cardTitle, isDark && styles.textDark]}
                                  numberOfLines={1}
                                >
                                  {notif.title}
                                </Text>
                                <View style={styles.timeWithDot}>
                                  <Text style={styles.timeText}>{notif.time}</Text>
                                  <View style={styles.pulseDot} />
                                </View>
                              </View>

                              <Text
                                style={[styles.cardBodyText, isDark && styles.subtextDark]}
                                numberOfLines={2}
                              >
                                {notif.message}
                              </Text>

                              {/* Tags & Action Buttons */}
                              <View style={styles.cardFooterRow}>
                                {notif.quotationId ? (
                                  <View style={styles.actionTagBadge}>
                                    <Text style={styles.actionTagText}>
                                      Quote #{notif.quotationId}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.tagBadge}>
                                    <Text style={styles.tagBadgeText}>Action Needed</Text>
                                  </View>
                                )}

                                <View style={styles.actionButtonsGroup}>
                                  <TouchableOpacity
                                    style={styles.reviewBtn}
                                    onPress={() => handleOpen(notif)}
                                    activeOpacity={0.85}
                                  >
                                    <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                                    <Text style={styles.reviewBtnText}>Review</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[styles.detailsBtn, isDark && styles.detailsBtnDark]}
                                    onPress={() => handleOpenCustomer(notif)}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={[styles.detailsBtnText, isDark && styles.subtextDark]}>
                                      Details
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    }

                    // Standard Notification Card (Verified payment, appointment, warranty, etc.)
                    return (
                      <TouchableOpacity
                        key={notif.id}
                        style={[styles.card, isDark && styles.cardDark]}
                        onPress={() => handleOpen(notif)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.cardMainRow}>
                          {/* Left Squircle Icon */}
                          <View style={[styles.iconSquircle, { backgroundColor: badge.bg }]}>
                            <Ionicons name={badge.iconName} size={24} color={badge.iconColor} />
                          </View>

                          {/* Main Info */}
                          <View style={styles.cardInfoCol}>
                            <View style={styles.cardTitleRow}>
                              <Text
                                style={[styles.cardTitle, isDark && styles.textDark]}
                                numberOfLines={1}
                              >
                                {notif.title}
                              </Text>
                              <View style={styles.timeWithDot}>
                                <Text style={styles.timeText}>{notif.time}</Text>
                                <View style={styles.pulseDot} />
                              </View>
                            </View>

                            <Text
                              style={[styles.cardBodyText, isDark && styles.subtextDark]}
                              numberOfLines={2}
                            >
                              {notif.message}
                            </Text>

                            {/* Tags & Action Link */}
                            <View style={styles.cardFooterRow}>
                              <View style={styles.tagBadge}>
                                <Ionicons
                                  name={notif.type === 'admin' ? 'shield-outline' : 'person-outline'}
                                  size={11}
                                  color="#0052CC"
                                  style={{ marginRight: 3 }}
                                />
                                <Text style={styles.tagBadgeText}>
                                  {notif.type === 'admin' ? 'Admin' : 'Personal'}
                                </Text>
                              </View>

                              <View style={styles.cardActionLink}>
                                <Text style={styles.cardActionLinkText}>
                                  {notif.rawType === NOTIFICATION_TYPES.PAYMENT_VERIFIED
                                    ? 'View receipt'
                                    : notif.rawType === NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED
                                    ? 'View customer'
                                    : notif.rawType?.includes('warranty')
                                    ? 'View warranty'
                                    : 'View details'}
                                </Text>
                                <Ionicons name="chevron-forward" size={13} color="#0052CC" />
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* All Caught Up Indicator */}
            <View style={styles.caughtUpContainer}>
              <View style={[styles.caughtUpIconWrap, isDark && styles.caughtUpIconWrapDark]}>
                <Ionicons name="checkmark" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
              </View>
              <Text style={[styles.caughtUpTitle, isDark && styles.textDark]}>
                {"You're all caught up!"}
              </Text>
              <Text style={[styles.caughtUpSubtitle, isDark && styles.subtextDark]}>
                No older notifications to show.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      {/* END: Feed */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },

  /* Brand Blue Header */
  headerContainer: {
    backgroundColor: '#0047B3',
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.3)',
  },
  countBadgeText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  markAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Filter Categories Horizontal Bar */
  filterScrollView: {
    marginHorizontal: -4,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#003A94',
    fontWeight: '700',
  },
  filterPillTextInactive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBadgeActive: {
    backgroundColor: '#EFF6FF',
  },
  pillBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pillBadgeTextActive: {
    color: '#0047B3',
  },
  pillBadgeTextInactive: {
    color: '#FFFFFF',
  },

  /* Feed Layout */
  scrollFeed: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  scrollFeedEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Section Header */
  sectionWrap: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    color: '#0047B3',
    fontWeight: '600',
  },
  cardsContainer: {
    gap: 12,
  },

  /* Stitch Card Design */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  timeWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0052CC',
  },
  cardBodyText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 3,
    marginBottom: 8,
  },

  /* Card Footer Row */
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 2,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0052CC',
  },
  actionTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  cardActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardActionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0052CC',
  },

  /* Action Buttons Group for Pending Payment Verification */
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0047B3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reviewBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  detailsBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Caught Up Footer Indicator */
  caughtUpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  caughtUpIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  caughtUpIconWrapDark: {
    backgroundColor: '#334155',
  },
  caughtUpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  caughtUpSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconCircleDark: {
    backgroundColor: '#1E293B',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },

  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
