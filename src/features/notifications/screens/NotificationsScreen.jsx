import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
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
import InnerHeader from '../../../shared/components/InnerHeader';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const INITIAL_NOTIFICATIONS = [
    {
      id: 'stitch-action-verify',
      type: 'admin',
      isActionRequest: true,
      category: 'action_needed',
      title: 'Final Payment Awaiting Verification',
      customerName: 'Mr. & Mrs. Anita Raman',
      customerId: '2',
      amount: 29500,
      paymentMethod: 'Cash',
      voucher: '#VCH-89042',
      time: '10m ago',
      read: false,
      icon: 'alert',
      message: 'Final payment submitted by executive. Office team must verify payment & completion proof.',
    },
    {
      id: 'notif-2',
      type: 'specific',
      targetEmployee: 'Prem',
      title: 'Site Visit Scheduled',
      message: 'New site visit assigned in Anna Nagar at 11:30 AM.',
      time: '25m ago',
      read: false,
      icon: 'calendar',
    },
    {
      id: 'notif-3',
      type: 'admin',
      title: 'Terrace Season Protocol Update',
      message: 'Updated safety procedures for chemical membrane application in monsoons.',
      time: '2h ago',
      read: true,
      icon: 'megaphone',
    },
  ];

  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const clearAllNotifications = () => setNotifications([]);
  const activeEmployee = 'Prem';

  const [activeTab, setActiveTab] = useState('specific');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
    }, [isDark])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const myNotifications = notifications.filter(
    (n) => n.type === 'specific' && n.targetEmployee === activeEmployee
  );
  const adminNotifications = notifications.filter((n) => n.type === 'admin');

  const displayed = activeTab === 'specific' ? myNotifications : adminNotifications;
  const unreadSpecific = myNotifications.filter((n) => !n.read).length;
  const unreadAdmin = adminNotifications.filter((n) => !n.read).length;

  const iconColorMap = {
    calendar: '#0052CC',
    'checkmark-circle': '#10B981',
    warning: '#F59E0B',
    megaphone: '#8B5CF6',
    'information-circle': '#3B82F6',
    alert: '#EF4444',
  };

  const getIconBg = (iconName, isDarkMode) => {
    const colors = {
      calendar: isDarkMode ? '#1E3A6E' : '#DBEAFE',
      'checkmark-circle': isDarkMode ? '#065F46' : '#D1FAE5',
      warning: isDarkMode ? '#78350F' : '#FEF3C7',
      megaphone: isDarkMode ? '#4C1D95' : '#EDE9FE',
      'information-circle': isDarkMode ? '#1E3A6E' : '#DBEAFE',
      alert: isDarkMode ? '#7F1D1D' : '#FEE2E2',
    };
    return colors[iconName] || (isDarkMode ? '#1C1C1C' : '#F1F5F9');
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {/* Header */}
      <InnerHeader
        title="Notifications"
        paddingTop={insets.top}
        isDark={isDark}
        right={
          activeTab === 'specific' ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => clearAllNotifications(activeEmployee)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Tab Bar */}
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'specific' && styles.tabActive]}
          onPress={() => setActiveTab('specific')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              isDark && styles.tabTextDark,
              activeTab === 'specific' && styles.tabTextActive,
            ]}
          >
            My Notifications
          </Text>
          {unreadSpecific > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadSpecific}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'admin' && styles.tabActive]}
          onPress={() => setActiveTab('admin')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              isDark && styles.tabTextDark,
              activeTab === 'admin' && styles.tabTextActive,
            ]}
          >
            Admin Notices
          </Text>
          {unreadAdmin > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.tabBadgeText}>{unreadAdmin}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          displayed.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#F8FAFC' : '#0052CC'}
            colors={['#0052CC']}
          />
        }
      >
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, isDark && { backgroundColor: '#1C1C1C' }]}>
              <Ionicons
                name="notifications-off-outline"
                size={48}
                color={isDark ? '#475569' : '#CBD5E1'}
              />
            </View>
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
              No Notifications
            </Text>
            <Text style={[styles.emptySubtitle, isDark && styles.subtextDark]}>
              {activeTab === 'specific'
                ? "You're all caught up! No personal alerts right now."
                : 'No admin announcements at this time.'}
            </Text>
          </View>
        ) : (
          displayed.map((notif) => {
            if (notif.isActionRequest) {
              return (
                <View
                  key={notif.id}
                  style={{
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    padding: 14,
                    marginBottom: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase' }}>
                          Action Needed
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#64748B' : '#94A3B8' }}>• {notif.time}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }} numberOfLines={1}>
                        {notif.customerName} (DR{notif.customerId}) • <Text style={{ fontWeight: '700', color: '#047857' }}>₹{notif.amount.toLocaleString()}</Text>
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                      <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '700' }}>{notif.paymentMethod}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#F1F5F9' }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#21498B',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => router.push({ pathname: '/payment-verification', params: { id: notif.customerId, amount: notif.amount, voucher: notif.voucher } })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle" size={15} color="#34D399" />
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Review</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 16,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#334155' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isDark ? '#475569' : '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => router.push({ pathname: '/customer-detail', params: { id: notif.customerId, initialTab: 'payments' } })}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: isDark ? '#CBD5E1' : '#475569', fontSize: 12, fontWeight: '600' }}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={notif.id}
                style={[
                  styles.card,
                  isDark && styles.cardDark,
                  !notif.read && styles.cardUnread,
                  !notif.read && isDark && styles.cardUnreadDark,
                ]}
                onPress={() => router.push({ pathname: '/notification-detail', params: { id: notif.id } })}
                activeOpacity={0.8}
              >
              {!notif.read && <View style={styles.unreadDot} />}

              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: getIconBg(notif.icon, isDark) },
                ]}
              >
                <Ionicons
                  name={notif.icon}
                  size={22}
                  color={iconColorMap[notif.icon] || '#0052CC'}
                />
              </View>

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.cardTitle,
                      isDark && styles.textDark,
                      !notif.read && styles.cardTitleUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {notif.title}
                  </Text>
                  <Text style={[styles.cardTime, isDark && styles.subtextDark]}>
                    {notif.time}
                  </Text>
                </View>
                <Text
                  style={[styles.cardMessage, isDark && styles.subtextDark]}
                  numberOfLines={2}
                >
                  {notif.message}
                </Text>

                <View style={styles.tagRow}>
                  <View
                    style={[
                      styles.tag,
                      notif.type === 'admin'
                        ? { backgroundColor: isDark ? '#4C1D95' : '#EDE9FE' }
                        : { backgroundColor: isDark ? '#1E3A6E' : '#DBEAFE' },
                    ]}
                  >
                    <Ionicons
                      name={notif.type === 'admin' ? 'megaphone' : 'person'}
                      size={11}
                      color={notif.type === 'admin' ? '#8B5CF6' : '#0052CC'}
                    />
                    <Text
                      style={[
                        styles.tagText,
                        { color: notif.type === 'admin' ? '#8B5CF6' : '#0052CC' },
                      ]}
                    >
                      {notif.type === 'admin' ? 'Admin' : 'Personal'}
                    </Text>
                  </View>
                  {!notif.read && (
                    <Text style={styles.tapToRead}>Tap to mark as read</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerDark: { backgroundColor: '#080808' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  tabBarDark: { backgroundColor: '#1C1C1C' },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  tabTextDark: { color: '#94A3B8' },
  tabTextActive: { color: '#1E293B', fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#0052CC',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    gap: 10,
  },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },
  cardDark: { backgroundColor: '#1C1C1C', borderColor: '#334155' },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: '#0052CC' },
  cardUnreadDark: { borderLeftColor: '#60A5FA' },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0052CC',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  cardTitleUnread: { fontWeight: '700' },
  cardTime: { fontSize: 11, color: '#94A3B8', flexShrink: 0, marginTop: 2 },
  cardMessage: { fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  tapToRead: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  textDark: { color: '#F1F5F9' },
  subtextDark: { color: '#94A3B8' },
});
