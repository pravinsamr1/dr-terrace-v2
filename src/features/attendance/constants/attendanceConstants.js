/**
 * Attendance & Leave Feature Constants & Fallback Values
 */

export const ATTENDANCE_DEFAULTS = {
  LOCATION: {
    address: 'Site Visit Location',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  DEFAULT_LEAVE_TYPE: 'Casual Leave',
  DEFAULT_TOTAL_DAYS: '1',
  LEAVE_TYPES: [
    'Casual Leave',
    'Sick Leave',
    'Emergency Leave',
    'Privilege Leave',
  ],
  STATUS: {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  },
};
