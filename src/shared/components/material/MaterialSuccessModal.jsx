import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * MaterialSuccessModal Component
 * Premium animated success modal with checkmark spring, pulse aura ring, and card scale transitions.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} [props.title='Success!']
 * @param {string} [props.message='Action completed successfully.']
 * @param {string} [props.badgeText]
 * @param {string} [props.buttonText='OK']
 * @param {() => void} props.onClose
 */
export default function MaterialSuccessModal({
  visible = false,
  title = 'Success!',
  message = 'Action completed successfully.',
  badgeText,
  buttonText = 'OK',
  onClose,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.85)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let pulseLoop = null;

    if (visible) {
      // Reset values
      backdropOpacity.setValue(0);
      cardScale.setValue(0.82);
      cardOpacity.setValue(0);
      iconScale.setValue(0);
      iconRotate.setValue(0);
      pulseScale.setValue(0.85);
      pulseOpacity.setValue(0.7);

      // 1. Fade backdrop in
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      // 2. Spring pop-up card
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          bounciness: 9,
          speed: 12,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Pop-in checkmark icon with bouncy spring & slight spin
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1,
            bounciness: 14,
            speed: 11,
            useNativeDriver: true,
          }),
          Animated.timing(iconRotate, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // 4. Subtle looping pulse aura behind checkmark
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 1.38,
              duration: 1400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 0.85,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
    } else {
      if (pulseLoop) pulseLoop.stop();
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
    };
  }, [visible]);

  const spin = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-25deg', '0deg'],
  });

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
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
          {/* Animated Success Badge Icon Container */}
          <View style={styles.iconContainer}>
            {/* Pulsing Aura Ring */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />

            {/* Glowing Icon Base Circle */}
            <Animated.View
              style={[
                styles.iconCircle,
                {
                  transform: [{ scale: iconScale }, { rotate: spin }],
                },
              ]}
            >
              <Ionicons name="checkmark" size={38} color="#FFFFFF" />
            </Animated.View>
          </View>

          {/* Badge Tag if present */}
          {badgeText ? (
            <View style={styles.badgeWrapper}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          ) : null}

          {/* Title */}
          <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, isDark ? styles.subtextDark : styles.subtextLight]}>
            {message}
          </Text>

          {/* OK / Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.82}
            onPress={onClose}
          >
            <Text style={styles.actionButtonText}>{buttonText}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
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
  iconContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeWrapper: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  subtextLight: {
    color: '#475569',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  actionButton: {
    backgroundColor: '#0052CC',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#0052CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
