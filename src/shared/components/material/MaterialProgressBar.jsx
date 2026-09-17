import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * MaterialProgressBar Component
 * 
 * @param {Object} props
 * @param {number} [props.progress] - Value between 0 and 1. If undefined, indeterminate is used.
 * @param {boolean} [props.indeterminate=false]
 * @param {string} [props.color]
 * @param {string} [props.trackColor]
 * @param {boolean} [props.visible=true]
 * @param {string} [props.label]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 */
export default function MaterialProgressBar({
  progress,
  indeterminate,
  color,
  trackColor,
  visible = true,
  label,
  style,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isIndeterminate = indeterminate !== undefined ? indeterminate : progress === undefined;
  const activeColor = color || (isDark ? '#93C5FD' : '#0052CC');
  const activeTrackColor = trackColor || (isDark ? '#1E293B' : '#E2E8F0');

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.labelText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {label}
          </Text>
          {progress !== undefined && !isIndeterminate && (
            <Text style={[styles.percentText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      ) : null}
      <ProgressBar
        progress={isIndeterminate ? undefined : progress}
        indeterminate={isIndeterminate}
        color={activeColor}
        style={[styles.progressBar, { backgroundColor: activeTrackColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
});
