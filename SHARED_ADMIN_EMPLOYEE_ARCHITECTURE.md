# 🏢 Unified Admin & Field Employee Architecture Guide
**Nexa CRM / Dr. Terrace Mobile App (React Native + Expo Router)**

---

## 📌 Executive Summary

This guide outlines the architecture and step-by-step implementation plan to unify the **Admin** and **Field Employee** apps into **one single codebase**.

### Key Objectives:
1. **100% Shared UI & Components**: Changes to designs, layouts, cards, colors, or typography in screens like `HomeScreen`, `CustomerDetailScreen`, or `QuotationScreen` will immediately apply to both Admin and Employee.
2. **Dynamic API Routing**: The app dynamically switches between `/api/v1/admin/*` and `/api/v1/field-employee/*` based on the active user session without duplicating UI screens or repositories.
3. **Role-Based Access Control (RBAC)**: Automatically hide unauthorized drawer items, tab buttons, and actions, and protect Admin-only screens (`employee-add`, `employee-list`, `reassign`, etc.) using route guards.

---

## 🏛 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       SHARED UI / SCREENS LAYER                         │
│       HomeScreen, AllAppointmentsScreen, CustomerDetail, Quotation      │
│          • Shared styling, typography, theme, and form elements         │
│          • Role-conditional action buttons (e.g., Reassign, Delete)     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│     NAVIGATION & ROUTE GUARDS         │ │   REPOSITORIES / API LAYER    │
│  (PersistentNavigation & AdminGuard)  │ │ (appointmentRepository, etc.) │
│  • Restricts Admin-only screens       │ │ • UI calls unified functions  │
│  • Filters Drawer & Tab Bar items     │ │   without caring about role   │
└───────────────────────────────────────┘ └───────────────┬───────────────┘
                                                          │
                                                          ▼
                                          ┌───────────────────────────────┐
                                          │      AXIOS API CLIENT         │
                                          │   (Dynamic Role Prefix)       │
                                          └───────────────┬───────────────┘
                                                          │
                                ┌─────────────────────────┴─────────────────────────┐
                                ▼                                                   ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│                 ADMIN ROUTES                  │   │            FIELD EMPLOYEE ROUTES              │
│       https://nexacrm.in/api/v1/admin/*       │   │   https://nexacrm.in/api/v1/field-employee/*  │
│  • All company appointments                   │   │  • Scoped to logged-in employee               │
│  • Full Employee CRUD & Reassign              │   │  • Read-only master data & personal visits    │
└───────────────────────────────────────────────┘   └───────────────────────────────────────────────┘
```

---

## 🔌 1. API Endpoints Comparison

The backend architecture is **symmetrical**: both roles share the same root URL (`https://nexacrm.in/api/v1`), using `/admin` or `/field-employee` as a prefix.

### Symmetrical Endpoints (100% Shared Between Both Roles)

| Feature | Admin Endpoint | Field Employee Endpoint | Behavior |
| :--- | :--- | :--- | :--- |
| **Login** | `POST /admin/auth/login` | `POST /field-employee/auth/login` | Uses dedicated role endpoint (`/admin/auth/login` vs `/field-employee/auth/login`) |
| **Logout** | `POST /admin/auth/logout` | `POST /field-employee/auth/logout` | Symmetrical logout endpoint (`/admin/auth/logout` vs `/field-employee/auth/logout`) |
| **Home View** | `GET /admin/home-view` | `GET /field-employee/home-view` | Admin sees all; Employee sees their assigned upcoming/missed |
| **Appointments List** | `GET /admin/appointments` | `GET /field-employee/appointments` | Paginated list (Employee scoped automatically by backend) |
| **Create Appointment** | `POST /admin/appointments` | `POST /field-employee/appointments` | Same payload format |
| **Appointment Detail** | `GET /admin/appointments/:id` | `GET /field-employee/appointments/:id` | Same payload format |
| **Update Appointment** | `PUT /admin/appointments/:id` | `PUT /field-employee/appointments/:id` | Same payload format |
| **Appointment Attend** | `POST /admin/appointment-attend` | `POST /field-employee/appointment-attend` | Records site visit attendance |
| **Quotations List** | `GET /admin/quotations` | `GET /field-employee/quotations` | Paginated quotations |
| **Quotation Prefill** | `GET /admin/quotations/page-view` | `GET /field-employee/quotations/page-view` | Returns packages & properties |
| **Quotation PDF View** | `GET /admin/quotations/:id/pdf-view` | `GET /field-employee/quotations/:id/pdf-view` | Terms & contact info for PDF |
| **Create Quotation** | `POST /admin/quotations` | `POST /field-employee/quotations` | Same payload format |
| **Clients** | `GET /admin/clients` | `GET /field-employee/clients` | Client directory |
| **Terms & Conditions** | `GET /admin/terms-and-conditions` | `GET /field-employee/terms-and-conditions` | Employee has read-only access |
| **Employee Policies** | `GET /admin/employee-policies` | `GET /field-employee/employee-policies` | Employee has read-only access |
| **Contact Info** | `GET /admin/contact-info` | `GET /field-employee/contact-info` | Company address & phones |

