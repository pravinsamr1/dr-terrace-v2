import { formatDateDDMMYY } from '../../../core/utils/dateFormat';

/**
 * Pure helpers for the notifications feature (no React Native / Expo imports, so they are easy to test).
 *
 * Backend contract (dr.terrace-backend, /api/v2/notifications):
 *   inbox item: { id, type, title, body, data, isRead, readAt, createdAt }
 *   type is one of appointment_assigned | payment_pending_verification | payment_verified | warranty_generated |
 *   warranty_verified
 *   data holds ids only: { appointmentId }, { quotationId, paymentId } or { quotationId, appointmentId }
 *   a push message carries the same ids in its data, plus { type }
 */

export const NOTIFICATION_TYPES = {
  APPOINTMENT_ASSIGNED: 'appointment_assigned',
  PAYMENT_PENDING: 'payment_pending_verification',
  PAYMENT_VERIFIED: 'payment_verified',
  WARRANTY_GENERATED: 'warranty_generated',
  WARRANTY_VERIFIED: 'warranty_verified',
};

const ICON_BY_TYPE = {
  [NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED]: 'calendar',
  [NOTIFICATION_TYPES.PAYMENT_PENDING]: 'alert',
  [NOTIFICATION_TYPES.PAYMENT_VERIFIED]: 'checkmark-circle',
  [NOTIFICATION_TYPES.WARRANTY_GENERATED]: 'shield-checkmark',
  [NOTIFICATION_TYPES.WARRANTY_VERIFIED]: 'shield-checkmark',
};

/** "just now", "5m ago", "3h ago", "2d ago", otherwise the date as DD-MM-YY. */
export function formatTimeAgo(dateInput, now = Date.now()) {
  const then = new Date(dateInput).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateDDMMYY(new Date(then));
}

/** Converts one backend inbox row into what the notification screens draw. */
export function toNotificationItem(raw, now = Date.now()) {
  const rawType = String(raw?.type || '');
  const isActionRequest = rawType === NOTIFICATION_TYPES.PAYMENT_PENDING;
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : {};
  return {
    id: String(raw?.id ?? ''),
    rawType,
    // "admin" = things an admin has to act on; everything else is personal to this user
    type: isActionRequest ? 'admin' : 'specific',
    isActionRequest,
    icon: ICON_BY_TYPE[rawType] || 'information-circle',
    title: String(raw?.title || 'Notification'),
    message: String(raw?.body || ''),
    time: formatTimeAgo(raw?.createdAt, now),
    createdAt: raw?.createdAt || null,
    read: Boolean(raw?.isRead),
    data,
    quotationId: data.quotationId ?? null,
    paymentId: data.paymentId ?? null,
    appointmentId: data.appointmentId ?? null,
  };
}

/**
 * Where tapping a notification should go. Accepts the `data` of a push message or of an inbox row.
 *  1. data.route (an in-app path such as "/customer-detail") with optional data.params wins
 *  2. otherwise the backend's type + ids decide
 *  3. otherwise the notifications screen
 * Only in-app paths are accepted; links to anywhere else are ignored.
 */
export function getNotificationTarget(data) {
  const route = typeof data?.route === 'string' ? data.route.trim() : '';
  if (route.startsWith('/') && !route.startsWith('//')) {
    const params = data?.params && typeof data.params === 'object' ? data.params : undefined;
    return { pathname: route, params };
  }

  const type = String(data?.type || '');
  const quotationId = data?.quotationId;
  const paymentId = data?.paymentId;
  const appointmentId = data?.appointmentId;
  const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';

  if (type === NOTIFICATION_TYPES.APPOINTMENT_ASSIGNED && has(appointmentId)) {
    return { pathname: '/customer-detail', params: { id: String(appointmentId) } };
  }
  if (
    (type === NOTIFICATION_TYPES.PAYMENT_PENDING || type === NOTIFICATION_TYPES.PAYMENT_VERIFIED) &&
    has(quotationId) &&
    has(paymentId)
  ) {
    return {
      pathname: '/payment-verification',
      params: {
        quotationId: String(quotationId),
        paymentId: String(paymentId),
        ...(has(appointmentId) ? { appointmentId: String(appointmentId), id: String(appointmentId) } : {}),
      },
    };
  }
  if (
    (type === NOTIFICATION_TYPES.WARRANTY_GENERATED || type === NOTIFICATION_TYPES.WARRANTY_VERIFIED) &&
    has(appointmentId)
  ) {
    return { pathname: '/customer-detail', params: { id: String(appointmentId), initialTab: 'warranty' } };
  }
  return { pathname: '/notifications' };
}
