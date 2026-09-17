import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

const ALL_TIERS = [
  { id: 'economic', label: 'Economic', color: '#475569' },
  { id: 'premium', label: 'Premium', color: '#2B59A2' },
  { id: 'elite', label: 'Elite', color: '#B45309' },
];

export default function QuotationTierSwitcher({
  activeTier = 'premium',
  availableTiers = ['economic', 'premium', 'elite'],
  onSelectTier,
  isDark = false,
}) {
  const normalizedAvailable = (availableTiers && availableTiers.length > 0)
    ? availableTiers.map((t) => String(t).toLowerCase())
    : ['economic', 'premium', 'elite'];

  const displayTiers = ALL_TIERS.filter((t) => normalizedAvailable.includes(t.id));

  // If only 1 tier was chosen, show an informative banner or compact active pill
  if (displayTiers.length <= 1) {
    const single = displayTiers[0] || ALL_TIERS[1];
    return (
      <View style={[styles.singleTierBanner, isDark && styles.singleTierBannerDark]}>
        <Text style={[styles.singleTierLabel, isDark && styles.subtextDark]}>
          QUOTATION TIER:
        </Text>
        <View style={[styles.singleTierBadge, isDark && styles.singleTierBadgeDark]}>
          <Text style={styles.singleTierBadgeText}>{single.label}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {displayTiers.map((tier) => {
        const isSelected = activeTier?.toLowerCase() === tier.id;
        return (
          <TouchableOpacity
            key={tier.id}
            style={[
              styles.segmentBtn,
              isSelected && styles.segmentBtnActive,
              isSelected && { backgroundColor: isDark ? '#2563EB' : '#2B59A2' },
            ]}
            onPress={() => onSelectTier(tier.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                isDark && styles.textDark,
                isSelected && styles.segmentTextActive,
              ]}
            >
              {tier.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    padding: 3.5,
    borderRadius: 14,
    marginBottom: 12,
    gap: 4,
  },
  containerDark: {
    backgroundColor: '#1E293B',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9.5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#2B59A2',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  singleTierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  singleTierBannerDark: {
    backgroundColor: '#172554',
    borderColor: '#1E40AF',
  },
  singleTierLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  singleTierBadge: {
    backgroundColor: '#2B59A2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  singleTierBadgeDark: {
    backgroundColor: '#2563EB',
  },
  singleTierBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#94A3B8',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
