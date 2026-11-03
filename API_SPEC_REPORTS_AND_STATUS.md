# Proposed API: Reports, Follow-ups, Dues and Customer Status

**Status: proposal. None of these endpoints exist yet.** The mobile app will connect to them once they are live and added to `CONNECT_FRONTEND_BACKEND_V2.md`.

**Source:** the designs in `stitch_drterrace_design_system/`. Their sample names, phone numbers, dates and amounts are placeholders, not data requirements.

**Backend team, please do these first:**

1. Answer the [decisions in section 2](#2-decisions-needed-before-building). Decisions 1 to 3 change the database design.
2. Reply if any endpoint, field name or default rule should differ. The app will follow what you actually ship.

---

## 1. Screens and the endpoints they need

| Screen (design folder) | Endpoints |
|---|---|
| Home: Performance & Reports (`nexa_crm_home_dashboard`, `nexa_crm_home_appointments_reports`) | 3.1 |
| Appointment Overview (`nexa_crm_sales_overview_reports`) | 3.2, 3.3, 3.4 |
| Follow-ups (`crm_follow_ups`) | 4.1 |
| Collections: Overview (`nexa_crm_collections_payments`) | 5.1, 5.2, 5.3 |
| Collections: Payments (`crm_payments_list`) | 5.1, 5.2, 5.3 |
| Collections: Due (`crm_due_payments`) | 5.4, 5.5, plus the existing record-payment endpoint |
| Customer Detail: Status History (`customer_detail_site_history`) | 6.1 |
| Customer Detail: Update Status (`customer_detail_update_status_modal`) | 6.2 |
| Customer Detail: Status Update Detail (`customer_detail_status_update_detail`) | 6.3 |

The employee filter on the report screens uses the existing `GET /api/v2/employees`.

---

## 2. Decisions needed before building

Each decision has a proposed default, and the rest of this spec assumes it.

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| 1 | **Where do due dates and payment milestones come from?** The Due screen shows stages such as "Start 60%", "2nd coat completed 30%" and "Work completion 10%", and "8 days late". The current API has service lines and payments, but no milestones or due dates. No design has a screen for entering them either. | Overdue amounts can't be calculated without this, so a data source and an entry screen are both needed. | Add milestones to each quotation (section 5.6). Add milestone entry to the quotation form as a separate design. |
| 2 | **What is the single list of customer statuses?** The designs use three different lists: the update form (Inspection Done, Follow Up Required, Deal Closed, Not Interested), Status History (WON, FOLLOW_UP, NEGOTIATION, SENT) and Lead status (Won, In progress, Follow-up, Sent, Lost quotes, No quote). | Reports and history must count the same thing. | Use the mapping in section 2.1. |
| 3 | **How is lead status set?** Is it set by hand, derived from quotations and payments, or both? | "Won" could otherwise disagree with the payment data. | The latest status update decides. Only `NO_QUOTE` and `SENT` are derived automatically (section 2.1). |
| 4 | **Does "received" include payments not yet verified?** | This changes the headline revenue figures. | Received counts admin-verified payments only. Unverified payments are reported separately as `awaitingVerification`. |
| 5 | **What does "pending" mean?** It could be all unpaid balances or only those from this month's quotations. | The comparison totals depend on it. | The unpaid balance on quotations dated in the selected month. |
| 6 | **Which date places a record in a month?** | Totals change depending on the date used. | Appointments: `appointmentDate`. Quotations: `quotationDate`. Payments: the payment date. |
| 7 | **Are these amounts with GST?** | Totals must match receipts. | Yes, based on the quotation grand total. |
| 8 | **Who can see what?** | These screens hold customer and financial data. | See section 2.2. |
| 9 | **How does "Send reminder" reach the customer?** | Meta requires an approved template for WhatsApp business messages. Also, the WhatsApp token should stay on the server. | The server sends WhatsApp using a new approved template. |
| 10 | **When is a voice note required?** The form says "Audio note required for follow-up", but other statuses show none. | This affects validation. | Required only for `FOLLOW_UP`. Optional otherwise. |
| 11 | **Is "Verified by rep" a real feature?** It appears on Status Update Detail with no explanation. | It may need its own workflow. | Leave it out for now. |

### 2.1 Proposed customer status mapping

| API value | Update form label | Lead status group | Set by |
|---|---|---|---|
| `NO_QUOTE` | not selectable | No quote | Automatic: no quotation and no later status |
| `SENT` | not selectable | Sent | Automatic: when a quotation is sent |
| `INSPECTION_DONE` | Inspection Done | In progress | User |
| `NEGOTIATION` | needs adding to the form | In progress | User |
| `FOLLOW_UP` | Follow Up Required | Follow-up | User |
| `WON` | Deal Closed | Won | User |
| `LOST` | Not Interested | Lost quotes | User |

### 2.2 Proposed access rules

The server must enforce these, in line with the existing rule that data scoping is handled on the server from the JWT. The app hiding a button is not enough.

| Data | Admin | Field employee |
|---|---|---|
| Reports, follow-ups and dues | All data, and can filter by `employeeId` | Own customers only. `employeeId` is ignored |
| Status history and adding a status update | All customers | Customers assigned to them |
| CSV export | Allowed | `403` |

---

## Shared rules

These match the existing API v2 conventions.

- **Base path:** `/api/v2`, with `Authorization: Bearer <jwt_token>`.
- **Success:** `{ "statusCode", "success": true, "data" }`. Lists add the existing `meta` object (`page`, `limit`, `totalItems`, `totalPages`, `hasNext`, `hasPrev`).
- **Errors:** `{ "statusCode", "success": false, "message" }`, where `message` can be shown to the user.
- **`month`:** `YYYY-MM`. Defaults to the current month.
- **Time zone:** "today", "overdue" and month boundaries use `Asia/Kolkata`.
- **Dates and times:** dates are `YYYY-MM-DD`. Timestamps are ISO 8601 with an offset.
- **Amounts:** numbers in rupees. Percentages are numbers, such as `56.3`. The app handles display.
- **Customer ID:** `appointmentId`, which is the ID the app already uses to open Customer Detail.
- **Rates:** the server calculates every total, percentage and trend, so all screens and exports agree.

Common errors: `400` invalid parameter, `401` not logged in, `403` not allowed, `404` not found.

---

## 3. Appointment reports

### 3.1 Home reports card

`GET /api/v2/reports/home?month=2026-10`

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "month": "2026-10",
    "previousMonth": "2026-09",
    "appointments": {
      "total": 51,
      "previousTotal": 44,
      "changePercent": 15.9,
      "conversionRate": 54.9,
      "previousConversionRate": 50.0,
      "conversionChangePoints": 4.9,
      "current": { "attended": 28, "visited": 14, "pending": 6, "unattended": 3 },
      "previous": { "attended": 22, "visited": 12, "pending": 7, "unattended": 3 }
    },
    "payments": {
      "total": 28400,
      "previousTotal": 24000,
      "changePercent": 18.3,
      "invoiceCount": 19,
      "current": { "received": 24150, "pending": 4250, "receivedPercent": 85.0, "pendingPercent": 15.0 },
      "previous": { "received": 20500, "pending": 3500, "receivedPercent": 85.4, "pendingPercent": 14.6 },
      "receivedCount": 19,
      "pendingInvoiceCount": 5,
      "awaitingVerification": 0
    }
  }
}
```

The backend should define and document `attended`, `visited`, `pending`, `unattended` and `conversionRate`. The designs show them but don't define them. The four appointment counts should add up to `total`.

### 3.2 Appointment overview

`GET /api/v2/reports/appointments?month=2026-10&employeeId=102`

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "month": "2026-10",
    "previousMonth": "2026-09",
    "attention": { "overdue": 2, "dueToday": 3, "total": 5 },
    "metrics": {
      "totalVisits": 58, "quoted": 46, "newLeads": 12,
      "converted": 29, "conversionRate": 50.0, "winRate": 64.0,
      "followUpsDueToday": 3, "followUpsOverdue": 2
    },
    "comparison": [
      { "key": "VISITS", "label": "Visits", "previous": 44, "current": 58 },
      { "key": "QUOTES_GIVEN", "label": "Quotes Given", "previous": 31, "current": 42 },
      { "key": "WON_DEALS", "label": "Won Deals", "previous": 21, "current": 29 },
      { "key": "PENDING", "label": "Pending", "previous": 19, "current": 14 }
    ],
    "leadStatus": {
      "total": 58,
      "groups": [
        { "key": "WON", "count": 18, "percent": 31.0 },
        { "key": "IN_PROGRESS", "count": 6, "percent": 10.3 },
        { "key": "FOLLOW_UP", "count": 8, "percent": 13.8 },
        { "key": "SENT", "count": 7, "percent": 12.1 },
        { "key": "LOST", "count": 7, "percent": 12.1 },
        { "key": "NO_QUOTE", "count": 12, "percent": 20.7 }
      ]
    }
  }
}
```

