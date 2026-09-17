# 🔌 Dr. Terrace - Frontend & Mobile Integration Guide (API v2)

This document provides complete integration specifications, architecture contracts, endpoint references, and client-side code examples for connecting frontend applications (**React**, **Next.js**, **Vue**, **Angular**) and mobile clients (**Flutter**, **React Native**) to the **Dr. Terrace REST API Backend (v2)**.

---

## 📑 Table of Contents
1. [What's New in API v2](#1-whats-new-in-api-v2)
2. [Architecture & Base URLs](#2-architecture--base-urls)
3. [2-Tier Role-Based Access Control (RBAC)](#3-2-tier-role-based-access-control-rbac)
4. [Authentication & Profile Flow](#4-authentication--profile-flow)
5. [Complete REST API v2 Endpoints Reference](#5-complete-rest-api-v2-endpoints-reference)
   - [Authentication](#authentication)
   - [Appointments (Unified)](#appointments)
   - [Quotations (Unified)](#quotations)
   - [Home View Dashboard](#home-view-dashboard)
   - [Master Data & Dropdowns (Unified)](#master-data--dropdowns-unified)
6. [Ready-to-Use Client Code Examples](#6-ready-to-use-client-code-examples)
   - [A. TypeScript / Axios Client with Interceptors](#a-typescript--axios-client-with-interceptors)
   - [B. React / Next.js Custom Hook](#b-react--nextjs-custom-hook)
   - [C. Flutter / Dart Mobile Service (Dio)](#c-flutter--dart-mobile-service)
7. [Migration Mapping (v1 $\to$ v2)](#7-migration-mapping-v1--v2)

---

## 1. What's New in API v2

| Area | API v1 (Legacy) | API v2 (Modernized) |
| :--- | :--- | :--- |
| **Route Structure** | Redundant split: `/api/v1/admin/*` vs `/api/v1/field-employee/*` | **Unified canonical REST resources** under `/api/v2/*` |
| **Data Scoping** | Hardcoded separate controllers and queries | **Automatic query scoping** based on caller's token |
| **Book Appointments** | Admin-only in primary flows | **Enabled for Field Employees** (auto-assigned to self) |
| **Confirm Quotation** | Complex dual paths | **Enabled for Field Employees** (for their assigned visits) |
| **Reassign Technician** | Scattered endpoints | Dedicated `PATCH /api/v2/appointments/:id/assign` (Admin only) |
| **Check-in Attendance** | `appointment_attends` sub-routes | Standardized `POST /api/v2/appointments/:id/checkin` |
| **Response Format** | Inconsistent envelope | Standard `{ statusCode: 200, success: true, data: ..., meta: { ... } }` |

---

## 2. Architecture & Base URLs

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│     Admin Web (React/Vite)  │  Field Mobile App (Flutter)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON Bearer Token
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Dr. Terrace API Gateway (:9000)                │
│  - Universal CORS & Helmet Security                         │
│  - JwtAuthGuard (Extracts User & Role)                      │
│  - RolesGuard (@Roles(ADMIN, FIELD_EMPLOYEE))               │
│  - Automated Data Scoping (Admin: Global | Field: Scoped)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Native Pool Connection
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (drterrace)                │
└─────────────────────────────────────────────────────────────┘
```

### Base URLs by Environment

| Environment | Base URL | API v2 Prefix |
| :--- | :--- | :--- |
| **Local Web Development** | `http://localhost:9000` | `http://localhost:9000/api/v2` |
| **Android Emulator** | `http://10.0.2.2:9000` | `http://10.0.2.2:9000/api/v2` |
| **iOS Simulator** | `http://localhost:9000` | `http://localhost:9000/api/v2` |
| **Live / Production** | `https://api.drterrace.com` | `https://api.drterrace.com/api/v2` |

> [!NOTE]
> **Coexistence**: API v1 (`/api/v1/*`) and API v2 (`/api/v2/*`) run side-by-side on the same server. You can migrate frontend screens incrementally without breaking existing mobile app releases.

---

## 3. 2-Tier Role-Based Access Control (RBAC)

API v2 defines two core operational roles:
1. **`ADMIN`**: Super Administrator & Office Administrator. Full oversight, staff dispatching, and system management.
2. **`FIELD_EMPLOYEE`**: Field Technicians & On-site staff. Autonomous on-site lead capture, site check-ins, drafting, and confirming quotes for their assigned visits.

### Capability Matrix

| Capability / Action | `ADMIN` | `FIELD_EMPLOYEE` |
| :--- | :---: | :---: |
| **Login** | Username/Password or Mobile/Password | Mobile Number / Password |
| **View Appointments** | All company visits | **Only** appointments assigned to them |
| **Book New Appointment** | Book & assign to any technician | **Enabled** (auto-assigned to self) |
| **Reassign Technician** | **Allowed** | **403 Forbidden** |
| **Site Check-in (Attendance)** | Allowed (admin override) | **Allowed** (GPS + timestamp) |
| **View Quotations** | All company quotations | **Only** quotations for their visits |
| **Draft Quotations** | Allowed | **Allowed** (for their visits) |
| **Confirm Quotation** | Allowed | **Allowed** (for their visits) |
| **Home View Dashboard** | Company-wide upcoming/missed | **Scoped** to their daily visits |

---

## 4. Authentication & Profile Flow

### 4.1 Login
Both Admin and Field Employees log in through the same endpoint.

```http
POST /api/v2/auth/login
Content-Type: application/json

{
  "username": "<admin_username_OR_employee_mobile_number>",
  "password": "<plain_text_password>"
}
```

#### Successful Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1756400000000,
    "user": {
      "id": 102,
      "username": "9841999888",
      "name": "Karthik Raja",
      "role": "FIELD_EMPLOYEE"
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1756400000000,
  "user": {
    "id": 102,
    "username": "9841999888",
    "name": "Karthik Raja",
    "role": "FIELD_EMPLOYEE"
  }
}
```

> [!TIP]
> **Uniform Envelope**: 100% of API v2 endpoints return their core response payload under the `data` property (`res.data`) and include `statusCode` (`200` or `201`). Convenience top-level keys (`res.token`, `res.user`, `res.appointments`, etc.) are also preserved for non-breaking compatibility.
>
> For root Admin logins (`admin`/`admin`), `user.id` is `0` and `user.role` is `"ADMIN"`.

---

### 4.2 Get Current User Profile
Validates token and returns current user permissions and role.

```http
GET /api/v2/auth/profile
Authorization: Bearer <jwt_token>
```

#### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 102,
    "username": "9841999888",
    "name": "Karthik Raja",
    "role": "FIELD_EMPLOYEE",
    "isAdmin": false,
    "isFieldEmployee": true
  },
  "user": {
    "id": 102,
    "username": "9841999888",
    "name": "Karthik Raja",
    "role": "FIELD_EMPLOYEE",
    "isAdmin": false,
    "isFieldEmployee": true
  }
}
```

---

## 5. Complete REST API v2 Endpoints Reference

### Appointments

#### 1. List Appointments (Role-Scoped)
- **`ADMIN`**: Returns all appointments across the company.
- **`FIELD_EMPLOYEE`**: Automatically filtered to visits assigned to the logged-in technician.

```http
GET /api/v2/appointments?page=1&limit=20&search=Chennai&sortBy=appointment_date&order=desc
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [
    {
      "id": 150,
      "clientName": "Rajesh Kumar",
      "mobileNumber": "9876543210",
      "appointmentDate": "2026-09-20",
      "appointmentFixDate": "2026-09-20",
      "appointmentTime": "10:30 AM",
      "googleLocation": "https://maps.google.com/?q=13.0827,80.2707",
      "assignedEmployeeId": 102,
      "employeeName": "Karthik Raja",
      "isAttended": false,
      "status": "SCHEDULED",
      "address": {
        "doorNo": "42-A",
        "streetName": "Gandhi Road",
        "area": "Anna Nagar",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600040"
      }
    }
  ]
}
```

---

#### 2. Book New Appointment
Enabled for **Both Admin and Field Employees**.
- When booked by a **Field Employee**, `assignedEmployeeId` automatically defaults to the logged-in employee.
- When booked by an **Admin**, `assignedEmployeeId` specifies the assigned technician.

```http
POST /api/v2/appointments
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "clientName": "Suresh Raina",
  "mobileNumber": "9887766554",
  "doorNo": "12/4",
  "streetName": "North Mada Street",
  "area": "Mylapore",
  "city": "Chennai",
  "state": "Tamil Nadu",
  "pincode": "600004",
  "googleLocation": "https://maps.google.com/?q=13.0334,80.2678",
  "appointmentDate": "2026-09-22",
  "appointmentTime": "14:00",
  "propertyId": 1,
  "whereToWaterproof": [1, 3],
  "assignedEmployeeId": 102
}
```

##### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "id": 151,
    "clientName": "Suresh Raina",
    "assignedEmployeeId": 102,
    "employeeName": "Karthik Raja",
    "status": "SCHEDULED"
  }
}
```

---

#### 3. View Appointment Details
```http
GET /api/v2/appointments/:id
Authorization: Bearer <jwt_token>
```
> Field staff can only view appointments assigned to them (attempting to view another technician's appointment returns `403 Forbidden`).

---

#### 4. Reassign Appointment (Admin Only)
Transfers an appointment to another technician.

```http
PATCH /api/v2/appointments/:id/assign
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "employeeId": 105
}
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Appointment reassigned to Ramesh Babu successfully",
  "data": {
    "id": 150,
    "assignedEmployeeId": 105,
    "employeeName": "Ramesh Babu"
  },
  "assignedEmployeeId": 105,
  "employeeName": "Ramesh Babu"
}
```
> [!CAUTION]
> If a Field Employee calls this endpoint, the backend returns `403 Forbidden` (`Admin access required`).

---

#### 5. Site Check-in (Attendance)
When the technician arrives at the site:

```http
POST /api/v2/appointments/:id/checkin
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "date": "2026-09-20",
  "time": "10:45"
}
```

##### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Site visit check-in recorded successfully",
  "data": {
    "id": 89,
    "appointmentId": 150,
    "employeeId": 102,
    "date": "2026-09-20",
    "time": "10:45 AM",
    "createdAt": "2026-09-20T05:15:00.000Z"
  }
}
```

---

### Quotations

#### 1. List Quotations (Role-Scoped)
```http
GET /api/v2/quotations?page=1&limit=20
Authorization: Bearer <jwt_token>
```
- **`ADMIN`**: Returns all quotations.
- **`FIELD_EMPLOYEE`**: Returns quotations for their assigned visits only.

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 15,
    "totalPages": 1
  },
  "data": [
    {
      "id": 75,
      "quotationDate": "2026-09-20",
      "propertyId": 1,
      "propertyName": "Residential Terrace",
      "packageId": 2,
      "packageName": "Standard Coating",
      "fieldEmployeeId": 102,
      "employeeName": "Karthik Raja",
      "appointmentId": 150,
      "advance": 10000,
      "midCost": 20000,
      "finalAmount": 20000,
      "grandTotal": 59000,
      "isConfirmed": true
    }
  ],
  "quotations": [ ... ]
}
```

---

#### 2. Create Quotation Draft
Enabled for **Both Admin and Field Employees**.

```http
POST /api/v2/quotations
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "quotationDate": "2026-09-20",
  "quoteValidateDate": "2026-10-20",
  "propertyId": 1,
  "packageId": 2,
  "appointmentId": 150,
  "advance": 10000,
  "midCost": 20000,
  "finalAmount": 20000,
  "discount": 1000,
  "isGst": true,
  "services": [
    {
      "serviceId": 1,
      "description": "Elastomeric Terrace Waterproofing System",
      "area": 1200,
      "rate": 45
    }
  ]
}
```

##### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Quotation created successfully",
  "id": 75,
  "data": {
    "id": 75,
    "quotationDate": "2026-09-20",
    "subTotal": 54000,
    "gstPercentage": 18,
    "gstAmount": 9720,
    "cgstAmount": 4860,
    "sgstAmount": 4860,
    "grandTotal": 62720,
    "isConfirmed": false
  }
}
```

---

#### 3. Confirm Quotation
Enabled for **Both Admin and Field Employees**.

When a technician closes the deal on-site with the customer, they confirm the proposal directly:

```http
POST /api/v2/quotations/:id/confirm
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "isConfirmed": true
}
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Quotation confirmed successfully",
  "data": {
    "id": 75,
    "isConfirmed": true,
    "updatedBy": "Field (Karthik Raja)"
  }
}
```

---

#### 4. View Official Quotation Proposal (PDF Data)
Returns formatted line items, sub-totals, GST splits, terms & conditions, and company contact details for rendering or printing:

```http
GET /api/v2/quotations/:id/pdf-view
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 75,
    "quotationDate": "2026-09-20",
    "clientName": "Rajesh Kumar",
    "phone": "9876543210",
    "services": [ ... ],
    "subTotal": 54000,
    "gstAmount": 9720,
    "grandTotal": 62720,
    "paymentTerms": {
      "advance": 20,
      "mid": 40,
      "final": 40
    },
    "terms": "1. 50% advance upon commencement...",
    "companyContact": {
      "officeAddress": "Kodambakkam High Rd, Chennai - 600 034",
      "mobileNumber": "+91 99621 19311",
      "emailAddress": "admin@drterrace.com"
    }
  }
}
```

---

### Home View Dashboard

Returns the executive summary of **Upcoming visits** (strictly today, capped at 5) and **Missed visits** (past unvisited, capped at 5).

```http
GET /api/v2/home-view?targetDate=2026-09-20
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "upcoming": [
      {
        "id": 150,
        "clientName": "Rajesh Kumar",
        "appointmentTime": "10:30 AM",
        "mobileNumber": "9876543210",
        "status": "SCHEDULED"
      }
    ],
    "missed": [
      {
        "id": 142,
        "clientName": "Manoj Prabhakar",
        "appointmentDate": "2026-09-18",
        "appointmentTime": "03:00 PM",
        "status": "SCHEDULED"
      }
    ]
  },
  "upcoming": [ ... ],
  "missed": [ ... ]
}
```

---

### Master Data & Dropdowns (Unified)

In API v2, all master data tables and dropdown catalogs are unified under clean, canonical endpoints. Accessible by **both Admin and Field Employees**.

| Resource | Primary Endpoint | Alias Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Where to Waterproof** | `GET /api/v2/where-to-waterproof` | `GET /api/v2/whereforwaterproof` | Waterproofing locations catalog |
| **Properties** | `GET /api/v2/properties` | - | Property categories (Terrace, Wall, etc.) |
| **Packages** | `GET /api/v2/packages` | - | Service packages & warranty info |
| **Package Sub-Categories** | `GET /api/v2/packages/:packageId/sub-categories` | `GET /api/v2/package-sub-categories?packageId=...` | Sub-categories under a package |
| **Services** | `GET /api/v2/services` | - | Master services list with tiers & warranty |
| **Service Details** | `GET /api/v2/service-details` | - | Granular service description items & rates |
| **Terms & Conditions** | `GET /api/v2/terms-and-conditions` | `GET /api/v2/terms` | Standard proposal terms & conditions |
| **Office Contact Info** | `GET /api/v2/contact-info` | `GET /api/v2/contact-information` | Official company header/contact details |
| **Employees / Staff** | `GET /api/v2/employees` | - | Active field technicians & staff list |

#### 1. Waterproofing Locations (`GET /api/v2/where-to-waterproof`)
Supports both `/api/v2/where-to-waterproof` and the legacy alias `/api/v2/whereforwaterproof`:

```http
GET /api/v2/where-to-waterproof
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    { "id": 1, "name": "Terrace" },
    { "id": 2, "name": "Balcony" },
    { "id": 3, "name": "Bathroom / Sunken Slab" }
  ],
  "whereToWaterproof": [
    { "id": 1, "name": "Terrace" },
    { "id": 2, "name": "Balcony" },
    { "id": 3, "name": "Bathroom / Sunken Slab" }
  ]
}
```

> [!TIP]
> Both `res.data.data` and `res.data.whereToWaterproof` are returned for 100% backward compatibility with mobile and web frontend parsers.

#### 2. Properties Catalog (`GET /api/v2/properties`)
```http
GET /api/v2/properties
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    { "id": 1, "name": "Residential" },
    { "id": 2, "name": "Commercial" },
    { "id": 3, "name": "Industrial" }
  ],
  "properties": [ ... ]
}
```

#### 3. Packages Catalog (`GET /api/v2/packages`)
```http
GET /api/v2/packages
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    { "id": 1, "name": "Standard Coating", "warranty": 5, "packages": "Standard" },
    { "id": 2, "name": "Premium Polyurethane", "warranty": 10, "packages": "Premium" }
  ]
}
```

#### 4. Active Employees / Staff List (`GET /api/v2/employees`)
Useful for appointment booking, reassignments, and technician lookups:
```http
GET /api/v2/employees
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": 102,
      "name": "Karthik Raja",
      "mobileNumber": "9841999888",
      "employeeType": "FieldEmployee",
      "employeeImage": "https://s3.amazonaws.com/drterrace/photos/karthik.jpg"
    }
  ]
}
```

---

## 6. Ready-to-Use Client Code Examples

### A. TypeScript / Axios Client with Interceptors

```typescript
// src/api/apiClient.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9000/api/v2';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject JWT Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unified API Methods
export const ApiV2 = {
  auth: {
    login: (credentials: { username: string; password: string }) =>
      apiClient.post('/auth/login', credentials),
    getProfile: () => apiClient.get('/auth/profile'),
  },

  appointments: {
    list: (params?: { page?: number; limit?: number; search?: string }) =>
      apiClient.get('/appointments', { params }),
    getById: (id: number) => apiClient.get(`/appointments/${id}`),
    create: (data: any) => apiClient.post('/appointments', data),
    reassign: (id: number, employeeId: number) =>
      apiClient.patch(`/appointments/${id}/assign`, { employeeId }),
    checkIn: (id: number, timeData?: { date?: string; time?: string }) =>
      apiClient.post(`/appointments/${id}/checkin`, timeData),
  },

  quotations: {
    list: (params?: { page?: number; limit?: number }) =>
      apiClient.get('/quotations', { params }),
    getById: (id: number) => apiClient.get(`/quotations/${id}`),
    create: (data: any) => apiClient.post('/quotations', data),
    update: (id: number, data: any) => apiClient.put(`/quotations/${id}`, data),
    confirm: (id: number, isConfirmed = true) =>
      apiClient.post(`/quotations/${id}/confirm`, { isConfirmed }),
    getPdfView: (id: number) => apiClient.get(`/quotations/${id}/pdf-view`),
  },

  dashboard: {
    getHomeView: (targetDate?: string) =>
      apiClient.get('/home-view', { params: { targetDate } }),
  },

  masterData: {
    getWhereToWaterproof: () => apiClient.get('/where-to-waterproof'),
    getProperties: () => apiClient.get('/properties'),
    getPackages: () => apiClient.get('/packages'),
    getPackageSubCategories: (packageId: number) =>
      apiClient.get(`/packages/${packageId}/sub-categories`),
    getServices: () => apiClient.get('/services'),
    getServiceDetails: () => apiClient.get('/service-details'),
    getTerms: () => apiClient.get('/terms-and-conditions'),
    getContactInfo: () => apiClient.get('/contact-info'),
    getEmployees: () => apiClient.get('/employees'),
  },
};
```

---

### B. React / Next.js Custom Hook

```typescript
// src/hooks/useAppointments.ts
import { useState, useEffect, useCallback } from 'react';
import { ApiV2 } from '../api/apiClient';

export function useAppointments(page = 1, limit = 20, search = '') {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiV2.appointments.list({ page, limit, search });
      setAppointments(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const bookAppointment = async (payload: any) => {
    const res = await ApiV2.appointments.create(payload);
    fetchAppointments(); // Refresh list
    return res.data;
  };

  return { appointments, meta, loading, error, refetch: fetchAppointments, bookAppointment };
}
```

---

### C. Flutter / Dart Mobile Service

```dart
// lib/services/api_v2_service.dart
import 'package:dio/dio.dart';

class ApiV2Service {
  final Dio _dio;
  static const String baseUrl = 'http://10.0.2.2:9000/api/v2'; // Android Emulator

  ApiV2Service(String? token)
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
        ));

  // 1. Technician Books New Appointment (auto-assigned to self)
  Future<Response> bookAppointment(Map<String, dynamic> data) async {
    return await _dio.post('/appointments', data: data);
  }

  // 2. Fetch Assigned Visits for Today
  Future<Response> getHomeDashboard({String? targetDate}) async {
    return await _dio.get(
      '/home-view',
      queryParameters: targetDate != null ? {'targetDate': targetDate} : null,
    );
  }

  // 3. Record Site Arrival Check-in
  Future<Response> checkIn(int appointmentId) async {
    return await _dio.post('/appointments/$appointmentId/checkin');
  }

  // 4. Create and Confirm Quotation On-Site
  Future<Response> createQuotation(Map<String, dynamic> quoteData) async {
    return await _dio.post('/quotations', data: quoteData);
  }

  Future<Response> confirmQuotation(int quotationId) async {
    return await _dio.post(
      '/quotations/$quotationId/confirm',
      data: {'isConfirmed': true},
    );
  }

  // 5. Master Data & Dropdowns
  Future<Response> getWhereToWaterproof() async {
    return await _dio.get('/where-to-waterproof');
  }

  Future<Response> getProperties() async {
    return await _dio.get('/properties');
  }

  Future<Response> getPackages() async {
    return await _dio.get('/packages');
  }

  Future<Response> getServices() async {
    return await _dio.get('/services');
  }
}
```

---

## 7. Migration Mapping (v1 $\to$ v2)

| Legacy v1 Route | API v2 Canonical Route | Allowed Roles |
| :--- | :--- | :---: |
| `POST /api/v1/admin/auth/login`<br/>`POST /api/v1/field-employee/auth/login` | `POST /api/v2/auth/login` | Public |
| `GET /api/v1/admin/appointments`<br/>`GET /api/v1/field-employee/appointments` | `GET /api/v2/appointments` | Both |
| `POST /api/v1/admin/appointments`<br/>`POST /api/v1/field-employee/appointments` | `POST /api/v2/appointments` | Both |
| `GET /api/v1/admin/appointments/:id`<br/>`GET /api/v1/field-employee/appointments/:id` | `GET /api/v2/appointments/:id` | Both |
| `PATCH/PUT /api/v1/admin/appointments/:id/reassign` | `PATCH /api/v2/appointments/:id/assign` | `ADMIN` only |
| `POST /api/v1/admin/appointment-attends` | `POST /api/v2/appointments/:id/checkin` | Both |
| `GET /api/v1/admin/quotations`<br/>`GET /api/v1/field-employee/quotations` | `GET /api/v2/quotations` | Both |
| `POST /api/v1/admin/quotations`<br/>`POST /api/v1/field-employee/quotations` | `POST /api/v2/quotations` | Both |
| `POST /api/v1/admin/quotations/:id/confirm`<br/>`POST /api/v1/field-employee/quotations/:id/confirm` | `POST /api/v2/quotations/:id/confirm` | Both |
| `GET /api/v1/admin/quotations/:id/pdf-view`<br/>`GET /api/v1/field-employee/quotations/:id/pdf-view` | `GET /api/v2/quotations/:id/pdf-view` | Both |
| `GET /api/v1/admin/home-view`<br/>`GET /api/v1/field-employee/home-view` | `GET /api/v2/home-view` | Both |
| `GET /api/v1/where-to-waterproof`<br/>`GET /api/v1/whereforwaterproof` | `GET /api/v2/where-to-waterproof` | Both |
| `GET /api/v1/properties` | `GET /api/v2/properties` | Both |
| `GET /api/v1/packages` | `GET /api/v2/packages` | Both |
| `GET /api/v1/services` | `GET /api/v2/services` | Both |
| `GET /api/v1/service-details` | `GET /api/v2/service-details` | Both |
| `GET /api/v1/terms-and-conditions` | `GET /api/v2/terms-and-conditions` | Both |
| `GET /api/v1/contact-info` | `GET /api/v2/contact-info` | Both |
| `GET /api/v1/admin/employees` | `GET /api/v2/employees` | Both |
