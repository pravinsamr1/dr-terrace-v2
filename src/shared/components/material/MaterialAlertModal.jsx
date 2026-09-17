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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * MaterialAlertModal Component
 * Premium animated alert/notice modal with spring bounce, pulsing glowing ring, and rich iconography.
 * Supports single button or dual action buttons (e.g. Try Again & Dismiss) with loading state.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} [props.title='Notice']
 * @param {string} [props.message='']
 * @param {'lock'|'warning'|'info'|'error'|'success'} [props.type='lock']
 * @param {string} [props.icon]
 * @param {string} [props.buttonText='Got It']
 * @param {string} [props.secondaryButtonText]
 * @param {boolean} [props.isLoading=false]
 * @param {() => void} [props.onClose]
 * @param {() => void} [props.onConfirm]
 * @param {() => void} [props.onDismiss]
 * @param {() => void} [props.onSecondaryAction]
 */
export default function MaterialAlertModal({
  visible = false,
  title = 'Notice',
  message = '',
  type = 'lock',
  icon,
  buttonText = 'Got It',
  secondaryButtonText,
  isLoading = false,
  onClose,
  onConfirm,
  onDismiss,
  onSecondaryAction,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.85)).current;
  const pulseOpacity = useRef(new Animated.Value(0.65)).current;

  // Type-specific color themes
  const themeConfig = {
    lock: {
      primary: '#F59E0B',
      primaryDark: '#D97706',
      bgLight: '#FEF3C7',
      bgDark: '#451A03',
      borderLight: '#FDE68A',
      borderDark: '#78350F',
      aura: '#F59E0B',
      defaultIcon: 'lock-closed',
      btnBg: '#F59E0B',
      btnText: '#FFFFFF',
    },
    warning: {
      primary: '#F97316',
      primaryDark: '#EA580C',
      bgLight: '#FFEDD5',
      bgDark: '#431407',
      borderLight: '#FED7AA',
      borderDark: '#7C2D12',
      aura: '#F97316',
      defaultIcon: 'alert-circle',
      btnBg: '#F97316',
      btnText: '#FFFFFF',
    },
    info: {
      primary: '#2563EB',
      primaryDark: '#1D4ED8',
      bgLight: '#EFF6FF',
      bgDark: '#1E293B',
      borderLight: '#BFDBFE',
      borderDark: '#1E3A8A',
      aura: '#3B82F6',
      defaultIcon: 'information-circle',
      btnBg: '#2563EB',
      btnText: '#FFFFFF',
    },
    error: {
      primary: '#EF4444',
      primaryDark: '#DC2626',
      bgLight: '#FEE2E2',
      bgDark: '#450A0A',
      borderLight: '#FECACA',
      borderDark: '#7F1D1D',
      aura: '#EF4444',
      defaultIcon: 'close-circle',
      btnBg: '#EF4444',
      btnText: '#FFFFFF',
    },
    success: {
      primary: '#10B981',
      primaryDark: '#059669',
      bgLight: '#ECFDF5',
      bgDark: '#064E3B',
      borderLight: '#A7F3D0',
      borderDark: '#065F46',
      aura: '#10B981',
      defaultIcon: 'checkmark-circle',
      btnBg: '#10B981',
      btnText: '#FFFFFF',
    },
  }[type] || {
    primary: '#F59E0B',
    primaryDark: '#D97706',
    bgLight: '#FEF3C7',
    bgDark: '#451A03',
    borderLight: '#FDE68A',
    borderDark: '#78350F',
    aura: '#F59E0B',
    defaultIcon: 'lock-closed',
    btnBg: '#F59E0B',
    btnText: '#FFFFFF',
  };

  const resolvedIcon = icon || themeConfig.defaultIcon;

  useEffect(() => {
    let pulseLoop = null;

    if (visible) {
      // Reset values
      backdropOpacity.setValue(0);
      cardScale.setValue(0.82);
      cardOpacity.setValue(0);
      iconScale.setValue(0);
      iconBounce.setValue(0);
      pulseScale.setValue(0.85);
      pulseOpacity.setValue(0.65);

      // 1. Fade backdrop in
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      // 2. Spring pop-up card
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          bounciness: 9,
          speed: 12,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Pop-in Icon with spring bounce
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(iconScale, {
          toValue: 1,
          bounciness: 12,
          speed: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // 4. Subtle looping aura pulse
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 1.35,
              duration: 1200,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1200,
              easing: Easing.out(Easing.ease),
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
              toValue: 0.65,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
    };
  }, [visible]);

  const handleClose = () => {
    // Smooth exit animations
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.85,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const dismissCallback = onClose || onConfirm || onDismiss;
      if (dismissCallback) dismissCallback();
    });
  };

  const handlePrimaryPress = () => {
    if (isLoading) return;
    if (onConfirm && secondaryButtonText) {
      onConfirm();
    } else {
      handleClose();
    }
  };

  const handleSecondaryPress = () => {
    if (isLoading) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.85,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const secondaryCallback = onSecondaryAction || onClose || onDismiss;
      if (secondaryCallback) secondaryCallback();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleSecondaryPress}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      >
        {/* Tap outside to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={secondaryButtonText ? handleSecondaryPress : handleClose}
        />

        {/* Animated Card Content */}
        <Animated.View
          style={[
            styles.cardContainer,
            isDark && styles.cardContainerDark,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          {/* Top Decorative Graphic Area with Pulsing Halo */}
          <View style={styles.iconWrapper}>
            {/* Glowing Pulse Aura */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  backgroundColor: themeConfig.aura,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />

            {/* Icon Base Circle */}
            <Animated.View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark ? themeConfig.bgDark : themeConfig.bgLight,
                  borderColor: isDark ? themeConfig.borderDark : themeConfig.borderLight,
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Ionicons
                name={resolvedIcon}
                size={34}
                color={themeConfig.primary}
              />
            </Animated.View>
          </View>

          {/* Title */}
          <Text style={[styles.title, isDark && styles.titleDark]}>
            {title}
          </Text>

          {/* Message Description */}
          {Boolean(message) && (
            <Text style={[styles.message, isDark && styles.messageDark]}>
              {message}
            </Text>
          )}

          {/* Action Button(s) */}
          {secondaryButtonText ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  isDark ? styles.cancelBtnDark : styles.cancelBtnLight,
                ]}
                onPress={handleSecondaryPress}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    isDark ? styles.cancelTextDark : styles.cancelTextLight,
                  ]}
                >
                  {secondaryButtonText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: themeConfig.btnBg }]}
                onPress={handlePrimaryPress}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={themeConfig.btnText} />
                ) : (
                  <Text style={[styles.confirmBtnText, { color: themeConfig.btnText }]}>
                    {buttonText}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: themeConfig.btnBg }]}
              onPress={handlePrimaryPress}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={themeConfig.btnText} />
              ) : (
                <Text style={[styles.confirmBtnText, { color: themeConfig.btnText }]}>
                  {buttonText}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  cardContainerDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  iconWrapper: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  messageDark: {
    color: '#94A3B8',
  },
  confirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
  },
  cancelBtnLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  cancelBtnDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelTextLight: {
    color: '#475569',
  },
  cancelTextDark: {
    color: '#E2E8F0',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