The design's numbers conflict: "Converted 29" against "Won 18". The backend should confirm how `converted` and `WON` differ, or make them the same number.

### 3.3 Appointment report list

`GET /api/v2/reports/appointments/items?month=2026-10&employeeId=102&leadStatus=WON&page=1&limit=20`

`leadStatus` is optional. Values: `WON`, `IN_PROGRESS`, `FOLLOW_UP`, `SENT`, `LOST`, `NO_QUOTE`.

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 20, "totalItems": 18, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "data": [
    {
      "appointmentId": 150,
      "clientName": "Rajesh Kumar",
      "mobileNumber": "9876543210",
      "siteAddress": "42-A, Gandhi Road, Anna Nagar, Chennai",
      "leadStatus": "WON",
      "quotationId": 83,
      "quotedAmount": 14250,
      "statusChangedBy": { "id": 102, "name": "Karthik Raja" },
      "statusChangedAt": "2026-10-24T16:30:00+05:30"
    }
  ]
}
```

`quotationId` and `quotedAmount` are `null` when there is no quotation.

### 3.4 Export appointment report

`GET /api/v2/reports/appointments/export?month=2026-10&employeeId=102&leadStatus=WON`

Admin only. Returns `text/csv` with a `Content-Disposition` filename, and uses the same filters as 3.3. Columns: customer, mobile, site, lead status, quoted amount, status changed by, status changed date.

---

## 4. Follow-ups

### 4.1 List follow-ups

`GET /api/v2/follow-ups?employeeId=102&page=1&limit=50`

Returns active reminders that are overdue or due today. The app groups them using `dueState`. Overdue items come first, oldest first, followed by today's items in time order.

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 50, "totalItems": 5, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "summary": { "overdue": 2, "dueToday": 3 },
  "data": [
    {
      "id": 901,
      "appointmentId": 150,
      "clientName": "Rajesh Kumar",
      "mobileNumber": "9876543210",
      "task": "Call about the ₹8,900 quote",
      "dueAt": "2026-10-22T10:00:00+05:30",
      "dueState": "OVERDUE",
      "daysLate": 2,
      "statusUpdateId": 7001
    }
  ]
}
```

