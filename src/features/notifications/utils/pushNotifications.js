import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getNotificationTarget } from './notificationMapper';

/**
 * Push notifications (Firebase Cloud Messaging through Expo's push service).
 *
 * Android: needs google-services.json (app.json -> android.googleServicesFile) in the build, and an FCM V1
 * service account key uploaded to Expo (eas credentials) so Expo can deliver to Firebase.
 *
 * Remote push does not work in Expo Go (Android, SDK 53+), so the module is not even loaded there.
 * Everything here quietly does nothing in Expo Go and on emulators.
 */

export const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';
export const ANDROID_CHANNEL_ID = 'default';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Loaded lazily so Expo Go never evaluates expo-notifications
const Notifications = isExpoGo ? null : require('expo-notifications');

if (Notifications) {
  // Show notifications that arrive while the app is open
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const getNotificationsModule = () => Notifications;

/**
 * Asks for permission, prepares the Android channel and returns this phone's Expo push token.
 * Never throws: on any problem it returns { token: null, reason }.
 */
export async function registerForPushNotificationsAsync() {
  if (!Notifications) {
    return { token: null, reason: 'Push notifications need a development or release build, not Expo Go.' };
  }
  if (!Device.isDevice) {
    return { token: null, reason: 'Push notifications need a real phone, not an emulator.' };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0052CC',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
      return { token: null, reason: 'Notification permission was not granted.' };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { token: null, reason: 'The EAS project id is missing from app.json.' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return { token };
  } catch (error) {
    return { token: null, reason: error?.message || 'Could not get a push token.' };
  }
}

/** The push token saved on this phone by the last successful registration, or null. */
export async function getStoredPushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (_e) {
    return null;
  }
}

export { getNotificationTarget };

/**
 * Calls `onReceived(notification)` whenever a push arrives while the app is open (so lists and badges can refresh).
 * Returns an unsubscribe function; does nothing in Expo Go.
 */
export function subscribeToIncomingNotifications(onReceived) {
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationReceivedListener(onReceived);
  return () => subscription.remove();
}

/** Forgets the token saved on this phone (used on logout). */
export async function clearStoredPushToken() {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (_e) {
    // nothing to clear
  }
}
