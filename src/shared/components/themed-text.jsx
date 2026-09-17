import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useThemeColor } from '../../core/hooks/useThemeColor';

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        styles.base,
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontWeight: '500',
    color: '#0a7ea4',
  },
});
