import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * Material Design Skeleton Component
 * 
 * @param {Object} props
 * @param {'text' | 'circular' | 'rectangular' | 'rounded'} [props.variant='text']
 * @param {number|string} [props.width='100%']
 * @param {number|string} [props.height]
 * @param {number} [props.borderRadius]
 * @param {'pulse' | 'none'} [props.animation='pulse']
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {boolean} [props.isDark]
 */
export default function MaterialSkeleton({
  variant = 'text',
  width = '100%',
  height,
  borderRadius,
  animation = 'pulse',
  style,
  isDark: propIsDark,
  children,
}) {
  const colorScheme = useColorScheme();
  const isDark = propIsDark !== undefined ? propIsDark : colorScheme === 'dark';

  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (animation === 'pulse') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.9,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.4,
            duration: 850,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      opacityAnim.setValue(0.7);
    }
  }, [animation, opacityAnim]);

  // Determine default dimensions and radius based on variant
  let defaultHeight = 16;
  let defaultRadius = 4;

  if (variant === 'circular') {
    defaultHeight = typeof width === 'number' ? width : 44;
    defaultRadius = typeof width === 'number' ? width / 2 : 22;
  } else if (variant === 'rounded') {
    defaultHeight = 44;
    defaultRadius = 12;
  } else if (variant === 'rectangular') {
    defaultHeight = 120;
    defaultRadius = 8;
  } else if (variant === 'text') {
    defaultHeight = 14;
    defaultRadius = 4;
  }

  const finalHeight = height !== undefined ? height : defaultHeight;
  const finalRadius = borderRadius !== undefined ? borderRadius : defaultRadius;

  const baseBg = isDark ? '#1E293B' : '#E2E8F0';
  const highlightBg = isDark ? '#334155' : '#CBD5E1';

  return (
    <View
      style={[
        styles.container,
        {
          width: width,
          height: finalHeight,
          borderRadius: finalRadius,
          backgroundColor: baseBg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: highlightBg,
            opacity: opacityAnim,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
});
