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
 * MaterialDeleteModal Component
 * Custom animated delete confirmation modal with pulsing danger aura, spring scale card, and dual action buttons.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} [props.title='Delete Revision?']
 * @param {string} [props.message='Are you sure you want to delete this revision? This action cannot be undone.']
 * @param {string} [props.confirmText='Delete']
 * @param {string} [props.cancelText='Cancel']
 * @param {boolean} [props.isDeleting=false]
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function MaterialDeleteModal({
  visible = false,
  title = 'Delete Revision?',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDeleting = false,
  onConfirm,
  onCancel,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.85)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let pulseLoop = null;

    if (visible) {
      // Reset values
      backdropOpacity.setValue(0);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);
      iconScale.setValue(0);
      pulseScale.setValue(0.85);
      pulseOpacity.setValue(0.6);

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
          bounciness: 8,
          speed: 13,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Pop danger icon
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(iconScale, {
          toValue: 1,
          bounciness: 12,
          speed: 14,
          useNativeDriver: true,
        }),
      ]).start();

      // 4. Subtle pulsing red ring loop
      pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.35,
              duration: 1400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 0.85,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1400,
              easing: Easing.out(Easing.ease),
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

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onCancel}
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
          {/* Pulsing Danger Icon */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                isDark ? styles.pulseRingDark : styles.pulseRingLight,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.iconCircle,
                isDark ? styles.iconCircleDark : styles.iconCircleLight,
                {
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={34}
                color={isDark ? '#F87171' : '#DC2626'}
              />
            </Animated.View>
          </View>

          {/* Title */}
          <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, isDark ? styles.subtextDark : styles.subtextLight]}>
            {message}
          </Text>

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, isDark ? styles.cancelBtnDark : styles.cancelBtnLight]}
              onPress={onCancel}
              activeOpacity={0.75}
              disabled={isDeleting}
            >
              <Text style={[styles.cancelBtnText, isDark ? styles.cancelTextDark : styles.cancelTextLight]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, isDeleting && { opacity: 0.7 }]}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="trash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.confirmBtnText}>
                {isDeleting ? 'Deleting...' : confirmText}
              </Text>
            </TouchableOpacity>
          </View>
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
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
    borderColor: '#FEE2E2',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3F1D1D',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  pulseRingLight: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  pulseRingDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  iconCircleLight: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  iconCircleDark: {
    backgroundColor: '#371B1B',
    borderColor: '#7F1D1D',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextLight: {
    color: '#64748B',
  },
  subtextDark: {
    color: '#94A3B8',
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
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
