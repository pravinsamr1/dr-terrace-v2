/**
 * Proforma invoice for a TAX customer.
 *
 * It is rendered by the same generator as the tax invoice (generateTaxInvoiceHTML in ReceiptScreen), so the layout is
 * identical; only the document title differs. This file maps the quotation returned by
 * GET /quotations/:id/pdf-view (the server has already calculated every amount) to the final-receipt data shape
 * that generator reads.
 *
 * It takes no number from the tax-invoice series (DRT ATEG ...): the proforma number is derived from the quotation number.
 */

export const PROFORMA_DOC_TITLE = 'PROFORMA INVOICE';

const cleanQuotationId = (quotation) => String(quotation?.id ?? quotation?.quotationId ?? '').replace(/^DRT-?/i, '');

export const getProformaInvoiceNumber = (quotation) => `DRT-PI-${cleanQuotationId(quotation)}`;

const serviceTitle = (svc) => {
  const title = String(svc?.title || svc?.serviceName || '').trim().replace(/:$/, '');
  const sub = String(svc?.subtitle || '').trim();
  if (!sub || /^(default|none|additional service)$/i.test(sub) || title.toLowerCase().includes(sub.toLowerCase())) return title;
  return title ? `${title} (${sub})` : sub;
};

export const buildProformaReceiptData = (quotation) => {
  const q = quotation || {};
  const pricing = q.pricing || {};
  const customer = q.customer || {};
  const address = customer.address || {};
  const gst = pricing.gst || null;

  const addressText = [address.doorNo, address.streetName, address.area, address.city, address.pincode]
    .filter(Boolean)
    .join(', ');
  const propertyName = q.property?.name ? String(q.property.name) : '';
  const propertyAddress = propertyName && addressText ? `${propertyName} - ${addressText}` : (addressText || propertyName);

  const rawServices = Array.isArray(q.services) ? q.services : [];
  const grossAmounts = rawServices.map((svc) => Number(svc.amount ?? Math.round(Number(svc.area || 0) * Number(svc.rate || 0))));

  // The tax invoice shows each line net of the discount (there is no separate discount row), so spread the
  // discount (taken before tax for a tax customer) pro-rata over the lines; the rounding difference goes on the
  // largest line so the lines add up exactly to the taxable amount the server calculated.
  const grossSum = grossAmounts.reduce((sum, a) => sum + a, 0);
  const discountTotal = Math.min(Number(pricing.discount?.amountForTax || 0), grossSum);
  const shares = grossAmounts.map((a) => (grossSum > 0 ? Math.round((a * discountTotal) / grossSum) : 0));
  if (grossSum > 0 && discountTotal > 0) {
    const largest = grossAmounts.indexOf(Math.max(...grossAmounts));
    shares[largest] += discountTotal - shares.reduce((sum, a) => sum + a, 0);
  }

  const services = rawServices.map((svc, idx) => ({
    id: svc.id ?? idx + 1,
    title: serviceTitle(svc),
    sqft: svc.area,
    rate: svc.rate,
    totalPrice: grossAmounts[idx] - shares[idx],
  }));

  return {
    receiptNumber: getProformaInvoiceNumber(q),
    receiptDate: new Date().toISOString(),
    quotationId: Number(cleanQuotationId(q)) || cleanQuotationId(q),
    customer: {
      name: customer.name,
      mobileNumber: customer.mobile,
      address: addressText,
      gstNumber: q.customerGstNumber || null,
    },
    customerGstNumber: q.customerGstNumber || null,
    propertyAddress,
    taxDecision: 'WITH_GST',
    gstPercentage: Number(gst?.percentage || 0),
    cgst: Number(gst?.cgst?.amount || 0),
    sgst: Number(gst?.sgst?.amount || 0),
    grandTotal: Number(pricing.grandTotal || 0),
    services,
  };
};
