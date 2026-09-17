import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';

/**
 * Support & Contact Information Repository
 * Handles fetching dynamic company contact info (mobile, landline, email, address) from the backend API.
 */
export const supportRepository = {
  getContactInfo: async () => {
    try {
      const endpointsToTry = [
        API_ENDPOINTS.CONTACT_INFO || '/contact-info',
        '/contact-information',
        '/contact',
      ];

      let responseData = null;

      for (const endpoint of endpointsToTry) {
        try {
          const res = await apiClient.get(endpoint);
          if (res && res.data) {
            responseData = res.data;
            break;
          }
        } catch (_err) {
          // try next fallback endpoint if available
        }
      }

      if (!responseData) {
        return {
          success: false,
          data: null,
          message: 'Unable to load contact information from server.',
        };
      }

      let payload = responseData;
      if (payload && payload.data) {
        payload = payload.data;
      }
      if (Array.isArray(payload)) {
        payload = payload[0] || null;
      }

      if (!payload) {
        return {
          success: false,
          data: null,
          message: 'No contact information record returned from server.',
        };
      }

      const normalizedData = {
        id: payload.id || null,
        mobileNumber: payload.mobileNumber || payload.mobile || payload.phone || payload.contactNumber || '',
        landlineNumber: payload.landlineNumber || payload.landline || payload.officePhone || payload.telephone || '',
        emailAddress: payload.emailAddress || payload.email || payload.mail || '',
        officeAddress: payload.officeAddress || payload.address || '',
      };

      return {
        success: true,
        data: normalizedData,
      };
    } catch (err) {
      console.warn('supportRepository.getContactInfo error:', err.message);
      return {
        success: false,
        data: null,
        message: err.message || 'Failed to fetch contact details.',
      };
    }
  },

  /**
   * Update Office Contact Info (Admin only)
   * PUT /contact-info
   */
  updateContactInfo: async (contactData) => {
    try {
      const response = await apiClient.put(
        API_ENDPOINTS.CONTACT_INFO || '/contact-info',
        contactData
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Contact info updated successfully',
      };
    } catch (err) {
      console.warn('supportRepository.updateContactInfo error:', err?.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to update contact info',
      };
    }
  },
};

export default supportRepository;