- `dueState` is `OVERDUE` or `TODAY`.
- `task` comes from the reminder note, or from the status update's notes if there's no reminder note.
- A follow-up closes when a new status update is saved for that customer, and the new update can start a new reminder. There is no separate "complete" action in the designs.
- The **Call** button uses `mobileNumber` on the phone, so it needs no endpoint.
- **Update Status** uses 6.2.

---

## 5. Collections and dues

### 5.1 Collections overview

`GET /api/v2/reports/collections?month=2026-10&employeeId=102`

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "month": "2026-10",
    "previousMonth": "2026-09",
    "attention": { "overdueInvoices": 5, "overdueAmount": 34200 },
    "metrics": {
      "totalCollected": 342800, "paidCount": 38, "paidThisWeek": 14,
      "pendingAmount": 86500, "pendingInvoices": 12, "collectionRate": 78.0,
      "totalInvoiced": 429300, "monthlyTarget": 450000,
      "paidInvoices": 28, "totalInvoices": 50,
      "awaitingVerification": 0
    },
    "comparison": [
      { "key": "PAID", "label": "Paid", "previous": 24, "current": 28 },
      { "key": "PENDING", "label": "Pending", "previous": 11, "current": 9 },
      { "key": "DUE_TODAY", "label": "Due today", "previous": 4, "current": 5 },
      { "key": "OVERDUE", "label": "Overdue", "previous": 7, "current": 5 }
    ],
    "paymentStatus": {
      "totalInvoices": 50,
      "groups": [
        { "key": "PAID", "count": 28, "percent": 56.0 },
        { "key": "PENDING", "count": 9, "percent": 18.0 },
        { "key": "DUE_TODAY", "count": 5, "percent": 10.0 },
        { "key": "OVERDUE", "count": 5, "percent": 10.0 }
      ]
    }
  }
}
```

`monthlyTarget` is `null` if no target is set. Nothing in the current API stores one, so the backend should say whether targets are in scope. In the design, the group counts add up to 47 of 50 invoices. The server's groups should cover every invoice.

### 5.2 Payment list

`GET /api/v2/reports/payments?month=2026-10&employeeId=102&status=PAID&page=1&limit=20`

`status` is optional. Values: `PAID`, `PENDING`, `OVERDUE`.

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 20, "totalItems": 38, "totalPages": 2, "hasNext": true, "hasPrev": false },
  "data": [
    {
      "id": "payment-5521",
      "status": "PAID",
      "appointmentId": 150,
      "quotationId": 83,
      "paymentId": 5521,
      "clientName": "Rajesh Kumar",
      "mobileNumber": "9876543210",
      "siteAddress": "42-A, Gandhi Road, Anna Nagar, Chennai",
      "amount": 14250,
      "paymentMethod": "UPI",
      "paidAt": "2026-10-24T11:20:00+05:30",
      "collectedBy": { "id": 102, "name": "Karthik Raja" },
      "invoiceDate": null,
      "dueDate": null,
      "daysLate": 0
    }
  ]
}
```