### Admin-Only Endpoints (Restricted for Field Employees)

| Feature | Admin Endpoint | Field Employee Access |
| :--- | :--- | :--- |
| **Employee CRUD** | `GET/POST/PUT/DELETE /admin/employees` | ❌ No Access (403 Forbidden) |
| **Reassign Appointment** | `PATCH /admin/appointments/:id/reassign` | ❌ No Access |
| **Delete Appointment** | `DELETE /admin/appointments/:id` | ❌ No Access |
| **Delete Quotation** | `DELETE /admin/quotations/:id` | ❌ No Access |
| **Master Data Management** | `POST/PUT/DELETE /admin/packages`, `/properties` | ❌ No Access |

---

## 🛠 2. Core Implementation Strategy

### Step 1: Update Application Config (`src/core/config/config.js`)

Remove the hardcoded `/admin` from `API_BASE_URL` and expose the unified server URL and clean endpoint paths:

```javascript
/**
 * Application Configuration & API Endpoints
 */

// Root server API URL without role prefix
export const API_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://nexacrm.in/api/v1';

export const API_ENDPOINTS = {
  // Auth Endpoints
  ADMIN_LOGIN: '/admin/auth/login',
  ADMIN_LOGOUT: '/admin/auth/logout',
  EMPLOYEE_LOGIN: '/field-employee/auth/login',
  EMPLOYEE_LOGOUT: '/field-employee/auth/logout',

  // Default / Symmetrical Auth Endpoints
  LOGIN: '/admin/auth/login',
  LOGOUT: '/auth/logout',
  PROFILE: '/auth/profile',

  // Symmetrical relative endpoints (prefixed dynamically by Axios interceptor)
  HOME_VIEW: '/home-view',
  APPOINTMENTS: '/appointments',
  QUOTATIONS: '/quotations',
  QUOTATIONS_PAGE_VIEW: '/quotations/page-view',
  CLIENTS: '/clients',
  CUSTOMERS: '/clients',
  APPOINTMENT_ATTEND: '/appointment-attend',
  WHERE_FOR_WATERPROOF: '/where-to-waterproof',
  TERMS_AND_CONDITIONS: '/terms-and-conditions',
  EMPLOYEE_POLICIES: '/employee-policies',
  CONTACT_INFO: '/contact-info',

  // Admin-only endpoints
  EMPLOYEES: '/employees',
  PACKAGES: '/packages',
  PROPERTIES: '/properties',
};

export const API_TIMEOUT_MS = 15000;
```

---

### Step 2: Dynamic Role Interceptor in Axios (`src/core/api/apiClient.js`)

Add a request interceptor that checks the logged-in user's role from `AsyncStorage` and automatically injects either `/admin` or `/field-employee`:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_SERVER_URL, API_TIMEOUT_MS } from '../config/config';

export const apiClient = axios.create({
  baseURL: API_SERVER_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Injects Auth Token & Dynamic Role Prefix
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // 1. Attach Bearer token
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 2. Resolve Role Prefix (/admin vs /field-employee)
      const userRaw = await AsyncStorage.getItem('user_data');
      const user = userRaw ? JSON.parse(userRaw) : null;
      
      const isFieldEmployee =
        user?.role === 'field-employee' ||
        user?.role === 'employee' ||
        user?.employeeType === 'FieldEmployee';

      const rolePrefix = isFieldEmployee ? '/field-employee' : '/admin';

      // If the URL is relative and not already prefixed with /admin or /field-employee
      if (
        config.url &&
        !config.url.startsWith('/admin') &&
        !config.url.startsWith('/field-employee') &&
        !config.url.startsWith('http')
      ) {
        const cleanUrl = config.url.startsWith('/') ? config.url : `/${config.url}`;
        config.url = `${rolePrefix}${cleanUrl}`;
      }
    } catch (_err) {
      // Proceed with original config on storage read error
    }

    return config;
  },
  (error) => Promise.reject(error)
);
```

---

### Step 3: Auth & Session Management

#### A. Role Detection on Login (`src/features/auth/api/authRepository.js`)
Ensure the role is correctly detected and stored in local storage:

```javascript
// Inside authRepository.login(mobileOrUsername, password, role = 'admin'):
const endpoint = role === 'field-employee' ? API_ENDPOINTS.EMPLOYEE_LOGIN : API_ENDPOINTS.ADMIN_LOGIN;
const response = await apiClient.post(endpoint, payload);
const data = response.data;

