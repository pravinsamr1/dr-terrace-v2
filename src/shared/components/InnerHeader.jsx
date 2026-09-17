/**
 * InnerHeader
 *
 * A minimal header used on all inner (non-Home, non-splash)
 * screens with balanced alignment, mathematically centered title, and adaptive right action slot.
 *
 * Props
 * ─────
 * title        {string}          Screen title shown in the centre.
 * onBack       {() => void}      Called when the back arrow is pressed.
 *                                Defaults to router.back().
 * right        {ReactNode}       Optional element rendered on the right side.
 * paddingTop   {number}          Safe-area / status-bar top inset.
 * isDark       {boolean}         Whether dark mode is active.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function InnerHeader({
  title,
  onBack,
  right,
  paddingTop = 20,
  isDark = false,
}) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  useFocusEffect(
    useCallback(() => {
      RNStatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android') {
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBackgroundColor('transparent');
      }
    }, [])
  );

  const topInset =
    Platform.OS === 'ios'
      ? Math.max(paddingTop, 20) + 6
      : Math.max(paddingTop, RNStatusBar.currentHeight || 24) + 6;

  return (
    <>
      <ExpoStatusBar style="light" translucent backgroundColor="transparent" />
      <RNStatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View
        style={[
          styles.header,
          isDark ? styles.headerDark : styles.headerLight,
          { paddingTop: topInset },
        ]}
      >
        <View style={styles.contentRow}>
          {/* Left Slot: Back button */}
          <View style={styles.leftSlot}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.backIconCircle, isDark && styles.backIconCircleDark]}>
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={isDark ? '#CBD5E1' : '#FFFFFF'}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Center Slot: Mathematically centered Title */}
          <View style={styles.titleContainer} pointerEvents="none">
            <Text
              style={[styles.title, isDark && styles.titleDark]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>

          {/* Right Slot: Flexible width, right-aligned, vertically centered */}
          <View style={styles.rightSlot}>
            {right ?? null}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  headerLight: {
    backgroundColor: '#0047BA',
  },
  headerDark: {
    backgroundColor: '#0A0F1E',
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  contentRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },

  /* Left Slot */
  leftSlot: {
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* Centered Title Container */
  titleContainer: {
    position: 'absolute',
    left: 54,
    right: 54,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  titleDark: {
    color: '#E2E8F0',
  },

  /* Right Slot */
  rightSlot: {
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 2,
  },
});
