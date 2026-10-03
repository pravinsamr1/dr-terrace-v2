import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { notificationRepository } from '../api/notificationRepository';
import {
  getNotificationTarget,
  getNotificationsModule,
  registerForPushNotificationsAsync,
} from '../utils/pushNotifications';

// Notifications already acted on, so a tap is never handled twice (listener + cold-start check)
const handledNotificationIds = new Set();

/**
 * Registers this phone for push notifications and opens the right screen when a notification is tapped.
 * Mount it once for logged-in users (see app/(tabs)/_layout.jsx).
 */
export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return undefined;

    let cancelled = false;

    registerForPushNotificationsAsync().then(async ({ token, reason }) => {
      if (cancelled) return;
      if (!token) {
        if (__DEV__) console.warn('[Push] not registered:', reason);
        return;
      }
      if (__DEV__) console.log('[Push] Expo push token:', token);

      // Tell the backend which phone belongs to this user. Done on every start: a token follows whoever logged in last.
      const res = await notificationRepository.registerDeviceToken(token, Platform.OS);
      if (!res.success && __DEV__) {
        console.warn(
          res.notAvailable
            ? '[Push] The server has no notification routes yet (deploy the backend and run migration 006).'
            : `[Push] Could not save the token on the server: ${res.message}`
        );
      }
    });

    const openFromResponse = (response) => {
      const id = response?.notification?.request?.identifier;
      if (!id || handledNotificationIds.has(id)) return;
      handledNotificationIds.add(id);
      router.push(getNotificationTarget(response.notification.request.content.data));
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);

    // The app was closed and opened by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled && response) openFromResponse(response);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [router]);
}
