import '../src/core/theme/initFonts';
import {
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import NetInfo from '@react-native-community/netinfo';
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { MD3LightTheme, PaperProvider, configureFonts } from 'react-native-paper';
import 'react-native-reanimated';

import { TabBarProvider } from '../src/core/context/TabBarContext';
import { ThemeCustomProvider } from '../src/core/hooks/useColorScheme';
import PersistentNavigation, { DrawerProvider } from '../src/shared/components/PersistentNavigation';
import { paperLightTheme } from '../src/shared/constants/theme';
import { authRepository } from '../src/features/auth/api/authRepository';
import { MaterialAlertModal } from '../src/shared/components/material';
import { setSessionExpiredHandler } from '../src/core/auth/sessionEvents';
import {
  setServerErrorHandler,
  retryPendingServerRequests,
  dismissPendingServerRequests,
} from '../src/core/api/serverErrorEvents';

// App always uses light theme — dark mode is removed
const AppLightTheme = {
  ...DefaultTheme,
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: 'bold',
    },
    heavy: {
      fontFamily: 'PlusJakartaSans_800ExtraBold',
      fontWeight: '800',
    },
  },
  colors: {
    ...DefaultTheme.colors,
    background: '#F4F8FC',
    card: '#FFFFFF',
    text: '#0F172A',
    border: '#E2E8F0',
    primary: '#0052CC',
  },
};

// ─── Global Typography Defaults ───────────────────────────────────────────────
// Applied after fonts are loaded in RootLayout.
// Individual screens can still override fontWeight / fontSize normally.

// Keep the native splash screen visible while loading assets
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

