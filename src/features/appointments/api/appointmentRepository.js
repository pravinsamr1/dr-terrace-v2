import { apiClient } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';
import { toApiDateString } from '../../../core/utils/dateFormat';

const WATERPROOF_NAME_MAP = {
  1: 'Terrace Waterproofing',
  2: 'Balcony Proofing',
  3: 'Bathroom Proofing',
  4: 'Terrace',
  8: 'Outer Wall Proofing',
  12: 'Bathroom Proofing',
  16: 'Sump Proofing',
};

/**
 * Appointment Repository for handling Appointment CRUD API calls
 */
export const appointmentRepository = {
  /**
   * Normalize an appointment item from backend API response
   */
  normalizeAppointment: (app, index = 0) => {
    if (!app) return null;
    const id = app.id || app._id || index + 1;
    const clientName = (app.customerName || app.clientName || app.name || '').trim();
    const phone = app.mobileNumber || app.phone || app.mobile || app.clientPhone || '';

    // Address breakdown extraction
    const addrObj = app.address && typeof app.address === 'object' ? app.address : {};
    const doorNo = app.doorNo || addrObj.doorNo || '';
    const streetName = app.streetName || app.street || addrObj.streetName || addrObj.street || '';
    const area = app.area || app.location || addrObj.area || addrObj.location || '';
    const city = app.city || addrObj.city || '';
    const state = app.state || addrObj.state || '';
    const pincode = app.pincode || addrObj.pincode || '';

    const fullAddress = typeof app.address === 'string' && app.address
      ? app.address
      : [doorNo, streetName, area, city, pincode].filter(Boolean).join(', ') || area || city || '';

    const date = app.appointmentDate || app.date || app.appointment_date || app.fixDate || '';
    const fixDate = app.appointmentFixDate || app.fixDate || app.fix_date || date;
    const time = app.appointmentTime || app.time || app.appointment_time || '';
    const status = app.status || '';
    const assignedTo = (app.assignedTo || app.assignedTechnician || app.technician || app.employeeName || '').trim();

    const rawWaterproofList = app.whereToWaterproofIds || app.whereToWaterproof;
    const normalizedWaterproofIds = Array.isArray(rawWaterproofList)
      ? rawWaterproofList
          .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
          .filter((n) => !isNaN(n) && n > 0)
      : [];

    let serviceType = 'Waterproofing';
    if (Array.isArray(app.whereToWaterproof) && app.whereToWaterproof.length > 0) {
      serviceType = app.whereToWaterproof.map((w) => {
        if (typeof w === 'object' && w !== null) {
          return w.name || WATERPROOF_NAME_MAP[w.id] || `Service #${w.id}`;
        }
        return WATERPROOF_NAME_MAP[w] || `Service #${w}`;
      }).join(', ');
    } else if (Array.isArray(app.serviceType)) {
      serviceType = app.serviceType.join(', ');
    } else if (Array.isArray(app.services)) {
      serviceType = app.services.join(', ');
    } else if (typeof app.serviceType === 'string' && app.serviceType) {
      serviceType = app.serviceType;
    } else if (typeof app.services === 'string' && app.services) {
      serviceType = app.services;
    }

    const assignedEmployeeId = app.assignedEmployeeId || app.employeeId || app.technicianId || null;

    return {
      ...app,
      id,
      _id: app._id || id,
      clientName,
      customerName: clientName,
      name: clientName,
      phone,
      mobile: phone,
      mobileNumber: phone,
      clientPhone: phone,
      assignedEmployeeId,
      whereToWaterproof: normalizedWaterproofIds.length > 0 ? normalizedWaterproofIds : (Array.isArray(app.whereToWaterproof) ? app.whereToWaterproof : []),
      whereToWaterproofIds: normalizedWaterproofIds,
      addressBreakdown: {
        doorNo,
        street: streetName,
        streetName,
        area,
        city,
        state,
        pincode,
      },
      location: [area, city].filter(Boolean).join(', ') || area || city || '',
      area,
      city,
      doorNo,
      streetName,
      street: streetName,
      state,
      pincode,
      address: fullAddress,
      googleLocation: app.googleLocation || '',
      date,
      appointmentDate: date,
      fixDate,
      appointmentFixDate: fixDate,
      time,
      appointmentTime: time,
      status,
      serviceType,
      assignedTo: assignedTo || app.employeeName || 'Unassigned',
      employeeName: app.employeeName || assignedTo || '',
      propertyName: app.propertyName || (app.property && app.property.name) || '',
      property: app.property || (app.propertyName ? { id: app.propertyId, name: app.propertyName } : null),
      quotations: Array.isArray(app.quotations) ? app.quotations : [],
    };
  },

  /**
   * Fetch home view appointments (upcoming and missed)
   * GET /home-view (or alias /hove-view)
   * Query params: { date, appointmentDate, employeeId }
   */
  getHomeView: async (params = {}) => {
    try {
      const cleanParams = {};
      if (params.targetDate) cleanParams.targetDate = params.targetDate;
      if (params.date) cleanParams.date = params.date;
      if (params.appointmentDate) cleanParams.appointmentDate = params.appointmentDate;
      if (params.employeeId) cleanParams.employeeId = params.employeeId;

      let response;
      const endpoint = API_ENDPOINTS.HOME_VIEW || '/home-view';
      try {
        response = await apiClient.get(endpoint, { params: cleanParams });
      } catch (err) {
        if (err?.response?.status === 404) {
          try {
            response = await apiClient.get(API_ENDPOINTS.HOVE_VIEW || '/hove-view', { params: cleanParams });
          } catch (err2) {
            if (err2?.response?.status === 404 || err2?.response?.status === 403) {
              response = await apiClient.get('/api/v1/home-view', { params: cleanParams });
            } else {
              throw err2;
            }
          }
        } else {
          throw err;
        }
      }

      const raw = response?.data || {};
      const payload = raw.data && (raw.data.upcoming || raw.data.missed) ? raw.data : raw;

      const rawUpcoming = Array.isArray(payload.upcoming)
        ? payload.upcoming
        : Array.isArray(payload.data?.upcoming)
        ? payload.data.upcoming
        : [];

      const rawMissed = Array.isArray(payload.missed)
        ? payload.missed
        : Array.isArray(payload.data?.missed)
        ? payload.data.missed
        : [];

      const upcoming = rawUpcoming.map((item, index) => appointmentRepository.normalizeAppointment(item, index));
      const missed = rawMissed.map((item, index) => appointmentRepository.normalizeAppointment(item, index));

      return {
        success: true,
        upcoming,
        missed,
      };
    } catch (error) {
      console.warn('[appointmentRepository] getHomeView error:', error?.response?.data || error?.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch home view appointments',
        upcoming: [],
        missed: [],
      };
    }
  },

  /**
   * Fetch all appointments from API with pagination & filters
   * GET /appointments?page=1&limit=20&search=...&area=...&city=...&name=...&phone=...
   */
  getAppointments: async (page = 1, limit = 20, filters = {}) => {
    try {
      const cleanParams = { page, limit };
      if (typeof filters === 'object' && filters !== null) {
        Object.keys(filters).forEach((key) => {
          if (filters[key] !== undefined && filters[key] !== null && String(filters[key]).trim() !== '') {
            cleanParams[key] = typeof filters[key] === 'string' ? filters[key].trim() : filters[key];
          }
        });
      }

      let response;
      const endpoint = API_ENDPOINTS.APPOINTMENTS || API_ENDPOINTS.NEW_APPOINTMENTS;
      try {
        response = await apiClient.get(endpoint, {
          params: cleanParams,
        });
      } catch (err) {
        if (err?.response?.status === 404 && API_ENDPOINTS.NEW_APPOINTMENTS && endpoint !== API_ENDPOINTS.NEW_APPOINTMENTS) {
          response = await apiClient.get(API_ENDPOINTS.NEW_APPOINTMENTS, {
            params: cleanParams,
          });
        } else {
          throw err;
        }
      }

      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : data?.appointments || data?.data || data?.result || data?.items || [];

      const list = rawList.map((app, index) => appointmentRepository.normalizeAppointment(app, index));

      const currentPage = Number(data?.page) || page;
      const totalPages = Number(data?.totalPages) || (list.length >= limit ? currentPage + 1 : 1);
      const totalItems = Number(data?.totalItems) || (data?.totalCount != null ? Number(data?.totalCount) : list.length);

      return {
        success: true,
        data: list,
        appointments: list,
        page: currentPage,
        limit: Number(data?.limit) || limit,
        totalItems,
        totalPages,
        hasMore: currentPage < totalPages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch appointments',
        data: [],
        appointments: [],
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 1,
        hasMore: false,
      };
    }
  },

  /**
   * Search appointments by area, city, name, phone, or unified keyword
   */
  searchAppointments: async (filters = {}, page = 1, limit = 50) => {
    const searchFilters = {};
    if (filters.area) searchFilters.area = filters.area;
    if (filters.city) searchFilters.city = filters.city;
    if (filters.clientName || filters.name) searchFilters.name = filters.clientName || filters.name;
    if (filters.phoneNumber || filters.phone || filters.mobileNumber) {
      searchFilters.phone = filters.phoneNumber || filters.phone || filters.mobileNumber;
    }
    if (filters.search) searchFilters.search = filters.search;
    if (filters.appointmentId || filters.id) searchFilters.appointmentId = filters.appointmentId || filters.id;

    return appointmentRepository.getAppointments(page, limit, searchFilters);
  },

  /**
   * Fetch single appointment by ID
   * GET /new-appointments/:id
   */
  getAppointmentById: async (id) => {
    try {
      const response = await apiClient.get(`${API_ENDPOINTS.NEW_APPOINTMENTS}/${id}`);
      const data = response.data;
      const rawApp = data?.appointment || data?.data || data;

      return {
        success: true,
        appointment: appointmentRepository.normalizeAppointment(rawApp),
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch appointment details',
      };
    }
  },

  /**
   * Create a new appointment
   * POST /new-appointments
   */
  addAppointment: async (appointmentData) => {
    try {
      const clientName = String(appointmentData.clientName || appointmentData.customerName || appointmentData.name || '').trim();
      const prefix = appointmentData.prefix || appointmentData.title || appointmentData.customerTitle || appointmentData.salutation || '';
      const payload = {
        clientName,
        customerName: clientName,
        ...(prefix ? { prefix, title: prefix, salutation: prefix } : {}),
        mobileNumber: String(appointmentData.mobileNumber || appointmentData.phone || appointmentData.mobile || '').replace(/[^0-9]/g, ''),
        address: typeof appointmentData.address === 'object' && appointmentData.address !== null
          ? {
            doorNo: String(appointmentData.address.doorNo || appointmentData.doorNo || '').trim(),
            streetName: String(appointmentData.address.streetName || appointmentData.address.street || appointmentData.streetName || '').trim(),
            area: String(appointmentData.address.area || appointmentData.area || appointmentData.location || '').trim(),
            city: String(appointmentData.address.city || appointmentData.city || '').trim(),
            state: String(appointmentData.address.state || appointmentData.state || '').trim(),
            pincode: String(appointmentData.address.pincode || appointmentData.pincode || '').trim(),
          }
          : {
            doorNo: String(appointmentData.doorNo || '').trim(),
            streetName: String(appointmentData.streetName || appointmentData.street || '').trim(),
            area: String(appointmentData.area || appointmentData.location || '').trim(),
            city: String(appointmentData.city || '').trim(),
            state: String(appointmentData.state || '').trim(),
            pincode: String(appointmentData.pincode || '').trim(),
          },
        googleLocation: appointmentData.googleLocation || '',
        appointmentDate: appointmentData.appointmentDate || appointmentData.date || '',
        appointmentFixDate: appointmentData.appointmentFixDate || appointmentData.fixDate || appointmentData.appointmentDate || appointmentData.date || '',
        appointmentTime: appointmentData.appointmentTime || appointmentData.time || '',
        whereToWaterproof: (() => {
          const raw = Array.isArray(appointmentData.whereToWaterproof) && appointmentData.whereToWaterproof.length > 0
            ? appointmentData.whereToWaterproof
            : appointmentData.whereToWaterproofIds;
          if (Array.isArray(raw)) {
            const ids = raw
              .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
              .filter((n) => !isNaN(n) && n > 0);
            if (ids.length > 0) return ids;
          }
          return [1];
        })(),
        propertyId: appointmentData.propertyId != null ? Number(appointmentData.propertyId) : null,
        assignedEmployeeId: Number(appointmentData.assignedEmployeeId || appointmentData.employeeId || appointmentData.technicianId) || null,
      };

      console.log('Posting new appointment payload:', JSON.stringify(payload));
      const response = await apiClient.post(API_ENDPOINTS.NEW_APPOINTMENTS, payload);
      const data = response.data;
      return {
        success: true,
        data,
        appointment: appointmentRepository.normalizeAppointment(data?.appointment || data?.data || data || payload),
      };
    } catch (error) {
      console.log('Failed to create appointment error:', error?.response?.data || error?.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to create appointment',
      };
    }
  },

  /**
   * Update an existing appointment
   * PUT /new-appointments/:id
   */
  updateAppointment: async (id, updatedFields) => {
    try {
      const hasCoreAppointmentFields = Boolean(
        updatedFields.clientName ||
        updatedFields.customerName ||
        updatedFields.name ||
        updatedFields.mobileNumber ||
        updatedFields.phone ||
        updatedFields.mobile ||
        updatedFields.address ||
        updatedFields.doorNo ||
        updatedFields.streetName ||
        updatedFields.area ||
        updatedFields.city ||
        updatedFields.appointmentDate ||
        updatedFields.date ||
        updatedFields.appointmentTime ||
        updatedFields.time ||
        updatedFields.whereToWaterproof ||
        updatedFields.assignedEmployeeId ||
        updatedFields.employeeId
      );

      // If the update only contains non-appointment fields (e.g. payment/receipt/warranty metadata),
      // do not send an empty PUT request to /api/v2/appointments/:id which corrupts data and fails on PostgreSQL constraints.
      if (!hasCoreAppointmentFields) {
        return {
          success: true,
          data: { id, ...updatedFields },
          appointment: appointmentRepository.normalizeAppointment({ id, ...updatedFields }),
        };
      }

      // If core fields are present, fetch existing appointment if any fields are missing to prevent overwriting with blanks
      let existingAppt = null;
      if (!updatedFields.clientName || !updatedFields.mobileNumber || !updatedFields.appointmentDate || !updatedFields.address) {
        try {
          const getRes = await appointmentRepository.getAppointmentById(id);
          existingAppt = getRes?.appointment || getRes?.data || null;
        } catch (_err) {
          // ignore
        }
      }

      const clientName = String(
        updatedFields.clientName ||
        updatedFields.customerName ||
        updatedFields.name ||
        existingAppt?.clientName ||
        existingAppt?.customerName ||
        existingAppt?.name ||
        ''
      ).trim();

      const mobileNumber = String(
        updatedFields.mobileNumber ||
        updatedFields.phone ||
        updatedFields.mobile ||
        existingAppt?.mobileNumber ||
        existingAppt?.phone ||
        ''
      ).replace(/[^0-9]/g, '');

      const addressSource = typeof updatedFields.address === 'object' && updatedFields.address !== null
        ? updatedFields.address
        : (typeof existingAppt?.address === 'object' && existingAppt?.address !== null ? existingAppt.address : {});

      const doorNo = String(updatedFields.doorNo || addressSource.doorNo || existingAppt?.doorNo || '').trim();
      const streetName = String(updatedFields.streetName || updatedFields.street || addressSource.streetName || addressSource.street || existingAppt?.streetName || '').trim();
      const area = String(updatedFields.area || updatedFields.location || addressSource.area || addressSource.location || existingAppt?.area || '').trim();
      const city = String(updatedFields.city || addressSource.city || existingAppt?.city || '').trim();
      const state = String(updatedFields.state || addressSource.state || existingAppt?.state || '').trim();
      const pincode = String(updatedFields.pincode || addressSource.pincode || existingAppt?.pincode || '').trim();

      const appointmentDate = updatedFields.appointmentDate || updatedFields.date || existingAppt?.appointmentDate || existingAppt?.date || '';
      const appointmentFixDate = updatedFields.appointmentFixDate || updatedFields.fixDate || appointmentDate;
      const appointmentTime = updatedFields.appointmentTime || updatedFields.time || existingAppt?.appointmentTime || existingAppt?.time || '10:00';

      const payload = {
        clientName,
        customerName: clientName,
        mobileNumber,
        doorNo,
        streetName,
        area,
        city,
        state,
        pincode,
        address: {
          doorNo,
          streetName,
          area,
          city,
          state,
          pincode,
        },
        googleLocation: updatedFields.googleLocation || existingAppt?.googleLocation || '',
        appointmentDate,
        appointmentFixDate,
        appointmentTime: appointmentTime.slice(0, 5), // Ensure max 5 chars for VARCHAR(5) like "14:00"
        whereToWaterproof: (() => {
          const raw = Array.isArray(updatedFields.whereToWaterproof) && updatedFields.whereToWaterproof.length > 0
            ? updatedFields.whereToWaterproof
            : (Array.isArray(existingAppt?.whereToWaterproof) && existingAppt.whereToWaterproof.length > 0
              ? existingAppt.whereToWaterproof
              : updatedFields.whereToWaterproofIds);
          if (Array.isArray(raw)) {
            const ids = raw
              .map((item) => (typeof item === 'object' && item !== null ? Number(item.id) : Number(item)))
              .filter((n) => !isNaN(n) && n > 0);
            if (ids.length > 0) return ids;
          }
          return [1];
        })(),
        propertyId: updatedFields.propertyId != null ? Number(updatedFields.propertyId) : (existingAppt?.propertyId != null ? Number(existingAppt.propertyId) : null),
        assignedEmployeeId: Number(updatedFields.assignedEmployeeId || updatedFields.employeeId || updatedFields.technicianId || existingAppt?.assignedEmployeeId || existingAppt?.employeeId) || null,
      };

      console.log(`PUT updating appointment ${id} payload:`, JSON.stringify(payload));
      const response = await apiClient.put(`${API_ENDPOINTS.NEW_APPOINTMENTS}/${id}`, payload);
      const data = response.data;
      return {
        success: true,
        data,
        appointment: appointmentRepository.normalizeAppointment(data?.appointment || data?.data || data || { id, ...payload }),
      };
    } catch (error) {
      console.log(`Failed to update appointment ${id} error:`, error?.response?.data || error?.message);
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update appointment',
      };
    }
  },

  /**
   * Create an appointment schedule / site visit attendance record
   * POST /appointment-schedules
   */
  createAppointmentSchedule: async (scheduleData) => {
    try {
      const payload = {
        appointmentId: Number(scheduleData.appointmentId || scheduleData.id),
        attendedDate: scheduleData.attendedDate || scheduleData.date || '',
        attendedTime: scheduleData.attendedTime || scheduleData.time || '',
        status: scheduleData.status || 'Site Visited',
        ...(scheduleData.totalArea ? { totalArea: Number(scheduleData.totalArea) } : {}),
      };
      console.log('Posting appointment schedule payload:', JSON.stringify(payload));
      const response = await apiClient.post('/appointment-schedules', payload);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.log('Failed to create appointment schedule:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to create appointment schedule',
      };
    }
  },

  /**
   * Helper to convert date to ISO YYYY-MM-DD format for API v2
   */
  toApiDate: (dateVal) => {
    if (!dateVal) return '';
    return toApiDateString(dateVal);
  },

  /**
   * Helper to convert time to 24-hour HH:mm format for API v2
   */
  toApiTime: (timeVal) => {
    if (!timeVal) return '';
    if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
      const hours = String(timeVal.getHours()).padStart(2, '0');
      const minutes = String(timeVal.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    const str = String(timeVal).trim();
    // If already 24-hour format HH:mm
    if (/^\d{1,2}:\d{2}$/.test(str)) {
      const [h, m] = str.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    // 12-hour format with AM/PM e.g. "03:25 PM"
    const match = str.match(/(\d+):(\d+)(?::\d+)?\s*(am|pm)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2].padStart(2, '0');
      const ampm = match[3] ? match[3].toLowerCase() : null;
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return str;
  },

  /**
   * API v2: Site visit check-in (Attendance)
   * Canonical v2 endpoint: POST /api/v2/appointments/:id/checkin
   * Body: { date: "YYYY-MM-DD", time: "HH:mm" }
   */
  checkIn: async (appointmentId, timeData = {}) => {
    const cleanId = String(appointmentId).replace(/\D/g, '') || appointmentId;
    const rawDate = timeData.date || timeData.attendedDate || '';
    const rawTime = timeData.time || timeData.attendedTime || '';

    const apiDate = appointmentRepository.toApiDate(rawDate);
    const apiTime = appointmentRepository.toApiTime(rawTime);

    const payload = {};
    if (apiDate || rawDate) payload.date = apiDate || rawDate;
    if (apiTime || rawTime) payload.time = apiTime || rawTime;

    // Resolve employeeId (required when recording check-in as admin)
    let empId = timeData.employeeId ?? timeData.assignedEmployeeId ?? timeData.technicianId;
    if (empId == null || isNaN(Number(empId)) || Number(empId) <= 0) {
      try {
        const appRes = await apiClient.get(`${API_ENDPOINTS.APPOINTMENTS}/${cleanId}`);
        const appData = appRes.data?.data || appRes.data?.appointment || appRes.data;
        empId = appData?.assignedEmployeeId ?? appData?.employeeId ?? appData?.technicianId;
      } catch (_e) {
        // Ignore fallback fetch error
      }
    }

    if (empId != null && !isNaN(Number(empId)) && Number(empId) > 0) {
      payload.employeeId = Number(empId);
    } else {
      payload.employeeId = 102; // Default active field technician ID per API v2
    }

    console.log(`[API v2] POST /appointments/${cleanId}/checkin:`, JSON.stringify(payload));

    try {
      const response = await apiClient.post(
        `${API_ENDPOINTS.APPOINTMENTS}/${cleanId}/checkin`,
        payload
      );

      console.log(`[API v2] Checkin response for appointment ${cleanId}:`, JSON.stringify(response?.data));

      if (response && (response.status === 200 || response.status === 201 || response.data?.success !== false)) {
        return {
          success: true,
          statusCode: response.status || 201,
          message: response.data?.message || 'Site visit check-in recorded successfully',
          data: response.data?.data || response.data,
        };
      }

      return {
        success: false,
        statusCode: response?.status || 400,
        message: response.data?.message || 'Failed to record site visit check-in',
      };
    } catch (error) {
      const status = error?.response?.status;
      const message = error.response?.data?.message || error.message || 'Failed to record site visit check-in';
      console.log(`[API v2] Failed to check in appointment ${cleanId}:`, status, message);
      return {
        success: false,
        statusCode: status,
        message,
        error: error?.response?.data,
      };
    }
  },

  /**
   * API v2: Save Attended Date and Attended Time for an appointment
   * Uses canonical v2 endpoint: POST /api/v2/appointments/:id/checkin
   */
  saveAttendedDetails: async (id, details = {}) => {
    const cleanId = String(id || details.appointmentId || details.customerId || '').replace(/\D/g, '') || id;
    return appointmentRepository.checkIn(cleanId, details);
  },

  /**
   * Fetch dynamic waterproof categories
   * GET /whereforwaterproof
   */
  getWaterproofOptions: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WHERE_FOR_WATERPROOF);
      const data = response.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return {
        success: true,
        data: list,
      };
    } catch (error) {
      console.log('Failed to fetch waterproof options:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch waterproof options',
        data: [],
      };
    }
  },

  /**
   * API v2: Reassign appointment to another technician (Admin only)
   * PATCH /appointments/:id/assign
   */
  reassignAppointment: async (appointmentId, employeeId) => {
    try {
      const response = await apiClient.patch(
        `${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}/assign`,
        { employeeId: Number(employeeId) }
      );
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Appointment reassigned successfully',
      };
    } catch (error) {
      console.log(`Failed to reassign appointment ${appointmentId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to reassign appointment',
      };
    }
  },

  /**
   * API v2: Delete an appointment visit
   * DELETE /appointments/:id
   */
  deleteAppointment: async (appointmentId) => {
    try {
      const cleanId = String(appointmentId).replace(/\D/g, '') || appointmentId;
      console.log(`[deleteAppointment] Sending DELETE ${API_ENDPOINTS.APPOINTMENTS}/${cleanId}`);
      const response = await apiClient.delete(`${API_ENDPOINTS.APPOINTMENTS}/${cleanId}`);
      return {
        success: true,
        data: response.data?.data || response.data,
        message: response.data?.message || 'Appointment deleted successfully',
      };
    } catch (error) {
      console.log(`Failed to delete appointment ${appointmentId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete appointment',
      };
    }
  },

  /**
   * API v2: Attendance Check-in Logs
   * GET /appointments/attends or GET /appointments/:id/attends
   */
  getAttends: async (appointmentId = null) => {
    try {
      const endpoint = appointmentId
        ? `${API_ENDPOINTS.APPOINTMENTS}/${appointmentId}/attends`
        : `${API_ENDPOINTS.APPOINTMENTS}/attends`;
      const response = await apiClient.get(endpoint);
      const list = response.data?.data || response.data?.attends || (Array.isArray(response.data) ? response.data : []);
      return {
        success: true,
        data: list,
      };
    } catch (error) {
      console.log('Failed to fetch attendance logs:', error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch attendance logs',
        data: [],
      };
    }
  },

  /**
   * API v2: Quotations Linked to Appointment
   * GET /appointments/:id/quotations
   */
  getAppointmentQuotations: async (appointmentId) => {
    try {
      const cleanId = String(appointmentId).replace(/\D/g, '') || appointmentId;
      const response = await apiClient.get(`${API_ENDPOINTS.APPOINTMENTS}/${cleanId}/quotations`);
      const data = response.data;
      const list = data?.data || data?.quotations || (Array.isArray(data) ? data : []);
      return {
        success: true,
        data: list,
        quotations: list,
      };
    } catch (error) {
      console.log(`Failed to fetch quotations for appointment ${appointmentId}:`, error?.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch appointment quotations',
        data: [],
        quotations: [],
      };
    }
  },
};

export default appointmentRepository;
