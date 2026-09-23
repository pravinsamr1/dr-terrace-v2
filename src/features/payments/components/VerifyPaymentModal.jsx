import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

/**
 * VerifyPaymentModal Component
 * Custom designed animated confirmation modal for Payment Verification.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {number} props.amount
 * @param {string} [props.clientName]
 * @param {string} [props.stage]
 * @param {string} [props.paymentMethod]
 * @param {string} [props.voucher]
 * @param {boolean} [props.isSubmitting=false]
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function VerifyPaymentModal({
  visible = false,
  amount = 0,
  clientName = '',
  stage = '',
  paymentMethod = '',
  voucher = '',
  isSubmitting = false,
  onConfirm,
  onCancel,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values (lazily initialized for stable identity)
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [cardScale] = useState(() => new Animated.Value(0.85));
  const [cardOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0));
  const [pulseScale] = useState(() => new Animated.Value(0.85));
  const [pulseOpacity] = useState(() => new Animated.Value(0.65));

  useEffect(() => {
    let pulseLoop = null;

    if (visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);
      iconScale.setValue(0);
      pulseScale.setValue(0.85);
      pulseOpacity.setValue(0.65);

      // 1. Backdrop fade in
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      // 2. Card spring
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          bounciness: 7,
          speed: 13,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Icon pop
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(iconScale, {
          toValue: 1,
          bounciness: 10,
          speed: 14,
          useNativeDriver: true,
        }),
      ]).start();

      // 4. Looping pulse ring
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
              toValue: 0.65,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
    } else if (pulseLoop) {
      pulseLoop.stop();
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
    };
  }, [visible, backdropOpacity, cardOpacity, cardScale, iconScale, pulseOpacity, pulseScale]);

  if (!visible) return null;

  const formattedAmount = Number(amount || 0).toLocaleString('en-IN');

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={isSubmitting ? undefined : onCancel}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        {/* Backdrop tap */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={isSubmitting ? undefined : onCancel}
        />

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
          {/* Top Pulsing Badge */}
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
                name="shield-checkmark"
                size={34}
                color={isDark ? '#34D399' : '#059669'}
              />
            </Animated.View>
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
            Verify Payment
          </Text>
          <Text style={[styles.subtitle, isDark ? styles.subtextDark : styles.subtextLight]}>
            Confirm the details below to record official verification.
          </Text>

          {/* Amount Card */}
          <View style={[styles.amountBox, isDark ? styles.amountBoxDark : styles.amountBoxLight]}>
            <Text style={[styles.amountLabel, isDark ? styles.amountLabelDark : styles.amountLabelLight]}>
              PAYMENT AMOUNT
            </Text>
            <Text style={[styles.amountValue, isDark ? styles.amountValueDark : styles.amountValueLight]}>
              ₹{formattedAmount}
            </Text>
          </View>

          {/* Details Table */}
          

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, isDark ? styles.cancelBtnDark : styles.cancelBtnLight]}
              onPress={onCancel}
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, isDark ? styles.cancelTextDark : styles.cancelTextLight]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, isSubmitting && { opacity: 0.85 }]}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Verifying...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.confirmBtnText}>Verify Payment</Text>
                </>
              )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },

  // Icon with pulsing aura
  iconWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  pulseRingLight: {
    backgroundColor: '#10B981',
  },
  pulseRingDark: {
    backgroundColor: '#059669',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  iconCircleLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  iconCircleDark: {
    backgroundColor: '#064E3B',
    borderColor: '#065F46',
  },

  // Text
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  subtextLight: {
    color: '#64748B',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Amount box
  amountBox: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  amountBoxLight: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  amountBoxDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
  },
  amountLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  amountLabelLight: {
    color: '#15803D',
  },
  amountLabelDark: {
    color: '#86EFAC',
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  amountValueLight: {
    color: '#166534',
  },
  amountValueDark: {
    color: '#4ADE80',
  },

  // Details card
  detailsCard: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 20,
    borderWidth: 1,
  },
  detailsCardLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  detailsCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '55%',
    textAlign: 'right',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  cancelBtnLight: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnDark: {
    borderColor: '#475569',
    backgroundColor: '#1E293B',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelTextLight: {
    color: '#475569',
  },
  cancelTextDark: {
    color: '#CBD5E1',
  },
  confirmBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
