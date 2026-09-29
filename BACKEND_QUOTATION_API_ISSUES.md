# Quotation API — Backend Issues

**Date:** 2026-09-28
**Endpoints:** `GET /api/v2/quotations/:id/edit-view` (observed), `GET /api/v2/quotations/:id/pdf-view` (same quotation shape assumed — see issue 9)
**Evidence:** live response for **quotation 1200** (package 2 "Pure Flexible Polyurethane coating", tier Premium)

The mobile app has been updated to read the field names the API actually returns (see "Fields the app relies on" at the end). The items below need a backend fix or a decision.

## Summary

| # | Issue | Severity |
|---|---|---|
| 1 | Quotation contains a service from a different package/tier | High |
| 2 | Discount amount does not reconcile with taxable amount | High |
| 3 | `discount` means percentage in requests but amount in responses | High |
| 4 | `withRegards` is always "Mr. SRIRAM" even when not chosen | Medium |
| 5 | `balanceAmount` has two different types | Medium |
| 6 | `validTill` is display text, not a date | Medium |
| 7 | `notes` contains the negotiation text | Low |
| 8 | Whole payload is sent twice | Low |
| 9 | API doc out of date for `edit-view` / `pdf-view` | Low |
| 10 | Catalog data quality | Low |

---

## 1. Quotation contains a service from a different package/tier — High

**Evidence (quotation 1200):**
- `quotation.package` = `{ id: 2, tier: "Premium" }`
- Its only service is `serviceId: 132` "Test tier", `rate: 89`, `serviceDetailId: null`
- In the `packages` catalog, service 132 exists **only** under **Economy → package 393 "Test Tier pack"** (subtitle "Default", `serviceDetailId: 11`, rate 89)

So a Premium quotation is priced with an Economy-package service, and the stored `serviceDetailId` is lost (`null` instead of `11`).

**Impact:** The Edit Quotation screen finds no Premium options for this service, so its subtitle dropdown is empty and the saved `serviceDetailId` stays `null`.

**Expected:** On create / update / add-service, validate that every service belongs to the quotation's package (or at least its tier) and persist the correct `serviceDetailId`. If cross-tier services are intentionally allowed, please document that rule so the app can support it.

## 2. Discount amount does not reconcile with taxable amount — High

**Evidence (quotation 1200):**

| Field | Value | Note |
|---|---|---|
| `pricing.subTotal` | 89000 | 1000 × 89 |
| `pricing.withoutGst.discount.amount` | 8900 | 10% of 89000 ✔ |
| `pricing.withGst.discount.amount` | **10502** | = 8900 × 1.18 (discount grossed up by GST) |
| `pricing.withGst.taxableAmount` | 80100 | = 89000 − **8900** |
| `discount` (top level) | **10502** | same grossed-up value |

`subTotal − withGst.discount.amount` = 78498 ≠ `taxableAmount` 80100. The final total (94518) is correct; only the displayed discount amount is inconsistent.

**Expected:** Since the discount is applied before tax, `withGst.discount.amount` should be **8900**. If the GST-inclusive figure is needed, return it under a separate, clearly named field (e.g. `discountInclGst`).

## 3. `discount` means percentage in requests but amount in responses — High

**Evidence:** The app's `PUT /quotations/:id` payload sends `discount: 10` (a **percentage**, alongside `discountPercentage` and `discountAmount`). The response returns `discount: 10502` (an **amount**).

**Expected:** Don't overload `discount`. Use `discountPercentage` and `discountAmount` consistently in both requests and responses, and deprecate the bare `discount` field.

## 4. `withRegards` is always "Mr. SRIRAM" even when not chosen — Medium

**Evidence:** quotation 1200 returns `withRegards: "Mr. SRIRAM"` while `employee.name` is "sam".

The app currently treats "Mr. SRIRAM" as a placeholder and replaces it with the assigned employee's name, because it cannot tell whether the user chose "Mr. SRIRAM" or the backend filled it in as a default. This means a deliberately chosen "Mr. SRIRAM" cannot be kept.

