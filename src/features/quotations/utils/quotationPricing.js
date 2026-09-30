/**
 * Quotation pricing, reproducing the server's rules exactly (API v2, Quotations > Pricing rules).
 * All amounts are whole rupees, rounded with Math.round at each step, because the server recalculates
 * `amount.subTotal` / `amount.grandTotal` and rejects the request with 400 when the app's figures differ.
 *
 *   Tax customer (isTaxCustomer: true)      - discount before tax
 *     discount = round(subTotal x discount% / 100); gst = round((subTotal - discount) x gst% / 100)
 *   Non-tax customer (isTaxCustomer: false) - discount after tax
 *     gst = round(subTotal x gst% / 100); discount = round((subTotal + gst) x discount% / 100)
 *
 * GST applies whenever the GST percentage is above 0; isTaxCustomer only picks the discount order.
 */

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const clampPercent = (value) => Math.min(100, Math.max(0, toNumber(value)));

export const lineAmount = (area, rate) => Math.round(toNumber(area) * toNumber(rate));

export const calculateQuotationPricing = ({ subTotal, gstPercentage, discountPercentage, isTaxCustomer }) => {
  const sub = Math.round(toNumber(subTotal));
  const gstPct = clampPercent(gstPercentage);
  const discPct = clampPercent(discountPercentage);

  const discountForTax = discPct > 0 ? Math.round((sub * discPct) / 100) : 0;
  const gstForTax = gstPct > 0 ? Math.round(((sub - discountForTax) * gstPct) / 100) : 0;
  const grandForTax = sub - discountForTax + gstForTax;

  const gstForNonTax = gstPct > 0 ? Math.round((sub * gstPct) / 100) : 0;
  const discountForNonTax = discPct > 0 ? Math.round(((sub + gstForNonTax) * discPct) / 100) : 0;
  const grandForNonTax = sub + gstForNonTax - discountForNonTax;

  const tax = Boolean(isTaxCustomer);
  const gstAmount = tax ? gstForTax : gstForNonTax;
  const cgstAmount = Math.round(gstAmount / 2);

  return {
    subTotal: sub,
    gstPercentage: gstPct,
    discountPercentage: discPct,
    discountAmountForTax: discountForTax,
    discountAmountForNonTax: discountForNonTax,
    discountAmount: tax ? discountForTax : discountForNonTax,
    gstAmount,
    cgstAmount,
    sgstAmount: gstAmount - cgstAmount,
    grandTotal: tax ? grandForTax : grandForNonTax,
  };
};
