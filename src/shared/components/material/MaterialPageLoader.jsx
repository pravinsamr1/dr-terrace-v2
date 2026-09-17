import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Surface } from 'react-native-paper';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * MaterialPageLoader Component
 * 
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {'small' | 'large' | number} [props.size='large']
 * @param {string} [props.color]
 * @param {boolean} [props.fullScreen=true]
 * @param {boolean} [props.showCard=false]
 * @param {React.ReactNode} [props.icon]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 */
export default function MaterialPageLoader({
  title,
  subtitle,
  size = 'large',
  color,
  fullScreen = true,
  showCard = false,
  icon,
  style,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const indicatorColor = color || (isDark ? '#93C5FD' : '#0052CC');

  const content = (
    <View style={styles.innerContent}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <ActivityIndicator
        animating={true}
        size={size}
        color={indicatorColor}
        style={styles.spinner}
      />
      {title ? (
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (showCard) {
    return (
      <View
        style={[
          fullScreen ? styles.fullScreenContainer : styles.inlineContainer,
          { backgroundColor: fullScreen ? (isDark ? '#0B1120' : '#F8FAFC') : 'transparent' },
          style,
        ]}
      >
        <Surface
          elevation={2}
          style={[
            styles.cardSurface,
            { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
          ]}
        >
          {content}
        </Surface>
      </View>
    );
  }

  return (
    <View
      style={[
        fullScreen ? styles.fullScreenContainer : styles.inlineContainer,
        { backgroundColor: fullScreen ? (isDark ? '#0B1120' : '#F8FAFC') : 'transparent' },
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inlineContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  spinner: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  cardSurface: {
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
});