**Expected:** Return `withRegards: null` when it was not explicitly set, and only return a value when the user chose one.

## 5. `balanceAmount` has two different types — Medium

**Evidence:**
- Top level: `balanceAmount: 94518` (number)
- `payment.balanceAmount: { withGst: 94518, withoutGst: 80100 }` (object)

**Expected:** Use one type per field name, e.g. keep the object under `payment.balanceAmount` and rename the top-level one to `balanceAmountSelected` (or remove it).

## 6. `validTill` is display text, not a date — Medium

**Evidence:** `validTill: "Quote Valid till 13-10-26"`. The API doc (`GET /quotations/:id`) shows `validTill: "2026-10-20"` (ISO date). The same text is also in `paymentTerms.validity`.

**Expected:** `validTill` should be an ISO date (`"2026-10-13"`). Keep the display sentence only in `paymentTerms.validity`.

## 7. `notes` contains the negotiation text — Low

**Evidence:** `notes`, `negotiation` and `paymentTerms.negotiation` all equal `"PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER"`.

**Expected:** Please confirm `notes` is mapped to the right column; it looks like it is populated from `negotiation`.

## 8. Whole payload is sent twice — Low

**Evidence:** The response contains `data: { quotation, properties, packages }` **and** the same `quotation`, `properties`, `packages` again at the root. The API doc only shows `data`. The `packages` catalog is most of the payload, so this roughly doubles the response size.

**Expected:** Return the payload under `data` only. The app already reads `data.quotation` / `data.properties` / `data.packages` first, so removing the root copy is safe for the app.

## 9. API doc out of date for `edit-view` / `pdf-view` — Low

`CONNECT_FRONTEND_BACKEND_V2.md` should be updated to match the live responses:
- **edit-view:** `packages` is grouped by tier — `[{ "package": "Economy", "data": [ ...packages ] }, ...]` — not a flat list.
- **Tier spelling:** the response uses **"Economy"**, the doc uses **"Economic"**. Please pick one spelling for both the API and the doc. (The app accepts both.)
- **pdf-view (section 6):** the documented sample has no `customer`, `property` or `package` objects. The app now assumes pdf-view returns the same quotation shape as edit-view. Please confirm and add these objects to the doc.

## 10. Catalog data quality — Low

- Packages 1–6 have `warranty: null` at package level; warranty only exists on each subtitle.
- Test packages are in the live catalog: **128 "Test"** (subtitle warranty "111 Years") and **393 "Test Tier pack"**.
- "Bathroom waterproofing" (serviceDetailId 8) has warranty **"0 Years"**.
- Packages **4, 5, 7** have no services.
- Typo in Premium "Terrace Waterproofing" description (serviceDetailId 2): `Two coats ]of`.

---

## Verified correct

- Subtotal: 1000 × 89 = 89000
- 10% discount: 8900 → taxable amount 80100
- GST 18% = 14418 (CGST 7209 + SGST 7209)
- Total with GST: 94518
- 60/30/10 payment splits add up exactly: with GST 56711 + 28355 + 9452 = 94518; without GST 48060 + 24030 + 8010 = 80100

## Fields the app relies on

Please keep these stable in the quotation object (`edit-view` and `pdf-view`):

| Field | Used for |
|---|---|
| `customer.name`, `customer.mobile` | PDF client name, share filename, WhatsApp message |
| `customer.address.area`, `customer.address.city` | PDF site details |
| `property.id`, `property.name` | Edit screen property type, PDF property label |
| `package.id` | Edit screen package selection |
| `package.tier` | PDF tier wording, share filename |
| `package.warranty` | Edit screen warranty, PDF warranty |
| `paymentTerms.validity` | Edit screen validity text |
| `pricing.selectedType`, `pricing.withGst.gst.percentage` | Edit screen GST |
| `advancePercent`, `midPercent`, `finalPercent`, `discountPercentage` | Edit screen payment terms and discount |

The app still falls back to the older flat names (`clientName`, `propertyName`, `packageId`, `quoteValidateDate`, `warranty`) if they are present.
