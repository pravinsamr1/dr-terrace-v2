import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ImageBackground, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { authRepository } from '../src/features/auth/api/authRepository';
import { useTabBar } from '../src/core/context/TabBarContext';

export default function SplashScreen() {
  const router = useRouter();
  const { setTabBarVisible } = useTabBar();

  // Hide the bottom navigation bar for the splash screen
  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  // Animation values for the two pulsing rings
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse 1 animation loop
    const anim1 = Animated.loop(
      Animated.timing(pulse1, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    // Pulse 2 animation loop
    const anim2 = Animated.loop(
      Animated.timing(pulse2, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    // Start pulse 1 immediately
    anim1.start();

    // Start pulse 2 with a delay for staggered effect
    const delayTimeout = setTimeout(() => {
      anim2.start();
    }, 750);

    // Redirect to login page (or tabs if logged in) after splash
    const redirectTimeout = setTimeout(async () => {
      try {
        const token = await authRepository.getToken();
        const user = await authRepository.getUser();
        if (token && user && !authRepository.isTokenExpired(token)) {
          router.replace('/(tabs)');
        } else {
          if (token && authRepository.isTokenExpired(token)) {
            await authRepository.logout();
          }
          router.replace('/login');
        }
      } catch (_e) {
        router.replace('/login');
      }
    }, 2000);

    return () => {
      anim1.stop();
      anim2.stop();
      clearTimeout(delayTimeout);
      clearTimeout(redirectTimeout);
    };
  }, [router, pulse1, pulse2]);

  // Scale and opacity interpolations
  // Scale goes from 1.0 (starting at the edge of the central white circle) up to 2.2
  // Opacity fades out from 0.6 down to 0
  const scale1 = pulse1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const opacity1 = pulse1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const scale2 = pulse2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const opacity2 = pulse2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <ImageBackground
      source={require('../assets/images/splash_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.logoWrapper}>
        {/* Pulsing Ring 1 */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: scale1 }],
              opacity: opacity1,
            },
          ]}
        />
        {/* Pulsing Ring 2 */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: scale2 }],
              opacity: opacity2,
            },
          ]}
        />

        {/* Central Circle with Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/nexa_logo_circle.png')}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBF4FA', // Fallback light blue color matching splash theme
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 200,
    height: 200,
  },
  logoContainer: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: {
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(180, 180, 180, 0.4)', // Translucent grey ring matching the design
    zIndex: 1,
  },
});
