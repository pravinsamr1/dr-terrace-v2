import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Global Session Expiration Event Bus
 */
let sessionExpiredHandler = null;
let isNotifying = false;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export async function notifySessionExpired() {
  if (isNotifying) return;
  isNotifying = true;

  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      isNotifying = false;
      return;
    }

    if (typeof sessionExpiredHandler === 'function') {
      sessionExpiredHandler();
    } else {
      // Fallback: clear session and route to login
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
      router.replace('/login');
    }
  } catch (err) {
    console.error('[SessionEvents] Error in notifySessionExpired:', err);
  } finally {
    setTimeout(() => {
      isNotifying = false;
    }, 2500);
  }
}
