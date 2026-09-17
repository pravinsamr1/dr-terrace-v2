import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function QuotationCustomerBanner({
  displayName,
  customerInitial,
  displayId,
  displayPhone,
  status = 'Active',
  isDark = false,
}) {
  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      {/* Monogram Avatar */}
      <View style={[styles.avatar, isDark && styles.avatarDark]}>
        <Text style={[styles.avatarText, isDark && styles.avatarTextDark]}>
          {customerInitial || 'C'}
        </Text>
      </View>

      {/* Details Column */}
      <View style={styles.detailsCol}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, isDark && styles.textDark]} numberOfLines={1}>
            {displayName || 'Valued Customer'}
          </Text>
          <View style={[styles.statusBadge, isDark && styles.statusBadgeDark]}>
            <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
              {status}
            </Text>
          </View>
        </View>

        {/* Customer ID Row */}
        <View style={styles.metaRow}>
          <Ionicons
            name="business-outline"
            size={13}
            color={isDark ? '#94A3B8' : '#64748B'}
            style={styles.metaIcon}
          />
          <Text style={[styles.metaText, isDark && styles.subtextDark]}>
            {displayId}
          </Text>
        </View>

        {/* Phone Row */}
        <View style={styles.metaRow}>
          <Ionicons
            name="call-outline"
            size={13}
            color={isDark ? '#94A3B8' : '#64748B'}
            style={styles.metaIcon}
          />
          <Text style={[styles.metaText, isDark && styles.subtextDark]}>
            {displayPhone}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3EDFA',
    borderWidth: 1.5,
    borderColor: '#CDE0F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarDark: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B59A2',
  },
  avatarTextDark: {
    color: '#60A5FA',
  },
  detailsCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },
  statusTextDark: {
    color: '#6EE7B7',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaIcon: {
    marginRight: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
