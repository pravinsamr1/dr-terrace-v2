import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import MaterialSkeleton from './MaterialSkeleton';

/**
 * MaterialCardSkeleton Component
 * 
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton cards to render
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {number} [props.elevation=1]
 */
export default function MaterialCardSkeleton({ count = 1, style, elevation = 1 }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cards = Array.from({ length: count }, (_, index) => index);

  return (
    <View style={styles.container}>
      {cards.map((key) => (
        <Surface
          key={key}
          elevation={elevation}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
            style,
          ]}
        >
          {/* Card Header Row */}
          <View style={styles.headerRow}>
            <MaterialSkeleton variant="circular" width={46} height={46} isDark={isDark} />
            <View style={styles.headerTextCol}>
              <MaterialSkeleton variant="text" width="65%" height={16} isDark={isDark} />
              <MaterialSkeleton variant="text" width="40%" height={12} isDark={isDark} />
            </View>
            <MaterialSkeleton variant="rounded" width={60} height={24} borderRadius={12} isDark={isDark} />
          </View>

          {/* Card Divider / Content lines */}
          <View style={styles.contentSection}>
            <MaterialSkeleton variant="text" width="95%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="80%" height={14} isDark={isDark} />
          </View>

          {/* Card Bottom Meta / Action Row */}
          <View style={styles.footerRow}>
            <MaterialSkeleton variant="rounded" width={80} height={20} borderRadius={6} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width={100} height={32} borderRadius={8} isDark={isDark} />
          </View>
        </Surface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  contentSection: {
    marginTop: 14,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
});
