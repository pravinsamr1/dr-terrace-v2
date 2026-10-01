import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialProgressBar, MaterialSkeleton } from '../../../shared/components/material';

const PREVIEW_HEIGHT = 200;

/**
 * Payment proof photo preview with its own loading and failed states.
 * Loading: pulsing skeleton, soft icon badge and a slim progress bar. Loaded: the photo fades in.
 * Failed: a calm message (the parent decides what tapping does, e.g. open the browser).
 * Give it key={uri} so a different photo starts from the loading state again.
 */
export default function ProofImagePreview({ uri, isDark, onLoaded, onFailed }) {
  const [status, setStatus] = useState('loading');
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (status === 'loaded') {
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [status, fade]);

  const titleColor = isDark ? '#E2E8F0' : '#334155';
  const subtitleColor = isDark ? '#94A3B8' : '#64748B';
  const badgeBg = isDark ? 'rgba(147, 197, 253, 0.16)' : 'rgba(30, 72, 143, 0.10)';
  const badgeIcon = isDark ? '#93C5FD' : '#1E488F';

  return (
    <View style={[styles.frame, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
      {status !== 'failed' && (
        <Animated.Image
          source={{ uri }}
          style={[styles.image, { opacity: fade }]}
          resizeMode="cover"
          resizeMethod="resize"
          onLoad={() => {
            setStatus('loaded');
            onLoaded?.();
          }}
          onError={(e) => {
            console.warn('[ProofImagePreview] proof image failed to load:', uri, e?.nativeEvent?.error);
            setStatus('failed');
            onFailed?.();
          }}
        />
      )}

      {status === 'loading' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <MaterialSkeleton
            variant="rectangular"
            height={PREVIEW_HEIGHT}
            borderRadius={0}
            style={styles.skeleton}
            isDark={isDark}
          />
          <View style={styles.centered}>
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Ionicons name="image-outline" size={26} color={badgeIcon} />
            </View>
            <Text style={[styles.title, { color: titleColor }]}>Loading proof image</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>Large photos can take a few seconds</Text>
          </View>
          <MaterialProgressBar indeterminate trackColor="transparent" style={styles.progress} />
        </View>
      )}

      {status === 'failed' && (
        <View style={styles.centered}>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(248, 113, 113, 0.16)' : 'rgba(220, 38, 38, 0.08)' }]}>
            <Ionicons name="cloud-offline-outline" size={26} color={isDark ? '#FCA5A5' : '#DC2626'} />
          </View>
          <Text style={[styles.title, { color: titleColor }]}>Preview unavailable</Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>Tap to open the image in your browser</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: PREVIEW_HEIGHT,
    width: '100%',
  },
  image: {
    width: '100%',
    height: PREVIEW_HEIGHT,
  },
  skeleton: {
    marginVertical: 0,
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  progress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    marginVertical: 0,
  },
});
