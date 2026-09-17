import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import MaterialSkeleton from './MaterialSkeleton';

/**
 * MaterialDetailSkeleton Component
 * Designed for profile/detail screens like Employee Detail, Customer Detail, etc.
 * 
 * @param {Object} props
 * @param {boolean} [props.showHeader=true]
 * @param {string} [props.headerTitle]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 */
export default function MaterialDetailSkeleton({
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
      {/* Header bar */}
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
          <MaterialSkeleton
            variant="circular"
            width={38}
            height={38}
            isDark={isDark}
            style={{ opacity: 0.7 }}
          />
          <View style={styles.headerTitleBox}>
            {headerTitle ? (
              <MaterialSkeleton
                variant="text"
                width={140}
                height={18}
                isDark={isDark}
                style={{ opacity: 0.85 }}
              />
            ) : (
              <MaterialSkeleton
                variant="text"
                width={120}
                height={18}
                isDark={isDark}
                style={{ opacity: 0.85 }}
              />
            )}
          </View>
          <MaterialSkeleton
            variant="circular"
            width={38}
            height={38}
            isDark={isDark}
            style={{ opacity: 0.7 }}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Surface
          elevation={2}
          style={[
            styles.profileCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.avatarRow}>
            <MaterialSkeleton
              variant="circular"
              width={80}
              height={80}
              isDark={isDark}
            />
            <View style={styles.profileInfoCol}>
              <MaterialSkeleton variant="text" width="80%" height={20} isDark={isDark} />
              <MaterialSkeleton
                variant="text"
                width="50%"
                height={14}
                style={{ marginTop: 6 }}
                isDark={isDark}
              />
              <View style={styles.pillRow}>
                <MaterialSkeleton
                  variant="rounded"
                  width={75}
                  height={22}
                  borderRadius={11}
                  isDark={isDark}
                />
                <MaterialSkeleton
                  variant="rounded"
                  width={60}
                  height={22}
                  borderRadius={11}
                  style={{ marginLeft: 8 }}
                  isDark={isDark}
                />
              </View>
            </View>
          </View>

          {/* Quick Action Icons Row */}
          <View style={styles.quickActionsRow}>
            <MaterialSkeleton variant="rounded" width="30%" height={36} borderRadius={10} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width="30%" height={36} borderRadius={10} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width="30%" height={36} borderRadius={10} isDark={isDark} />
          </View>
        </Surface>

        {/* Stats / Metric Grid */}
        <View style={styles.metricsGrid}>
          <Surface
            elevation={1}
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <MaterialSkeleton variant="circular" width={32} height={32} isDark={isDark} />
            <MaterialSkeleton variant="text" width="60%" height={16} style={{ marginTop: 8 }} isDark={isDark} />
            <MaterialSkeleton variant="text" width="40%" height={12} isDark={isDark} />
          </Surface>

          <Surface
            elevation={1}
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <MaterialSkeleton variant="circular" width={32} height={32} isDark={isDark} />
            <MaterialSkeleton variant="text" width="60%" height={16} style={{ marginTop: 8 }} isDark={isDark} />
            <MaterialSkeleton variant="text" width="40%" height={12} isDark={isDark} />
          </Surface>
        </View>

        {/* Detailed Sections Card 1 */}
        <Surface
          elevation={1}
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <MaterialSkeleton variant="text" width={130} height={18} isDark={isDark} />
            <MaterialSkeleton variant="rounded" width={50} height={20} borderRadius={6} isDark={isDark} />
          </View>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="30%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="55%" height={14} isDark={isDark} />
          </View>
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="35%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="45%" height={14} isDark={isDark} />
          </View>
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="28%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="60%" height={14} isDark={isDark} />
          </View>
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="32%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="50%" height={14} isDark={isDark} />
          </View>
        </Surface>

        {/* Detailed Sections Card 2 */}
        <Surface
          elevation={1}
          style={[
            styles.sectionCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <MaterialSkeleton variant="text" width={150} height={18} isDark={isDark} />
          </View>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="35%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="50%" height={14} isDark={isDark} />
          </View>
          <View style={styles.fieldRow}>
            <MaterialSkeleton variant="text" width="30%" height={14} isDark={isDark} />
            <MaterialSkeleton variant="text" width="40%" height={14} isDark={isDark} />
          </View>
        </Surface>
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
  profileCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfoCol: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    marginVertical: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
});
