# 🔌 Dr. Terrace - Frontend & Mobile Integration Guide (API v2)

This document provides complete integration specifications, architecture contracts, endpoint references, and client-side code examples for connecting frontend applications (**React**, **Next.js**, **Vue**, **Angular**) and mobile clients (**Flutter**, **React Native**) to the **Dr. Terrace REST API Backend (v2)**.

---

## 📑 Table of Contents

1. [What's New in API v2](#1-whats-new-in-api-v2)
2. [Architecture & Base URLs](#2-architecture--base-urls)
3. [Authentication & Profile Flow](#3-authentication--profile-flow)
4. [Complete REST API v2 Endpoints Reference](#4-complete-rest-api-v2-endpoints-reference)
   - [Authentication](#authentication)
   - [Appointments (Unified)](#appointments)
   - [Quotations (Unified)](#quotations)
     - [Pricing rules](#pricing-rules)
     - [2. Create Quotation](#2-create-quotation)
     - [4. The quotation object](#4-get-quotation-details-the-quotation-object)
     - [9. Confirm Quotation](#9-confirm-quotation-idconfirm)
     - [10. Unlock Quotation](#10-unlock-quotation-idunlock)
     - [12. Quotation Errors](#12-quotation-errors)
   - [Proforma Invoice (Tax Customers Only)](#proforma-invoice-tax-customers-only)
   - [Quotation Payments & Direct Settlement (New Flow)](#quotation-payments--direct-settlement-new-simplified-flow)
     - [1. Get Payment Summary & History](#1-get-payment-summary--history)
     - [2. Record Intermediate Payment (Grand Total)](#2-record-intermediate-payment-checked-against-the-grand-total)
     - [3. Admin Verify Payment](#3-admin-verify-payment)
     - [4. Settling The Balance](#4-settling-the-balance)
     - [5. Rollback / Delete Payment (Admin Only)](#5-rollback--delete-latest-payment-admin-only)
   - [Payments & Blockchain Ledger (Unified)](#payments--blockchain-ledger-unified)
     - [1. Get Payment State / Pay-View](#1-get-payment-state--pay-view)
     - [2. Record Base Service Payment](#2-record-service-payment-base-scope)
     - [3. Final Settlement](#3-confirm-final-settlement)
     - [4. Dynamic Pricing Configuration (GST & Discount)](#4-dynamic-pricing-configuration-gst--discount-toggles)
     - [5. Verify Blockchain Ledger Integrity](#5-verify-blockchain-ledger-integrity)
     - [6. Admin Verify Payment](#6-admin-verify-payment)
     - [7. Single Payment Verification View](#7-single-payment-verification-view)
     - [8. Record GST Clearance Payment](#8-record-gst-clearance-payment)
     - [9. Generate Final Official Receipt](#9-generate-final-official-receipt)
     - [10. Admin Toggle Receipt Lock](#10-admin-toggle-receipt-lock)
     - [11. Receipt Numbering Settings & Dynamic Series](#11-receipt-numbering-settings--dynamic-series)
     - [12. Delete Payment & Auto-Cleanup Rules](#12-delete-payment--auto-cleanup-rules)
     - [13. Clean Up Orphaned Payment Proof Images (Admin Only)](#13-clean-up-orphaned-payment-proof-images-admin-only)
   - [Warranty (Unified)](#warranty-unified)
     - [1. Check Warranty Eligibility](#1-check-warranty-eligibility)
     - [2. Get Warranty Config / Available Services](#2-get-warranty-config--available-services)
     - [3. Create Warranty Config](#3-create-warranty-config)
     - [4. Update Warranty Config](#4-update-warranty-config)
     - [5. Generate Warranty](#5-generate-warranty)
     - [6. Get Warranty](#6-get-warranty)
     - [7. Delete Warranty](#7-delete-warranty)
     - [8. Verify Warranty (Master Admin)](#8-verify-warranty-master-admin-only)
   - [Clients / Customers (Unified)](#clients--customers-unified)
   - [Appointment Schedules (Unified)](#appointment-schedules-unified)
   - [Company & Employee Policies (Unified)](#company--employee-policies-unified)
   - [Push Notifications](#push-notifications)
   - [WhatsApp Webhook (Meta Cloud API)](#whatsapp-webhook-meta-cloud-api)
   - [System Health](#system-health)
   - [Home View Dashboard](#home-view-dashboard)
   - [Master Data & Dropdowns (Unified)](#master-data--dropdowns-unified)
     - [1. Waterproofing Locations](#1-waterproofing-locations-get-apiv2where-to-waterproof)
     - [2. Properties Catalog](#2-properties-catalog-get-apiv2properties)
     - [3. Packages Catalog](#3-packages-catalog-get-apiv2packages)
     - [4. Active Employees / Staff List](#4-active-employees--staff-list-get-apiv2employees)
     - [5. Bank Account Details](#5-bank-account-details-unified)
     - [6. Staff Management & Photo Upload](#6-staff-management--photo-upload-admin-only)
5. [Ready-to-Use Client Code Examples](#5-ready-to-use-client-code-examples)
   - [A. TypeScript / Axios Client with Interceptors](#a-typescript--axios-client-with-interceptors)
   - [B. React / Next.js Custom Hook](#b-react--nextjs-custom-hook)
   - [C. Flutter / Dart Mobile Service (Dio)](#c-flutter--dart-mobile-service)

---

## 1. Key Capabilities of API v2

| Area                    | Implementation Specification                                            |
| :---------------------- | :---------------------------------------------------------------------- |
| **Route Structure**     | **Unified canonical REST resources** under `/api/v2/*`                  |
| **Data Scoping**        | **Automatic query scoping** based on caller's token                     |
| **Database Engine**     | **TypeORM & TypeScript Entity Layer** with atomic transactions & pooled connections |
| **Book Appointments**   | **Enabled for Field Employees** (auto-assigned to self)                 |
| **Confirm Quotation**   | **Enabled for Field Employees** (for their assigned visits)             |
| **Reassign Technician** | Dedicated `PATCH /api/v2/appointments/:id/assign` (Admin only)          |
| **Check-in Attendance** | Standardized `POST /api/v2/appointments/:id/checkin`                    |
| **Direct Settlement**   | Dedicated `/api/v2/quotation-payments/:id` flow: payments against the quotation's grand total; GST (tax invoice vs cash bill) set on the quotation |
| **Response Format**     | Standard `{ statusCode: 200, success: true, data: ..., meta: { ... } }` |
| **Client Screen Loading** | **1 Single Unified Request**: `GET /api/v2/clients/:id` bundles profile, packages, quotations, and active payment summary |
| **Post-Sale Warranty**  | New **Warranty module**: configure per-service warranty years after final receipt lock; Admin can delete and redo a warranty at any time |
| **Bank Accounts**       | Full company account management via `/api/v2/account-details` with primary account toggle |
| **Storage Lifecycle**   | Automated disk unlinking on payment deletion & admin orphaned receipt cleanup (`/api/v2/payments/cleanup-orphaned-images`) |

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
                               │ TypeORM DataSource / Entity Repository
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (drterrace)                │
└─────────────────────────────────────────────────────────────┘
```

### Base URLs by Environment

| Environment               | Base URL                    | API v2 Prefix                      |
| :------------------------ | :-------------------------- | :--------------------------------- |
| **Local Web Development** | `http://localhost:9000`     | `http://localhost:9000/api/v2`     |
| **Android Emulator**      | `http://10.0.2.2:9000`      | `http://10.0.2.2:9000/api/v2`      |
| **iOS Simulator**         | `http://localhost:9000`     | `http://localhost:9000/api/v2`     |
| **Live / Production**     | `https://api.drterrace.com` | `https://api.drterrace.com/api/v2` |
---

## 3. Authentication & Profile Flow

### 3.1 Login

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
> For the root account (`ADMIN_USERNAME` from the server environment), `user.id` is `0` and `user.role` is `"MASTER_ADMIN"` (the one master admin, configured in `.env`). Office employees log in as `ADMIN` and technicians as `FIELD_EMPLOYEE`.

---

### 3.2 Get Current User Profile

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
    "isMasterAdmin": false,
    "isFieldEmployee": true
  },
  "user": {
    "id": 102,
    "username": "9841999888",
    "name": "Karthik Raja",
    "role": "FIELD_EMPLOYEE",
    "isAdmin": false,
    "isMasterAdmin": false,
    "isFieldEmployee": true
  }
}
```

`isAdmin` is `true` for both `ADMIN` and `MASTER_ADMIN`; `isMasterAdmin` is `true` only for `MASTER_ADMIN`.

---

## 4. Complete REST API v2 Endpoints Reference

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

#### 6. Update Appointment Details

```http
PUT /api/v2/appointments/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "clientName": "Rajesh Kumar",
  "mobileNumber": "9876543210",
  "address": {
    "doorNo": "42-B",
    "streetName": "Gandhi Road Ext",
    "area": "Anna Nagar",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600040"
  },
  "appointmentDate": "2026-09-22",
  "appointmentTime": "11:00"
}
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Appointment updated successfully",
  "data": {
    "id": 150,
    "clientName": "Rajesh Kumar",
    "mobileNumber": "9876543210"
  }
}
```

---

#### 7. Delete Appointment Visit

```http
DELETE /api/v2/appointments/:id
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Appointment deleted successfully",
  "data": { "id": 150 }
}
```

---

#### 8. Attendance Check-in Logs

```http
GET /api/v2/appointments/attends
GET /api/v2/appointments/:id/attends
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": 89,
      "appointmentId": 150,
      "employeeId": 102,
      "employeeName": "Karthik Raja",
      "clientName": "Rajesh Kumar",
      "date": "2026-09-20",
      "time": "10:45 AM"
    }
  ]
}
```

---

#### 9. Quotations Linked to Appointment

Retrieve all quotations created or drafted for a specific appointment visit:

```http
GET /api/v2/appointments/:id/quotations
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": 75,
      "grandTotal": 62720,
      "isConfirmed": true
    }
  ],
  "quotations": [
    {
      "id": 75,
      "grandTotal": 62720,
      "isConfirmed": true
    }
  ]
}
```

---

### Quotations

Every quotation endpoint returns the same **quotation object** (§4). The quotation keeps one tax state,
`isTaxCustomer`, and the server calculates every amount.

#### Pricing rules

All amounts are whole rupees, rounded at each step (`Math.round`), so the app can reproduce them exactly.

```
line amount = round(area × rate)
subTotal    = sum of line amounts

Tax customer (isTaxCustomer: true) — discount before tax:
  discount   = round(subTotal × discount% / 100)                  → discount.amountForTax
  gst        = round((subTotal − discount) × gst% / 100)
  grandTotal = subTotal − discount + gst

Non-tax customer (isTaxCustomer: false) — discount after tax:
  gst        = round(subTotal × gst% / 100)
  discount   = round((subTotal + gst) × discount% / 100)          → discount.amountForNonTax
  grandTotal = subTotal + gst − discount

cgst = round(gst / 2), sgst = gst − cgst, each at gst% / 2
```

- **GST applies whenever `gstPercentage > 0`,** for either kind of customer. `isTaxCustomer` doesn't switch GST on
  or off; it decides the discount order and whether the final receipt is a tax invoice or a cash bill.
- `pricing.discount` is `null` when there is no discount, and `pricing.gst` is `null` when there is no GST.
- The response always returns both discount amounts (`amountForTax`, `amountForNonTax`); `grandTotal` uses the one
  that matches `isTaxCustomer`.

Worked example: 1,000 sqft × ₹53, 10% discount, 18% GST.

| | Tax customer | Non-tax customer |
|---|---|---|
| `subTotal` | 53,000 | 53,000 |
| Discount | `amountForTax` 5,300 (10% of 53,000) | `amountForNonTax` 6,254 (10% of 62,540) |
| GST 18% | 8,586 (on 47,700) | 9,540 (on 53,000) |
| `grandTotal` | **56,286** | **56,286** |

---

#### 1. List Quotations (Role-Scoped)

```http
GET /api/v2/quotations?page=1&limit=20&appointmentId=691&employeeId=100
Authorization: Bearer <jwt_token>
```

`appointmentId` and `employeeId` are optional filters (`employeeId` is Admin only). A field employee only sees
their own quotations.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1 },
  "data": [ { "...": "quotation object (§4)" } ]
}
```

---

#### 2. Create Quotation

Enabled for **Admin and Field Employees**.

```http
POST /api/v2/quotations
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "appointmentId": 691,
  "propertyId": 2,
  "packageId": 2,
  "quotationDate": "2026-09-29",
  "validTill": "2026-10-14",
  "isTaxCustomer": true,
  "customerGstNumber": "33AAAAA0000A1Z5",
  "withRegards": "Mr. SRIRAM",
  "negotiation": "PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER",
  "workCommencement": "Work can be started 48hrs from the time of payment received",
  "services": [
    { "serviceDetailId": 2, "area": 1000, "rate": 53, "description": "Terrace (Cement floor) (Four Layer System) ..." }
  ],
  "amount": {
    "gstPercentage": 18,
    "discountPercentage": 10,
    "subTotal": 53000,
    "grandTotal": 56286
  }
}
```

| Field | Rules |
|---|---|
| `appointmentId`, `propertyId`, `packageId` | Required, must exist. The customer comes from the appointment. |
| `quotationDate` | Required, `YYYY-MM-DD`. |
| `validTill` | Optional, `YYYY-MM-DD`, on or after `quotationDate`. Defaults to `quotationDate` + 15 days. |
| `isTaxCustomer` | Required, `true` or `false`. |
| `customerGstNumber` | Optional string (max 50). Stored as sent; the format isn't checked. |
| `withRegards`, `negotiation`, `workCommencement` | Optional. `negotiation` and `workCommencement` have defaults. |
| `services[]` | At least one. `serviceDetailId` must exist and belong to the package's tier (or a tier-less "None" package). `area` > 0, `rate` ≥ 0. `description` overrides the catalog text. Title, subtitle and warranty come from the catalog. |
| `amount.gstPercentage` | `null` or 0–100. GST applies when > 0. |
| `amount.discountPercentage` | `null` or 0–100. |
| `amount.subTotal`, `amount.grandTotal` | Required. The server recalculates both with the rules above and returns `400` if either differs. `amount.grantTotal` is accepted as another name for `grandTotal`. |
| `employeeId` | Admin only, optional. Defaults to the appointment's assigned employee. A field employee is always themselves. |

##### Response (`201 Created`)

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Quotation created",
  "data": { "...": "quotation object (§4)" }
}
```

##### Response (`400 Bad Request`) — totals don't match

```json
{
  "statusCode": 400,
  "success": false,
  "message": "amount.grandTotal (56000) does not match the calculated grand total (56286)",
  "details": {
    "expected": {
      "subTotal": 53000,
      "grandTotal": 56286,
      "pricing": { "...": "the server's pricing block" }
    }
  }
}
```

---

#### 3. Update Quotation

```http
PUT /api/v2/quotations/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

The body is the **same as create** and replaces the quotation's lines and settings. The response is the updated
quotation object with `revision` increased by 1.

- **Lines are matched by `serviceDetailId`,** so an unchanged line keeps its `id`. Older lines saved without a
  service detail are matched by their service instead.
- **A line that has payments can't be removed** (`400`).
- **Lines already on the quotation skip the tier check** unless `packageId` changes.
- **Field employee:** only their own quotations, and only while `isConfirmed` is `false`.
- **Admin:** any quotation.
- **Locked after the final receipt:** once it has been generated, updates return `400`.

---

#### 4. Get Quotation Details (the quotation object)

```http
GET /api/v2/quotations/:id
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 1351,
    "quotationDate": "2026-09-29",
    "validTill": "2026-10-14",
    "revision": 1,
    "isConfirmed": false,
    "appointmentId": 691,

    "isTaxCustomer": true,
    "customerGstNumber": "33AAAAA0000A1Z5",

    "customer": {
      "name": "Mr samm",
      "mobile": "8925591969",
      "address": { "doorNo": "gh", "streetName": "avavb", "area": "Avadi", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600054" }
    },
    "property": { "id": 2, "name": "Apartment" },
    "package": { "id": 2, "name": "Pure Flexible Polyurethane coating", "tier": "Premium", "warranty": "10 Years" },
    "employee": { "id": 100, "name": "sam" },
    "withRegards": "Mr. SRIRAM",

    "services": [
      {
        "id": 2051,
        "serviceId": 1,
        "serviceDetailId": 2,
        "title": "Terrace Waterproofing",
        "subtitle": "Default",
        "description": "Terrace (Cement floor) (Four Layer System) ...",
        "area": 1000,
        "rate": 53,
        "amount": 53000,
        "warranty": "10 Years"
      }
    ],

    "pricing": {
      "subTotal": 53000,
      "discount": { "percentage": 10, "amountForTax": 5300, "amountForNonTax": 6254 },
      "gst": {
        "percentage": 18,
        "amount": 8586,
        "cgst": { "percentage": 9, "amount": 4293 },
        "sgst": { "percentage": 9, "amount": 4293 }
      },
      "grandTotal": 56286
    },

    "payment": { "totalPaid": 0, "balanceAmount": 56286, "paymentStatus": "UNPAID" },

    "paymentTerms": {
      "validity": "Quote Valid till 14-10-26",
      "negotiation": "PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER",
      "workStart": "Work can be started 48hrs from the time of payment received"
    }
  }
}
```

- `services` lists every line. A custom line has `serviceId` and `serviceDetailId` of `null`. Only lines migrated from
  the old on-site additional services look like this; editing the quotation (`PUT`) replaces them with the lines you send
  (a line that has payments can't be removed, `400`).
- `package.warranty` is the quotation-level warranty (the one shown on the pdf-view): the warranty stored on the quotation or its package, otherwise the longest warranty among its lines. It is `null` only when no line has a warranty.
- `payment` counts every recorded payment (milestone and per-service) against `pricing.grandTotal`.
- `paymentTerms.validity` is a display sentence; `validTill` is the date.

---

#### 5. Quotation PDF (`:id/pdf-view`)

```http
GET /api/v2/quotations/:id/pdf-view
Authorization: Bearer <jwt_token>
```

Returns the **quotation object** plus `terms` (HTML from terms & conditions) and `companyContact`.

- Render the discount line from `pricing.discount.amountForTax` (tax customer) or `amountForNonTax` (non-tax
  customer).
- Render the GST lines (CGST, SGST) only when `pricing.gst` is not `null`.
- The order of the lines follows the pricing rules: discount then GST for a tax customer, GST then discount
  otherwise.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "...": "quotation object (§4)",
    "terms": "<p>1. 50% Advance with Purchase Order, ...</p>",
    "companyContact": {
      "id": 1,
      "officeAddress": "Kodambakkam, Chennai - 600024",
      "mobileNumber": "+91 99621 19311",
      "landlineNumber": "044-45000775",
      "emailAddress": "info@drterrace.com"
    }
  }
}
```

---

#### 6. Quotation Creation Options (`page-view`)

Returns all properties and the package/service catalog for the quotation form, **grouped by tier**. Use a
`serviceDetailId` from `subtitles` in `services[]` of the create request.

```http
GET /api/v2/quotations/page-view
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "properties": [{ "id": 1, "name": "Residential" }],
    "packages": [
      {
        "package": "Economic",
        "data": [
          {
            "id": 1,
            "packageId": 1,
            "packageName": "Standard Coating",
            "warranty": null,
            "services": [
              {
                "serviceId": 1,
                "serviceName": "Terrace Waterproofing",
                "tierType": "MultiTier",
                "subtitles": [
                  { "serviceDetailId": 1, "subtitle": "Default", "description": "...", "rate": 100, "warranty": "5 Years" }
                ]
              }
            ]
          }
        ]
      },
      { "package": "Premium", "data": [ "..." ] },
      { "package": "Elite", "data": [ "..." ] },
      { "package": "None", "data": [ "..." ] }
    ]
  }
}
```

> [!IMPORTANT]
> **Tier spelling**: the API always uses **"Economic"** (package rows stored as `"Economy"` are normalised).

---

#### 7. Quotation Edit View (`:id/edit-view`)

```http
GET /api/v2/quotations/:id/edit-view
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "quotation": { "...": "quotation object (§4)" },
    "properties": [{ "id": 1, "name": "Residential" }],
    "packages": [ { "package": "Economic", "data": [ "..." ] } ]
  }
}
```

---

#### 8. Quotations by Client / Appointment

```http
GET /api/v2/quotations/client/:appointmentId
Authorization: Bearer <jwt_token>
```

Quotation summaries for an appointment, grouped by tier. `amount` is the quotation's `grandTotal`.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "appointmentId": 691,
    "packages": [
      {
        "packageId": 2,
        "packages": "Premium",
        "quotations": [
          {
            "quotationId": 1351,
            "packageId": 2,
            "packageName": "Pure Flexible Polyurethane coating",
            "quotationTitle": "Pure Flexible Polyurethane coating",
            "revisionNo": 1,
            "amount": 56286,
            "isConfirmed": false,
            "quotationDate": "2026-09-29"
          }
        ]
      }
    ]
  },
  "appointmentId": 691,
  "packages": [ "..." ],
  "quotations": [ "...flat list of the summaries above..." ]
}
```

---

#### 9. Confirm Quotation (`:id/confirm`)

Enabled for **Admin** and **Field Employee** (their own quotations). Confirming **deletes the appointment's other
unconfirmed quotations**.

```http
POST /api/v2/quotations/:id/confirm
Authorization: Bearer <jwt_token>
Content-Type: application/json

{ "isConfirmed": true }
```

Response `data` is the quotation object with `isConfirmed: true`. Only an Admin can send `isConfirmed: false`, and
not after a payment exists.

---

#### 10. Unlock Quotation (`:id/unlock`)

**Admin only.** Sets `isConfirmed` back to `false` so the quotation can be edited. Response `data` is the quotation
object.

```http
POST /api/v2/quotations/:id/unlock
Authorization: Bearer <admin_jwt_token>
```

---

#### 11. Delete Quotation

```http
DELETE /api/v2/quotations/:id
Authorization: Bearer <jwt_token>
```

Not allowed once a payment exists (`403`). A field employee can only delete their own unconfirmed quotations.

```json
{ "statusCode": 200, "success": true, "message": "Quotation deleted successfully", "data": { "id": 1351 } }
```

---

#### 12. Quotation Errors

All errors return `{ statusCode, success: false, message }`. Showing `message` as-is works for each.

| Status | Example `message` | When |
|---|---|---|
| 400 | `isTaxCustomer is required (true or false)` | Missing or not a boolean. |
| 400 | `quotationDate is required in YYYY-MM-DD format` | Missing or wrong format (`validTill` has the same rule). |
| 400 | `services must have at least one line` | Empty `services`. |
| 400 | `services[0].area must be a number greater than 0` | Invalid line values. |
| 400 | `amount.grandTotal (56000) does not match the calculated grand total (56286)` | App totals differ; `details.expected` has the server's figures. |
| 400 | `Service detail 11 (Test tier) belongs to a different package tier and cannot be added to this quotation` | Wrong tier. |
| 400 | `Service line 2051 (Terrace Waterproofing) has payments and can't be removed from the quotation` | Update drops a paid line. |
| 400 | `Quotation is locked because its final receipt has already been generated.` | Update after the receipt. |
| 403 | `Quotation is confirmed and locked. Only an admin can unlock it.` | Field employee edits a confirmed quotation. |
| 404 | `Appointment 999 not found` | Unknown `appointmentId`, `propertyId`, `packageId` or `employeeId`. |

---

### Proforma Invoice (Tax Customers Only)

A proforma invoice is linked to a quotation and only exists for a **tax customer** (`isTaxCustomer: true`). A
quotation has at most one. The frontend collects `poNumber`, `bankDetails` and `terms` and sends them in one
request; the server generates the invoice.

| Rule | |
|---|---|
| Who | Admins and master admins generate, change and delete it. A field employee can only **read** the invoice of their own quotations. |
| `poNumber` | Optional: a string, or `null` / left out. It can be added later with `PATCH`. |
| `bankDetails` | Required, and must be the **primary bank account**. |
| `terms` | Required: the payment terms printed on the invoice. |
| Non-tax customer | `400`: "A proforma invoice can only be raised for a tax customer…". |
| Number | `PI-<financial year>-<sequence>`, for example `PI-26-27-0001`. |
| Frozen copy | The quotation is recorded as it was when the invoice was generated, so the invoice does not change if the quotation does. To refresh it, delete the invoice and generate a new one. |

The server does not email or message the customer; the response is the document to show or share.

#### 1. Generate

```http
POST /api/v2/quotations/:id/proforma-invoice
Authorization: Bearer <admin_or_master_admin_jwt>
Content-Type: application/json

{
  "poNumber": "PO-2026-0042",
  "bankDetails": {
    "id": 1,
    "accountName": "Dr. Terrace Waterproofing",
    "bankName": "HDFC Bank",
    "accountNumber": "50200088991122",
    "ifscCode": "HDFC0000084",
    "branchName": "Nungambakkam Branch, Chennai"
  },
  "terms": "60% advance with the order, 30% on the mid stage and 10% on completion"
}
```

| Field | Rules |
|---|---|
| `poNumber` | Optional. Text up to 100 characters, or `null`. |
| `bankDetails` | Required object. `accountName`, `bankName`, `accountNumber` and `ifscCode` are required; `branchName` and `id` are optional. The account number and IFSC code must match the primary bank account (case and spaces are ignored). Get it from the bank account details (the account with `isPrimary: true`). |
| `terms` | Required text, up to 4000 characters. |

A `bankDetails` that is not the primary account returns `400` with the real primary account in
`details.primaryBank`. If no account is marked primary, mark one first. The invoice stores and prints the primary
account as it is recorded in the system.

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Proforma invoice generated",
  "data": {
    "id": 3,
    "invoiceNumber": "PI-26-27-0003",
    "invoiceDate": "2026-10-03",
    "quotationId": 1351,
    "poNumber": "PO-2026-0042",
    "bankDetails": {
      "id": 1,
      "accountName": "Dr. Terrace Waterproofing",
      "bankName": "HDFC Bank",
      "accountNumber": "50200088991122",
      "ifscCode": "HDFC0000084",
      "branchName": "Nungambakkam Branch, Chennai"
    },
    "terms": "60% advance with the order, 30% on the mid stage and 10% on completion",
    "quotation": { "...": "quotation object (§4): customer, services, pricing with GST" },
    "quotationTerms": "<p>1. 50% Advance with Purchase Order, ...</p>",
    "companyContact": { "officeAddress": "...", "mobileNumber": "...", "landlineNumber": "...", "emailAddress": "..." },
    "createdBy": "Admin (Suresh)",
    "createdAt": "2026-10-03T06:10:00.000Z",
    "updatedAt": "2026-10-03T06:10:00.000Z"
  }
}
```

`409` if the quotation already has an invoice.

#### 2. Change later

```http
PATCH /api/v2/quotations/:id/proforma-invoice
Content-Type: application/json

{ "poNumber": "PO-2026-0042" }
```

Any of `poNumber`, `bankDetails` and `terms` (same rules as above); only the fields you send change. `poNumber: null`
clears it. Returns the same object as generate.

#### 3. Get

```http
GET /api/v2/quotations/:id/proforma-invoice
```

`404` if there is none. Returns the same object as generate.

#### 4. Delete

```http
DELETE /api/v2/quotations/:id/proforma-invoice
```

Removes the invoice so a fresh one can be generated.

| Status | When |
|---|---|
| 400 | Non-tax customer; missing or invalid `bankDetails` / `terms` / `poNumber`; `bankDetails` is not the primary account; no primary account set |
| 403 | A field employee tries to generate, change or delete |
| 404 | Unknown quotation; no invoice yet; a field employee asks about someone else's quotation |
| 409 | An invoice already exists for this quotation |

---

### Quotation Payments & Direct Settlement (New Simplified Flow)

A dedicated, streamlined quotation payment system (`src/v2/modules/quotation-payment/`) that simplifies client transactions:
- **No Milestone / Stage Restrictions**: No forced "Advance 60%" or "Mid 30%" classification — payments can be any amount.
- **Payments Against The Grand Total**: Every payment is checked against the quotation's
  `pricing.grandTotal` (see the pricing rules under **Quotations**). `progress.balanceAmount = grandTotal - totalPaid`
  is the balance to show and to pay against.
- **Tax Invoice Or Cash Bill**: The quotation's `isTaxCustomer` decides the receipt: `true` gives a **Tax Invoice**
  (`DRT ATEG …`, `gstDecision: "APPLIED"`, `invoiceType: "TAX_INVOICE"`); `false` gives a **Cash Bill** (`DRT…`,
  `"OPTED_OUT"`, `"CASH_BILL"`). GST itself is charged whenever the quotation has a GST percentage.
- **Changing It**: Edit the quotation (`PUT /api/v2/quotations/:id`) or use `PATCH /api/v2/quotations/:id/pricing-config`
  (`isTaxCustomer`, `withGst`, `gstPercentage`, `discountPercentage`). Once a receipt has been issued, its tax
  decision is fixed.
- **Whole-Number Integers**: All monetary calculations, subtotals, taxes, and balances are rounded whole numbers (`Math.round(...)`).
- **Sequential Verification Guard**: Next payment cannot be recorded until previous payments are verified by Admin (`isVerified = true`).
- **Audit History Chain**: Links to `previousPaymentId`, tracking `balanceBefore` and `balanceAfter`.

```mermaid
flowchart TD
    Q["Quotation pricing
grandTotal: 56,286
isTaxCustomer: true, invoiceType: TAX_INVOICE"] --> B["Payment #1 (UPI: 30,000)
Balance: 26,286"]
    B --> C["Admin Verifies Payment #1
(isVerified: true)"]
    C --> D["Payment #2 (ACCOUNT: 20,000)
Balance: 6,286"]
    D --> E["Admin Verifies Payment #2
(isVerified: true)"]
    E --> F["Payment #3 (ACCOUNT: 6,286)
Balance: 0"]
    F --> I["Status: FULLY_PAID
Receipt: Tax Invoice (isTaxCustomer: true)"]
```

---

#### 1. Get Payment Summary & History

```http
GET /api/v2/quotation-payments/:id
Authorization: Bearer <jwt_token>
```
*Aliases: `GET /api/v2/quotations/:id/quotation-payments`, `GET /api/v2/quotations/:id/payment-plan`*

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "quotationId": 21,
    "quotationTitle": "Acrylic Elastomeric Coating",
    "propertyName": "House",
    "clientName": "Blockchain Client",
    "mobileNumber": "9777766666",
    "gstDecision": "APPLIED",
    "isTaxCustomer": true,
    "invoiceType": "TAX_INVOICE",
    "customerGstNumber": "33AAAAA0000A1Z5",
    "pricing": {
      "subTotal": 53000,
      "discount": { "percentage": 10, "amountForTax": 5300, "amountForNonTax": 6254 },
      "gst": {
        "percentage": 18,
        "amount": 8586,
        "cgst": { "percentage": 9, "amount": 4293 },
        "sgst": { "percentage": 9, "amount": 4293 }
      },
      "grandTotal": 56286
    },
    "progress": {
      "totalPaid": 50000,
      "balanceAmount": 6286,
      "paymentStatus": "PARTIALLY_PAID"
    },
    "history": [
      {
        "id": 101,
        "amount": 30000,
        "paymentMethod": "UPI",
        "account": null,
        "upiId": "client@okhdfcbank",
        "voucher": null,
        "referenceNumber": "UPI12345678",
        "paymentDate": "2026-09-24",
        "balanceBefore": 56286,
        "balanceAfter": 26286,
        "proofImage": "/uploads/payments/proof-1.jpg",
        "notes": "Token payment",
        "isVerified": true,
        "verifiedBy": "Admin (System Administrator)",
        "verifiedAt": "2026-09-24T05:00:00.000Z",
        "verificationNotes": "Verified in HDFC bank",
        "receivedBy": "Field Employee (John)",
        "previousPaymentId": null
      },
      {
        "id": 102,
        "amount": 20000,
        "paymentMethod": "ACCOUNT",
        "account": {
          "id": 1,
          "accountName": "Dr. Terrace Waterproofing Pvt Ltd",
          "bankName": "HDFC Bank",
          "accountNumber": "50200012345678",
          "ifscCode": "HDFC0001234",
          "branchName": "T Nagar"
        },
        "upiId": null,
        "voucher": null,
        "referenceNumber": "NEFT987654321",
        "paymentDate": "2026-09-26",
        "balanceBefore": 26286,
        "balanceAfter": 6286,
        "proofImage": "/uploads/payments/neft.pdf",
        "notes": null,
        "isVerified": true,
        "verifiedBy": "Admin (System Administrator)",
        "verifiedAt": "2026-09-26T06:30:00.000Z",
        "verificationNotes": null,
        "receivedBy": "Admin (System Administrator)",
        "previousPaymentId": 101
      }
    ]
  }
}
```

---

#### 2. Record Intermediate Payment (Checked Against The Grand Total)

The amount must not exceed `progress.balanceAmount` (`grandTotal - totalPaid`).

```http
POST /api/v2/quotation-payments/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount": 30000,
  "paymentMethod": "UPI",
  "upiId": "client@okhdfcbank",
  "referenceNumber": "UPI12345678",
  "paymentDate": "2026-09-24",
  "notes": "Token advance"
}
```
*Supports `paymentMethod`: `UPI` (with `upiId`), `ACCOUNT` (with `accountId`), or `CASH` (with `voucher`). Also accepts `multipart/form-data` with `proofImage` file upload.*

##### Response (`201 Created`)

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "id": 101,
      "amount": 30000,
      "paymentMethod": "UPI",
      "account": null,
      "upiId": "client@okhdfcbank",
      "balanceBefore": 56286,
      "balanceAfter": 26286,
      "previousPaymentId": null,
      "isVerified": false
    },
    "summary": { ... }
  }
}
```

---

#### 3. Admin Verify Payment

Restricted to **Admin** (`Role.ADMIN`).

```http
PATCH /api/v2/quotation-payments/:id/:paymentId/verify
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "isVerified": true,
  "verificationNotes": "Amount credited and verified in HDFC current account"
}
```
*Also accepts `POST /api/v2/quotation-payments/:id/:paymentId/verify`.*

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment verified successfully by Admin",
  "data": {
    "id": 101,
    "isVerified": true,
    "verifiedBy": "Admin (System Administrator)",
    "verifiedAt": "2026-09-24T05:00:00.000Z",
    "verificationNotes": "Amount credited and verified in HDFC current account"
  }
}
```

---

#### 4. Settling The Balance

There is no separate final-payment endpoint: `POST /api/v2/quotation-payments/:id/final` (and its
`/quotations/:id/quotation-payments/final` and `/quotations/:id/payment-plan/final` aliases) has been removed and
returns `404`.

- **Last payment:** record it like any other payment (§2) for the remaining `progress.balanceAmount`.
- **After Admin verifies it:** `paymentStatus` becomes `FULLY_PAID` and the receipt can be generated (§8).
- **Receipt type** follows the quotation's `isTaxCustomer`: tax invoice or cash bill.
- **Customer GSTIN:** set it on the quotation, or send `customerGstNumber` when generating the receipt.

---

#### 5. Rollback / Delete Latest Payment (Admin Only)

Deletes the latest payment in the chain and restores the balance. The quotation's `isTaxCustomer` is not changed.

```http
DELETE /api/v2/quotation-payments/:id/:paymentId
Authorization: Bearer <admin_jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment 103 deleted successfully and balance rolled back"
}
```

#### 6. Get Payment Verify View (`:id/:paymentId/verify-view`)

Retrieves the complete verification dossier for a specific payment, combining:
- **Full Payment Details**: `amount`, `paymentMethod`, `account` (bank details), `upiId`, `voucher`, `referenceNumber`, `paymentDate`, `createdAt`, `notes`, `receivedBy`, `balanceBefore`, `balanceAfter`, `previousPaymentId`.
- **Proof Inspection**: `proofImage`, `proofImageUrl` (fully qualified HTTP URL), `fileType` (`image/png`, `application/pdf`, etc.), and `hasProofImage`.
- **Sequential Verification Guard**: `canVerify: boolean`, `blockingPaymentId: number | null` (indicating whether earlier payments in the chain block this payment from being verified).
- **Quotation Financial Context**: `quotationId`, `quotationTitle`, `propertyName`, `clientName`, `mobileNumber`, `siteAddress`, `pricing` (the quotation pricing: `subTotal`, `discount`, `gst`, `grandTotal`), and `progress` (`totalPaid`, `balanceAmount`, `paymentStatus`).
- **Data Shape**: Returns all payment properties at root level, plus nested `proof`, `verification`, `quotation`, and `payment` objects for 100% frontend compatibility.

* **Roles**: Admin, Field Employee
* **Supported Endpoints**:
  - `GET /api/v2/quotation-payments/:id/:paymentId/verify-view`
  - `GET /api/v2/quotation-payments/:id/payments/:paymentId/verify-view`
  - `GET /api/v2/quotations/:id/quotation-payments/:paymentId/verify-view`
  - `GET /api/v2/quotation-payments/:id/:paymentId` (direct alias)
  - `GET /api/v2/quotation-payments/verify-view/:paymentId` (direct by payment ID)
  - `GET /api/v2/quotation-payments/payments/:paymentId/verify-view` (direct by payment ID)

```http
GET /api/v2/quotation-payments/:id/:paymentId/verify-view
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 101,
    "paymentId": "101",
    "amount": 5000,
    "paymentMethod": "CASH",
    "voucher": "VCH-001",
    "account": null,
    "upiId": null,
    "referenceNumber": null,
    "notes": "Advance payment received on site",
    "receivedBy": "Field Employee (John)",
    "paymentDate": "2026-09-24",
    "createdAt": "2026-09-24T10:00:00.000Z",
    "balanceBefore": 50000,
    "balanceAfter": 45000,
    "previousPaymentId": null,
    "proofImage": "/static/payments/proof-101.png",
    "proofImageUrl": "http://api.drterrace.com/static/payments/proof-101.png",
    "isVerified": false,
    "proof": {
      "hasProofImage": true,
      "proofImage": "/static/payments/proof-101.png",
      "proofImageUrl": "http://api.drterrace.com/static/payments/proof-101.png",
      "fileType": "image/png"
    },
    "verification": {
      "isVerified": false,
      "verifiedBy": null,
      "verifiedAt": null,
      "verificationNotes": null,
      "canVerify": true,
      "blockingPaymentId": null
    },
    "quotation": {
      "quotationId": 265,
      "quotationTitle": "Acrylic Elastomeric Coating",
      "propertyName": "Villa",
      "clientName": "Mr Test User",
      "mobileNumber": "8939497978",
      "clientMobile": "8939497978",
      "siteAddress": "Door 12, Main Street, Anna Nagar, Chennai, Tamil Nadu, 600040",
      "isConfirmed": true,
      "gstDecision": "APPLIED",
      "customerGstNumber": "33AAAAA0000A1Z5",
      "pricing": {
        "subTotal": 50000,
        "discount": null,
        "gst": {
          "percentage": 18,
          "amount": 9000,
          "cgst": { "percentage": 9, "amount": 4500 },
          "sgst": { "percentage": 9, "amount": 4500 }
        },
        "grandTotal": 59000
      },
      "progress": {
        "totalPaid": 5000,
        "balanceAmount": 54000,
        "paymentStatus": "PARTIALLY_PAID"
      },
      "totalWithGst": 59000,
      "totalPaid": 5000,
      "balanceAmount": 45000,
      "paymentStatus": "PARTIALLY_PAID"
    },
    "payment": {
      "id": 101,
      "amount": 5000,
      "paymentMethod": "CASH",
      "account": null,
      "upiId": null,
      "voucher": "VCH-001",
      "referenceNumber": null,
      "paymentDate": "2026-09-24",
      "balanceBefore": 50000,
      "balanceAfter": 45000,
      "proofImage": "/static/payments/proof-101.png",
      "notes": "Advance payment received on site",
      "isVerified": false,
      "verifiedBy": null,
      "verifiedAt": null,
      "verificationNotes": null,
      "receivedBy": "Field Employee (John)",
      "previousPaymentId": null
    }
  }
}
```

#### 7. Generate & Show Official Final Receipt (Full Receipt View)

Directly view or generate the official final receipt within the `quotation-payments` workflow.
Once the quotation is fully settled (`progress.paymentStatus === "FULLY_PAID"`) and all payments are verified by Admin, this endpoint compiles and returns the full official receipt (including assigned sequential `receiptNumber`, itemized base and variation services, tax calculations, customer address, and company details) and locks the quotation against further edits.

##### Endpoints

```http
GET /api/v2/quotation-payments/:id/final-receipt
POST /api/v2/quotation-payments/:id/final-receipt
Authorization: Bearer <jwt_token>
```
*Aliases: `GET /api/v2/quotation-payments/:id/receipt`, `POST /api/v2/quotation-payments/:id/receipt`, `GET /api/v2/quotations/:id/final-receipt`*

##### Optional Customer GST Number
You can optionally provide a customer GST Number:
- Via **Query Parameter**: `?customerGstNumber=33AAAAA0000A1Z5` (or `?customer_gst_number=...`)
- Via **POST Body**: `{ "customerGstNumber": "33AAAAA0000A1Z5" }`

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Final receipt generated successfully",
  "data": {
    "receiptNumber": "DRT500",
    "receiptDate": "2026-09-25T12:00:00.000Z",
    "quotationId": 120,
    "quotationTitle": "Residential Terrace Waterproofing - #120",
    "customer": {
      "name": "Rajesh Sharma",
      "mobileNumber": "9876543210",
      "address": "42, 1st Cross, Anna Nagar, Chennai, 600040",
      "gstNumber": "33AAAAA0000A1Z5"
    },
    "customerGstNumber": "33AAAAA0000A1Z5",
    "propertyAddress": "Anna Nagar Villa - 42, 1st Cross, Anna Nagar, Chennai, 600040",
    "taxDecision": "WITHOUT_GST",
    "isGstConfirmed": true,
    "isReceiptGenerated": true,
    "isReceiptLocked": true,
    "receiptGeneratedAt": "2026-09-25T12:00:00.000Z",
    "originalTotalPrice": 25000,
    "grossSubtotal": 25000,
    "discountPercentage": 0,
    "discountAmount": 0,
    "subtotalAfterDiscount": 25000,
    "withGst": false,
    "gstPercentage": 0,
    "gstAmount": 0,
    "cgst": 0,
    "sgst": 0,
    "grandTotal": 25000,
    "totalPaid": 25000,
    "balanceAmount": 0,
    "paymentStatus": "FULLY_PAID",
    "allServicesCompleted": true,
    "canGenerateReceipt": true,
    "receiptStatus": "GENERATED",
    "services": [
      {
        "id": 1,
        "title": "Terrace Waterproofing",
        "sqft": 100,
        "rate": 100,
        "totalPrice": 10000,
        "warranty": "5 Years"
      },
      {
        "id": 2,
        "title": "Balcony Waterproofing",
        "sqft": 100,
        "rate": 150,
        "totalPrice": 15000,
        "warranty": "2 Years"
      }
    ],
    "payments": [
      {
        "id": "1",
        "previousPaymentId": null,
        "amount": 4000,
        "paymentMethod": "UPI",
        "upiId": "customer@okhdfcbank",
        "notes": "Advance token",
        "receivedBy": "Field Employee",
        "isVerified": true,
        "verifiedBy": "Admin (admin)",
        "createdAt": "2026-09-24T10:00:00.000Z"
      }
    ],
    "companyContact": { ... },
    "terms": "..."
  }
}
```

##### Receipt Status in Payment Summary (`GET /api/v2/quotation-payments/:id`)
`GET /api/v2/quotation-payments/:id` returns comprehensive receipt readiness fields so your frontend knows exactly when to render the "Download Receipt" / "Show Final Receipt" button:
- `canGenerateReceipt: boolean` (`true` when `paymentStatus === "FULLY_PAID"` and all payments are verified)
- `isReceiptGenerated: boolean` (`true` once the official final receipt has been generated)
- `receiptNumber: string | null` (official sequential receipt number, e.g. `DRT500` or `DRT ATEG 016/26-27`)
- `receiptGeneratedAt: string | null` (ISO timestamp)
- `isReceiptLocked: boolean` (`true` when locked)
- `receiptStatus`: `"PENDING"` | `"READY"` | `"GENERATED"`
- `receipt: { canGenerateReceipt, isReceiptGenerated, receiptNumber, receiptGeneratedAt, isReceiptLocked, receiptStatus }`

---

#### 8. Post-Sale Warranty Integration for Quotation Payments

The new `quotation-payments` architecture is 100% integrated with the Warranty system. Once a quotation is fully paid and verified, clients and field employees can configure and generate official warranty certificates directly using the `/quotation-payments/:id/warranty*` routes.

##### Warranty Eligibility Criteria
1. **Fully Paid**: `progress.paymentStatus === "FULLY_PAID"` (all balances cleared either with or without GST).
2. **All Payments Verified**: Every single payment in the quotation's audit chain has `isVerified: true` (Admin approval).
3. **Automatic Official Receipt Locking**: If a receipt number has not yet been assigned, configuring or generating the warranty automatically assigns the next official sequential receipt number (e.g. `DRT502` or `DRT ATEG 016/26-27`) and permanently locks it on the quotation (`is_receipt_generated = true, is_receipt_locked = true`).
4. **Service Scope**: Available services are the quotation's own service lines.

##### Endpoints Summary

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v2/quotation-payments/:id/warranty-eligibility` | Checks if quotation is eligible to configure warranty | Admin, Field Employee |
| `GET` | `/api/v2/quotation-payments/:id/warranty-config` | Fetches existing config, or the quotation's available services | Admin, Field Employee |
| `POST` | `/api/v2/quotation-payments/:id/warranty-config` | Creates warranty duration configuration per service | Admin, Field Employee |
| `PATCH` | `/api/v2/quotation-payments/:id/warranty-config` | Updates warranty configuration (before warranty generation) | Admin, Field Employee |
| `POST` | `/api/v2/quotation-payments/:id/warranty` | Generates final warranty certificate (locks config) | Admin, Field Employee |
| `GET` | `/api/v2/quotation-payments/:id/warranty` | Retrieves generated warranty certificate with all items | Admin, Field Employee |
| `DELETE` | `/api/v2/quotation-payments/:id/warranty` | Deletes warranty at any time (unlocks config) | Admin Only |

*(Note: Standard `/api/v2/quotations/:id/warranty*` aliases are also fully supported).*

---

### Payments & Blockchain Ledger (Unified)

Dr. Terrace API v2 features an immutable, cryptographic pointer-linked payment ledger. Every payment recorded against a quotation links directly to the immediately preceding payment block via `previousPaymentId`, anchoring to a Genesis block (`null`) created upon quotation confirmation.

```mermaid
flowchart LR
    GENESIS["Genesis Block<br/><b>Quotation Confirmed</b>"]
    
    subgraph S1 ["Base Service 1: Surface Prep (₹15k)"]
        P1["Payment #1 (CASH)<br/>id: <b>uuid-1</b><br/>prev: <b>null</b><br/>amt: ₹10,000"]
        P2["Payment #2 (UPI)<br/>id: <b>uuid-2</b><br/>prev: <b>uuid-1</b><br/>amt: ₹5,000<br/><b>✓ COMPLETED</b>"]
    end

    subgraph S2 ["Base Service 2: Primer Coating (₹20k)"]
        P3["Payment #3 (ACCOUNT)<br/>id: <b>uuid-3</b><br/>prev: <b>uuid-2</b><br/>amt: ₹10,000<br/><b>⏳ PENDING</b>"]
    end

    GENESIS -.-> P1
    P1 --> P2
    P2 --> P3

    style GENESIS fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px
    style P1 fill:#dcfce7,stroke:#15803d,stroke-width:2px
    style P2 fill:#dcfce7,stroke:#15803d,stroke-width:2px
    style P3 fill:#fef3c7,stroke:#b45309,stroke-width:2px
```

#### TypeScript Types & Models

```typescript
type UUID = string;

type PaymentStatus = "PENDING" | "COMPLETED";

type PaymentType = "CASH" | "ACCOUNT" | "UPI";

type BasePayment = {
  id: UUID;
  amount: number;
  previousPaymentId: UUID | null;
  proofImage?: string | null;      // Path/URL to uploaded proof receipt or voucher
  isVerified: boolean;             // True if verified by Admin, false if pending
  verifiedBy?: string | null;      // Admin name/identifier who approved the payment
  verifiedAt?: string | null;      // ISO timestamp of admin verification
  createdAt: string;
};

type CashPayment = BasePayment & {
  paymentMethod: "CASH";
  voucher: string;
};

type AccountPayment = BasePayment & {
  paymentMethod: "ACCOUNT";
  accountId: number;
  bankName?: string;
  accountNumber?: string;
};

type UpiPayment = BasePayment & {
  paymentMethod: "UPI";
  upiId: string;
};

type PaymentChain = CashPayment | AccountPayment | UpiPayment;

type Service = {
  id: number;
  title: string;
  sqft: number;
  rate?: number;
  originalPrice: number;           // Undiscounted base cost = sqft * rate
  discountAmount: number;          // Option A pro-rata discount allocated to this line item
  totalPrice: number;              // Net target payable = originalPrice - discountAmount
  paidAmount: number;
  balanceAmount: number;
  paymentType: PaymentType;
  status: PaymentStatus;           // COMPLETED when paidAmount >= totalPrice
  warranty: string;
  warrantyYears: number;
  isWarrantyApplicable: boolean;
  payments: PaymentChain[];
};

type GstPaymentDetails = {
  id: number;                      // 0 for virtual GST clearance milestone
  title: string;                   // "GST Tax Clearance"
  sqft: number;                    // 0
  rate: number;                    // 0
  originalPrice: number;           // Total calculated GST amount in ₹
  discountAmount: number;          // 0
  totalPrice: number;              // Total payable GST amount in ₹
  paidAmount: number;              // Sum of all GST payments recorded
  balanceAmount: number;           // Remaining unpaid GST tax balance
  gstPercentage: number;           // Configured GST % (e.g. 18.0)
  gstAmount: number;               // Total calculated GST amount in ₹
  cgst: number;                    // Central GST split (50%)
  sgst: number;                    // State GST split (50%)
  status: PaymentStatus;           // "PENDING" or "COMPLETED"
  paymentType: PaymentType;        // Last payment method used ("CASH" | "ACCOUNT" | "UPI")
  warranty: string;
  warrantyYears: number;
  isWarrantyApplicable: boolean;
  payments: PaymentChain[];        // List of all GST tax payment transactions
};

type PaymentState = {
  id: number;
  title: string;
  originalTotalPrice: number;      // Undiscounted sum of all base services
  totalPrice: number;              // Net target sum of all base services after discount
  totalPaid: number;               // Sum of all payments (services + GST)
  balanceAmount: number;           // max(0, totalWithGst - totalPaid)
  services: Service[];             // Quotation service lines (pro-rata discounted, can be paid in any order)
  grossSubtotal: number;           // Same as originalTotalPrice (sum of the service lines before discount)
  withDiscount: boolean;           // Dynamic toggle: true if discount is active
  isDiscount: boolean;             // Boolean alias for withDiscount
  discountPercentage: number;      // Discount rate % (e.g. 10 for 10%)
  discountAmount: number;          // Pre-tax discount spread across the lines (quotation pricing.discount.amountForTax)
  subtotalAfterDiscount: number;   // grossSubtotal - discountAmount (sum of the line totals)
  isTaxCustomer: boolean;          // Quotation tax state: tax invoice (true) vs cash bill (false)
  pricing: QuotationPricing;       // The quotation pricing (subTotal, discount, gst, grandTotal): show these figures
  withGst: boolean;                // GST is charged (the quotation has a GST percentage)
  isGst: boolean;                  // Boolean alias for withGst
  isGstConfirmed: boolean;         // Always true (deprecated)
  gstPercentage: number;           // GST rate % (0 when no GST)
  gstAmount: number;               // GST line: totalWithGst - subtotalAfterDiscount (0 if withGst is false)
  totalWithGst: number;            // pricing.grandTotal: what the customer pays in full
  gstPayment: GstPaymentDetails | null; // Dedicated GST clearance details; null when withGst is false
  gstPayments: PaymentChain[];     // Array of GST payment chains (empty array if withGst is false)
  canMakePayment: boolean;         // True only if confirmed, balance > 0, AND hasUnverifiedPayments === false
  allServicesCompleted: boolean;   // True when every service line is fully paid
  canDecideGst: boolean;           // Deprecated, ignore: there is no GST decision to make any more (it can still read true)
  canGenerateReceipt: boolean;     // True only when fully paid, all verified, and all services completed
  isReceiptGenerated: boolean;     // True once final receipt is generated
  receiptNumber: string | null;    // Official receipt series e.g. "DRT ATEG 016/26-27" or "DRT500"
  receiptGeneratedAt: string | null; // ISO timestamp of receipt generation
  isReceiptLocked: boolean;        // True when quotation is locked post-receipt
  customerGstNumber?: string | null; // Optional client GSTIN
  hasUnverifiedPayments: boolean;  // True if any prior payment is pending admin verification
  unverifiedPaymentCount: number;  // Count of pending unverified payments
  currentActiveServiceId: number | null;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID";
  gstStatus: string;               // Status enum e.g. "WITH_GST_PAYMENT_PENDING", "WITHOUT_GST"
  receiptStatus: string;           // Status enum e.g. "READY", "GENERATED", "SERVICES_PENDING"
};

type SinglePaymentVerifyProof = {
  hasProofImage: boolean;
  proofImage: string | null;       // Stored relative path e.g. "/static/payments/<uuid>.png"
  proofImageUrl: string | null;   // Full accessible URL e.g. "http://192.168.1.10:9000/static/payments/<uuid>.png"
  fileType?: string | null;       // MIME type e.g. "image/png", "image/jpeg", "image/webp", "application/pdf"
};

type SinglePaymentVerifyStatus = {
  isVerified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  canVerify: boolean;             // false if an earlier payment in the chain is still unverified
  blockingPaymentId: string | null; // ID of the earliest unverified payment in the chain blocking this payment
};

type SinglePaymentVerifyService = {
  serviceId: number;
  serviceTitle: string;
  sqft?: number;
  rate?: number;
  originalPrice?: number;
  discountAmount?: number;
  totalPrice: number;
  paidAmount: number;
  balanceAmount: number;
  status: PaymentStatus;
  warranty?: string;
  warrantyYears?: number;
};

type SinglePaymentVerifyQuotation = {
  quotationId: number;
  quotationTitle: string;
  quotationDate?: string;
  clientName?: string;
  clientMobile?: string;
  siteAddress?: string;
  isConfirmed: boolean;
  totalWithGst: number;
  totalPaid: number;
  balanceAmount: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID";
};

type SinglePaymentVerifyViewResponse = {
  paymentId: string;
  amount: number;
  paymentMethod: "CASH" | "ACCOUNT" | "UPI" | string;
  voucher?: string | null;
  account?: {
    id: number;
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName?: string;
  } | null;
  upiId?: string | null;
  notes?: string | null;
  receivedBy: string;
  paymentDate?: string;
  createdAt: string;
  proofImage?: string | null;
  proofImageUrl?: string | null;
  isVerified?: boolean;
  proof: SinglePaymentVerifyProof;
  verification: SinglePaymentVerifyStatus;
  service?: SinglePaymentVerifyService | null;
  quotation: SinglePaymentVerifyQuotation;
};
```

---

#### Core Business Rules & Invariants

1. **Pre-Payment Confirmation Guard**: Payments can only be recorded for confirmed quotations (`isConfirmed: true`). Attempting to record payments on draft proposals returns `400 Bad Request`.
2. **Post-Payment Immutability Guard**: Once payment recording begins on a quotation, it is permanently locked against modification (`PUT`), deletion (`DELETE`), or unlocking (`POST /unlock`), returning `403 Forbidden`.
3. **Independent Base Service Payments (Any Order)**: Payments can be recorded against any base quotation service in any order. Preceding services are not required to be completed before making payments on subsequent services.
4. **Pro-Rata Service Discount Distribution**:
   - The quotation's pre-tax discount (`pricing.discount.amountForTax`) is spread across every line in
     proportion to `originalPrice`, in whole rupees. The shares always add up to the discount exactly.
   - The service's net target payable is `service.totalPrice = service.originalPrice - service.discountAmount`.
   - A service marks as `COMPLETED` as soon as `paidAmount >= totalPrice`.
5. **Dynamic GST & Discount Toggles**:
   - GST is charged when the quotation has a GST percentage; `isTaxCustomer` is the separate tax state (tax invoice vs cash bill, discount order). Both are set on the quotation and can be changed until the final receipt exists via `PATCH /pricing-config` (`withGst` / `gstPercentage` / `isTaxCustomer`). The tax state cannot be changed at final settlement.
   - Discount (`withDiscount` / `isDiscount`) can be enabled/disabled at quotation creation or via `PATCH /pricing-config`.
   - When enabled, custom rates (`gstPercentage`, `discountPercentage`) can be specified dynamically.
6. **Warranty Rules**:
   - `warranty: "5 Years"` $\to$ `warrantyYears: 5`, `isWarrantyApplicable: true`.
   - `warranty: "0"` or empty $\to$ `warrantyYears: 0`, `isWarrantyApplicable: false`.
7. **GST Follows The Quotation**:
   - Whether the receipt is a tax invoice or a cash bill is known from the start: it is the quotation's `isTaxCustomer`. There is no end-of-project GST election.
   - Totals follow the quotation pricing rules (see **Quotations**). The pre-tax discount is spread across every line, and the GST line is what the grand total adds on top.
   - For a tax customer the GST line equals `pricing.gst.amount`. For a non-tax customer it also absorbs the difference between the two discounts (₹53,000, 10%, 18%: GST line 8,586, GST 9,540), so show GST from `pricing.gst` and use `gstPayment` as the amount to collect.
   - `POST /api/v2/quotations/:id/final-settlement` settles the remaining balance. Its `withGst` field is optional and must match the quotation, otherwise the request fails with `400`.
8. **Cryptographic Chain Linking**:
   - Every payment has a UUID primary key.
   - The first payment is the Genesis block (`previousPaymentId: null`).
   - Every subsequent payment points strictly to the immediately preceding payment block.
9. **Payment Proof Image Mandatory for All Payments**:
    - Every payment recorded across the platform (service payments, GST clearance, or final settlement) **strictly requires a proof image** (`proofImage`).
    - Attempting to record any payment without a proof image or with an empty/null image returns `400 Bad Request`: `"Payment proof image is required"`.
    - **Direct file upload (`multipart/form-data`)**: Attach file with field name `proofImage` (or `proof`, `image`, `file`, `receipt`). Saved automatically to `static/payments/<uuid>.<ext>` and stored in PostgreSQL (`proof_image`).
    - **JSON payload (`application/json`)**: Pass `"proofImage": "/static/payments/custom_receipt.png"`.
    - Images are served statically from `/static/payments/*`.
10. **Admin Payment Verification Guard (Mandatory)**:
    - Every payment recorded by field employees defaults to `isVerified: false`.
    - **All previous payments on a quotation must be verified by Admin before any new payment can be made.**
    - If any unverified payments exist, attempting to record a new payment is rejected (`400 Bad Request`: `"Cannot record new payment: Previous payment (${id}) is pending Admin verification. Admin must verify all previous payments before a new payment can be recorded."`).
    - In `PaymentState`, `canMakePayment` is calculated as `quote.isConfirmed && balanceAmount > 0 && !hasUnverifiedPayments`.
    - Only `Role.ADMIN` can verify payments via `POST /api/v2/quotations/:id/payments/:paymentId/verify` (`403 Forbidden` for field employees).
11. **No GST Decision Gate**:
    - There is no With GST / Without GST choice at the end. `canDecideGst` is deprecated: ignore it (it can still read `true`).
    - `gstStatus` and `receiptStatus` never return `AWAITING_GST_DECISION`.
    - A final settlement or GST payment that contradicts the quotation's tax status returns `400`; change the status on the quotation (`PATCH /pricing-config`) instead.
12. **Non-GST vs GST Customer Settlement**:
    - **No GST (`withGst: false`)**: Balance is the service totals. Once they are paid and verified the status is `FULLY_PAID` and `canGenerateReceipt` unlocks (`receiptStatus: "READY"`).
    - **With GST (`withGst: true`)**: GST (e.g. 18%) is part of the balance from the start. Once all services are completed the remaining balance equals `gstAmount`. Client/staff records the tax payment via `POST /api/v2/quotations/:id/gst-payment` or `POST /api/v2/quotations/:id/final-settlement`. Final receipt remains **locked** until Admin verifies and approves the tax payment (`receiptStatus: "AWAITING_GST_PAYMENT"` $\to$ `"AWAITING_VERIFICATION"` $\to$ `"READY"`) The receipt is a **tax invoice** (`DRT ATEG 017/26-27`) when `isTaxCustomer` is true and a **cash bill** (`DRT500`) otherwise, with or without GST.
13. **Final Receipt Gatekeeper & Full Receipt Lock (`GET` / `POST /api/v2/quotations/:id/final-receipt`)**:
    - The official final receipt can be generated **ONLY** when `balanceAmount === 0`, `hasUnverifiedPayments === false`, and all services are completed.
    - **Persistence & Lock**: Upon generation, `isReceiptGenerated` is set to `true`, and `receiptNumber` (e.g. `REC-120-20260918`) and `receiptGeneratedAt` are permanently stored in the database.
    - **Full Receipt Lock**: The quotation is immediately locked (`isReceiptLocked: true`, `receiptStatus: "GENERATED"`). Any further attempts to record payments, modify pricing, or alter settlement will be rejected with `400 Bad Request`.
    - **Admin Override**: Admin can unlock/lock via `PATCH /api/v2/quotations/:id/receipt-lock`.
14. **Atomic Payment Failure Rollback ("If Any Payment Fails, Don't Save Any One")**:
    - **Final Settlement**: When a final settlement carries an inline payment (`POST /api/v2/quotations/:id/final-settlement` with `amount` or `POST /api/v2/quotations/:id/gst-payment`) and the payment fails, the other settings sent with it (GST percentage, discount, GST number) are **rolled back** and not saved. The quotation's `isTaxCustomer` is never changed by a settlement.
15. **Auto-Cleanup on Empty Payments ("If Payments Empty, Delete / Reset")**:
    - When a payment is deleted via `DELETE /api/v2/quotations/:id/payments/:paymentId`:
      - **GST Tax Clearance**: If all GST payments are deleted (`0 remaining`), the GST amount becomes unpaid again. GST stays on the quotation: `withGst` stays `true` and `gstPayment` is still populated with `paidAmount: 0`.
16. **Dedicated `gstPayment` Object & Nullability**:
    - In `PaymentState`, when `withGst` is `false` (no GST percentage on the quotation), `gstPayment` is `null` and `gstAmount` is `0`. All amounts are whole rupees.
    - Only when `withGst: true` is `gstPayment` populated with line-item details (`id: 0`, `title: "GST Tax Clearance"`, `originalPrice: gstAmount`, `paidAmount`, `balanceAmount`, `cgst`, `sgst`, `payments: []`, etc.).

---

#### 1. Get Payment State / Pay-View

Returns the complete unified `PaymentState`, including the quotation's service lines, chained payments, warranties, and bank account options:

```http
GET /api/v2/quotations/:id/pay-view
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 120,
    "title": "Residential Terrace Waterproofing - #120",
    "originalTotalPrice": 35000,
    "totalPrice": 31500,
    "totalPaid": 25000,
    "balanceAmount": 12170,
    "grossSubtotal": 35000,
    "withDiscount": true,
    "isDiscount": true,
    "discountPercentage": 10,
    "discountAmount": 3500,
    "subtotalAfterDiscount": 31500,
    "isTaxCustomer": true,
    "pricing": {
      "subTotal": 35000,
      "discount": { "percentage": 10, "amountForTax": 3500, "amountForNonTax": 4130 },
      "gst": {
        "percentage": 18,
        "amount": 5670,
        "cgst": { "percentage": 9, "amount": 2835 },
        "sgst": { "percentage": 9, "amount": 2835 }
      },
      "grandTotal": 37170
    },
    "withGst": true,
    "isGst": true,
    "isGstConfirmed": true,
    "gstPercentage": 18,
    "gstAmount": 5670,
    "totalWithGst": 37170,
    "canMakePayment": true,
    "allServicesCompleted": false,
    "canDecideGst": false,
    "canGenerateReceipt": false,
    "isReceiptGenerated": false,
    "receiptNumber": null,
    "receiptGeneratedAt": null,
    "isReceiptLocked": false,
    "customerGstNumber": "33AAAAA0000A1Z5",
    "gstStatus": "PENDING_SERVICES",
    "receiptStatus": "SERVICES_PENDING",
    "hasUnverifiedPayments": false,
    "unverifiedPaymentCount": 0,
    "currentActiveServiceId": 2,
    "paymentStatus": "PARTIALLY_PAID",
    "services": [
      {
        "id": 1,
        "title": "Surface Preparation & Crack Filling",
        "sqft": 1000,
        "rate": 15,
        "originalPrice": 15000,
        "discountAmount": 1500,
        "totalPrice": 13500,
        "paidAmount": 13500,
        "balanceAmount": 0,
        "paymentType": "UPI",
        "status": "COMPLETED",
        "warranty": "0",
        "warrantyYears": 0,
        "isWarrantyApplicable": false,
        "payments": [
          {
            "id": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
            "amount": 10000,
            "previousPaymentId": null,
            "paymentMethod": "CASH",
            "voucher": "VCH-2026-0081",
            "isVerified": true,
            "verifiedBy": "Admin (admin)",
            "verifiedAt": "2026-09-18T10:20:00.000Z",
            "createdAt": "2026-09-18T10:15:00.000Z"
          },
          {
            "id": "a91c7f42-32de-40c2-9e81-7c50a112b202",
            "amount": 3500,
            "previousPaymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
            "paymentMethod": "UPI",
            "upiId": "client@okhdfcbank",
            "isVerified": true,
            "verifiedBy": "Admin (admin)",
            "verifiedAt": "2026-09-18T11:15:00.000Z",
            "createdAt": "2026-09-18T11:00:00.000Z"
          }
        ]
      },
      {
        "id": 2,
        "title": "Primer & Chemical Coating",
        "sqft": 1000,
        "rate": 20,
        "originalPrice": 20000,
        "discountAmount": 2000,
        "totalPrice": 18000,
        "paidAmount": 11500,
        "balanceAmount": 6500,
        "paymentType": "ACCOUNT",
        "status": "PENDING",
        "warranty": "5 Years",
        "warrantyYears": 5,
        "isWarrantyApplicable": true,
        "payments": [
          {
            "id": "f882194a-bc12-42da-95a2-4410e309c303",
            "amount": 11500,
            "previousPaymentId": "a91c7f42-32de-40c2-9e81-7c50a112b202",
            "paymentMethod": "ACCOUNT",
            "accountId": 1,
            "isVerified": true,
            "verifiedBy": "Admin (admin)",
            "verifiedAt": "2026-09-18T12:45:00.000Z",
            "createdAt": "2026-09-18T12:30:00.000Z"
          }
        ]
      }
    ],
    "gstPayment": {
      "id": 0,
      "title": "GST Tax Clearance",
      "sqft": 0,
      "rate": 0,
      "originalPrice": 5670,
      "discountAmount": 0,
      "totalPrice": 5670,
      "paidAmount": 0,
      "balanceAmount": 5670,
      "gstPercentage": 18,
      "gstAmount": 5670,
      "cgst": 2835,
      "sgst": 2835,
      "status": "PENDING",
      "paymentType": "CASH",
      "warranty": "",
      "warrantyYears": 0,
      "isWarrantyApplicable": false,
      "payments": []
    },
    "gstPayments": [],
    "isConfirmed": true,
    "quotationId": 120,
    "quotation": {
      "id": 120,
      "title": "Residential Terrace Waterproofing - #120",
      "totalPrice": 31500,
      "grandTotal": 37170,
      "isConfirmed": true,
      "totalPaid": 25000,
      "balanceAmount": 12170,
      "paymentStatus": "PARTIALLY_PAID"
    },
    "accounts": [
      {
        "id": 1,
        "accountName": "Dr. Terrace Waterproofing",
        "bankName": "HDFC Bank",
        "accountNumber": "50200088991122",
        "ifscCode": "HDFC0000084",
        "branchName": "Nungambakkam Branch, Chennai",
        "isPrimary": true
      }
    ],
    "primaryAccount": {
      "id": 1,
      "accountName": "Dr. Terrace Waterproofing",
      "bankName": "HDFC Bank",
      "accountNumber": "50200088991122",
      "ifscCode": "HDFC0000084",
      "branchName": "Nungambakkam Branch, Chennai",
      "isPrimary": true
    }
  }
}
```

> [!NOTE]
> **GST Nullability & Default Representation**:
> - When `withGst: false` (no GST percentage on the quotation), `gstPayment` is `null`, `gstPayments: []`, and `gstAmount: 0`. `isTaxCustomer` (tax invoice vs cash bill) is separate; `isGstConfirmed` is always `true`.
> - Only when `withGst: true` is `gstPayment` populated with the dedicated `"GST Tax Clearance"` object and its nested `payments` array.

---

#### 2. Record Service Payment

Records a payment block for a base service. Payments can be recorded against any service in any order without sequential blocking. Supports both `multipart/form-data` with direct proof image file upload and `application/json`.

```http
POST /api/v2/quotations/:id/services/:serviceId/payments
Authorization: Bearer <jwt_token>
```

##### Option A: Direct File Upload (`multipart/form-data`) — Recommended
```bash
curl -X POST "http://localhost:9000/api/v2/quotations/120/services/1/payments" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "amount=5000" \
  -F "paymentMethod=UPI" \
  -F "upiId=client@okhdfcbank" \
  -F "notes=Stage 2 primer advance" \
  -F "proofImage=@/path/to/upi_receipt.png"
```

##### Option B: JSON Payload (`application/json`)
```json
{
  "amount": 5000,
  "paymentMethod": "UPI",
  "upiId": "client@okhdfcbank",
  "notes": "Stage 2 primer advance",
  "proofImage": "/static/payments/upi_receipt.png"
}
```

##### Payment Method Parameters:
- **`CASH`**: Requires `voucher` (string voucher or receipt number).
- **`ACCOUNT`**: Requires `accountId` (integer ID of bank account from `account_details`).
- **`UPI`**: Requires `upiId` (string UPI VPA e.g. `user@okhdfcbank`).
- **`proofImage`** (Required): File attachment in `multipart/form-data` (accepted field names: `proofImage`, `proof`, `image`, `file`, `receipt`) or string URL/path in JSON. Saved to `static/payments/<uuid>.<ext>` and served at `/static/payments/<filename>`. Must be provided for every payment.

##### Response (`201 Created`)

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Service payment recorded in blockchain ledger",
  "data": {
    "payment": {
      "id": "a91c7f42-32de-40c2-9e81-7c50a112b202",
      "amount": 5000,
      "previousPaymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
      "paymentMethod": "UPI",
      "upiId": "client@okhdfcbank",
      "proofImage": "/static/payments/a91c7f42-32de-40c2-9e81-7c50a112b202.png",
      "createdAt": "2026-09-18T11:00:00.000Z"
    },
    "state": { ... }
  }
}
```

---

#### 3. Confirm Final Settlement

Called at project handover to settle the remaining balance. `isTaxCustomer` (or the older `withGst` / `isGst`) is optional here and means the tax state; if sent it must match the quotation or the request fails with `400` (`"This quotation is for a tax customer. Change the tax status on the quotation instead of at final settlement."`). Supports optional final payment with proof image via `multipart/form-data` or `application/json`:

> [!NOTE]
> **Atomic Rollback on Payment Failure**: If an `amount` is sent with the final settlement request and recording the payment fails (e.g. invalid voucher, amount exceeds balance, unverified previous payment), the other settings sent with it (GST percentage, discount, GST number) are **rolled back** and not saved. The customer's tax status (`isTaxCustomer`) is never changed here; change it with `PATCH /api/v2/quotations/:id/pricing-config`.

```http
POST /api/v2/quotations/:id/final-settlement
Authorization: Bearer <jwt_token>
```

##### Option A: Direct File Upload (`multipart/form-data`) — Recommended
```bash
curl -X POST "http://localhost:9000/api/v2/quotations/120/final-settlement" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "isTaxCustomer=true" \
  -F "amount=12170" \
  -F "paymentMethod=ACCOUNT" \
  -F "accountId=1" \
  -F "notes=Final settlement upon project completion with 18% GST" \
  -F "proofImage=@/path/to/neft_bank_confirmation.pdf"
```

##### Option B: JSON Payload (`application/json`)
```json
{
  "isTaxCustomer": true,
  "amount": 12170,
  "paymentMethod": "ACCOUNT",
  "accountId": 1,
  "notes": "Final settlement upon project completion with 18% GST",
  "proofImage": "/static/payments/neft_bank_confirmation.pdf"
}
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Final settlement confirmed",
  "data": {
    "id": 120,
    "totalPrice": 31500,
    "isTaxCustomer": true,
    "withGst": true,
    "gstPercentage": 18,
    "totalWithGst": 37170,
    "totalPaid": 37170,
    "balanceAmount": 0,
    "paymentStatus": "FULLY_PAID",
    "...": "rest of PaymentState"
  }
}
```

---

#### 4. Dynamic Pricing Configuration (GST & Discount Toggles)

Allows updating the quotation's pricing settings during site execution or negotiation:

| Field | Effect |
|---|---|
| `isTaxCustomer` | Sets the tax state (discount order, tax invoice vs cash bill). |
| `gstPercentage` | Sets the GST rate; `0` removes GST. |
| `withGst` / `isGst` | `true` turns GST on (keeps a saved rate, or 18%), `false` sets it to 0. Ignored when `gstPercentage` is sent. |
| `discountPercentage` | Sets the discount rate; `0` removes the discount. |
| `withDiscount` / `isDiscount` | `false` removes the discount (sets the rate to 0). |

The quotation totals and the payment balance chain are recalculated immediately. Not allowed after the final receipt (`400`).

> [!TIP]
> **Automatic Activation**: If a non-zero `gstPercentage` or `discountPercentage` is sent without explicitly setting the boolean flag, the backend automatically sets `withGst: true` or `withDiscount: true`.
>
> **Option A Pro-Rata Recalculation**: Updating the discount percentage automatically recalculates the pro-rata discount for every line, updates `subtotalAfterDiscount`, re-evaluates GST on the discounted base, and recalculates remaining balance and service completion status.

```http
PATCH /api/v2/quotations/:id/pricing-config
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

##### Request Body
```json
{
  "withGst": true,
  "gstPercentage": 18,
  "withDiscount": true,
  "discountPercentage": 10
}
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Pricing configuration updated successfully",
  "data": {
    "id": 120,
    "title": "Residential Terrace Waterproofing - #120",
    "originalTotalPrice": 35000,
    "totalPrice": 31500,
    "totalPaid": 13500,
    "balanceAmount": 23670,
    "grossSubtotal": 35000,
    "withDiscount": true,
    "isDiscount": true,
    "discountPercentage": 10,
    "discountAmount": 3500,
    "subtotalAfterDiscount": 31500,
    "isTaxCustomer": true,
    "pricing": {
      "subTotal": 35000,
      "discount": { "percentage": 10, "amountForTax": 3500, "amountForNonTax": 4130 },
      "gst": {
        "percentage": 18,
        "amount": 5670,
        "cgst": { "percentage": 9, "amount": 2835 },
        "sgst": { "percentage": 9, "amount": 2835 }
      },
      "grandTotal": 37170
    },
    "withGst": true,
    "isGst": true,
    "gstPercentage": 18,
    "gstAmount": 5670,
    "totalWithGst": 37170,
    "canMakePayment": true,
    "hasUnverifiedPayments": false,
    "unverifiedPaymentCount": 0,
    "currentActiveServiceId": 2,
    "paymentStatus": "PARTIALLY_PAID",
    "services": [
      {
        "id": 1,
        "title": "Surface Preparation & Crack Filling",
        "sqft": 1000,
        "rate": 15,
        "originalPrice": 15000,
        "discountAmount": 1500,
        "totalPrice": 13500,
        "paidAmount": 13500,
        "balanceAmount": 0,
        "status": "COMPLETED"
      }
    ]
  }
}
```

---

#### 5. Verify Blockchain Ledger Integrity

Traverses the chronological pointer chain from the Genesis block to the latest block, verifying:
1. Genesis block has `previousPaymentId: null`.
2. Every subsequent block strictly points to the immediate predecessor block ID.
3. No orphan payments or broken links exist.

```http
GET /api/v2/quotations/:id/payments/verify-chain
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "isValid": true,
    "totalBlocks": 3,
    "genesisPaymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
    "latestPaymentId": "f882194a-bc12-42da-95a2-4410e309c303",
    "totalAmount": 25000,
    "chain": [
      {
        "id": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
        "previousPaymentId": null,
        "amount": 10000,
        "paymentMethod": "CASH",
        "serviceTitle": "Surface Preparation & Crack Filling",
        "createdAt": "2026-09-18T10:15:00.000Z"
      },
      {
        "id": "a91c7f42-32de-40c2-9e81-7c50a112b202",
        "previousPaymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
        "amount": 3500,
        "paymentMethod": "UPI",
        "serviceTitle": "Surface Preparation & Crack Filling",
        "createdAt": "2026-09-18T11:00:00.000Z"
      },
      {
        "id": "f882194a-bc12-42da-95a2-4410e309c303",
        "previousPaymentId": "a91c7f42-32de-40c2-9e81-7c50a112b202",
        "amount": 11500,
        "paymentMethod": "ACCOUNT",
        "serviceTitle": "Primer & Chemical Coating",
        "createdAt": "2026-09-18T12:30:00.000Z"
      }
    ]
  }
}
```

---

#### 6. Admin Verify Payment

Allows Admin to verify or approve a payment recorded on a quotation. All prior payments must be verified by Admin before any subsequent payment can be recorded.

> [!IMPORTANT]
> **Admin-Only**: This endpoint requires `Role.ADMIN`. Field technicians receive `403 Forbidden`.

```http
POST /api/v2/quotations/:id/payments/:paymentId/verify
PATCH /api/v2/quotations/:id/payments/:paymentId/verify
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```
*(Also available as direct endpoint: `POST /api/v2/payments/:paymentId/verify` or `PATCH /api/v2/payments/:paymentId/verify`)*

##### Request Body
```json
{
  "isVerified": true,
  "notes": "Verified against bank statement / voucher"
}
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment verified successfully by Admin",
  "data": {
    "paymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
    "isVerified": true,
    "verifiedBy": "Admin (admin)",
    "verifiedAt": "2026-09-18T10:30:00.000Z",
    "notes": "Verified against bank statement / voucher",
    "proof": {
      "hasProofImage": true,
      "proofImage": "/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
      "proofImageUrl": "http://192.168.1.10:9000/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
      "fileType": "image/png"
    },
    "verification": {
      "isVerified": true,
      "verifiedBy": "Admin (admin)",
      "verifiedAt": "2026-09-18T10:30:00.000Z",
      "verificationNotes": "Verified against bank statement / voucher",
      "canVerify": true,
      "blockingPaymentId": null
    },
    "state": {
      "id": 120,
      "canMakePayment": true,
      "hasUnverifiedPayments": false,
      "unverifiedPaymentCount": 0
    }
  }
}
```

---

#### 7. Single Payment Verification View

Focused on inspecting a single payment by `:paymentId`, returning its uploaded proof image, receipt/voucher details, verification chain status, and quotation/service context.

```http
GET /api/v2/payments/:paymentId/verify-view
GET /api/v2/quotations/:id/payments/:paymentId/verify-view
Authorization: Bearer <jwt_token>
```
*(Direct lookup also supported on `GET /api/v2/payments/:id` with UUID or integer ID)*

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "paymentId": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
    "amount": 5000,
    "paymentMethod": "CASH",
    "voucher": "VCH-2026-0001",
    "account": null,
    "upiId": null,
    "notes": "Advance collected via cash voucher",
    "receivedBy": "Field Employee (Karthik)",
    "paymentDate": "2026-09-20",
    "createdAt": "2026-09-20T10:30:00.000Z",
    "proofImage": "/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
    "proofImageUrl": "http://192.168.1.10:9000/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
    "isVerified": false,
    "proof": {
      "hasProofImage": true,
      "proofImage": "/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
      "proofImageUrl": "http://192.168.1.10:9000/static/payments/e4b2d180-87a3-4f91-b3b0-0b61e204a101.png",
      "fileType": "image/png"
    },
    "verification": {
      "isVerified": false,
      "verifiedBy": null,
      "verifiedAt": null,
      "verificationNotes": null,
      "canVerify": true,
      "blockingPaymentId": null
    },
    "service": {
      "serviceId": 1,
      "serviceTitle": "Surface Cleaning & Crack Seal",
      "sqft": 1000,
      "rate": 15,
      "originalPrice": 15000,
      "discountAmount": 1500,
      "totalPrice": 13500,
      "paidAmount": 5000,
      "balanceAmount": 8500,
      "status": "PENDING",
      "warranty": "5 Years",
      "warrantyYears": 5
    },
    "quotation": {
      "quotationId": 120,
      "quotationTitle": "Residential Terrace Waterproofing - #120",
      "quotationDate": "2026-09-20",
      "clientName": "Rajesh Sharma",
      "clientMobile": "9876543210",
      "siteAddress": "No. 42, 1st Cross, Anna Nagar, Chennai, Tamil Nadu, 600040",
      "isConfirmed": true,
      "totalWithGst": 37170,
      "totalPaid": 5000,
      "balanceAmount": 32170,
      "paymentStatus": "PARTIALLY_PAID"
    }
  }
}
```

> [!IMPORTANT]
> **Sequential Verification Guard**: If an earlier payment on the quotation is unverified, `verification.canVerify` evaluates to `false` and `verification.blockingPaymentId` references the preceding unverified payment ID.

---

#### 8. Record GST Clearance Payment

Records a payment specifically against the pending GST line of a quotation that charges GST (`withGst: true`). Returns `400` when the quotation has no GST. Continues the chronological blockchain ledger.

> [!NOTE]
> **Preconditions & Guards**:
> 1. **All service payments completed**: Base services and variation orders must be 100% completed (`allServicesCompleted === true`).
> 2. **Direct Payment / Auto-Enable**: If GST has not yet been confirmed, calling `POST /api/v2/quotations/:id/gst-payment` automatically enables `withGst: true` and confirms GST for this transaction.
> 3. **Verification Guard**: All previous payments must be verified by Admin (`assertAllPreviousPaymentsVerified`).
> 4. **Atomic Rollback**: If recording the GST payment fails (e.g. invalid voucher, amount exceeds GST balance), GST confirmation is **rolled back and NOT saved in the database**.
> 5. Remaining GST balance must be greater than 0.

```http
POST /api/v2/quotations/:id/gst-payment
Authorization: Bearer <jwt_token>
```

##### Option A: Direct File Upload (`multipart/form-data`) — Recommended
```bash
curl -X POST "http://localhost:9000/api/v2/quotations/120/gst-payment" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "amount=5670" \
  -F "paymentMethod=ACCOUNT" \
  -F "accountId=1" \
  -F "notes=Full 18% GST settlement via bank transfer" \
  -F "proofImage=@/path/to/gst_tax_challan.pdf"
```

##### Option B: JSON Payload (`application/json`)
```json
{
  "amount": 5670,
  "paymentMethod": "ACCOUNT",
  "accountId": 1,
  "notes": "Full 18% GST settlement via bank transfer",
  "proofImage": "/static/payments/gst_tax_challan.pdf"
}
```

##### Response (`201 Created`)

```json
{
  "statusCode": 201,
  "success": true,
  "message": "GST clearance payment recorded in blockchain ledger",
  "data": {
    "quotationId": 120,
    "title": "Residential Terrace Waterproofing - #120",
    "totalWithGst": 37170,
    "totalPaid": 37170,
    "balanceAmount": 0,
    "withGst": true,
    "gstPercentage": 18,
    "gstAmount": 5670,
    "hasUnverifiedPayments": true,
    "unverifiedPaymentCount": 1,
    "paymentStatus": "PARTIALLY_PAID",
    "gstStatus": "WITH_GST_VERIFICATION_PENDING",
    "receiptStatus": "AWAITING_VERIFICATION",
    "canGenerateReceipt": false,
    "services": [
      {
        "id": 1,
        "title": "Surface Preparation & Crack Filling",
        "totalPrice": 13500,
        "paidAmount": 13500,
        "balanceAmount": 0,
        "status": "COMPLETED"
      },
      {
        "id": 2,
        "title": "Primer & Chemical Coating",
        "totalPrice": 18000,
        "paidAmount": 18000,
        "balanceAmount": 0,
        "status": "COMPLETED"
      }
    ],
    "gstPayment": {
      "id": 0,
      "title": "GST Tax Clearance",
      "totalPrice": 5670,
      "paidAmount": 5670,
      "balanceAmount": 0,
      "gstPercentage": 18,
      "gstAmount": 5670,
      "cgst": 2835,
      "sgst": 2835,
      "status": "COMPLETED",
      "paymentType": "ACCOUNT",
      "payments": [
        {
          "id": "c1928374-e82b-42c1-a83d-9f821034bc99",
          "previousPaymentId": "b7391801-44cd-4e92-9118-8f6194b1e404",
          "amount": 5670,
          "paymentMethod": "ACCOUNT",
          "accountId": 1,
          "notes": "Full 18% GST settlement via bank transfer",
          "proofImage": "/static/payments/c1928374-e82b-42c1-a83d-9f821034bc99.pdf",
          "isVerified": false,
          "isGstPayment": true,
          "createdAt": "2026-09-18T14:30:00.000Z"
        }
      ]
    },
    "gstPayments": [
      {
        "id": "c1928374-e82b-42c1-a83d-9f821034bc99",
        "amount": 5670,
        "paymentMethod": "ACCOUNT",
        "isVerified": false,
        "isGstPayment": true
      }
    ]
  }
}
```

---

#### 9. Generate Final Official Receipt (Full Receipt View)

Generates and retrieves the official, fully itemized final receipt for a settled quotation. Once generated, the quotation is **automatically locked** (`isReceiptLocked: true`) to preserve immutable financial audit records.

> [!CAUTION]
> **Strict Receipt Gatekeeper**:
> The receipt endpoint will **FAIL** (`400 Bad Request`) unless ALL of the following criteria are met:
> 1. **Quotation Confirmed**: The quotation must be approved and confirmed (`is_confirmed = true`).
> 2. **All Services Completed**: Base services and variation orders must be 100% completed (`allServicesCompleted === true`).
> 3. **Tax Status Set**: Always satisfied: it is the quotation's `isTaxCustomer`. The receipt is a tax invoice (`taxDecision: "WITH_GST"`) or a cash bill (`"WITHOUT_GST"`); its amounts (`grossSubtotal`, `discountAmount`, `gstAmount`, `cgst`, `sgst`, `grandTotal`) and the `isTaxCustomer` / `pricing` fields come from the quotation pricing.
> 4. **Zero Balance**: All dues, including any GST, must be fully paid (`balanceAmount === 0`).
> 5. **Zero Unverified Payments**: Every single payment block in the blockchain ledger must be verified and approved by Admin (`hasUnverifiedPayments === false`).
>
> Check `PaymentState.canGenerateReceipt === true` (or `receiptStatus === "READY"`) before enabling the "Download / Print Receipt" button in your UI.

```http
GET /api/v2/quotations/:id/final-receipt
POST /api/v2/quotations/:id/final-receipt
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

##### Official Receipt Numbering Rules:
- **Without GST Receipts**:
  - Format: `${withoutGstPrefix}${withoutGstNextNumber}`, e.g., `DRT500`, `DRT501`, `DRT502`, ...
  - Starts sequentially at `500` and automatically increments atomically in the database upon each new receipt generation.
- **With GST Receipts**:
  - Format: `${withGstPrefix} ${withGstCode}/${financialYear}`, e.g., `DRT ATEG 016/26-27`.
  - Financial year is dynamically calculated based on the Indian Financial Year (April 1 to March 31):
    - Current FY (April 2026 to March 2027): `DRT ATEG 016/26-27`
    - Next FY (after April 1, 2027): Automatically rolls over to `DRT ATEG 016/27-28`
- **Admin Configuration**:
  - The series code (`"016"`), prefix (`"DRT ATEG"`), without-GST prefix (`"DRT"`), and counter start (`500`) can be configured dynamically from the Admin Panel via `GET` / `PUT /api/v2/receipt-settings`.

##### Optional Customer GST Number
You can optionally send `customerGstNumber` (or `customer_gst_number`):
- Via **POST JSON Body**: `{ "customerGstNumber": "33AAAAA0000A1Z5" }`
- Via **GET Query Param**: `?customerGstNumber=33AAAAA0000A1Z5`
- If omitted, the request succeeds normally without error.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Final receipt generated successfully",
  "data": {
    "receiptNumber": "DRT ATEG 016/26-27",
    "receiptDate": "2026-09-18T15:00:00.000Z",
    "quotationId": 120,
    "quotationTitle": "Residential Terrace Waterproofing - #120",
    "customer": {
      "name": "Rajesh Sharma",
      "mobileNumber": "9876543210",
      "doorNo": "42",
      "streetName": "1st Cross",
      "area": "Anna Nagar",
      "city": "Chennai",
      "state": "Tamil Nadu",
      "pincode": "600040",
      "address": "42, 1st Cross, Anna Nagar, Chennai, 600040",
      "gstNumber": "33AAAAA0000A1Z5"
    },
    "customerGstNumber": "33AAAAA0000A1Z5",
    "propertyAddress": "Anna Nagar Villa - 42, 1st Cross, Anna Nagar, Chennai, 600040",
    "taxDecision": "WITH_GST",
    "isTaxCustomer": true,
    "pricing": {
      "subTotal": 35000,
      "discount": { "percentage": 10, "amountForTax": 3500, "amountForNonTax": 4130 },
      "gst": {
        "percentage": 18,
        "amount": 5670,
        "cgst": { "percentage": 9, "amount": 2835 },
        "sgst": { "percentage": 9, "amount": 2835 }
      },
      "grandTotal": 37170
    },
    "isGstConfirmed": true,
    "isReceiptGenerated": true,
    "isReceiptLocked": true,
    "receiptGeneratedAt": "2026-09-18T15:00:00.000Z",
    "originalTotalPrice": 35000,
    "grossSubtotal": 35000,
    "discountPercentage": 10,
    "discountAmount": 3500,
    "subtotalAfterDiscount": 31500,
    "withGst": true,
    "gstPercentage": 18,
    "gstAmount": 5670,
    "cgst": 2835,
    "sgst": 2835,
    "grandTotal": 37170,
    "totalPaid": 37170,
    "balanceAmount": 0,
    "paymentStatus": "FULLY_PAID",
    "allServicesCompleted": true,
    "canGenerateReceipt": true,
    "receiptStatus": "GENERATED",
    "services": [
      {
        "id": 1,
        "title": "Surface Preparation & Crack Filling",
        "sqft": 1000,
        "rate": 15,
        "totalPrice": 13500,
        "warranty": "5 Years"
      },
      {
        "id": 2,
        "title": "Primer & Chemical Coating",
        "sqft": 1000,
        "rate": 20,
        "totalPrice": 18000,
        "warranty": "5 Years"
      }
    ],
    "payments": [
      {
        "id": "e4b2d180-87a3-4f91-b3b0-0b61e204a101",
        "previousPaymentId": null,
        "amount": 10000,
        "paymentMethod": "CASH",
        "voucher": "VCH-2026-0081",
        "notes": "Advance booking voucher",
        "receivedBy": "Field Employee (Karthik)",
        "isVerified": true,
        "verifiedBy": "Admin (admin)",
        "verifiedAt": "2026-09-18T10:20:00.000Z",
        "createdAt": "2026-09-18T10:15:00.000Z"
      },
      {
        "id": "c1928374-e82b-42c1-a83d-9f821034bc99",
        "previousPaymentId": "b7391801-44cd-4e92-9118-8f6194b1e404",
        "amount": 5670,
        "paymentMethod": "ACCOUNT",
        "notes": "Full 18% GST settlement via NEFT",
        "receivedBy": "Admin Office",
        "isVerified": true,
        "verifiedBy": "Admin (admin)",
        "verifiedAt": "2026-09-18T14:45:00.000Z",
        "createdAt": "2026-09-18T14:30:00.000Z"
      }
    ],
    "gstPayment": {
      "id": 0,
      "title": "GST Tax Clearance",
      "sqft": 0,
      "rate": 0,
      "originalPrice": 5670,
      "discountAmount": 0,
      "totalPrice": 5670,
      "paidAmount": 5670,
      "balanceAmount": 0,
      "gstPercentage": 18,
      "gstAmount": 5670,
      "cgst": 2835,
      "sgst": 2835,
      "status": "COMPLETED",
      "paymentType": "ACCOUNT",
      "warranty": "",
      "warrantyYears": 0,
      "isWarrantyApplicable": false,
      "payments": [
        {
          "id": "c1928374-e82b-42c1-a83d-9f821034bc99",
          "previousPaymentId": "b7391801-44cd-4e92-9118-8f6194b1e404",
          "amount": 5670,
          "paymentMethod": "ACCOUNT",
          "notes": "Full 18% GST settlement via NEFT",
          "receivedBy": "Admin Office",
          "isVerified": true,
          "verifiedBy": "Admin (admin)",
          "verifiedAt": "2026-09-18T14:45:00.000Z",
          "isGstPayment": true,
          "createdAt": "2026-09-18T14:30:00.000Z"
        }
      ]
    },
    "gstPayments": [
      {
        "id": "c1928374-e82b-42c1-a83d-9f821034bc99",
        "previousPaymentId": "b7391801-44cd-4e92-9118-8f6194b1e404",
        "amount": 5670,
        "paymentMethod": "ACCOUNT",
        "notes": "Full 18% GST settlement via NEFT",
        "receivedBy": "Admin Office",
        "isVerified": true,
        "verifiedBy": "Admin (admin)",
        "verifiedAt": "2026-09-18T14:45:00.000Z",
        "isGstPayment": true,
        "createdAt": "2026-09-18T14:30:00.000Z"
      }
    ],
    "companyContact": {
      "mobileNumber": "+91 98765 00000",
      "landlineNumber": "044-24567890",
      "emailAddress": "support@drterrace.com",
      "officeAddress": "No. 10, Industrial Estate, Guindy, Chennai - 600032"
    },
    "terms": "<p>1. All waterproofing works executed strictly in accordance with Dr. Terrace Technical Specifications.</p>\n<p>2. Warranty certificate will be effective from the date of final receipt issuance.</p>"
  }
}
```

---

#### 10. Admin Toggle Receipt Lock

Allows Admins to manually lock or unlock a quotation after a final receipt has been generated. When locked (`isReceiptLocked: true`), all further payments, pricing updates, and settlement changes are strictly blocked (`400 Bad Request`). If an emergency correction is required, an Admin can unlock the quotation (`isLocked: false`), make the adjustment, and re-lock it without losing the original `receiptNumber` or `receiptGeneratedAt`.

> [!IMPORTANT]
> **Admin-Only**: This endpoint requires `Role.ADMIN`. Field employees receive `403 Forbidden`.

```http
PATCH /api/v2/quotations/:id/receipt-lock
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "isLocked": false,
  "notes": "Emergency unlock by Admin to adjust variation service measurements"
}
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Quotation receipt lock status updated successfully",
  "data": {
    "id": 120,
    "isReceiptGenerated": true,
    "receiptNumber": "DRT ATEG 016/26-27",
    "receiptGeneratedAt": "2026-09-18T15:00:00.000Z",
    "isReceiptLocked": false,
    "receiptStatus": "READY"
  }
}
```

---

#### 11. Receipt Numbering Settings & Dynamic Series

Allows inspecting and configuring receipt prefixes, series codes, and next sequential counter numbers for official final receipts.

##### 13.1 Get Receipt Settings
```http
GET /api/v2/receipt-settings
Authorization: Bearer <jwt_token>
```
> [!NOTE]
> Accessible by both `Role.ADMIN` and `Role.FIELD_EMPLOYEE` to render preview badges or configuration views in the UI.

###### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 1,
    "withoutGstPrefix": "DRT",
    "withoutGstNextNumber": 500,
    "withGstPrefix": "DRT ATEG",
    "withGstCode": "016",
    "currentFinancialYear": "26-27",
    "nextWithoutGstReceiptNumber": "DRT500",
    "nextWithGstReceiptNumber": "DRT ATEG 016/26-27",
    "updatedAt": "2026-09-19T10:00:00.000Z"
  }
}
```

##### 13.2 Update Receipt Settings (Admin Configurable)
```http
PUT /api/v2/receipt-settings
PATCH /api/v2/receipt-settings
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "withGstCode": "016",
  "withGstPrefix": "DRT ATEG",
  "withoutGstPrefix": "DRT",
  "withoutGstNextNumber": 500
}
```

> [!IMPORTANT]
> **Admin-Only**: Requires `Role.ADMIN`. Field employees receive `403 Forbidden`. All fields in the body are optional.

###### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Receipt settings updated successfully",
  "data": {
    "id": 1,
    "withoutGstPrefix": "DRT",
    "withoutGstNextNumber": 500,
    "withGstPrefix": "DRT ATEG",
    "withGstCode": "016",
    "currentFinancialYear": "26-27",
    "nextWithoutGstReceiptNumber": "DRT500",
    "nextWithGstReceiptNumber": "DRT ATEG 016/26-27",
    "updatedAt": "2026-09-19T10:45:00.000Z"
  }
}
```

---

#### 12. Delete Payment & Auto-Cleanup Rules

Deletes a recorded payment by its ID (`UUID` hex string or milestone integer). Supports both quotation-scoped and global paths.

```http
DELETE /api/v2/quotations/:id/payments/:paymentId
DELETE /api/v2/payments/:paymentId
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment deleted successfully",
  "data": {
    "deleted": true
  }
}
```

##### Automated Ledger & State Cleanup Behaviors:
1. **Blockchain Pointer Repair**:
   - The cryptographic chain links are healed automatically: if payment $P_2$ pointed to $P_1$ and $P_3$ pointed to $P_2$, deleting $P_2$ automatically updates $P_3$'s `previousPaymentId` to point directly to $P_1$.
2. **GST Tax Clearance Deleted (GST Status Is Kept)**:
   - If the deleted payment was a GST tax clearance payment (`is_gst_payment = true`), the GST amount simply becomes unpaid again.
   - GST stays on the quotation: `withGst` remains `true` and `gstPayment` stays populated with `paidAmount: 0`. GST and the tax state are only changed on the quotation (`PATCH /pricing-config`), never by deleting a payment.
3. **Receipt Lock Guard**:
   - Payments cannot be deleted if the final receipt has already been generated and locked (`isReceiptLocked === true`). Attempting deletion returns `400 Bad Request`.
4. **Auto-Delete Related Proof Image File**:
   - The physical proof image file stored on disk (in `static/payments/` or `uploads/payments/`) associated with the deleted payment is automatically removed to prevent orphaned files and save disk space.
   - If another payment record in the database still references the exact same file path, the file is safely preserved.

---

#### 13. Clean Up Orphaned Payment Proof Images (Admin Only)

Periodically or on-demand purges unlinked proof image files from disk that were uploaded but never completed or linked to an active payment record.

```http
POST /api/v2/payments/cleanup-orphaned-images
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "olderThanSeconds": 60
}
```

> [!NOTE]
> `olderThanSeconds` defaults to `60` (1 minute). Files created within the last 60 seconds are safely preserved so active in-flight payment submissions are never interrupted.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Cleaned up 3 orphaned payment image(s) from disk",
  "data": {
    "scanned": 15,
    "deleted": 3,
    "remaining": 12
  }
}
```

---

### Warranty (Unified)

Warranty is a **post-receipt** module: it can only be configured and generated for a quotation whose final receipt has already been generated and locked (`isReceiptGenerated === true && isReceiptLocked === true`, see [Payments §11](#11-generate-final-official-receipt)). It follows a strict lifecycle:

```
Receipt generated & locked  ─▶  ELIGIBLE
        │  POST /warranty-config
        ▼
  CONFIGURED (warranty === null)  ─▶  editable via PATCH /warranty-config
        │  POST /warranty
        ▼
  GENERATED (warranty exists)  ─▶  config now locked, no more PATCH
        │  POST /warranty/verify (master admin only)  ─▶  VERIFIED (isVerified: true)
        │  DELETE /warranty (Admin while not verified; only a master admin once verified)
        ▼
  back to CONFIGURED (config preserved & editable again)
```

> [!IMPORTANT]
> The service list used to build the config form is the quotation's own service lines (**not** parsed out of the final-receipt response).
>
> **Compatible with Both Payment Modules**:
> - **Quotation-Payments Module (Recommended)**: Eligible when `paymentStatus === "FULLY_PAID"` and all payments are verified by Admin (`isVerified = true`). The warranty engine automatically generates and locks the next official sequential receipt number (`DRT...`) on the quotation when configured or generated.
> - **Legacy Payments Module**: Eligible when final official receipt has been generated and locked (`isReceiptGenerated === true && isReceiptLocked === true`).
> - **Dual Route Support**: Both `/api/v2/quotation-payments/:id/warranty*` and `/api/v2/quotations/:id/warranty*` are supported for all warranty operations.

#### 1. Check Warranty Eligibility

```http
GET /api/v2/quotation-payments/:id/warranty-eligibility
Authorization: Bearer <jwt_token>
```
*Alias: `GET /api/v2/quotations/:id/warranty-eligibility`*

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "quotationId": 481,
    "isEligible": true,
    "receiptNumber": "DRT ATEG 016/25-26",
    "hasConfig": false,
    "hasWarranty": false
  },
  "quotationId": 481,
  "isEligible": true,
  "receiptNumber": "DRT ATEG 016/25-26",
  "hasConfig": false,
  "hasWarranty": false
}
```
> If `isEligible` is `false`, a `reason` field explains why (final receipt not yet generated/locked).

---

#### 2. Get Warranty Config / Available Services

```http
GET /api/v2/quotations/:id/warranty-config
Authorization: Bearer <jwt_token>
```

If no config has been created yet, `config` is `null` and `availableServices` lists every service line on the quotation, each with a suggested pre-fill (`suggestedYears`, parsed from the quotation's own warranty string).

##### Response (`200 OK`) — no config yet
```json
{
  "statusCode": 200,
  "success": true,
  "data": null,
  "config": null,
  "availableServices": [
    { "serviceId": 12, "title": "Terrace Waterproofing", "suggestedYears": 5 },
    { "serviceId": 7,  "title": "Balcony Extension",     "suggestedYears": 2 }
  ]
}
```

##### Response (`200 OK`) — config exists
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 3,
    "quotationId": 481,
    "receiptNumber": "DRT ATEG 016/25-26",
    "warrantyStartDate": "2026-09-22",
    "configuredBy": "Admin (Suresh)",
    "supervisorId": "SUP-101",
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": "2026-09-22T10:00:00.000Z",
    "services": [
      { "id": 9, "serviceId": 12, "serviceTitle": "Terrace Waterproofing", "years": 5 },
      { "id": 10, "serviceId": 7, "serviceTitle": "Balcony Extension", "years": 1.5 }
    ]
  },
  "config": { "...": "same object as above" }
}
```

---

#### 3. Create Warranty Config

```http
POST /api/v2/quotations/:id/warranty-config
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "warrantyStartDate": "2026-09-22",
  "supervisorId": "SUP-101",
  "services": [
    { "serviceId": 12, "years": 5 },
    { "serviceId": 7,  "years": 1.5 }
  ]
}
```

> [!IMPORTANT]
> - Fails `400` if the quotation is not `isEligible` (see #1), if a config already exists (use PATCH instead), or if a warranty has already been generated.
> - Each `serviceId` must reference a real service line on this quotation — unknown IDs return `404`.
> - `supervisorId` is optional free text (trimmed, max 100 chars; empty/omitted = `null`; `supervisor_id` is also accepted). It is copied onto the warranty when it is generated.
> - `years` accepts **fractional values** (e.g. `1.5` = 18 months), rounded to 2 decimal places on save. Negative or non-numeric values return `400`.

##### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Warranty config created successfully",
  "data": { "...": "WarrantyConfigResponse, same shape as #2" },
  "config": { "...": "same object" }
}
```

---

#### 4. Update Warranty Config

```http
PATCH /api/v2/quotations/:id/warranty-config
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "warrantyStartDate": "2026-09-25",
  "supervisorId": "SUP-101",
  "services": [
    { "serviceId": 12, "years": 6 }
  ]
}
```

> [!IMPORTANT]
> Full replace, not a merge — `supervisorId` is overwritten too (omit it and it becomes `null`), and the `services` array you send **replaces** the existing config's service list entirely. Only allowed while `hasWarranty === false`; once a warranty has been generated, this returns `400` (an Admin must delete the warranty first to unlock editing again).

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Warranty config updated successfully",
  "data": { "...": "WarrantyConfigResponse" },
  "config": { "...": "same object" }
}
```

---

#### 5. Generate Warranty

```http
POST /api/v2/quotations/:id/warranty
Authorization: Bearer <jwt_token>
```

Snapshots the current config into an immutable warranty record. **Idempotent**: calling this again on an already-generated warranty simply returns the existing warranty rather than erroring.

> [!IMPORTANT]
> Fails `400` if warranty config hasn't been created yet, or if the quotation's receipt was somehow regenerated under a different number since the config was created (reconfigure in that case).

##### Response (`201 Created`)
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Warranty generated successfully",
  "data": {
    "id": 2,
    "quotationId": 481,
    "receiptNumber": "DRT ATEG 016/25-26",
    "warrantyStartDate": "2026-09-22",
    "generatedBy": "Admin (Suresh)",
    "supervisorId": "SUP-101",
    "generatedAt": "2026-09-22T10:15:00.000Z",
    "isVerified": false,
    "verifiedBy": null,
    "verifiedAt": null,
    "verificationNotes": null,
    "deletableUntil": null,
    "isDeletable": true,
    "items": [
      {
        "id": 5, "serviceId": 12, "serviceTitle": "Terrace Waterproofing",
        "years": 5, "warrantyStartDate": "2026-09-22", "warrantyEndDate": "2031-09-22"
      },
      {
        "id": 6, "serviceId": 7, "serviceTitle": "Balcony Extension",
        "years": 1.5, "warrantyStartDate": "2026-09-22", "warrantyEndDate": "2028-03-22"
      }
    ]
  },
  "warranty": { "...": "same object" }
}
```

---

#### 6. Get Warranty

```http
GET /api/v2/quotations/:id/warranty
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": { "...": "WarrantyResponse, same shape as #5, or null if none generated yet" },
  "warranty": { "...": "same object" }
}
```

---

#### 7. Delete Warranty

```http
DELETE /api/v2/quotations/:id/warranty
Authorization: Bearer <admin_jwt_token>
```

> [!IMPORTANT]
> **Admin-Only**: Requires `Role.ADMIN` (a master admin qualifies too). Field employees receive `403 Forbidden`.
> There is no time limit, but a **verified** warranty (`isVerified: true`) can only be deleted by a master admin; an
> admin gets `403` ("This warranty is verified. Only a master admin can delete it."). `isDeletable` is `false` while
> verified; `deletableUntil` is always `null`. Deleting clears the warranty back to `null` — the warranty
> config itself is preserved and becomes editable again via PATCH.

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Warranty deleted successfully"
}
```

##### Response (`404 Not Found`) — no warranty generated for this quotation
```json
{
  "statusCode": 404,
  "success": false,
  "message": "No warranty exists for this quotation"
}
```

---

#### 8. Verify Warranty (Master Admin Only)

```http
POST /api/v2/quotations/:id/warranty/verify
Authorization: Bearer <master_admin_jwt>
Content-Type: application/json

{ "isVerified": true, "verificationNotes": "Checked against the final receipt" }
```

`PATCH` and the `/api/v2/quotation-payments/:id/warranty/verify` path work the same way.

| Field | Rules |
|---|---|
| `isVerified` | Optional boolean, default `true`. Send `false` to remove the verification. |
| `verificationNotes` | Optional text, up to 1000 characters. |

- **Master admin only.** An admin or employee gets `403 Forbidden` ("Master admin access required").
- `404` if no warranty has been generated for the quotation yet.
- Verifying a warranty that is already verified changes nothing, so the first verifier and time are kept.
- A warranty starts **not verified**. Existing warranties were migrated as not verified.
- `verifiedBy` is `Master Admin (<name>)`. Unverifying clears `verifiedBy` and `verifiedAt`.

##### Response (`200 OK`)
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Warranty verified",
  "data": {
    "id": 2,
    "quotationId": 481,
    "isVerified": true,
    "verifiedBy": "Master Admin (System Administrator)",
    "verifiedAt": "2026-09-23T09:00:00.000Z",
    "verificationNotes": "Checked against the final receipt",
    "isDeletable": false,
    "items": [ "..." ]
  },
  "warranty": { "...": "same object" }
}
```

---

### Clients / Customers (Unified)

```http
GET /api/v2/clients?page=1&limit=20&search=Anna+Nagar
Authorization: Bearer <jwt_token>
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": 56,
      "clientId": 56,
      "appointmentId": 56,
      "clientName": "sam",
      "mobileNumber": "8925591969",
      "area": "Maduravoyal",
      "city": "Chennai"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

#### 2. Get Client Details

```http
GET /api/v2/clients/:id
Authorization: Bearer <jwt_token>
```

> **Unified Single Request**: Returns complete client profile and visit appointment details, plus all linked **`packages`**, **`quotations`** (each enriched with its own `payment` summary), and the primary active/confirmed **`payment`** (with pricing, progress, and payment history). Eliminates the need for multiple roundtrip requests from frontend/mobile apps.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 84,
    "appointmentId": 84,
    "clientName": "Mr Test a",
    "mobileNumber": "2648845464",
    "address": {
      "doorNo": "Pannak",
      "streetName": "Shah",
      "area": "Camp Road",
      "city": "Chennai",
      "state": "Tamil Nadu",
      "pincode": "600073"
    },
    "mapLocation": "Bsbsbdb",
    "appointmentDate": "2026-09-21",
    "appointmentFixDate": "2026-09-21",
    "appointmentTime": "06:25 PM",
    "propertyId": null,
    "propertyName": null,
    "property": null,
    "whereToWaterproof": [
      { "id": 1, "name": "Terrace Waterproofing" },
      { "id": 2, "name": "Bathroom Waterproofing" }
    ],
    "whereToWaterproofIds": [1, 2],
    "employeeId": 100,
    "assignedEmployeeId": 100,
    "employeeName": "sam",
    "appointmentAttend": {
      "id": 9,
      "appointmentId": 84,
      "customerId": 84,
      "clientName": "Mr Test a",
      "employeeId": 100,
      "employeeName": "sam",
      "date": "2026-09-21",
      "time": "18:26",
      "createdAt": "2026-09-21T12:56:45.169Z"
    },
    "packages": [
      { "packageId": 1, "packages": "Economic", "quotations": [] },
      { "packageId": 2, "packages": "Premium", "quotations": [] },
      {
        "packageId": 3,
        "packages": "Elite",
        "quotations": [
          {
            "quotationId": "144",
            "packageId": 3,
            "packageName": "Polyurethane based  Polyurea coating",
            "quotationTitle": "Polyurethane based  Polyurea coating",
            "revisionNo": 1,
            "amount": 35431158,
            "isConfirmed": true,
            "quotationDate": "2026-09-21",
            "payment": { /* Quotation Payment Summary from /quotation-payments/:id */ }
          }
        ]
      }
    ],
    "quotations": [
      {
        "quotationId": "144",
        "packageId": 3,
        "packageName": "Polyurethane based  Polyurea coating",
        "quotationTitle": "Polyurethane based  Polyurea coating",
        "revisionNo": 1,
        "amount": 35431158,
        "isConfirmed": true,
        "quotationDate": "2026-09-21",
        "payment": { /* Quotation Payment Summary from /quotation-payments/:id */ }
      }
    ],
    "payment": {
      "quotationId": 144,
      "quotationTitle": "Polyurethane based  Polyurea coating",
      "propertyName": "Apartment",
      "clientName": "Mr Test a",
      "mobileNumber": "2648845464",
      "gstDecision": "APPLIED",
      "isTaxCustomer": true,
      "invoiceType": "TAX_INVOICE",
      "customerGstNumber": null,
      "pricing": {
        "subTotal": 33362672,
        "discount": { "percentage": 10, "amountForTax": 3336267, "amountForNonTax": 3936795 },
        "gst": {
          "percentage": 18,
          "amount": 5404753,
          "cgst": { "percentage": 9, "amount": 2702377 },
          "sgst": { "percentage": 9, "amount": 2702376 }
        },
        "grandTotal": 35431158
      },
      "progress": {
        "totalPaid": 0,
        "balanceAmount": 35431158,
        "paymentStatus": "UNPAID"
      },
      "history": []
    }
  }
}
```

#### 3. Client Quotations History

```http
GET /api/v2/clients/:id/quotations
Authorization: Bearer <jwt_token>
```

> [!TIP]
> **Performance Recommendation**: If you are displaying the client screen, calling `GET /api/v2/clients/:id` already includes `packages`, `quotations`, and `payment`. You do **not** need to call this endpoint separately during client screen load. This standalone endpoint remains available for isolated quotation history lookups or refreshing quotations without reloading the customer profile.

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "appointmentId": 84,
    "packages": [
      {
        "packageId": 1,
        "packages": "Economic",
        "quotations": []
      },
      {
        "packageId": 2,
        "packages": "Premium",
        "quotations": []
      },
      {
        "packageId": 3,
        "packages": "Elite",
        "quotations": [
          {
            "quotationId": "144",
            "packageId": 3,
            "packageName": "Polyurethane based  Polyurea coating",
            "quotationTitle": "Polyurethane based  Polyurea coating",
            "revisionNo": 1,
            "amount": 35431158,
            "isConfirmed": true,
            "quotationDate": "2026-09-21",
            "payment": { /* Quotation Payment Summary from /quotation-payments/:id */ }
          }
        ]
      },
      {
        "packageId": null,
        "packages": "None",
        "quotations": []
      }
    ],
    "quotations": [
      {
        "quotationId": "144",
        "packageId": 3,
        "packageName": "Polyurethane based  Polyurea coating",
        "quotationTitle": "Polyurethane based  Polyurea coating",
        "revisionNo": 1,
        "amount": 35431158,
        "isConfirmed": true,
        "quotationDate": "2026-09-21",
        "payment": { /* Quotation Payment Summary from /quotation-payments/:id */ }
      }
    ],
    "payment": {
      "quotationId": 144,
      "quotationTitle": "Polyurethane based  Polyurea coating",
      "propertyName": "Apartment",
      "clientName": "Mr Test a",
      "mobileNumber": "2648845464",
      "gstDecision": "APPLIED",
      "isTaxCustomer": true,
      "invoiceType": "TAX_INVOICE",
      "customerGstNumber": null,
      "pricing": {
        "subTotal": 33362672,
        "discount": { "percentage": 10, "amountForTax": 3336267, "amountForNonTax": 3936795 },
        "gst": {
          "percentage": 18,
          "amount": 5404753,
          "cgst": { "percentage": 9, "amount": 2702377 },
          "sgst": { "percentage": 9, "amount": 2702376 }
        },
        "grandTotal": 35431158
      },
      "progress": {
        "totalPaid": 0,
        "balanceAmount": 35431158,
        "paymentStatus": "UNPAID"
      },
      "history": []
    }
  }
}
```

---

### Appointment Schedules (Unified)

#### 1. List Schedules

```http
GET /api/v2/appointment-schedules?date=2026-09-22
Authorization: Bearer <jwt_token>
```

#### 2. Book or Update Schedule Slots

```http
POST /api/v2/appointment-schedules
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "appointmentDate": "2026-09-25",
  "appointmentTime": "10:00",
  "slot10To12": 1,
  "slot12To14": 0,
  "slot14To16": 1,
  "slot16To18": 0
}
```

---

### Company & Employee Policies (Unified)

#### 1. View Company Policies

```http
GET /api/v2/employee-policies
Authorization: Bearer <jwt_token>
```

#### 2. View Latest Policy

```http
GET /api/v2/employee-policies/latest
Authorization: Bearer <jwt_token>
```

#### 3. Manage Policies (Admin Only)

- `POST /api/v2/employee-policies` (Create policy)
- `PUT/PATCH /api/v2/employee-policies/reorder` (Reorder policies sequence: `{ order: [{ id: 1, sequence: 1 }, ...] }`)
- `PUT /api/v2/employee-policies/:id` (Update policy)
- `DELETE /api/v2/employee-policies/:id` (Delete policy)

---

### Push Notifications

Expo push notifications plus an in-app inbox. Every endpoint is scoped to the signed-in user (Admin or Field
Employee). Sending is fire-and-forget: a failed push never affects the request that caused it. Set
`PUSH_ENABLED=false` on the server to turn pushes and inbox rows off.

| Type | Sent to | When |
|---|---|---|
| `appointment_assigned` | The assigned field employee | An appointment is assigned to them |
| `payment_pending_verification` | Every admin | A payment recorded by an employee needs verification |
| `payment_verified` | The quotation's field employee | An admin verifies a payment |
| `warranty_generated` | The quotation's field employee | A warranty certificate is generated (see below) |
| `warranty_verified` | The quotation's field employee | The master admin approves (verifies) the warranty (see below) |

The person who triggered a notification never receives it. `data` carries ids only (`appointmentId`, `quotationId`,
`paymentId`), never personal data. Tapping a notification should open the matching screen; `warranty_generated`
and `warranty_verified` open that customer's Warranty tab.

**Warranty notification rules**

- Sent once, when a new warranty is actually generated (`POST /api/v2/quotations/:id/warranty` or
  `POST /api/v2/quotation-payments/:id/warranty`), after the transaction commits.
- Not sent for a repeat request (the existing warranty is returned), for a request that lost a race, or when saving the
  warranty configuration.
- Not sent when the quotation has no field employee, or when the field employee is the one who generated it.
- `warranty_verified` is sent when the master admin approves the warranty (`POST` or `PATCH` on
  `.../warranty/verify`), once, and only when the warranty really changes from not verified to verified. It is not
  sent for a repeat approval of an already verified warranty, or when the approval is removed
  (`isVerified: false`). Approving it again after removing the approval sends a new one.

```json
{
  "type": "warranty_generated",
  "title": "Warranty certificate ready",
  "body": "The warranty certificate for your customer was generated. Tap to view it.",
  "data": { "quotationId": 83, "appointmentId": 34 }
}
```

```json
{
  "type": "warranty_verified",
  "title": "Warranty approved",
  "body": "The warranty for your customer was approved by the master admin. Tap to view it.",
  "data": { "quotationId": 83, "appointmentId": 34 }
}
```

#### Register / remove a device

```http
POST /api/v2/notifications/device-token
Authorization: Bearer <jwt_token>
Content-Type: application/json

{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "android" }
```

Returns `{ "statusCode": 200, "success": true, "message": "Device registered" }`. A token belongs to one user at a
time: registering it again moves it. A value that isn't an Expo push token returns `400`.

```http
DELETE /api/v2/notifications/device-token
Content-Type: application/json

{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

Removes only the caller's own token (`"Device unregistered"`).

#### Inbox

```http
GET /api/v2/notifications?page=1&limit=20
```

`limit` is capped at 100. Newest first.

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": "412",
      "type": "warranty_generated",
      "title": "Warranty certificate ready",
      "body": "The warranty certificate for your customer was generated. Tap to view it.",
      "data": { "quotationId": 83, "appointmentId": 34 },
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-10-02T09:41:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "unreadCount": 1
}
```

| Endpoint | Effect |
|---|---|
| `PATCH /api/v2/notifications/:id/read` | Marks one notification read (`404` if it isn't yours) |
| `POST /api/v2/notifications/read-all` | Marks every unread notification read |

---

### WhatsApp Webhook (Meta Cloud API)

Called by Meta, **not by the app**. There is no JWT; the POST is authenticated by Meta's signature. Configure it in Meta → WhatsApp → Configuration with the callback URL `https://<domain>/api/v2/webhooks/whatsapp` and subscribe to the `messages` field.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v2/webhooks/whatsapp` | Verification handshake. Needs `hub.mode=subscribe`, `hub.verify_token` (must equal `WHATSAPP_VERIFY_TOKEN`) and `hub.challenge`; echoes the challenge as plain text, else `403`. |
| `POST` | `/api/v2/webhooks/whatsapp` | Event delivery. `X-Hub-Signature-256` is checked against `WHATSAPP_APP_SECRET` over the raw body (`401` if invalid or if the secret is not configured). Inbound messages go to `whatsapp_messages`, delivery statuses (sent/delivered/read/failed) to `whatsapp_message_statuses`; duplicates are ignored. A database error returns `500` so Meta retries. |

Env vars: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

---

### System Health

```http
GET /api/v2/health
```

##### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "status": "UP",
  "database": "UP",
  "uptime": 124.52
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

| Resource                   |      Methods      | Primary Endpoint                             | Alias Endpoint                   | Allowed Roles | Description                                |
| :------------------------- | :---------------: | :------------------------------------------- | :------------------------------- | :-----------: | :----------------------------------------- |
| **Where to Waterproof**    |       `GET`       | `/api/v2/where-to-waterproof`                | `/api/v2/whereforwaterproof`     |     Both      | Waterproofing locations catalog            |
|                            | `POST/PUT/DELETE` | `/api/v2/where-to-waterproof/:id`            | -                                |    `ADMIN`    | Manage locations catalog                   |
| **Properties**             |       `GET`       | `/api/v2/properties`                         | -                                |     Both      | Property categories (Terrace, Wall, etc.)  |
|                            | `POST/PUT/DELETE` | `/api/v2/properties/:id`                     | -                                |    `ADMIN`    | Manage properties                          |
| **Packages**               |       `GET`       | `/api/v2/packages`                           | -                                |     Both      | Service packages & warranty info           |
|                            | `POST/PUT/DELETE` | `/api/v2/packages/:id`                       | -                                |    `ADMIN`    | Manage packages                            |
| **Package Sub-Categories** |       `GET`       | `/api/v2/packages/:packageId/sub-categories` | `/api/v2/package-sub-categories` |     Both      | Sub-categories under a package             |
|                            | `POST/PUT/DELETE` | `/api/v2/package-sub-categories/:id`         | -                                |    `ADMIN`    | Manage package sub-categories              |
| **Services**               |       `GET`       | `/api/v2/services`                           | -                                |     Both      | Master services list with tiers & warranty |
|                            | `POST/PUT/DELETE` | `/api/v2/services/:id`                       | -                                |    `ADMIN`    | Manage master services                     |
| **Service Details**        |       `GET`       | `/api/v2/service-details`                    | -                                |     Both      | Granular service description items & rates |
|                            | `POST/PUT/DELETE` | `/api/v2/service-details/:id`                | -                                |    `ADMIN`    | Manage service description items & rates   |
| **Terms & Conditions**     |       `GET`       | `/api/v2/terms-and-conditions`               | `/api/v2/terms`                  |     Both      | Standard proposal terms & conditions       |
|                            | `POST/PUT/DELETE` | `/api/v2/terms-and-conditions/:id`           | `/api/v2/terms/reorder`          |    `ADMIN`    | Manage terms & reorder sequences           |
| **Office Contact Info**    |       `GET`       | `/api/v2/contact-info`                       | `/api/v2/contact-information`    |     Both      | Official company header/contact details    |
|                            |       `PUT`       | `/api/v2/contact-info`                       | -                                |    `ADMIN`    | Update company contact details             |
| **Bank Account Details**   |       `GET`       | `/api/v2/account-details`                    | `/api/v2/accountdetails`         |     Both      | Official company bank accounts for payments |
|                            |       `GET`       | `/api/v2/account-details/primary`            | -                                |     Both      | Current primary bank account for transfers  |
|                            | `POST/PUT/DELETE` | `/api/v2/account-details/:id`                | -                                |    `ADMIN`    | Manage company bank accounts                |
|                            |      `PATCH`      | `/api/v2/account-details/:id/set-primary`    | -                                |    `ADMIN`    | Set default primary account for payments    |
| **Employees / Staff**      |       `GET`       | `/api/v2/employees`                          | -                                |     Both      | Active field technicians & staff list      |
|                            | `POST/PUT/DELETE` | `/api/v2/employees/:id`                      | -                                |    `ADMIN`    | Staff management with photo upload         |

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
    {
      "id": 1,
      "name": "Standard Coating",
      "warranty": 5,
      "packages": "Standard"
    },
    {
      "id": 2,
      "name": "Premium Polyurethane",
      "warranty": 10,
      "packages": "Premium"
    }
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

#### 5. Bank Account Details (Unified)

In API v2, company bank accounts are managed centrally under `/api/v2/account-details`. Clients and field staff query these to populate transfer destinations during `ACCOUNT` payments. Publicly viewable; write operations require `Role.ADMIN`.

##### A. List All Bank Accounts

```http
GET /api/v2/account-details
Authorization: Bearer <jwt_token>
```
*Alias: `GET /api/v2/accountdetails`*

###### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": 1,
      "accountName": "Dr. Terrace Waterproofing Pvt Ltd",
      "bankName": "HDFC Bank",
      "accountNumber": "50200012345678",
      "ifscCode": "HDFC0001234",
      "branchName": "T Nagar",
      "isPrimary": true
    },
    {
      "id": 2,
      "accountName": "Dr. Terrace Waterproofing Pvt Ltd",
      "bankName": "ICICI Bank",
      "accountNumber": "001105009876",
      "ifscCode": "ICIC0000011",
      "branchName": "Anna Nagar",
      "isPrimary": false
    }
  ]
}
```

##### B. Get Primary Bank Account

Directly retrieves the currently active default company bank account.

```http
GET /api/v2/account-details/primary
Authorization: Bearer <jwt_token>
```

###### Response (`200 OK`)

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 1,
    "accountName": "Dr. Terrace Waterproofing Pvt Ltd",
    "bankName": "HDFC Bank",
    "accountNumber": "50200012345678",
    "ifscCode": "HDFC0001234",
    "branchName": "T Nagar",
    "isPrimary": true
  }
}
```

##### C. Create Bank Account (Admin Only)

```http
POST /api/v2/account-details
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "accountName": "Dr. Terrace Waterproofing Pvt Ltd",
  "bankName": "Axis Bank",
  "accountNumber": "918020012345678",
  "ifscCode": "UTIB0000123",
  "branchName": "Guindy",
  "isPrimary": false
}
```

##### D. Set Primary Bank Account (Admin Only)

Atomically sets the target account as primary and unsets all other accounts.

```http
PATCH /api/v2/account-details/:id/set-primary
Authorization: Bearer <admin_jwt_token>
```

##### E. Delete Bank Account (Admin Only)

```http
DELETE /api/v2/account-details/:id
Authorization: Bearer <admin_jwt_token>
```

---

#### 6. Staff Management & Photo Upload (Admin Only)

Admin users can create, update, and manage employee profiles including avatar/profile photo uploads via `multipart/form-data`.

##### A. Create Employee with Photo

```http
POST /api/v2/employees
Authorization: Bearer <admin_jwt_token>
Content-Type: multipart/form-data

name: Ramesh Babu
mobileNumber: 9876543210
password: SecretPassword123
aadhaarNumber: 123456789012
monthlyBase: 25000
conveyanceAllowance: 3000
monthlyWorkingDay: 26
employeeType: FieldEmployee
address: {"doorNo":"12","streetName":"Gandhi St","area":"Velachery","city":"Chennai","pincode":"600042","state":"Tamil Nadu"}
employeeImage: <binary image file: .png, .jpg, .jpeg, .webp>
```

###### Response (`201 Created`)

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "id": 105,
    "name": "Ramesh Babu",
    "mobileNumber": "9876543210",
    "employeeType": "FieldEmployee",
    "employeeImage": "/static/employees/3b9f48ac-0841-477c-a496-a65c0245a4a5.jpg",
    "monthlyBase": 25000
  }
}
```

##### B. Update Employee Profile & Photo

```http
PUT /api/v2/employees/:id
Authorization: Bearer <admin_jwt_token>
Content-Type: multipart/form-data

name: Ramesh Babu M
conveyanceAllowance: 3500
employeeImage: <new binary image file>
```

##### C. Delete Employee

```http
DELETE /api/v2/employees/:id
Authorization: Bearer <admin_jwt_token>
```

---

## 5. Ready-to-Use Client Code Examples

### A. TypeScript / Axios Client with Interceptors

```typescript
// src/api/apiClient.ts
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:9000/api/v2";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically inject JWT Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unified API Methods
export const ApiV2 = {
  auth: {
    login: (credentials: { username: string; password: string }) =>
      apiClient.post("/auth/login", credentials),
    getProfile: () => apiClient.get("/auth/profile"),
    logout: () => apiClient.post("/auth/logout"),
  },

  appointments: {
    list: (params?: { page?: number; limit?: number; search?: string }) =>
      apiClient.get("/appointments", { params }),
    getById: (id: number) => apiClient.get(`/appointments/${id}`),
    create: (data: any) => apiClient.post("/appointments", data),
    update: (id: number, data: any) =>
      apiClient.put(`/appointments/${id}`, data),
    delete: (id: number) => apiClient.delete(`/appointments/${id}`),
    reassign: (id: number, employeeId: number) =>
      apiClient.patch(`/appointments/${id}/assign`, { employeeId }),
    checkIn: (id: number, timeData?: { date?: string; time?: string }) =>
      apiClient.post(`/appointments/${id}/checkin`, timeData),
    getAttends: (appointmentId?: number) =>
      appointmentId
        ? apiClient.get(`/appointments/${appointmentId}/attends`)
        : apiClient.get("/appointments/attends"),
    getQuotations: (appointmentId: number) =>
      apiClient.get(`/appointments/${appointmentId}/quotations`),
  },

  quotations: {
    list: (params?: { page?: number; limit?: number }) =>
      apiClient.get("/quotations", { params }),
    getById: (id: number) => apiClient.get(`/quotations/${id}`),
    getPageView: () => apiClient.get("/quotations/page-view"),
    getEditView: (id: number) => apiClient.get(`/quotations/${id}/edit-view`),
    getByClient: (appointmentId: number) =>
      apiClient.get(`/quotations/client/${appointmentId}`),
    create: (data: any) => apiClient.post("/quotations", data),
    update: (id: number, data: any) => apiClient.put(`/quotations/${id}`, data),
    delete: (id: number) => apiClient.delete(`/quotations/${id}`),
    confirm: (id: number, isConfirmed = true) =>
      apiClient.post(`/quotations/${id}/confirm`, { isConfirmed }),
    unlock: (id: number) => apiClient.post(`/quotations/${id}/unlock`),
    getPdfView: (id: number) => apiClient.get(`/quotations/${id}/pdf-view`),
  },

  quotationPayments: {
    getSummary: (quotationId: number) =>
      apiClient.get(`/quotation-payments/${quotationId}`),
    recordPayment: (
      quotationId: number,
      data: {
        amount: number;
        paymentMethod: "CASH" | "ACCOUNT" | "UPI";
        accountId?: number;
        upiId?: string;
        voucher?: string;
        referenceNumber?: string;
        paymentDate?: string;
        notes?: string;
        proofImage?: File | Blob | string;
      },
    ) => {
      if (data.proofImage instanceof Blob || data.proofImage instanceof File) {
        const formData = new FormData();
        formData.append("amount", String(data.amount));
        formData.append("paymentMethod", data.paymentMethod);
        if (data.accountId) formData.append("accountId", String(data.accountId));
        if (data.upiId) formData.append("upiId", data.upiId);
        if (data.voucher) formData.append("voucher", data.voucher);
        if (data.referenceNumber)
          formData.append("referenceNumber", data.referenceNumber);
        if (data.paymentDate) formData.append("paymentDate", data.paymentDate);
        if (data.notes) formData.append("notes", data.notes);
        formData.append("proofImage", data.proofImage);
        return apiClient.post(`/quotation-payments/${quotationId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      return apiClient.post(`/quotation-payments/${quotationId}`, data);
    },
    verifyPayment: (
      quotationId: number,
      paymentId: number,
      data: { isVerified: boolean; verificationNotes?: string },
    ) =>
      apiClient.patch(
        `/quotation-payments/${quotationId}/${paymentId}/verify`,
        data,
      ),
    deletePayment: (quotationId: number, paymentId: number) =>
      apiClient.delete(`/quotation-payments/${quotationId}/${paymentId}`),
    getVerifyView: (quotationId: number, paymentId: number) =>
      apiClient.get(`/quotation-payments/${quotationId}/${paymentId}/verify-view`),
  },

  payments: {
    getPayView: (quotationId: number) =>
      apiClient.get(`/quotations/${quotationId}/pay-view`),
    recordServicePayment: (
      quotationId: number,
      serviceId: number,
      data: {
        amount: number;
        paymentMethod: "CASH" | "ACCOUNT" | "UPI";
        voucher?: string;
        accountId?: number;
        upiId?: string;
        notes?: string;
        proofImage?: File | Blob | string;
      },
    ) => {
      if (data.proofImage instanceof Blob || data.proofImage instanceof File) {
        const formData = new FormData();
        formData.append("amount", String(data.amount));
        formData.append("paymentMethod", data.paymentMethod);
        if (data.voucher) formData.append("voucher", data.voucher);
        if (data.accountId) formData.append("accountId", String(data.accountId));
        if (data.upiId) formData.append("upiId", data.upiId);
        if (data.notes) formData.append("notes", data.notes);
        formData.append("proofImage", data.proofImage);
        return apiClient.post(
          `/quotations/${quotationId}/services/${serviceId}/payments`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      }
      return apiClient.post(
        `/quotations/${quotationId}/services/${serviceId}/payments`,
        data,
      );
    },
    confirmFinalSettlement: (
      quotationId: number,
      data: {
        withGst?: boolean; // optional: follows the quotation's tax status
        amount?: number;
        paymentMethod?: "CASH" | "ACCOUNT" | "UPI";
        voucher?: string;
        accountId?: number;
        upiId?: string;
        notes?: string;
        proofImage?: File | Blob | string;
      },
    ) => {
      if (data.proofImage instanceof Blob || data.proofImage instanceof File) {
        const formData = new FormData();
        if (data.withGst !== undefined) formData.append("withGst", String(data.withGst));
        if (data.amount !== undefined) formData.append("amount", String(data.amount));
        if (data.paymentMethod) formData.append("paymentMethod", data.paymentMethod);
        if (data.voucher) formData.append("voucher", data.voucher);
        if (data.accountId) formData.append("accountId", String(data.accountId));
        if (data.upiId) formData.append("upiId", data.upiId);
        if (data.notes) formData.append("notes", data.notes);
        formData.append("proofImage", data.proofImage);
        return apiClient.post(
          `/quotations/${quotationId}/final-settlement`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      }
      return apiClient.post(
        `/quotations/${quotationId}/final-settlement`,
        data,
      );
    },
    verifyChain: (quotationId: number) =>
      apiClient.get(`/quotations/${quotationId}/payments/verify-chain`),
    cleanupOrphanedImages: (olderThanSeconds = 60) =>
      apiClient.post("/payments/cleanup-orphaned-images", { olderThanSeconds }),
  },

  warranty: {
    getEligibility: (quotationId: number) =>
      apiClient.get(`/quotations/${quotationId}/warranty-eligibility`),
    getConfig: (quotationId: number) =>
      apiClient.get(`/quotations/${quotationId}/warranty-config`),
    createConfig: (
      quotationId: number,
      data: {
        services: Array<{
          serviceId: number;
          warrantyYears: number;
        }>;
      },
    ) => apiClient.post(`/quotations/${quotationId}/warranty-config`, data),
    updateConfig: (
      quotationId: number,
      data: {
        services: Array<{
          serviceId: number;
          warrantyYears: number;
        }>;
      },
    ) => apiClient.patch(`/quotations/${quotationId}/warranty-config`, data),
    generate: (quotationId: number) =>
      apiClient.post(`/quotations/${quotationId}/warranty`),
    get: (quotationId: number) =>
      apiClient.get(`/quotations/${quotationId}/warranty`),
    delete: (quotationId: number) =>
      apiClient.delete(`/quotations/${quotationId}/warranty`),
  },

  accountDetails: {
    list: () => apiClient.get("/account-details"),
    getPrimary: () => apiClient.get("/account-details/primary"),
    getById: (id: number) => apiClient.get(`/account-details/${id}`),
    create: (data: any) => apiClient.post("/account-details", data),
    update: (id: number, data: any) =>
      apiClient.put(`/account-details/${id}`, data),
    setPrimary: (id: number) =>
      apiClient.patch(`/account-details/${id}/set-primary`),
    delete: (id: number) => apiClient.delete(`/account-details/${id}`),
  },

  clients: {
    list: (params?: { page?: number; limit?: number; search?: string }) =>
      apiClient.get("/clients", { params }),
    // Unified Single-Request: returns profile, packages, quotations (with payment), and active payment
    getById: (id: number) => apiClient.get(`/clients/${id}`),
    getQuotations: (id: number) => apiClient.get(`/clients/${id}/quotations`),
  },

  schedules: {
    list: (date?: string) =>
      apiClient.get("/appointment-schedules", { params: { date } }),
    createOrUpdate: (data: any) =>
      apiClient.post("/appointment-schedules", data),
    update: (id: number, data: any) =>
      apiClient.put(`/appointment-schedules/${id}`, data),
    delete: (id: number) => apiClient.delete(`/appointment-schedules/${id}`),
  },

  policies: {
    list: () => apiClient.get("/employee-policies"),
    getLatest: () => apiClient.get("/employee-policies/latest"),
    getById: (id: number) => apiClient.get(`/employee-policies/${id}`),
    create: (data: any) => apiClient.post("/employee-policies", data),
    update: (id: number, data: any) =>
      apiClient.put(`/employee-policies/${id}`, data),
    delete: (id: number) => apiClient.delete(`/employee-policies/${id}`),
  },

  dashboard: {
    getHomeView: (targetDate?: string) =>
      apiClient.get("/home-view", { params: { targetDate } }),
  },

  masterData: {
    getWhereToWaterproof: () => apiClient.get("/where-to-waterproof"),
    getProperties: () => apiClient.get("/properties"),
    getPackages: () => apiClient.get("/packages"),
    getPackageSubCategories: (packageId: number) =>
      apiClient.get(`/packages/${packageId}/sub-categories`),
    getServices: () => apiClient.get("/services"),
    getServiceDetails: () => apiClient.get("/service-details"),
    getTerms: () => apiClient.get("/terms-and-conditions"),
    getContactInfo: () => apiClient.get("/contact-info"),
    getAccountDetails: () => apiClient.get("/account-details"),
    getPrimaryAccountDetail: () => apiClient.get("/account-details/primary"),
    getEmployees: () => apiClient.get("/employees"),
    getEmployeeById: (id: number) => apiClient.get(`/employees/${id}`),
  },

  health: {
    check: () => apiClient.get("/health"),
  },
};
```

---

### B. React / Next.js Custom Hook

```typescript
// src/hooks/useAppointments.ts
import { useState, useEffect, useCallback } from "react";
import { ApiV2 } from "../api/apiClient";

export function useAppointments(page = 1, limit = 20, search = "") {
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
      setError(err.response?.data?.message || "Failed to load appointments");
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

  return {
    appointments,
    meta,
    loading,
    error,
    refetch: fetchAppointments,
    bookAppointment,
  };
}
```

```typescript
// src/hooks/useQuotationPayments.ts
import { useState, useEffect, useCallback } from "react";
import { ApiV2 } from "../api/apiClient";

export function useQuotationPayments(quotationId: number) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!quotationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ApiV2.quotationPayments.getSummary(quotationId);
      setSummary(res.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to load quotation payment summary",
      );
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const recordPayment = async (data: any) => {
    setSubmitting(true);
    try {
      const res = await ApiV2.quotationPayments.recordPayment(quotationId, data);
      await fetchSummary();
      return res.data;
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPayment = async (paymentId: number, isVerified = true, notes?: string) => {
    const res = await ApiV2.quotationPayments.verifyPayment(quotationId, paymentId, {
      isVerified,
      verificationNotes: notes,
    });
    await fetchSummary();
    return res.data;
  };

  const deletePayment = async (paymentId: number) => {
    const res = await ApiV2.quotationPayments.deletePayment(quotationId, paymentId);
    await fetchSummary();
    return res.data;
  };

  return {
    summary,
    loading,
    submitting,
    error,
    refetch: fetchSummary,
    recordPayment,
    verifyPayment,
    deletePayment,
  };
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

  // 1. Authentication
  Future<Response> login(String username, String password) async {
    return await _dio.post('/auth/login', data: {'username': username, 'password': password});
  }

  Future<Response> getProfile() async {
    return await _dio.get('/auth/profile');
  }

  // 2. Appointments
  Future<Response> listAppointments({int page = 1, int limit = 20, String? search}) async {
    return await _dio.get('/appointments', queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null) 'search': search,
    });
  }

  Future<Response> bookAppointment(Map<String, dynamic> data) async {
    return await _dio.post('/appointments', data: data);
  }

  Future<Response> updateAppointment(int id, Map<String, dynamic> data) async {
    return await _dio.put('/appointments/$id', data: data);
  }

  Future<Response> deleteAppointment(int id) async {
    return await _dio.delete('/appointments/$id');
  }

  Future<Response> checkIn(int appointmentId) async {
    return await _dio.post('/appointments/$appointmentId/checkin');
  }

  Future<Response> reassignAppointment(int appointmentId, int employeeId) async {
    return await _dio.patch('/appointments/$appointmentId/assign', data: {'employeeId': employeeId});
  }

  Future<Response> getAppointmentQuotations(int appointmentId) async {
    return await _dio.get('/appointments/$appointmentId/quotations');
  }

  // 3. Quotations
  Future<Response> getQuotationPageView() async {
    return await _dio.get('/quotations/page-view');
  }

  Future<Response> createQuotation(Map<String, dynamic> quoteData) async {
    return await _dio.post('/quotations', data: quoteData);
  }

  Future<Response> updateQuotation(int id, Map<String, dynamic> quoteData) async {
    return await _dio.put('/quotations/$id', data: quoteData);
  }

  Future<Response> confirmQuotation(int quotationId) async {
    return await _dio.post(
      '/quotations/$quotationId/confirm',
      data: {'isConfirmed': true},
    );
  }

  Future<Response> unlockQuotation(int quotationId) async {
    return await _dio.post('/quotations/$quotationId/unlock');
  }

  Future<Response> getPdfView(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/pdf-view');
  }

  // 4. Quotation Payments & Direct Settlement (New Flow)
  Future<Response> getQuotationPaymentSummary(int quotationId) async {
    return await _dio.get('/quotation-payments/$quotationId');
  }

  Future<Response> recordQuotationPayment({
    required int quotationId,
    required double amount,
    required String paymentMethod, // 'CASH', 'ACCOUNT', 'UPI'
    int? accountId,
    String? upiId,
    String? voucher,
    String? referenceNumber,
    String? paymentDate,
    String? notes,
    String? proofImagePath,
  }) async {
    if (proofImagePath != null) {
      final formData = FormData.fromMap({
        'amount': amount,
        'paymentMethod': paymentMethod,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (voucher != null) 'voucher': voucher,
        if (referenceNumber != null) 'referenceNumber': referenceNumber,
        if (paymentDate != null) 'paymentDate': paymentDate,
        if (notes != null) 'notes': notes,
        'proofImage': await MultipartFile.fromFile(proofImagePath),
      });
      return await _dio.post(
        '/quotation-payments/$quotationId',
        data: formData,
      );
    }
    return await _dio.post(
      '/quotation-payments/$quotationId',
      data: {
        'amount': amount,
        'paymentMethod': paymentMethod,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (voucher != null) 'voucher': voucher,
        if (referenceNumber != null) 'referenceNumber': referenceNumber,
        if (paymentDate != null) 'paymentDate': paymentDate,
        if (notes != null) 'notes': notes,
      },
    );
  }

  Future<Response> verifyQuotationPayment(
    int quotationId,
    int paymentId, {
    required bool isVerified,
    String? verificationNotes,
  }) async {
    return await _dio.patch(
      '/quotation-payments/$quotationId/$paymentId/verify',
      data: {
        'isVerified': isVerified,
        if (verificationNotes != null) 'verificationNotes': verificationNotes,
      },
    );
  }

  Future<Response> deleteQuotationPayment(int quotationId, int paymentId) async {
    return await _dio.delete('/quotation-payments/$quotationId/$paymentId');
  }

  Future<Response> getQuotationPaymentVerifyView(int quotationId, int paymentId) async {
    return await _dio.get('/quotation-payments/$quotationId/$paymentId/verify-view');
  }

  // 5. Payments & Blockchain Ledger (with Proof Image Upload)
  Future<Response> getPaymentState(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/pay-view');
  }

  Future<Response> recordServicePayment({
    required int quotationId,
    required int serviceId,
    required double amount,
    required String paymentMethod, // 'CASH', 'ACCOUNT', 'UPI'
    String? voucher,
    int? accountId,
    String? upiId,
    String? notes,
    String? proofImagePath,
  }) async {
    if (proofImagePath != null) {
      final formData = FormData.fromMap({
        'amount': amount,
        'paymentMethod': paymentMethod,
        if (voucher != null) 'voucher': voucher,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (notes != null) 'notes': notes,
        'proofImage': await MultipartFile.fromFile(proofImagePath),
      });
      return await _dio.post(
        '/quotations/$quotationId/services/$serviceId/payments',
        data: formData,
      );
    }
    return await _dio.post(
      '/quotations/$quotationId/services/$serviceId/payments',
      data: {
        'amount': amount,
        'paymentMethod': paymentMethod,
        if (voucher != null) 'voucher': voucher,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (notes != null) 'notes': notes,
      },
    );
  }

  Future<Response> confirmFinalSettlement({
    required int quotationId,
    bool? withGst, // optional: follows the quotation's tax status
    double? amount,
    String? paymentMethod,
    String? voucher,
    int? accountId,
    String? upiId,
    String? notes,
    String? proofImagePath,
  }) async {
    if (proofImagePath != null) {
      final formData = FormData.fromMap({
        if (withGst != null) 'withGst': withGst,
        if (amount != null) 'amount': amount,
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (voucher != null) 'voucher': voucher,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (notes != null) 'notes': notes,
        'proofImage': await MultipartFile.fromFile(proofImagePath),
      });
      return await _dio.post(
        '/quotations/$quotationId/final-settlement',
        data: formData,
      );
    }
    return await _dio.post(
      '/quotations/$quotationId/final-settlement',
      data: {
        if (withGst != null) 'withGst': withGst,
        if (amount != null) 'amount': amount,
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (voucher != null) 'voucher': voucher,
        if (accountId != null) 'accountId': accountId,
        if (upiId != null) 'upiId': upiId,
        if (notes != null) 'notes': notes,
      },
    );
  }

  Future<Response> verifyChain(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/payments/verify-chain');
  }

  Future<Response> cleanupOrphanedPaymentImages({int olderThanSeconds = 60}) async {
    return await _dio.post(
      '/payments/cleanup-orphaned-images',
      data: {'olderThanSeconds': olderThanSeconds},
    );
  }

  // 6. Post-Receipt Warranty
  Future<Response> getWarrantyEligibility(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/warranty-eligibility');
  }

  Future<Response> getWarrantyConfig(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/warranty-config');
  }

  Future<Response> createWarrantyConfig(
    int quotationId,
    List<Map<String, dynamic>> services,
  ) async {
    return await _dio.post(
      '/quotations/$quotationId/warranty-config',
      data: {'services': services},
    );
  }

  Future<Response> updateWarrantyConfig(
    int quotationId,
    List<Map<String, dynamic>> services,
  ) async {
    return await _dio.patch(
      '/quotations/$quotationId/warranty-config',
      data: {'services': services},
    );
  }

  Future<Response> generateWarranty(int quotationId) async {
    return await _dio.post('/quotations/$quotationId/warranty');
  }

  Future<Response> getWarranty(int quotationId) async {
    return await _dio.get('/quotations/$quotationId/warranty');
  }

  Future<Response> deleteWarranty(int quotationId) async {
    return await _dio.delete('/quotations/$quotationId/warranty');
  }

  // 7. Home View Dashboard
  Future<Response> getHomeDashboard({String? targetDate}) async {
    return await _dio.get(
      '/home-view',
      queryParameters: targetDate != null ? {'targetDate': targetDate} : null,
    );
  }

  // 8. Clients
  Future<Response> listClients({int page = 1, int limit = 20, String? search}) async {
    return await _dio.get('/clients', queryParameters: {'page': page, 'limit': limit, if (search != null) 'search': search});
  }

  // Unified Single-Request: returns client details, packages, quotations (with payment), and active payment
  Future<Response> getClientById(int id) async {
    return await _dio.get('/clients/$id');
  }

  Future<Response> getClientQuotations(int id) async {
    return await _dio.get('/clients/$id/quotations');
  }

  // 9. Master Data & Bank Account Details
  Future<Response> getWhereToWaterproof() async => await _dio.get('/where-to-waterproof');
  Future<Response> getProperties() async => await _dio.get('/properties');
  Future<Response> getPackages() async => await _dio.get('/packages');
  Future<Response> getPackageSubCategories(int packageId) async =>
      await _dio.get('/packages/$packageId/sub-categories');
  Future<Response> getServices() async => await _dio.get('/services');
  Future<Response> getServiceDetails() async => await _dio.get('/service-details');
  Future<Response> getTermsAndConditions() async => await _dio.get('/terms-and-conditions');
  Future<Response> getContactInfo() async => await _dio.get('/contact-info');
  Future<Response> getAccountDetails() async => await _dio.get('/account-details');
  Future<Response> getPrimaryAccountDetail() async => await _dio.get('/account-details/primary');
  Future<Response> getAccountDetailById(int id) async => await _dio.get('/account-details/$id');
  Future<Response> getEmployees({String? employeeType}) async =>
      await _dio.get('/employees', queryParameters: employeeType != null ? {'employeeType': employeeType} : null);
  Future<Response> getEmployeeById(int id) async => await _dio.get('/employees/$id');
}
```