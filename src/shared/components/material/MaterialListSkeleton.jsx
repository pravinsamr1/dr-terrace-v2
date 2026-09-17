import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import MaterialSkeleton from './MaterialSkeleton';

/**
 * MaterialListSkeleton Component
 * 
 * @param {Object} props
 * @param {number} [props.count=4] - Number of skeleton rows to render
 * @param {boolean} [props.isCardStyle=true] - Whether to render as elevated cards or simple list rows
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 */
export default function MaterialListSkeleton({
  count = 4,
  isCardStyle = true,
  style,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <View style={[styles.container, style]}>
      {items.map((key) => {
        const itemContent = (
          <View style={styles.itemRow}>
            {/* Avatar Placeholder */}
            <MaterialSkeleton
              variant="circular"
              width={52}
              height={52}
              isDark={isDark}
            />

            {/* Details Placeholder */}
            <View style={styles.infoCol}>
              <MaterialSkeleton
                variant="text"
                width={key % 2 === 0 ? '70%' : '55%'}
                height={16}
                isDark={isDark}
              />
              <MaterialSkeleton
                variant="text"
                width={key % 2 === 0 ? '45%' : '60%'}
                height={13}
                style={{ marginTop: 6 }}
                isDark={isDark}
              />
              <View style={styles.badgeRow}>
                <MaterialSkeleton
                  variant="rounded"
                  width={64}
                  height={18}
                  borderRadius={6}
                  isDark={isDark}
                />
                <MaterialSkeleton
                  variant="rounded"
                  width={72}
                  height={18}
                  borderRadius={6}
                  style={{ marginLeft: 8 }}
                  isDark={isDark}
                />
              </View>
            </View>

            {/* Trailing Icon / Action */}
            <View style={styles.actionCol}>
              <MaterialSkeleton
                variant="circular"
                width={32}
                height={32}
                isDark={isDark}
              />
            </View>
          </View>
        );

        if (isCardStyle) {
          return (
            <Surface
              key={key}
              elevation={1}
              style={[
                styles.cardWrapper,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              {itemContent}
            </Surface>
          );
        }

        return (
          <View
            key={key}
            style={[
              styles.rowWrapper,
              { borderBottomColor: isDark ? '#334155' : '#E2E8F0' },
            ]}
          >
            {itemContent}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  cardWrapper: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  rowWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionCol: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
