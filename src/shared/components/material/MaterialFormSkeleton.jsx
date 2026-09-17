import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import MaterialSkeleton from './MaterialSkeleton';

/**
 * MaterialFormSkeleton Component
 * Designed for create / edit forms.
 * 
 * @param {Object} props
 * @param {boolean} [props.showHeader=true]
 * @param {string} [props.headerTitle]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 */
export default function MaterialFormSkeleton({
  showHeader = true,
  headerTitle,
  style,
}) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0B1120' : '#F4F8FC' },
        style,
      ]}
    >
      {showHeader && (
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 20),
              backgroundColor: isDark ? '#1E293B' : '#0047BA',
            },
          ]}
        >
          <MaterialSkeleton variant="circular" width={38} height={38} isDark={isDark} style={{ opacity: 0.7 }} />
          <View style={styles.headerTitleBox}>
            <MaterialSkeleton variant="text" width={140} height={18} isDark={isDark} style={{ opacity: 0.85 }} />
          </View>
          <View style={{ width: 38 }} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Upload Placeholder */}
        <View style={styles.avatarSection}>
          <MaterialSkeleton variant="circular" width={90} height={90} isDark={isDark} />
          <MaterialSkeleton variant="text" width={110} height={14} style={{ marginTop: 10 }} isDark={isDark} />
        </View>

        {/* Section 1: Basic Information */}
        <Surface
          elevation={1}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <MaterialSkeleton variant="text" width={140} height={16} isDark={isDark} />
          <View style={styles.divider} />

          {/* Input 1 */}
          <MaterialSkeleton variant="text" width={90} height={13} style={{ marginBottom: 4 }} isDark={isDark} />
          <MaterialSkeleton variant="rounded" width="100%" height={48} borderRadius={10} isDark={isDark} />

          {/* Input 2 */}
          <MaterialSkeleton variant="text" width={110} height={13} style={{ marginTop: 12, marginBottom: 4 }} isDark={isDark} />
          <MaterialSkeleton variant="rounded" width="100%" height={48} borderRadius={10} isDark={isDark} />

          {/* Input 3 */}
          <MaterialSkeleton variant="text" width={80} height={13} style={{ marginTop: 12, marginBottom: 4 }} isDark={isDark} />
          <MaterialSkeleton variant="rounded" width="100%" height={48} borderRadius={10} isDark={isDark} />
        </Surface>

        {/* Section 2: Roles / Dropdowns */}
        <Surface
          elevation={1}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <MaterialSkeleton variant="text" width={150} height={16} isDark={isDark} />
          <View style={styles.divider} />

          {/* Chips Selection */}
          <MaterialSkeleton variant="text" width={100} height={13} style={{ marginBottom: 8 }} isDark={isDark} />
          <View style={styles.chipRow}>
            <MaterialSkeleton variant="rounded" width={85} height={32} borderRadius={16} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width={95} height={32} borderRadius={16} style={{ marginLeft: 8 }} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width={80} height={32} borderRadius={16} style={{ marginLeft: 8 }} isDark={isDark} />
          </View>

          {/* Dropdown Input */}
          <MaterialSkeleton variant="text" width={120} height={13} style={{ marginTop: 14, marginBottom: 4 }} isDark={isDark} />
          <MaterialSkeleton variant="rounded" width="100%" height={48} borderRadius={10} isDark={isDark} />
        </Surface>

        {/* Submit Button Placeholder */}
        <View style={styles.buttonContainer}>
          <MaterialSkeleton variant="rounded" width="100%" height={52} borderRadius={14} isDark={isDark} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitleBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    marginVertical: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
});
