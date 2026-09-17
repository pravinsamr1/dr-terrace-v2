import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Appointment Schedule Repository (API v2)
 * Handles schedule slots and site visit schedules under /appointment-schedules
 */
export const scheduleRepository = {
  /**
   * List appointment schedules with optional date filter
   * GET /appointment-schedules?date=YYYY-MM-DD
   */
  getSchedules: async (params = {}) => {
    try {
      const cleanParams = typeof params === 'string'
        ? { date: params }
        : (typeof params === 'object' && params !== null ? { ...params } : {});

      const response = await apiClient.get(
        API_ENDPOINTS.APPOINTMENT_SCHEDULES || '/appointment-schedules',
        { params: cleanParams }
      );
      const data = response.data;
      const list = Array.isArray(data)
        ? data
        : data?.data || data?.schedules || [];

      return {
        success: true,
        data: list,
        schedules: list,
      };
    } catch (error) {
      console.warn('[scheduleRepository] getSchedules error:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch appointment schedules',
        data: [],
        schedules: [],
      };
    }
  },

  /**
   * Book or update schedule slots
   * POST /appointment-schedules
   */
  createOrUpdateSchedule: async (scheduleData) => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.APPOINTMENT_SCHEDULES || '/appointment-schedules',
        scheduleData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Schedule created/updated successfully',
      };
    } catch (error) {
      console.warn('[scheduleRepository] createOrUpdateSchedule error:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to save appointment schedule',
      };
    }
  },

  /** Alias for createOrUpdateSchedule */
  createSchedule: async (scheduleData) => {
    return scheduleRepository.createOrUpdateSchedule(scheduleData);
  },

  /**
   * Update existing schedule slot by ID
   * PUT /appointment-schedules/:id
   */
  updateSchedule: async (id, scheduleData) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.put(
        `${API_ENDPOINTS.APPOINTMENT_SCHEDULES || '/appointment-schedules'}/${cleanId}`,
        scheduleData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Schedule updated successfully',
      };
    } catch (error) {
      console.warn(`[scheduleRepository] updateSchedule error for ${id}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update schedule',
      };
    }
  },

  /**
   * Delete an appointment schedule by ID
   * DELETE /appointment-schedules/:id
   */
  deleteSchedule: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.delete(
        `${API_ENDPOINTS.APPOINTMENT_SCHEDULES || '/appointment-schedules'}/${cleanId}`
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Schedule deleted successfully',
      };
    } catch (error) {
      console.warn(`[scheduleRepository] deleteSchedule error for ${id}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete schedule',
      };
    }
  },
};

export default scheduleRepository;
