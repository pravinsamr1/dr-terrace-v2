import { notificationRepository } from '../api/notificationRepository';
import { clearStoredPushToken, getStoredPushToken } from './pushNotifications';

const UNREGISTER_TIMEOUT_MS = 4000;

/**
 * Stops pushes for this phone on logout: removes its token from the backend (so the next person to log in is not
 * notified about this user's work) and forgets it locally. Must run BEFORE the login token is cleared, because the
 * backend call needs it. Never throws and never makes logout wait more than a few seconds.
 */
export async function unregisterPushDevice() {
  try {
    const token = await getStoredPushToken();
    if (!token) return;
    await Promise.race([
      notificationRepository.unregisterDeviceToken(token),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
    ]);
    await clearStoredPushToken();
  } catch (_e) {
    // logout must always succeed
  }
}
