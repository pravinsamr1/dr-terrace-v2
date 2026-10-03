import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';
import { toNotificationItem } from '../utils/notificationMapper';

/**
 * Notifications API (API v2): push device tokens and the per-user inbox.
 *
 * Every call resolves with { success, ... } and never throws, so a server that is offline or does not have the
 * notification routes yet (HTTP 404) cannot break login or the home screen.
 */

const failure = (error, fallbackMessage) => {
  const status = error?.response?.status;
  return {
    success: false,
    status,
    // 404 = the backend has not been deployed with the notification module yet
    notAvailable: status === 404,
    message: error?.response?.data?.message || error?.message || fallbackMessage,
  };
};

export const notificationRepository = {
  /** POST /notifications/device-token. Safe to call on every app start; a token belongs to one user at a time. */
  registerDeviceToken: async (token, platform) => {
    try {
      await apiClient.post(API_ENDPOINTS.NOTIFICATION_DEVICE_TOKEN, { token, platform });
      return { success: true };
    } catch (error) {
      return failure(error, 'Could not register this device for notifications');
    }
  },

  /** DELETE /notifications/device-token (the caller's own token only). */
  unregisterDeviceToken: async (token) => {
    try {
      await apiClient.delete(API_ENDPOINTS.NOTIFICATION_DEVICE_TOKEN, { data: { token } });
      return { success: true };
    } catch (error) {
      return failure(error, 'Could not unregister this device');
    }
  },

  /** GET /notifications?page&limit -> items ready for the screens, plus unreadCount and total. */
  list: async ({ page = 1, limit = 50 } = {}) => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS, { params: { page, limit } });
      const body = response.data || {};
      const rows = Array.isArray(body.data) ? body.data : [];
      const now = Date.now();
      return {
        success: true,
        data: rows.map((row) => toNotificationItem(row, now)),
        unreadCount: Number(body.unreadCount) || 0,
        total: Number(body.total) || rows.length,
        page: Number(body.page) || page,
      };
    } catch (error) {
      return { ...failure(error, 'Could not load notifications'), data: [], unreadCount: 0, total: 0 };
    }
  },

  /** Only the number of unread notifications (for the bell badge). */
  getUnreadCount: async () => {
    const res = await notificationRepository.list({ page: 1, limit: 1 });
    return res.success ? res.unreadCount : 0;
  },

  /** PATCH /notifications/:id/read */
  markRead: async (id) => {
    try {
      await apiClient.patch(API_ENDPOINTS.NOTIFICATION_READ(id));
      return { success: true };
    } catch (error) {
      return failure(error, 'Could not mark the notification as read');
    }
  },

  /** POST /notifications/read-all */
  markAllRead: async () => {
    try {
      await apiClient.post(API_ENDPOINTS.NOTIFICATIONS_READ_ALL);
      return { success: true };
    } catch (error) {
      return failure(error, 'Could not mark all notifications as read');
    }
  },
};

export default notificationRepository;
