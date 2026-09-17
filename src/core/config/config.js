/**
 * Application Configuration & API Endpoints
 *
 * API v2 — Unified canonical REST resources.
 * Both Admin and Field Employee use the same endpoints.
 * Role-based data scoping is handled server-side via JWT.
 *
 * Set the EXPO_PUBLIC_API_URL in .env or use the default below.
 */

// ── API v2 Base URL ───────────────────────────────────────────────────────────
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://amusement-easter-praising.ngrok-free.dev/api/v2';
  // process.env.EXPO_PUBLIC_API_URL || 'https://nexacrm.in/api/v2';

// Legacy v1 base (kept for employee image URL construction only)
export const API_V1_BASE_URL = 'https://amusement-easter-praising.ngrok-free.dev';
// export const API_V1_BASE_URL = 'https://nexacrm.in';

export const API_ENDPOINTS = {
  // Auth (unified — same endpoint for Admin & Field Employee)
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  PROFILE: '/auth/profile',

  // Core resources
  EMPLOYEES: '/employees',
  EMPLOYEE: '/employees',
  APPOINTMENTS: '/appointments',
  NEW_APPOINTMENTS: '/appointments',
  HOME_VIEW: '/home-view',
  CLIENTS: '/clients',
  CUSTOMERS: '/clients',

  // Quotations
  QUOTATIONS: '/quotations',
  QUOTATIONS_PAGE_VIEW: '/quotations/page-view',

  // Master data & dropdowns
  WHERE_FOR_WATERPROOF: '/where-to-waterproof',
  WHERE_TO_WATERPROOF: '/where-to-waterproof',
  PROPERTIES: '/properties',
  PACKAGES: '/packages',
  PACKAGE_SUB_CATEGORIES: '/package-sub-categories',
  SERVICES: '/services',
  SERVICE_DETAILS: '/service-details',
  CONTACT_INFO: '/contact-info',
  CONTACT_INFORMATION: '/contact-info',
  TERMS_AND_CONDITIONS: '/terms-and-conditions',
  TERMS: '/terms-and-conditions',
  TERMS_REORDER: '/terms-and-conditions/reorder',
  EMPLOYEE_POLICIES: '/employee-policies',
  EMPLOYEE_POLICIES_LATEST: '/employee-policies/latest',
  EMPLOYEE_POLICIES_REORDER: '/employee-policies/reorder',

  // Attendance (v2 uses /appointments/:id/checkin and /appointments/attends)
  APPOINTMENT_ATTEND: '/appointment-attend',

  // Schedules (v2 /appointment-schedules)
  APPOINTMENT_SCHEDULES: '/appointment-schedules',

  // Health
  HEALTH: '/health',
};

export const API_TIMEOUT_MS = 150000;
