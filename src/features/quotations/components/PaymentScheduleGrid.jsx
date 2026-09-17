import React from 'react';
import { StyleSheet, View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentScheduleGrid({
  advancePercent = '60',
  midPercent = '30',
  finalPercent = '10',
  onChangeAdvance,
  onChangeMid,
  onChangeFinal,
  isDark = false,
}) {
  const advNum = parseFloat(advancePercent) || 0;
  const midNum = parseFloat(midPercent) || 0;
  const finNum = parseFloat(finalPercent) || 0;
  const totalSum = advNum + midNum + finNum;
  const is100 = Math.abs(totalSum - 100) < 0.1;

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={[styles.titleText, isDark && styles.textDark]}>
          PAYMENT SCHEDULE
        </Text>
        <View
          style={[
            styles.badge,
            is100 ? styles.badgeSuccess : styles.badgeWarn,
            isDark && (is100 ? styles.badgeSuccessDark : styles.badgeWarnDark),
          ]}
        >
          <Ionicons
            name={is100 ? 'checkmark-circle' : 'alert-circle'}
            size={12}
            color={is100 ? '#059669' : '#D97706'}
            style={{ marginRight: 3 }}
          />
          <Text
            style={[
              styles.badgeText,
              { color: is100 ? (isDark ? '#34D399' : '#047857') : (isDark ? '#FBBF24' : '#B45309') },
            ]}
          >
            {totalSum}% Total
          </Text>
        </View>
      </View>

      {/* 3-Column Grid */}
      <View style={styles.grid}>
        {/* Advance */}
        <View style={[styles.colCard, isDark && styles.colCardDark]}>
          <Text style={[styles.colLabel, isDark && styles.subtextDark]}>ADVANCE</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              keyboardType="numeric"
              value={String(advancePercent ?? '')}
              onChangeText={onChangeAdvance}
              placeholder="60"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text style={[styles.percentSign, isDark && styles.subtextDark]}>%</Text>
          </View>
        </View>

        {/* Mid-Coat */}
        <View style={[styles.colCard, isDark && styles.colCardDark]}>
          <Text style={[styles.colLabel, isDark && styles.subtextDark]}>MID-COAT</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              keyboardType="numeric"
              value={String(midPercent ?? '')}
              onChangeText={onChangeMid}
              placeholder="30"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text style={[styles.percentSign, isDark && styles.subtextDark]}>%</Text>
          </View>
        </View>

        {/* Final */}
        <View style={[styles.colCard, isDark && styles.colCardDark]}>
          <Text style={[styles.colLabel, isDark && styles.subtextDark]}>FINAL</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              keyboardType="numeric"
              value={String(finalPercent ?? '')}
              onChangeText={onChangeFinal}
              placeholder="10"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text style={[styles.percentSign, isDark && styles.subtextDark]}>%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeSuccessDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  badgeWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeWarnDark: {
    backgroundColor: '#451A03',
    borderColor: '#78350F',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  colCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  colCardDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  colLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    minWidth: 28,
    padding: 0,
  },
  percentSign: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 2,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
