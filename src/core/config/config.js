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
  // process.env.EXPO_PUBLIC_API_URL || 'https://amusement-easter-praising.ngrok-free.dev/api/v2';
  process.env.EXPO_PUBLIC_API_URL || 'https://drterrace.pravinsam.in/api/v2';
  // process.env.EXPO_PUBLIC_API_URL || 'https://nexacrm.in/api/v2';
  
  // Legacy v1 base (kept for employee image URL construction only)
  // export const API_V1_BASE_URL = 'https://amusement-easter-praising.ngrok-free.dev';
  export const API_V1_BASE_URL = 'https://drterrace.pravinsam.in';
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

  // Quotation Payments (New Simplified Flow — /api/v2/quotation-payments)
  // Canonical endpoints for the new quotation-payment module
  QUOTATION_PAYMENT_SUMMARY: (quoteId) => `/quotation-payments/${quoteId}`,
  QUOTATION_PAYMENT_RECORD: (quoteId) => `/quotation-payments/${quoteId}`,
  QUOTATION_PAYMENT_VERIFY: (quoteId, paymentId) => `/quotation-payments/${quoteId}/${paymentId}/verify`,
  QUOTATION_PAYMENT_VERIFY_VIEW: (quoteId, paymentId) => `/quotation-payments/${quoteId}/${paymentId}/verify-view`,
  QUOTATION_PAYMENT_FINAL: (quoteId) => `/quotation-payments/${quoteId}/final`,
  QUOTATION_PAYMENT_ADDITIONAL_SERVICES: (quoteId) => `/quotation-payments/${quoteId}/additional-services`,
  QUOTATION_SERVICES_OPTIONS: (quoteId) => `/quotations/${quoteId}/services/options`,
  QUOTATION_ADDITIONAL_SERVICE_VIEW: (quoteId) => `/quotations/${quoteId}/additional-service-view`,
  QUOTATION_SERVICES_ADD: (quoteId) => `/quotations/${quoteId}/services`,
  QUOTATION_PAYMENT_DELETE_NEW: (quoteId, paymentId) => `/quotation-payments/${quoteId}/${paymentId}`,

  // Quotation Payments — Blockchain Ledger (Legacy — kept for AdditionalPayment & Receipt screens)
  // QUOTATION_PAY_VIEW: (id) => `/quotations/${id}/pay-view`,
  QUOTATION_SERVICE_PAYMENT: (quoteId, serviceId) => `/quotations/${quoteId}/services/${serviceId}/payments`,
  QUOTATION_ADDITIONAL_SERVICES: (quoteId) => `/quotation-payments/${quoteId}/additional-services`,
  QUOTATION_ADDITIONAL_SERVICE_PAYMENT: (quoteId, serviceId) => `/quotations/${quoteId}/additional-services/${serviceId}/payments`,
  QUOTATION_FINAL_SETTLEMENT: (quoteId) => `/quotations/${quoteId}/final-settlement`,
  QUOTATION_PRICING_CONFIG: (quoteId) => `/quotations/${quoteId}/pricing-config`,
  QUOTATION_VERIFY_CHAIN: (quoteId) => `/quotations/${quoteId}/payments/verify-chain`,
  QUOTATION_VERIFY_PAYMENT: (quoteId, paymentId) => `/quotations/${quoteId}/payments/${paymentId}/verify`,
  PAYMENT_VERIFY: (paymentId) => `/payments/${paymentId}/verify`,
  PAYMENT_VERIFY_VIEW: (paymentId) => `/payments/${paymentId}/verify-view`,
  QUOTATION_PAYMENT_VERIFY_VIEW_LEGACY: (quoteId, paymentId) => `/quotations/${quoteId}/payments/${paymentId}/verify-view`,
  QUOTATION_GST_PAYMENT: (quoteId) => `/quotations/${quoteId}/gst-payment`,
  QUOTATION_FINAL_RECEIPT: (quoteId) => `/quotations/${quoteId}/final-receipt`,
  QUOTATION_RECEIPT_LOCK: (quoteId) => `/quotations/${quoteId}/receipt-lock`,
  QUOTATION_PAYMENT_DELETE: (quoteId, paymentId) => `/quotations/${quoteId}/payments/${paymentId}`,
  PAYMENT_DELETE: (paymentId) => `/payments/${paymentId}`,
  RECEIPT_SETTINGS: '/receipt-settings',

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
  BANK_ACCOUNTS: '/bank-accounts',
  BANKS: '/banks',
  TERMS_AND_CONDITIONS: '/terms-and-conditions',
  TERMS: '/terms-and-conditions',
  TERMS_REORDER: '/terms-and-conditions/reorder',
  EMPLOYEE_POLICIES: '/employee-policies',
  EMPLOYEE_POLICIES_LATEST: '/employee-policies/latest',
  EMPLOYEE_POLICIES_REORDER: '/employee-policies/reorder',

  // Attendance (API v2 canonical endpoints: POST /appointments/:id/checkin & GET /appointments/attends)
  APPOINTMENT_CHECKIN: (id) => `/appointments/${id}/checkin`,
  APPOINTMENT_ATTENDS: '/appointments/attends',
  APPOINTMENT_ATTEND: '/appointments/attends',

  // Schedules (v2 /appointment-schedules)
  APPOINTMENT_SCHEDULES: '/appointment-schedules',

  // Health
  HEALTH: '/health',
};

export const API_TIMEOUT_MS = 150000;