const token = data?.token || data?.accessToken || '';

// Normalize role: Check employeeType and role fields
const isFieldEmp =
  endpoint === API_ENDPOINTS.EMPLOYEE_LOGIN ||
  data?.user?.employeeType === 'FieldEmployee' ||
  data?.user?.role === 'field-employee' ||
  data?.user?.role === 'employee' ||
  data?.employeeType === 'FieldEmployee';

const user = {
  ...(data?.user || data?.data?.user || {}),
  role: isFieldEmp ? 'field-employee' : 'admin',
  employeeType: isFieldEmp ? 'FieldEmployee' : 'OfficeEmployee',
};

if (token) await authRepository.storeToken(token);
if (user) await authRepository.storeUser(user);
```

#### B. Unblock Employees in App Entry (`app/index.jsx`)
Change lines 53-65 in `app/index.jsx`:

```javascript
// BEFORE (Blocked employees):
// if (token && user && user.role !== 'employee' && !authRepository.isTokenExpired(token))

// AFTER (Allows both Admin and Field Employee):
const token = await authRepository.getToken();
const user = await authRepository.getUser();

if (token && user && !authRepository.isTokenExpired(token)) {
  router.replace('/(tabs)');
} else {
  if (token && authRepository.isTokenExpired(token)) {
    await authRepository.logout();
  }
  router.replace('/login');
}
```

#### C. Unblock Employees in `AppointmentsContext.jsx`
Remove the code that clears the session when `user.role === 'employee'`. Both roles should maintain active sessions.

---

### Step 4: Screen & Navigation Permissions (PersistentNavigation.jsx)

In `src/shared/components/PersistentNavigation.jsx`:

```javascript
// Filter Drawer menu items dynamically by role
const isFieldEmployee = userRole === 'field-employee' || userRole === 'employee';

const menuItems = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home', route: 'index' },
  { label: 'Our Clients', icon: 'people-outline', activeIcon: 'people', route: 'clients' },
  { label: 'Appointments', icon: 'calendar-outline', activeIcon: 'calendar', route: 'appointments' },
  { label: 'Outstanding Payments', icon: 'card-outline', activeIcon: 'card', route: 'outstanding' },
  { label: 'Warranty Tracker', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', route: 'warranty' },
  { label: 'Attendance & Leave', icon: 'location-outline', activeIcon: 'location', route: 'attendance-leave' },
  { label: 'Salary Details', icon: 'cash-outline', activeIcon: 'cash', route: 'salary-details' },
  { label: 'Salary Advance', icon: 'wallet-outline', activeIcon: 'wallet', route: 'salary-advance' },

  // Admin-only drawer items
  ...(!isFieldEmployee ? [
    { label: 'Employee Management', icon: 'people-circle-outline', activeIcon: 'people-circle', route: 'employee-list' },
    { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: 'settings' },
  ] : []),

  { label: 'Support', icon: 'headset-outline', activeIcon: 'headset', route: 'support' },
  { label: 'EMP Policy', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', route: 'policy' },
  { label: 'Terms & Conditions', icon: 'document-text-outline', activeIcon: 'document-text', route: 'terms' },
];
```

---

### Step 5: Protect Admin Routes (`RoleGuard.jsx`)

Create a reusable guard `src/shared/components/RoleGuard.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authRepository } from '../../features/auth/api/authRepository';

