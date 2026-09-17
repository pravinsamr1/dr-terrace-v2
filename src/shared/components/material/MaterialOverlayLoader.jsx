import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * MaterialOverlayLoader Component
 * Premium animated overlay loader with fade backdrop and spring card pop.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} [props.title='Please wait...']
 * @param {string} [props.subtitle]
 * @param {string} [props.color]
 * @param {() => void} [props.onDismiss]
 */
export default function MaterialOverlayLoader({
  visible = false,
  title = 'Please wait...',
  subtitle,
  color,
  onDismiss,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          bounciness: 6,
          speed: 14,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const indicatorColor = color || (isDark ? '#60A5FA' : '#0052CC');

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Animated.View
          style={[
            styles.card,
            isDark ? styles.cardDark : styles.cardLight,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={styles.spinnerWrapper}>
            <ActivityIndicator
              animating={true}
              size={36}
              color={indicatorColor}
            />
          </View>

          {title ? (
            <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
              {title}
            </Text>
          ) : null}

          {subtitle ? (
            <Text style={[styles.subtitle, isDark ? styles.subtextDark : styles.subtextLight]}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    paddingVertical: 26,
    paddingHorizontal: 28,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  spinnerWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  subtextLight: {
    color: '#64748B',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