`paymentMethod` uses the existing values (`UPI`, `ACCOUNT`, `CASH`). `PENDING` and `OVERDUE` rows have no `paymentId`, and fill in `invoiceDate` and `dueDate` instead.

### 5.3 Export payment report

`GET /api/v2/reports/payments/export?month=2026-10&employeeId=102&status=PAID`

Admin only. Returns `text/csv`, using the same filters as 5.2.

### 5.4 Due list

`GET /api/v2/reports/dues?month=2026-10&employeeId=102&page=1&limit=20`

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 20, "totalItems": 10, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "summary": { "overdueAmount": 34200, "overdueInvoices": 5, "dueTodayInvoices": 5, "dueTodayAmount": 22500 },
  "data": [
    {
      "quotationId": 83,
      "appointmentId": 150,
      "clientName": "Rajesh Kumar",
      "mobileNumber": "9876543210",
      "dueState": "OVERDUE",
      "dueDate": "2026-10-16",
      "daysLate": 8,
      "projectTotal": 23000,
      "paidAmount": 18400,
      "paidPercent": 80.0,
      "balanceAmount": 4600,
      "balancePercent": 20.0,
      "milestones": [
        { "id": 1, "name": "Start", "percent": 60, "amount": 13800, "paidAmount": 13800, "balanceAmount": 0, "dueDate": "2026-09-20", "status": "PAID" },
        { "id": 2, "name": "2nd coat completed", "percent": 30, "amount": 6900, "paidAmount": 4600, "balanceAmount": 2300, "dueDate": "2026-10-16", "status": "OVERDUE" },
        { "id": 3, "name": "Work completion", "percent": 10, "amount": 2300, "paidAmount": 0, "balanceAmount": 2300, "dueDate": "2026-11-05", "status": "PENDING" }
      ]
    }
  ]
}
```

- `dueState` is `OVERDUE` or `TODAY`. Overdue items come first, most days late first.
- Milestone `status` is `PAID`, `PART_PAID`, `PENDING` or `OVERDUE`. A milestone that is both part paid and past due reports `OVERDUE`.
- **Record payment** uses the existing `POST /api/v2/quotation-payments/:id`. A payment must not exceed the balance, and the existing admin verification rules still apply.

### 5.5 Send payment reminder

`POST /api/v2/quotations/:id/payment-reminders`

```json
{ "milestoneId": 2, "clientRequestId": "6f1c8c1e-3b1a-4d55-9d0e-1f2a3b4c5d6e" }
```

`milestoneId` is optional. The server sends the message using its own WhatsApp token and keeps a record of it.

Response `201 Created`:

```json
{
  "statusCode": 201,
  "success": true,
  "data": { "id": 44, "channel": "WHATSAPP", "sentAt": "2026-10-24T11:20:00+05:30" }
}
```

To prevent customers receiving repeated messages, a repeated `clientRequestId` returns the original result, and the server may return `429` if a reminder for the same quotation was sent within the last 24 hours.

### 5.6 Proposed milestone storage

Needed if decision 1 is accepted. This adds to quotations and doesn't change existing payment records.

`quotation_payment_milestones`: `id`, `quotation_id`, `name`, `percent`, `amount`, `due_date`, `sort_order`.

- Percentages on a quotation must add up to 100.
- `amount` is calculated from the quotation grand total.
- The backend should decide how payments are allocated across milestones. The proposed rule is oldest milestone first, which leaves existing payment records and the verification ledger unchanged.
- Existing quotations have no milestones, so they need a migration rule, or they should appear as a single milestone for the full amount.

Create and update endpoints depend on the milestone entry design, so they aren't part of this spec.

---

## 6. Customer status updates

### 6.1 Status history

`GET /api/v2/appointments/:id/status-updates?page=1&limit=20`

Newest first.

```json
{
  "statusCode": 200,
  "success": true,
  "meta": { "page": 1, "limit": 20, "totalItems": 4, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "data": [
    {
      "id": 7001,
      "status": "WON",
      "dealValue": 24500,
      "notes": "Payment received. Terrace coating and waterproofing package finalized.",
      "createdAt": "2026-10-24T16:30:00+05:30",
      "createdBy": { "id": 102, "name": "Karthik Raja" },
      "voiceNote": { "url": "/static/status-updates/7001.m4a", "durationSeconds": 28, "label": "Debrief voice note" },
      "reminder": null
    }
  ]
}
```

### 6.2 Add a status update

`POST /api/v2/appointments/:id/status-updates`

`multipart/form-data`, because it can include audio.

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | string | Yes | `INSPECTION_DONE`, `NEGOTIATION`, `FOLLOW_UP`, `WON` or `LOST` |
| `notes` | string | No | Maximum 2,000 characters |
| `reminderAt` | ISO 8601 timestamp | No | Must be in the future. The app turns Tomorrow, In 2 Days and Next Week into this value |
| `reminderNote` | string | No | Shown as the follow-up task |
| `quotationId` | integer | No | The quotation this update relates to. Must belong to this appointment |
| `voiceNote` | audio file | Decision 10 | `audio/mp4` or `audio/m4a`. Maximum 10 MB and 5 minutes |
| `voiceNoteDurationSeconds` | integer | With `voiceNote` | The server should reject values that don't match the file, if it can check |
| `clientRequestId` | UUID string | Yes | See below |

**`clientRequestId` prevents duplicates.** The app doesn't automatically resend `POST` requests after an unclear failure, because the server may already have saved them. If a user taps Save again, the app reuses the same ID, and the server returns the original update instead of creating a second one.

Response `201 Created`: the created update in the shape shown in 6.1. A repeated `clientRequestId` returns `200 OK` with the original update.

Example errors:

| Status | Example `message` |
|---|---|
| 400 | `status must be one of INSPECTION_DONE, NEGOTIATION, FOLLOW_UP, WON, LOST` |
| 400 | `A voice note is required for a follow-up` |
| 400 | `reminderAt must be in the future` |
| 403 | `This customer is not assigned to you` |
| 413 | `Voice note must be 10 MB or smaller` |

### 6.3 Status update detail

`GET /api/v2/appointments/:id/status-updates/:updateId`

Returns the shape from 6.1, plus payment context and full reminder details.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": 7001,
    "status": "WON",
    "dealValue": 24500,
    "paymentStatus": "FULLY_PAID",
    "notes": "Conducted terrace inspection, approx 1,450 sq.ft.",
    "createdAt": "2026-10-24T16:30:00+05:30",
    "createdBy": { "id": 102, "name": "Karthik Raja" },
    "voiceNote": { "url": "/static/status-updates/7001.m4a", "durationSeconds": 28, "label": "Debrief audio note recorded on-site" },
    "reminder": {
      "remindAt": "2026-10-28T10:00:00+05:30",
      "note": "Site preparation and primer delivery check",
      "state": "ACTIVE",
      "pushScheduled": true
    }
  }
}
```

- `paymentStatus` uses the existing values (`UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`), or `null` if there is no quotation.
- `dealValue` comes from the linked quotation's grand total, or `null` if there is no linked quotation.
- Reminder `state` is `ACTIVE`, `SENT` or `CLOSED`.

**Voice note access:** recordings can contain private customer conversations. They need the same login and customer-scoping checks as the rest of this data, so a public `/static` URL isn't enough. Either require the bearer token to download, or return a short-lived signed URL. The backend should choose one and document it.

### 6.4 Reminder push notification

Add a new type to the existing push system:

```json
{
  "type": "follow_up_reminder",
  "title": "Follow-up due",
  "body": "A customer follow-up is due. Tap to view it.",
  "data": { "appointmentId": 150, "statusUpdateId": 7001 }
}
```

- The server sends it at `reminderAt`, so it arrives even if the app isn't open.
- It goes to the employee assigned to the customer. If nobody is assigned, it goes to the user who created the reminder.
- `data` carries IDs only, matching the existing rule that notifications don't carry personal data.
- Tapping it opens that customer's Customer Detail screen.

---

## 7. Performance

The Home screen loads 3.1 on every visit, and the report endpoints may scan large tables.

- 3.1 should normally respond in under 1 second. Indexes on the date and assigned-employee columns may be needed.
- Each report should be one request. The app shouldn't have to fetch every appointment and quotation to calculate totals.

---

## 8. App work after these endpoints are live

| Feature | App work |
|---|---|
| Home reports card | New component added to the Home screen, between Quick Actions and Employee's Management. Existing sections stay as they are |
| Report screens | New routes and screens, plus new repositories |
| Customer status | New section and modals on Customer Detail. Existing tabs stay as they are |
| Voice notes | New `expo-audio` package, a microphone permission and a new native build |
| Follow-up push | Open the correct screen when `follow_up_reminder` is tapped |