export function AdminOnlyGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    authRepository.getUser().then((user) => {
      const isFieldEmp =
        user?.role === 'field-employee' ||
        user?.role === 'employee' ||
        user?.employeeType === 'FieldEmployee';
      setIsAdmin(!isFieldEmp);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0052CC" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-outline" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>
          This screen is only available to system administrators.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Go Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFF' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#0052CC', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
```

#### Wrap Admin-Only Screen Re-Exports:
- `app/employee-list.jsx`
- `app/employee-add.jsx`
- `app/employee-edit.jsx`
- `app/reassign.jsx`

Example:
```jsx
// app/employee-list.jsx
import EmployeeListScreen from '../src/features/employees/screens/EmployeeListScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function EmployeeListRoute() {
  return (
    <AdminOnlyGuard>
      <EmployeeListScreen />
    </AdminOnlyGuard>
  );
}
```

---

### Step 6: Shared Screen Adaptation (Inside Screen Components)

#### 1. `HomeScreen.jsx`
- Quick Action buttons:
  - "New Appointment": Visible to both (both have `POST /appointments`), or restricted to Admin if required.
  - "View All Appointments": Visible to both (Field employees see their scoped appointments; remove the lock screen!).
  - "Our Clients": Visible to both.
  - "Send Quote": Visible to both.

#### 2. `CustomerDetailScreen.jsx`
- Client info, map link, address, contact numbers are 100% identical.
- Action Buttons:
  ```jsx
  {/* Action visible to both */}
  <TouchableOpacity style={styles.primaryButton} onPress={handleSiteAttend}>
    <Text style={styles.primaryButtonText}>Record Site Visit</Text>
  </TouchableOpacity>

  {/* Actions restricted to Admin */}
  {userRole === 'admin' && (
    <View style={styles.adminButtonsRow}>
      <TouchableOpacity onPress={handleReassign}>
        <Text style={styles.reassignText}>Reassign Staff</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDelete}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  )}
  ```

---

## 📋 Summary of Screen Accessibility Matrix

| Screen | Route | Admin | Field Employee | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Home** | `app/(tabs)/index.jsx` | ✅ | ✅ | Backend filters appointments automatically |
| **All Appointments** | `app/all-appointments.jsx` | ✅ | ✅ | Employee sees their assigned visits |
| **Customer Detail** | `app/customer-detail.jsx` | ✅ | ✅ | Reassign/Delete buttons hidden for employees |
| **New Appointment** | `app/new-appointment.jsx` | ✅ | ✅ | Both can create appointments |
| **Edit Appointment** | `app/edit-appointment.jsx` | ✅ | ✅ | Both can update appointment details |
| **Make Quotation** | `app/make-quotation.jsx` | ✅ | ✅ | Both can create quotations |
| **Send Quote** | `app/send-quote.jsx` | ✅ | ✅ | Both can send quotes |
| **Attendance & Leave**| `app/attendance-leave.jsx` | ✅ | ✅ | Admin manages all; Employee logs self |
| **Salary Details** | `app/salary-details.jsx` | ✅ | ✅ | Employee views personal salary slip |
| **Salary Advance** | `app/salary-advance.jsx` | ✅ | ✅ | Employee applies; Admin approves |
| **Our Clients** | `app/clients.jsx` | ✅ | ✅ | Client list |
| **Reassign** | `app/reassign.jsx` | ✅ | ❌ | Protected by `AdminOnlyGuard` |
| **Employee Add** | `app/employee-add.jsx` | ✅ | ❌ | Protected by `AdminOnlyGuard` |
| **Employee List** | `app/employee-list.jsx` | ✅ | ❌ | Protected by `AdminOnlyGuard` |
| **Employee Edit** | `app/employee-edit.jsx` | ✅ | ❌ | Protected by `AdminOnlyGuard` |
| **Settings** | `app/(tabs)/settings.jsx` | ✅ | ❌ | Admin preference control |

---

## 🚀 Execution Checklist

- [ ] **Phase 1: Config & API Client**
  - Update `src/core/config/config.js` with `API_SERVER_URL = 'https://nexacrm.in/api/v1'`.
  - Add the dynamic `/admin` vs `/field-employee` prefix logic to `src/core/api/apiClient.js`.

- [ ] **Phase 2: Auth Flow**
  - Update `src/features/auth/api/authRepository.js` to store `role: 'admin' | 'field-employee'`.
  - In `app/index.jsx`, allow both roles to proceed to `/(tabs)`.
  - In `context/AppointmentsContext.jsx`, remove the employee session logout condition.

- [ ] **Phase 3: Navigation & Guards**
  - Update `PersistentNavigation.jsx` to filter drawer items based on `userRole`.
  - Create `src/shared/components/RoleGuard.jsx` (`AdminOnlyGuard`).
  - Wrap `employee-list.jsx`, `employee-add.jsx`, `employee-edit.jsx`, and `reassign.jsx` with `AdminOnlyGuard`.

- [ ] **Phase 4: Screen Polish**
  - Remove the inline lock screens from `AllAppointmentsScreen.jsx` and `NewAppointmentScreen.jsx`.
  - Test login with both an Admin account and an Employee account to verify seamless API switching.