// ─── Global Network Banner ────────────────────────────────────────────────────
function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useRef(new Animated.Value(-56)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || state.isConnected === null;
      setIsOffline(offline);

      if (offline) {
        // Show banner immediately
        if (timerRef.current) clearTimeout(timerRef.current);
        setShowBanner(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      } else {
        // Back online — show a brief "Connected" state then hide
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
        timerRef.current = setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -56,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowBanner(false));
        }, 2000);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [slideAnim]);

  if (!showBanner) return null;

  return (
    <Animated.View
      style={[
        bannerStyles.banner,
        isOffline ? bannerStyles.offline : bannerStyles.online,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={bannerStyles.icon}>{isOffline ? '⚡' : '✓'}</Text>
      <Text style={bannerStyles.text}>
        {isOffline ? 'No internet connection' : 'Back online'}
      </Text>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 10,
    gap: 6,
  },
  offline: {
    backgroundColor: '#DC2626',
  },
  online: {
    backgroundColor: '#16A34A',
  },
  icon: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

function RootLayoutContent() {
  const [sessionExpiredVisible, setSessionExpiredVisible] = useState(false);
  const [serverErrorState, setServerErrorState] = useState({
    visible: false,
    title: '',
    message: '',
    isRetrying: false,
  });

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      const token = await authRepository.getToken();
      if (!token) return; // User already not logged in or on login screen
      setSessionExpiredVisible(true);
    });

    setServerErrorHandler((state) => {
      setServerErrorState((prev) => ({
        ...prev,
        ...state,
      }));
    });

    return () => {
      setSessionExpiredHandler(null);
      setServerErrorHandler(null);
    };
  }, []);

  const handleSessionExpiredConfirm = async () => {
    setSessionExpiredVisible(false);
    await authRepository.clearLocalSession();
    router.replace('/login');
  };

  const handleRetryServerError = async () => {
    await retryPendingServerRequests();
  };

  const handleDismissServerError = () => {
    dismissPendingServerRequests();
  };

  const activePaperTheme = {
    ...MD3LightTheme,
    fonts: configureFonts({ config: { fontFamily: 'PlusJakartaSans_400Regular' } }),
    colors: { ...MD3LightTheme.colors, ...paperLightTheme.colors },
  };

  return (
    <PaperProvider theme={activePaperTheme}>
      <ThemeProvider value={AppLightTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="all-appointments" options={{ headerShown: false }} />
          <Stack.Screen name="new-appointment" options={{ headerShown: false }} />
          <Stack.Screen name="edit-appointment" options={{ headerShown: false }} />
          <Stack.Screen name="reassign" options={{ headerShown: false }} />
          <Stack.Screen name="customer-detail" options={{ headerShown: false }} />
          <Stack.Screen name="clients" options={{ headerShown: false }} />
          <Stack.Screen name="payment-detail" options={{ headerShown: false }} />
          <Stack.Screen name="payment-form" options={{ headerShown: false }} />
          <Stack.Screen name="receipt" options={{ headerShown: false }} />
          <Stack.Screen name="employee-add" options={{ headerShown: false }} />
          <Stack.Screen name="employee-list" options={{ headerShown: false }} />
          <Stack.Screen name="employee-detail" options={{ headerShown: false }} />
          <Stack.Screen name="employee-edit" options={{ headerShown: false }} />
          <Stack.Screen name="attendance-leave" options={{ headerShown: false }} />
          <Stack.Screen name="salary-details" options={{ headerShown: false }} />
          <Stack.Screen name="salary-advance" options={{ headerShown: false }} />
          <Stack.Screen name="make-quotation" options={{ headerShown: false }} />
          <Stack.Screen name="edit-quotation" options={{ headerShown: false }} />
          <Stack.Screen name="quotation-history" options={{ headerShown: false }} />
          <Stack.Screen name="send-quotation" options={{ headerShown: false }} />
          <Stack.Screen name="send-quote" options={{ headerShown: false }} />
          <Stack.Screen name="outstanding" options={{ headerShown: false }} />
          <Stack.Screen name="warranty" options={{ headerShown: false }} />
          <Stack.Screen name="warranty-letter" options={{ headerShown: false }} />
          <Stack.Screen name="policy" options={{ headerShown: false }} />
          <Stack.Screen name="terms" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="notification-detail" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>

        {/* Persistent tab bar + drawer rendered above every stack screen */}
        <PersistentNavigation />

        {/* Global offline/online indicator — overlays every screen */}
        <NetworkBanner />

        {/* Global Session Expired Warning Modal */}
        <MaterialAlertModal
          visible={sessionExpiredVisible}
          title="Session Expired"
          message="Your login session has expired. Please log in again to continue."
          type="warning"
          buttonText="Log In Again"
          onClose={handleSessionExpiredConfirm}
          onConfirm={handleSessionExpiredConfirm}
          onDismiss={handleSessionExpiredConfirm}
        />

        {/* Global Server Error (502 / Bad Gateway) Retry Modal */}
        <MaterialAlertModal
          visible={serverErrorState.visible}
          title={serverErrorState.title || 'Server Error (502)'}
          message={
            serverErrorState.message ||
            'The server is temporarily unavailable (502 Bad Gateway). Please tap Try Again to reconnect.'
          }
          type="error"
          icon="cloud-offline-outline"
          buttonText="Try Again"
          secondaryButtonText="Dismiss"
          isLoading={serverErrorState.isRetrying}
          onConfirm={handleRetryServerError}
          onSecondaryAction={handleDismissServerError}
          onClose={handleDismissServerError}
          onDismiss={handleDismissServerError}
        />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Apply Plus Jakarta Sans as the global font for ALL Text & TextInput
      // For Android, we disable includeFontPadding to fix vertical clipping and alignment.
      const globalFont = 'PlusJakartaSans_400Regular';
      const defaultTextStyle = {
        fontFamily: globalFont,
        letterSpacing: 0,
        ...Platform.select({
          android: {
            includeFontPadding: false,
            textAlignVertical: 'center',
          },
        }),
      };

      if (!Text.defaultProps) Text.defaultProps = {};
      Text.defaultProps.style = [defaultTextStyle, Text.defaultProps.style];

      if (!TextInput.defaultProps) TextInput.defaultProps = {};
      TextInput.defaultProps.style = [defaultTextStyle, TextInput.defaultProps.style];

      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);


  useEffect(() => {
    // Track AppState and validate token when app comes back to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevAppState = appState.current;
      appState.current = nextAppState;

      if (
        prevAppState &&
        prevAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        authRepository.checkSessionValidity();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);


  if (!fontsLoaded) return null;

  return (
    <ThemeCustomProvider>
      <TabBarProvider>
        <DrawerProvider>
          <RootLayoutContent />
        </DrawerProvider>
      </TabBarProvider>
    </ThemeCustomProvider>
  );
}
