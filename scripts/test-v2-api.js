/**
 * Verification test for Dr. Terrace API v2 implementations
 * Tests imports, method existence, signatures, and config endpoints.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

// Mock AsyncStorage and React Native modules for Node environment
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === '@react-native-async-storage/async-storage') {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
      multiRemove: async () => {},
    };
  }
  if (id === 'expo-router') {
    return { router: { replace: () => {}, push: () => {} } };
  }
  return originalRequire.apply(this, arguments);
};

// Babel compilation hook for extensionless and ES module imports in /src/
const defaultJsLoader = require.extensions['.js'];
require.extensions['.js'] = function (module, filename) {
  if (filename.includes('/src/')) {
    const content = fs.readFileSync(filename, 'utf8');
    const transformed = babel.transformSync(content, {
      presets: ['babel-preset-expo'],
      filename,
    });
    return module._compile(transformed.code, filename);
  }
  return defaultJsLoader(module, filename);
};

test('API v2 Implementation Verification', async (t) => {
  await t.test('1. Core config endpoints contain all v2 paths', () => {
    const { API_ENDPOINTS } = require('../src/core/config/config');
    assert.strictEqual(API_ENDPOINTS.LOGIN, '/auth/login');
    assert.strictEqual(API_ENDPOINTS.LOGOUT, '/auth/logout');
    assert.strictEqual(API_ENDPOINTS.PROFILE, '/auth/profile');
    assert.strictEqual(API_ENDPOINTS.APPOINTMENTS, '/appointments');
    assert.strictEqual(API_ENDPOINTS.QUOTATIONS, '/quotations');
    assert.strictEqual(API_ENDPOINTS.QUOTATIONS_PAGE_VIEW, '/quotations/page-view');
    assert.strictEqual(API_ENDPOINTS.CLIENTS, '/clients');
    assert.strictEqual(API_ENDPOINTS.APPOINTMENT_SCHEDULES, '/appointment-schedules');
    assert.strictEqual(API_ENDPOINTS.EMPLOYEE_POLICIES, '/employee-policies');
    assert.strictEqual(API_ENDPOINTS.EMPLOYEE_POLICIES_LATEST, '/employee-policies/latest');
    assert.strictEqual(API_ENDPOINTS.EMPLOYEE_POLICIES_REORDER, '/employee-policies/reorder');
    assert.strictEqual(API_ENDPOINTS.TERMS_AND_CONDITIONS, '/terms-and-conditions');
    assert.strictEqual(API_ENDPOINTS.TERMS_REORDER, '/terms-and-conditions/reorder');
    assert.strictEqual(API_ENDPOINTS.CONTACT_INFO, '/contact-info');
    assert.strictEqual(API_ENDPOINTS.HEALTH, '/health');
    assert.strictEqual(API_ENDPOINTS.PROPERTIES, '/properties');
    assert.strictEqual(API_ENDPOINTS.PACKAGES, '/packages');
    assert.strictEqual(API_ENDPOINTS.PACKAGE_SUB_CATEGORIES, '/package-sub-categories');
    assert.strictEqual(API_ENDPOINTS.SERVICES, '/services');
    assert.strictEqual(API_ENDPOINTS.SERVICE_DETAILS, '/service-details');
    assert.strictEqual(API_ENDPOINTS.WHERE_TO_WATERPROOF, '/where-to-waterproof');
  });

  await t.test('2. ApiV2 facade exposes all required domains and methods', () => {
    const { ApiV2 } = require('../src/core/api/apiClient');
    assert.ok(ApiV2, 'ApiV2 must be defined');

    // Auth
    assert.strictEqual(typeof ApiV2.auth.login, 'function');
    assert.strictEqual(typeof ApiV2.auth.getProfile, 'function');
    assert.strictEqual(typeof ApiV2.auth.logout, 'function');

    // Appointments
    assert.strictEqual(typeof ApiV2.appointments.list, 'function');
    assert.strictEqual(typeof ApiV2.appointments.getById, 'function');
    assert.strictEqual(typeof ApiV2.appointments.create, 'function');
    assert.strictEqual(typeof ApiV2.appointments.update, 'function');
    assert.strictEqual(typeof ApiV2.appointments.delete, 'function');
    assert.strictEqual(typeof ApiV2.appointments.reassign, 'function');
    assert.strictEqual(typeof ApiV2.appointments.checkIn, 'function');
    assert.strictEqual(typeof ApiV2.appointments.getAttends, 'function');
    assert.strictEqual(typeof ApiV2.appointments.getQuotations, 'function');

    // Quotations
    assert.strictEqual(typeof ApiV2.quotations.list, 'function');
    assert.strictEqual(typeof ApiV2.quotations.getById, 'function');
    assert.strictEqual(typeof ApiV2.quotations.getPageView, 'function');
    assert.strictEqual(typeof ApiV2.quotations.getEditView, 'function');
    assert.strictEqual(typeof ApiV2.quotations.getByClient, 'function');
    assert.strictEqual(typeof ApiV2.quotations.create, 'function');
    assert.strictEqual(typeof ApiV2.quotations.update, 'function');
    assert.strictEqual(typeof ApiV2.quotations.delete, 'function');
    assert.strictEqual(typeof ApiV2.quotations.confirm, 'function');
    assert.strictEqual(typeof ApiV2.quotations.getPdfView, 'function');

    // Clients
    assert.strictEqual(typeof ApiV2.clients.list, 'function');
    assert.strictEqual(typeof ApiV2.clients.getById, 'function');
    assert.strictEqual(typeof ApiV2.clients.getQuotations, 'function');

    // Schedules
    assert.strictEqual(typeof ApiV2.schedules.list, 'function');
    assert.strictEqual(typeof ApiV2.schedules.createOrUpdate, 'function');
    assert.strictEqual(typeof ApiV2.schedules.update, 'function');
    assert.strictEqual(typeof ApiV2.schedules.delete, 'function');

    // Policies
    assert.strictEqual(typeof ApiV2.policies.list, 'function');
    assert.strictEqual(typeof ApiV2.policies.getLatest, 'function');
    assert.strictEqual(typeof ApiV2.policies.getById, 'function');
    assert.strictEqual(typeof ApiV2.policies.create, 'function');
    assert.strictEqual(typeof ApiV2.policies.update, 'function');
    assert.strictEqual(typeof ApiV2.policies.delete, 'function');
    assert.strictEqual(typeof ApiV2.policies.reorder, 'function');

    // Dashboard
    assert.strictEqual(typeof ApiV2.dashboard.getHomeView, 'function');

    // Master Data
    assert.strictEqual(typeof ApiV2.masterData.getWhereToWaterproof, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createWhereToWaterproof, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateWhereToWaterproof, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteWhereToWaterproof, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getProperties, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createProperty, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateProperty, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteProperty, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getPackages, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createPackage, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updatePackage, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deletePackage, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getPackageSubCategories, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createPackageSubCategory, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updatePackageSubCategory, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deletePackageSubCategory, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getServices, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createService, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateService, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteService, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getServiceDetails, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createServiceDetail, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateServiceDetail, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteServiceDetail, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getTerms, 'function');
    assert.strictEqual(typeof ApiV2.masterData.getTermById, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createTerm, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateTerm, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteTerm, 'function');
    assert.strictEqual(typeof ApiV2.masterData.reorderTerms, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getContactInfo, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateContactInfo, 'function');

    assert.strictEqual(typeof ApiV2.masterData.getEmployees, 'function');
    assert.strictEqual(typeof ApiV2.masterData.getEmployeeById, 'function');
    assert.strictEqual(typeof ApiV2.masterData.createEmployee, 'function');
    assert.strictEqual(typeof ApiV2.masterData.updateEmployee, 'function');
    assert.strictEqual(typeof ApiV2.masterData.deleteEmployee, 'function');

    // Health
    assert.strictEqual(typeof ApiV2.health.check, 'function');
  });

  await t.test('3. Repositories have all missing v2 methods', () => {
    const { authRepository } = require('../src/features/auth/api/authRepository');
    assert.strictEqual(typeof authRepository.getProfile, 'function');

    const { appointmentRepository } = require('../src/features/appointments/api/appointmentRepository');
    assert.strictEqual(typeof appointmentRepository.deleteAppointment, 'function');
    assert.strictEqual(typeof appointmentRepository.getAttends, 'function');
    assert.strictEqual(typeof appointmentRepository.getAppointmentQuotations, 'function');

    const { quotationRepository } = require('../src/features/quotations/api/quotationRepository');
    assert.strictEqual(typeof quotationRepository.getQuotations, 'function');
    assert.strictEqual(typeof quotationRepository.getByClient, 'function');
    assert.strictEqual(typeof quotationRepository.getQuotationsByClient, 'function');

    const { scheduleRepository } = require('../src/features/schedules/api/scheduleRepository');
    assert.strictEqual(typeof scheduleRepository.getSchedules, 'function');
    assert.strictEqual(typeof scheduleRepository.createOrUpdateSchedule, 'function');
    assert.strictEqual(typeof scheduleRepository.updateSchedule, 'function');
    assert.strictEqual(typeof scheduleRepository.deleteSchedule, 'function');

    const { policyRepository } = require('../src/features/settings/api/policyRepository');
    assert.strictEqual(typeof policyRepository.getLatest, 'function');
    assert.strictEqual(typeof policyRepository.getPolicyById, 'function');
    assert.strictEqual(typeof policyRepository.createPolicy, 'function');
    assert.strictEqual(typeof policyRepository.updatePolicy, 'function');
    assert.strictEqual(typeof policyRepository.deletePolicy, 'function');
    assert.strictEqual(typeof policyRepository.reorderPolicies, 'function');

    const { termsRepository } = require('../src/features/settings/api/termsRepository');
    assert.strictEqual(typeof termsRepository.getTermById, 'function');
    assert.strictEqual(typeof termsRepository.createTerm, 'function');
    assert.strictEqual(typeof termsRepository.updateTerm, 'function');
    assert.strictEqual(typeof termsRepository.deleteTerm, 'function');
    assert.strictEqual(typeof termsRepository.reorderTerms, 'function');

    const { supportRepository } = require('../src/features/settings/api/supportRepository');
    assert.strictEqual(typeof supportRepository.updateContactInfo, 'function');

    const { masterDataRepository } = require('../src/features/masterData/api/masterDataRepository');
    assert.strictEqual(typeof masterDataRepository.getWhereToWaterproof, 'function');
    assert.strictEqual(typeof masterDataRepository.createWhereToWaterproof, 'function');
    assert.strictEqual(typeof masterDataRepository.updateWhereToWaterproof, 'function');
    assert.strictEqual(typeof masterDataRepository.deleteWhereToWaterproof, 'function');

    assert.strictEqual(typeof masterDataRepository.getProperties, 'function');
    assert.strictEqual(typeof masterDataRepository.createProperty, 'function');
    assert.strictEqual(typeof masterDataRepository.updateProperty, 'function');
    assert.strictEqual(typeof masterDataRepository.deleteProperty, 'function');

    assert.strictEqual(typeof masterDataRepository.getPackages, 'function');
    assert.strictEqual(typeof masterDataRepository.createPackage, 'function');
    assert.strictEqual(typeof masterDataRepository.updatePackage, 'function');
    assert.strictEqual(typeof masterDataRepository.deletePackage, 'function');

    assert.strictEqual(typeof masterDataRepository.getPackageSubCategories, 'function');
    assert.strictEqual(typeof masterDataRepository.createPackageSubCategory, 'function');
    assert.strictEqual(typeof masterDataRepository.updatePackageSubCategory, 'function');
    assert.strictEqual(typeof masterDataRepository.deletePackageSubCategory, 'function');

    assert.strictEqual(typeof masterDataRepository.getServices, 'function');
    assert.strictEqual(typeof masterDataRepository.createService, 'function');
    assert.strictEqual(typeof masterDataRepository.updateService, 'function');
    assert.strictEqual(typeof masterDataRepository.deleteService, 'function');

    assert.strictEqual(typeof masterDataRepository.getServiceDetails, 'function');
    assert.strictEqual(typeof masterDataRepository.createServiceDetail, 'function');
    assert.strictEqual(typeof masterDataRepository.updateServiceDetail, 'function');
    assert.strictEqual(typeof masterDataRepository.deleteServiceDetail, 'function');

    const { healthRepository } = require('../src/features/health/api/healthRepository');
    assert.strictEqual(typeof healthRepository.check, 'function');
  });

  await t.test('4. Re-export at src/api/apiClient works identically', () => {
    const { ApiV2, apiClient } = require('../src/api/apiClient');
    assert.ok(ApiV2);
    assert.ok(apiClient);
  });
});
