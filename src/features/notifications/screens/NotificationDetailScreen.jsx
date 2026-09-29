import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';

const ICON_COLOR_MAP = {
  calendar: '#0052CC',
  'checkmark-circle': '#10B981',
  warning: '#F59E0B',
  megaphone: '#8B5CF6',
  'information-circle': '#3B82F6',
  alert: '#EF4444',
};

const getIconBg = (iconName, isDark) => {
  const colors = {
    calendar: isDark ? '#1E3A6E' : '#DBEAFE',
    'checkmark-circle': isDark ? '#065F46' : '#D1FAE5',
    warning: isDark ? '#78350F' : '#FEF3C7',
    megaphone: isDark ? '#4C1D95' : '#EDE9FE',
    'information-circle': isDark ? '#1E3A6E' : '#DBEAFE',
    alert: isDark ? '#7F1D1D' : '#FEE2E2',
  };
  return colors[iconName] || (isDark ? '#1C1C1C' : '#F1F5F9');
};

export default function NotificationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const notif = null;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
    }, [isDark])
  );

  if (!notif) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, { paddingTop: Math.max(insets.top + 10, 50) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#F1F5F9' : '#1E293B'} />
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={isDark ? '#475569' : '#CBD5E1'} />
          <Text style={[styles.emptyText, isDark && styles.textDark]}>Notification not found.</Text>
        </View>
      </View>
    );
  }

  const iconColor = ICON_COLOR_MAP[notif.icon] || '#0052CC';
  const iconBg = getIconBg(notif.icon, isDark);

  const typeLabel = notif.type === 'admin' ? 'Admin Notice' : 'Personal Notification';
  const typeColor = notif.type === 'admin' ? '#8B5CF6' : '#0052CC';
  const typeBg = notif.type === 'admin'
    ? (isDark ? '#4C1D95' : '#EDE9FE')
    : (isDark ? '#1E3A6E' : '#DBEAFE');

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {/* Header */}
      <InnerHeader title="Notification" paddingTop={insets.top} isDark={isDark} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Hero Icon Card */}
        <View style={[styles.heroCard, isDark && styles.heroCardDark]}>
          <View style={[styles.heroIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={notif.icon} size={40} color={iconColor} />
          </View>

          {/* Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: typeBg }]}>
            <Ionicons name={notif.type === 'admin' ? 'megaphone' : 'person'} size={12} color={typeColor} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>

          <Text style={[styles.notifTitle, isDark && styles.textDark]}>{notif.title}</Text>
          <Text style={[styles.notifTime, isDark && styles.subtextDark]}>{notif.time}</Text>
        </View>

        {/* Message Card */}
        <View style={[styles.messageCard, isDark && styles.messageCardDark]}>
          <View style={styles.messageLabelRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.messageLabel, isDark && styles.subtextDark]}>Message</Text>
          </View>
          <Text style={[styles.messageText, isDark && styles.textDark]}>{notif.message}</Text>
        </View>

        {/* Meta Info Card */}
        <View style={[styles.metaCard, isDark && styles.metaCardDark]}>
          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="person-circle-outline" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </View>
            <View style={styles.metaInfo}>
              <Text style={[styles.metaLabel, isDark && styles.subtextDark]}>Recipient</Text>
              <Text style={[styles.metaValue, isDark && styles.textDark]}>{notif.targetEmployee}</Text>
            </View>
          </View>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="time-outline" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </View>
            <View style={styles.metaInfo}>
              <Text style={[styles.metaLabel, isDark && styles.subtextDark]}>Received</Text>
              <Text style={[styles.metaValue, isDark && styles.textDark]}>{notif.time}</Text>
            </View>
          </View>

          <View style={[styles.divider, isDark && styles.dividerDark]} />

          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name={notif.read ? 'checkmark-done' : 'ellipse-outline'} size={18} color={notif.read ? '#10B981' : (isDark ? '#94A3B8' : '#64748B')} />
            </View>
            <View style={styles.metaInfo}>
              <Text style={[styles.metaLabel, isDark && styles.subtextDark]}>Status</Text>
              <Text style={[styles.metaValue, { color: notif.read ? '#10B981' : typeColor }]}>
                {notif.read ? 'Read' : 'Unread'}
              </Text>
            </View>
          </View>
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity
          style={[styles.dismissBtn, { backgroundColor: typeColor }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.dismissBtnText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerDark: { backgroundColor: '#080808' },

  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  heroCardDark: { backgroundColor: '#1C1C1C', borderColor: '#334155' },
  heroIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, gap: 5, marginBottom: 14,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  notifTitle: {
    fontSize: 20, fontWeight: '700',
    color: '#1E293B', textAlign: 'center',
    letterSpacing: -0.3, lineHeight: 28,
    marginBottom: 8,
  },
  notifTime: {
    fontSize: 13, color: '#94A3B8',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  messageCardDark: { backgroundColor: '#1C1C1C', borderColor: '#334155' },
  messageLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 12,
  },
  messageLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  messageText: {
    fontSize: 15, color: '#1E293B',
    lineHeight: 24, fontWeight: '400',
  },
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaCardDark: { backgroundColor: '#1C1C1C', borderColor: '#334155' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  metaIconWrap: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  metaInfo: { flex: 1 },
  metaLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  dividerDark: { backgroundColor: '#2A2A2A' },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 6,
  },
  dismissBtnText: {
    fontSize: 16, fontWeight: '700', color: '#FFFFFF',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: '#64748B' },
  textDark: { color: '#F1F5F9' },
  subtextDark: { color: '#94A3B8' },
});
