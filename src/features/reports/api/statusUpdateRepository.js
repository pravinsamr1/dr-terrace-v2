import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const UPLOAD_TIMEOUT_MS = 120000;

/** RFC 4122 v4 format. Only used so the server can recognise a repeated submit, not for security. */
export const createClientRequestId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });

export const statusUpdateRepository = {
  /** Options for the form: active user-selectable statuses plus Lost, as the API guide specifies */
  getStatusOptions: async () => {
    const data = unwrap(await apiClient.get(API_ENDPOINTS.QUOTATION_STATUSES, { params: { active: true } }));
    const statuses = Array.isArray(data) ? data : data?.items || [];
    return statuses.filter((status) => !status.isSystem || status.code === 'LOST');
  },

  getHistory: async (appointmentId, params = {}) => {
    const response = await apiClient.get(`${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}/status-updates`, { params });
    const data = unwrap(response);
    const items = Array.isArray(data) ? data : data?.items || [];
    return { items, totalItems: response?.data?.meta?.totalItems ?? data?.totalItems ?? items.length };
  },

  getDetail: async (appointmentId, updateId) =>
    unwrap(await apiClient.get(`${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}/status-updates/${updateId}`)),

  /** The caller keeps clientRequestId across retries, so a resend cannot add a second entry */
  create: async (appointmentId, { status, notes, nextFollowUpDate, quotationId, audio, clientRequestId }) => {
    const form = new FormData();
    form.append('status', status);
    form.append('clientRequestId', clientRequestId);
    if (notes) form.append('notes', notes);
    if (nextFollowUpDate) form.append('nextFollowUpDate', nextFollowUpDate);
    if (quotationId) form.append('quotationId', String(quotationId));
    if (audio) {
      form.append('audio', { uri: audio.uri, name: 'voice-note.m4a', type: 'audio/mp4' });
      form.append('audioDurationSec', String(audio.durationSec));
    }
    return unwrap(
      await apiClient.post(`${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}/status-updates`, form, {
        timeout: UPLOAD_TIMEOUT_MS,
      })
    );
  },
};
