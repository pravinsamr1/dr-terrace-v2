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
  const [notifications, setNotifications] = useState([]);
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
          displayed.map((notif) => (
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
          ))
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
