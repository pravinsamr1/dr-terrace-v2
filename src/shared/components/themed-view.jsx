import React from 'react';
import { View } from 'react-native';
import { useThemeColor } from '../../core/hooks/useThemeColor';

export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
