import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * System Health Repository (API v2)
 * GET /health
 */
export const healthRepository = {
  check: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.HEALTH || '/health');
      return {
        success: true,
        data: response.data,
        status: response.data?.status || 'UP',
        database: response.data?.database || 'UP',
        uptime: response.data?.uptime || null,
      };
    } catch (error) {
      console.warn('[healthRepository] check health error:', error?.response?.data || error.message);
      return {
        success: false,
        status: 'DOWN',
        message: error.response?.data?.message || error.message || 'Health check failed',
      };
    }
  },
};

export default healthRepository;
