import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logoBase64 } from '../../../shared/constants/LogoBase64';
import { sealBase64 } from '../../../shared/constants/SealBase64';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { paymentRepository } from '../api/paymentRepository';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { createPdfFile, sharePdfFile, toSafeFileName } from '../../../core/utils/pdfShare';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';

const formatSqft = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.toLowerCase().includes('sq')) return str;
  return `${str} sq.ft`;
};

// payView.additionalPayment comes back from the API as a single object
// (e.g. { id, title, payments: [...] }), not an array — unlike payView.services.
// Normalize it to a list so every consumer below can treat it uniformly,
// whether the backend ever sends one object or an array of them.
const getAdditionalPaymentList = (payView) => {
  const ap = payView?.additionalPayment;
  if (Array.isArray(ap)) return ap;
  if (ap && typeof ap === 'object') return [ap];
  return [];
};

// Helper function to extract unified receipt data model for Dr. Terrace receipts
const getReceiptData = (app, customerGst, finalReceiptData = null, params = {}, payView = null) => {
  const isFullReceipt = params?.isFullServiceReceipt === 'true';

  // Individual payment receipts never show GST. The final bill is a tax invoice for a tax customer
  // (taxDecision WITH_GST), otherwise a cash bill; the receipt's own taxDecision wins over route params.
  const isGst = Boolean(
    isFullReceipt && (
      finalReceiptData?.taxDecision
        ? finalReceiptData.taxDecision === 'WITH_GST'
        : (
          typeof finalReceiptData?.isTaxCustomer === 'boolean'
            ? finalReceiptData.isTaxCustomer
            : (params?.hasGst === 'true' || payView?.isTaxCustomer === true)
        )
    )
  );

  // params.docTitle lets a caller reuse this layout under another title (the proforma invoice)
  const docTitle = params?.docTitle || (isGst ? 'TAX INVOICE' : (isFullReceipt ? 'CASH BILL' : 'CASH RECEIPT'));

  // Cash Receipt / Cash Bill show one line referencing the agreed quotation instead of itemised services
  const receiptQuoteId =
    params?.quotationId ||
    finalReceiptData?.quotationId ||
    finalReceiptData?.quotation?.id ||
    payView?.quotationId ||
    app?.confirmedQuoteId ||
    app?.activeQuotationId ||
    (Array.isArray(app?.quotations) && app.quotations.find((q) => q.isConfirmed)?.id) ||
    '';
  const quoteNoLabel = receiptQuoteId
    ? (String(receiptQuoteId).startsWith('DRT-') ? String(receiptQuoteId) : `DRT-${receiptQuoteId}`)
    : '';
  const cashServiceText = quoteNoLabel
    ? `All the services and measurements as per agreed quotation No. ${quoteNoLabel}`
    : 'All the services and measurements as per agreed quotation';

  let invoiceNo =
    finalReceiptData?.receiptNumber ||
    payView?.receipt?.receiptNumber ||
    payView?.receiptNumber ||
    params?.receiptNumber ||
    app?.receiptNumber ||
    params?.voucher ||
    '';

  const rawReceiptDate =
    params?.date
      ? new Date(params.date)
      : (finalReceiptData?.receiptDate || finalReceiptData?.receiptGeneratedAt)
        ? new Date(finalReceiptData.receiptDate || finalReceiptData.receiptGeneratedAt)
        : (payView?.receipt?.receiptGeneratedAt || payView?.receiptGeneratedAt)
          ? new Date(payView.receipt?.receiptGeneratedAt || payView.receiptGeneratedAt)
          : (app?.finalPaidDetails?.paymentDate || app?.midTermPaidDetails?.paymentDate || app?.initialPaidDetails?.paymentDate || new Date());

  const dateVal = formatDateDDMMYY(rawReceiptDate);

  const clientName = (
    finalReceiptData?.customer?.name ||
    payView?.customer?.name ||
    app?.clientName ||
    app?.name ||
    app?.customerName ||
    'Customer'
  ).toUpperCase();

  const customerObj = finalReceiptData?.customer || payView?.customer || app?.customer || {};
  let addressLines = [];
  if (customerObj.address && typeof customerObj.address === 'string') {
    addressLines = customerObj.address.split(',').map((p) => p.trim()).filter(Boolean);
  } else if (customerObj.doorNo || customerObj.streetName) {
    const l1 = [customerObj.doorNo, customerObj.streetName].filter(Boolean).join(', ');
    if (l1) addressLines.push(l1);
    if (customerObj.area) addressLines.push(customerObj.area);
    const l3 = [customerObj.city, customerObj.pincode].filter(Boolean).join(' - ');
    if (l3) addressLines.push(l3);
  } else if (app?.address || app?.location) {
    const parts = (app.address || app.location || '').split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      addressLines = parts;
    } else if (parts.length === 1) {
      addressLines.push(parts[0]);
    }
  }
  if (addressLines.length === 0) {
    addressLines.push('Chennai, Tamil Nadu');
  }

  const gstinVal =
    customerGst ||
    finalReceiptData?.customerGstNumber ||
    finalReceiptData?.customer?.gstNumber ||
    payView?.customer?.gstNumber ||
    app?.gstNumber ||
    app?.gstin ||
    '';

  const siteAddress = (
    finalReceiptData?.propertyAddress ||
    app?.propertyAddress ||
    app?.siteAddress ||
    app?.location ||
    app?.address ||
    (customerObj?.area ? [customerObj.doorNo, customerObj.streetName, customerObj.area, customerObj.city, customerObj.pincode].filter(Boolean).join(', ') : '') ||
    clientName
  ).toUpperCase();

  // Extract service list
  let servicesList = [];
  let paymentAmount = 0;

  if (isFullReceipt) {
    if (Array.isArray(finalReceiptData?.services) && finalReceiptData.services.length > 0) {
      servicesList = finalReceiptData.services.map((s, idx) => ({
        sNo: idx + 1,
        name: (s.title || s.serviceName || 'Terrace Waterproofing').toUpperCase(),
        measurement: formatSqft(s.sqft) || (s.measurement ? String(s.measurement) : '1'),
        rate: s.rate ? Number(s.rate).toLocaleString('en-IN') : (s.totalPrice && s.sqft ? Math.round(Number(s.totalPrice) / Number(s.sqft)).toLocaleString('en-IN') : Number(s.totalPrice || 0).toLocaleString('en-IN')),
        total: Number(s.totalPrice || s.total || 0),
      }));
    } else if (Array.isArray(payView?.services) && payView.services.length > 0) {
      servicesList = payView.services.map((s, idx) => ({
        sNo: idx + 1,
        name: (s.title || s.serviceName || 'Terrace Waterproofing').toUpperCase(),
        measurement: formatSqft(s.sqft) || '1',
        rate: s.rate ? Number(s.rate).toLocaleString('en-IN') : (s.totalPrice && s.sqft ? Math.round(Number(s.totalPrice) / Number(s.sqft)).toLocaleString('en-IN') : Number(s.totalPrice || 0).toLocaleString('en-IN')),
        total: Number(s.totalPrice || s.paidAmount || 0),
      }));
      const additionalPaymentList = getAdditionalPaymentList(payView);
      if (additionalPaymentList.length > 0) {
        additionalPaymentList.forEach((s) => {
          servicesList.push({
            sNo: servicesList.length + 1,
            name: (s.title || 'ADDITIONAL WORK').toUpperCase(),
            measurement: formatSqft(s.sqft) || '1',
            rate: s.rate ? Number(s.rate).toLocaleString('en-IN') : Number(s.totalPrice || 0).toLocaleString('en-IN'),
            total: Number(s.totalPrice || s.paidAmount || 0),
          });
        });
      }
    } else if (
      app?.quotations?.[0]?.servicesList &&
      Array.isArray(app.quotations[0].servicesList) &&
      app.quotations[0].servicesList.length > 0
    ) {
      const q = app.quotations[0];
      const tier = app?.chosenCategory || 'Basic';
      servicesList = q.servicesList.map((s, idx) => {
        let r = s.rateBasic || s.rate || 0;
        let sub = s.subtotalBasic || s.subtotal || 0;
        if (tier === 'Mid' || tier === 'Medium') {
          r = s.rateMid || s.rateMedium || r;
          sub = s.subtotalMid || s.subtotalMedium || sub;
        } else if (tier === 'Luxury' || tier === 'High') {
          r = s.rateLuxury || s.rateHigh || r;
          sub = s.subtotalLuxury || s.subtotalHigh || sub;
        }
        return {
          sNo: idx + 1,
          name: (s.serviceName || s.name || 'Terrace Waterproofing').toUpperCase(),
          measurement: formatSqft(s.sqft) || (s.area && !isNaN(s.area) ? formatSqft(s.area) : '1'),
          rate: r ? Number(r).toLocaleString('en-IN') : Number(sub).toLocaleString('en-IN'),
          total: Number(sub || 0),
        };
      });
    }
  } else {
    // Individual service payment / milestone receipt
    let matchedService = null;
    let matchedPaymentId = params?.paymentId || null;
    if (payView && (params?.milestone || params?.voucher || params?.paymentId)) {
      const allPaymentsFlat = [
        ...(Array.isArray(payView.services) ? payView.services : []),
        ...getAdditionalPaymentList(payView),
        ...(payView.gstPayment ? [payView.gstPayment] : []),
        ...(Array.isArray(payView.history) ? [{ payments: payView.history }] : []),
        ...(Array.isArray(payView.payments) ? [{ payments: payView.payments }] : []),
      ].flatMap((s) => (Array.isArray(s.payments) ? s.payments : []));
      const foundPayment = allPaymentsFlat.find((p) =>
        (params.paymentId && String(p.id) === String(params.paymentId)) ||
        (params.milestone && String(p.id) === String(params.milestone)) ||
        (params.voucher && String(p.voucher || '').toLowerCase() === String(params.voucher).toLowerCase())
      );
      if (foundPayment?.id) matchedPaymentId = foundPayment.id;
    }
    if (!isGst && (matchedPaymentId || params?.paymentId)) {
      const pid = matchedPaymentId || params?.paymentId;
      invoiceNo = String(pid).startsWith('DRT') ? pid : `DRT${pid}`;
    }
    if (payView) {
      const allServices = [
        ...(Array.isArray(payView.services) ? payView.services : []),
        ...getAdditionalPaymentList(payView),
      ];
      if (params?.serviceId) {
        matchedService = allServices.find((s) => String(s.id) === String(params.serviceId));
      }
      if (!matchedService && params?.stage) {
        const cleanStage = String(params.stage).toLowerCase().replace(/[\(\)]/g, '').trim();
        matchedService = allServices.find((s) => {
          const cleanTitle = String(s.title || '').toLowerCase().trim();
          return cleanTitle === cleanStage || cleanTitle.includes(cleanStage) || cleanStage.includes(cleanTitle);
        });
      }
      if (!matchedService && (params?.voucher || params?.milestone)) {
        matchedService = allServices.find((s) =>
          Array.isArray(s.payments) &&
          s.payments.some((p) =>
            (params.voucher && String(p.voucher).toLowerCase() === String(params.voucher).toLowerCase()) ||
            (params.milestone && String(p.id) === String(params.milestone))
          )
        );
      }
      if (!matchedService && allServices.length === 1) {
        matchedService = allServices[0];
      }
    }

    const sName = cashServiceText;

    const rawSqft =
      matchedService?.sqft ||
      params?.sqft ||
      (app?.sqft && !isNaN(app.sqft) ? app.sqft : '');

    const measurement = formatSqft(rawSqft) || '1';

    const rawRate =
      matchedService?.rate ||
      params?.rate ||
      (matchedService?.totalPrice && rawSqft ? Math.round(Number(matchedService.totalPrice) / Number(rawSqft)) : '') ||
      (params?.totalCost && rawSqft ? Math.round(Number(params.totalCost) / Number(rawSqft)) : '');

    const rateFormatted = rawRate
      ? Number(rawRate).toLocaleString('en-IN')
      : (params?.amount ? Number(params.amount).toLocaleString('en-IN') : '0');

    paymentAmount = Number(
      params?.amount ||
      matchedService?.paidAmount ||
      matchedService?.totalPrice ||
      params?.totalCost ||
      0
    );

    servicesList = [
      {
        sNo: 1,
        name: sName,
        measurement: measurement,
        rate: rateFormatted,
        total: paymentAmount,
      },
    ];
  }

  const baseTotal = isFullReceipt
    ? Number(
      finalReceiptData?.quotation?.totalAmount ||
      finalReceiptData?.grossSubtotal ||
      finalReceiptData?.originalTotalPrice ||
      payView?.pricing?.subTotal ||
      payView?.grossSubtotal ||
      payView?.totalPrice ||
      params?.totalCost ||
      params?.amount ||
      app?.totalPayment ||
      app?.totalCost ||
      app?.cost ||
      0
    )
    : Number(paymentAmount || params?.amount || 0);

  if (servicesList.length === 0) {
    const defaultTitle =
      finalReceiptData?.quotation?.title ||
      payView?.quotationTitle ||
      (Array.isArray(app?.packages) &&
        app.packages.flatMap((p) => p.quotations || []).find((q) => q.isConfirmed)?.packageName) ||
      app?.serviceType ||
      'TERRACE WATERPROOFING';

    servicesList = [
      {
        sNo: 1,
        name: defaultTitle.toUpperCase(),
        measurement: formatSqft(params?.sqft) || (app?.sqft && !isNaN(app.sqft) ? formatSqft(app.sqft) : '1'),
        rate: params?.rate ? Number(params.rate).toLocaleString('en-IN') : Number(baseTotal).toLocaleString('en-IN'),
        total: baseTotal,
      },
    ];
  }

  if (Array.isArray(app?.extraCharges) && app.extraCharges.length > 0) {
    app.extraCharges.forEach((c) => {
      servicesList.push({
        sNo: servicesList.length + 1,
        name: (c.title || 'EXTRA CHARGE').toUpperCase(),
        measurement: '1',
        rate: Number(c.amount || 0).toLocaleString('en-IN'),
        total: Number(c.amount || 0),
      });
    });
  }

  const linesTotal = servicesList.reduce((acc, s) => acc + (s.total || 0), 0) || baseTotal;

  // A cash bill shows the full amount payable (the server's grandTotal, which includes GST when GST is charged),
  // not the pre-tax line totals.
  const serverGrandTotal = isFullReceipt
    ? Number(finalReceiptData?.grandTotal ?? finalReceiptData?.pricing?.grandTotal)
    : NaN;
  const subTotal = !isGst && Number.isFinite(serverGrandTotal) && serverGrandTotal > 0 ? serverGrandTotal : linesTotal;

  if (!isGst) {
    servicesList = [{ sNo: 1, name: cashServiceText, measurement: '', rate: '', total: subTotal }];
  }

  const gstPercent = finalReceiptData
    ? (Number(finalReceiptData.gstPercentage ?? finalReceiptData.pricing?.gst?.percentage ?? 0) || 0)
    : Number(payView?.gstPercentage || payView?.pricing?.gst?.percentage || app?.gstPercentage || params?.gstPercent || 18);
  const cgstRate = gstPercent / 2;
  const sgstRate = gstPercent / 2;

  let cgstAmount = 0;
  let sgstAmount = 0;
  if (isGst) {
    if (finalReceiptData?.cgst != null && finalReceiptData?.sgst != null) {
      cgstAmount = Number(finalReceiptData.cgst);
      sgstAmount = Number(finalReceiptData.sgst);
    } else {
      cgstAmount = Math.round((subTotal * (cgstRate / 100)) * 100) / 100;
      sgstAmount = Math.round((subTotal * (sgstRate / 100)) * 100) / 100;
    }
  }

  const afterTax = isGst ? subTotal + cgstAmount + sgstAmount : subTotal;
  const grandTotal = isGst ? Math.round(afterTax) : Math.round(subTotal);

  return {
    isGst,
    docTitle,
    invoiceNo,
    dateVal,
    clientName,
    addressLines,
    gstinVal,
    siteAddress,
    servicesList,
    subTotal,
    gstPercent,
    cgstRate,
    sgstRate,
    cgstAmount,
    sgstAmount,
    afterTax,
    grandTotal,
  };
};

// Helper function to generate Tax Invoice / Payment Receipt HTML matching the official Dr. Terrace format
// ============================================================
// MULTI-PAGE TAX INVOICE / RECEIPT PDF
// Designed specifically for Expo Print
// ============================================================

export const generateTaxInvoiceHTML = (
  app,
  customerGst,
  finalReceiptData = null,
  params = {},
  payView = null
) => {
  const {
    isGst,
    docTitle,
    invoiceNo,
    dateVal: currentDate,
    clientName,
    addressLines,
    gstinVal,
    siteAddress,
    servicesList,
    subTotal,
    cgstRate,
    sgstRate,
    cgstAmount,
    sgstAmount,
    afterTax,
    grandTotal,
  } = getReceiptData(
    app,
    customerGst,
    finalReceiptData,
    params,
    payView
  );

  // ==========================================================
  // HELPERS
  // ==========================================================

  const money = (value) =>
    Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  // ==========================================================
  // IMPORTANT:
  //
  // We deliberately create pages ourselves instead of relying
  // on fixed HTML headers/footers.
  //
  // This is much more reliable with expo-print.
  // ==========================================================

  const FIRST_PAGE_ROWS = 10;
  const NORMAL_PAGE_ROWS = 17;
  const FINAL_PAGE_ROWS = 9;

  // ==========================================================
  // SPLIT SERVICES INTO PAGES
  // ==========================================================

  const splitServicesIntoPages = (items) => {
    if (!items || items.length === 0) {
      return [[]];
    }

    const pages = [];

    // --------------------------------------------------------
    // First page
    // Has:
    // - Header
    // - Billing address
    // - Site address
    // - Table
    // --------------------------------------------------------

    pages.push(items.slice(0, FIRST_PAGE_ROWS));

    let remaining = items.slice(FIRST_PAGE_ROWS);

    while (remaining.length > 0) {
      pages.push(remaining.slice(0, NORMAL_PAGE_ROWS));
      remaining = remaining.slice(NORMAL_PAGE_ROWS);
    }

    return pages;
  };

  let servicePages = splitServicesIntoPages(servicesList);

  // ==========================================================
  // If the final page has too many rows, move some rows to a
  // new final page so that totals/signature/seal have room.
  // ==========================================================

  if (servicePages.length > 1) {
    const lastIndex = servicePages.length - 1;
    const lastPage = servicePages[lastIndex];

    if (lastPage.length > FINAL_PAGE_ROWS) {
      const keepRows = lastPage.slice(0, FINAL_PAGE_ROWS);
      const moveRows = lastPage.slice(FINAL_PAGE_ROWS);

      servicePages[lastIndex] = keepRows;

      servicePages.push(moveRows);
    }
  }

  // ==========================================================
  // HEADER
  // ==========================================================

  const renderHeader = () => `
    <div class="letterhead">

      <table class="header-table">

        <tr>

          <td class="header-logo-cell">

            <img
              src="data:image/png;base64,${logoBase64}"
              class="header-logo"
            />

          </td>

          <td class="header-title-cell">

            <div class="document-title">
              ${escapeHtml(docTitle)}
            </div>

          </td>

          <td class="header-meta-cell">

            <div>
              INV : ${escapeHtml(invoiceNo)}
            </div>

            <div>
              DATE : ${escapeHtml(currentDate)}
            </div>

          </td>

        </tr>

      </table>

    </div>
  `;

  // ==========================================================
  // FOOTER
  // ==========================================================

  const renderFooter = () => `
    <div class="company-footer">

      <div class="footer-line"></div>

      <table class="footer-table">

        <tr>

          <td class="footer-company">

            <strong>
              Dr. Terrace Water Proofing
              (ISO - 9001: 2008 Certified)
            </strong>

            <br />

            Parsn Commercial Complex,
            C-13, B-13, 2nd Floor,
            Kodambakkam High Road,
            Nungambakkam,

            <br />

            Chennai - 600006

            <br />

            www.drterrace.com /
            www.drterracewaterproofing.com

            <br />

            <strong>
              GST NO 33AANFD9271D1ZE
            </strong>

          </td>

          <td class="footer-logo-cell">

            <img
              src="data:image/png;base64,${logoBase64}"
              class="footer-logo"
            />

          </td>

        </tr>

      </table>

    </div>
  `;

  // ==========================================================
  // BILLING SECTION
  // ONLY ON FIRST PAGE
  // ==========================================================

  const renderBilling = () => `
    <div class="billing-section">

      <div class="billing-title">
        BILLING ADDRESS
      </div>

      <div class="billing-name">
        ${escapeHtml(clientName)}
      </div>

      ${addressLines
        .map(
          (line) => `
            <div class="billing-line">
              ${escapeHtml(line)}
            </div>
          `
        )
        .join('')}

      ${
        gstinVal
          ? `
            <div class="billing-line gst-line">
              GST - ${escapeHtml(gstinVal)}
            </div>
          `
          : ''
      }

    </div>

    <div class="site-address">

      SITE ADDRESS:
      ${escapeHtml(siteAddress)}

    </div>
  `;

  // ==========================================================
  // TABLE HEADER
  // ==========================================================

  const renderTableHeader = () => `
    <thead>

      <tr>

        <th class="col-sno">
          S. No
        </th>

        <th class="col-service">
          Service
        </th>

        ${isGst ? `
        <th class="col-measurement">
          Measurement
        </th>

        <th class="col-rate">
          Cost / sft (Rs)
        </th>
        ` : ''}

        <th class="col-total">
          Total
        </th>

      </tr>

    </thead>
  `;

  // ==========================================================
  // SERVICE ROWS
  // ==========================================================

  const renderServiceRows = (items) =>
    items
      .map(
        (svc) => `
          <tr class="service-row">

            <td class="center">
              ${escapeHtml(svc.sNo)}
            </td>

            <td class="service-name">
              ${escapeHtml(svc.name)}
            </td>

            ${isGst ? `
            <td class="center">
              ${escapeHtml(svc.measurement)}
            </td>

            <td class="center">
              ${escapeHtml(svc.rate)}
            </td>
            ` : ''}

            <td class="right bold">
              Rs. ${money(svc.total)}
            </td>

          </tr>
        `
      )
      .join('');

  // ==========================================================
  // HSN
  // ==========================================================

  const renderHsn = () =>
    isGst
      ? `
        <tr class="hsn-row">

          <td></td>

          <td class="center bold">
            HSN CODE : 995453
          </td>

          <td></td>

          <td></td>

          <td></td>

        </tr>
      `
      : '';

  // ==========================================================
  // TOTALS
  // ONLY FINAL PAGE
  // ==========================================================

  const renderTotals = () => `
    <table class="totals-table">

      <tr>

        <td colspan="2"></td>

        <td colspan="2" class="center bold">
          Sub Total
        </td>

        <td class="right bold">
          Rs. ${money(subTotal)}
        </td>

      </tr>

      ${
        isGst
          ? `
            <tr>

              <td colspan="2"></td>

              <td class="center bold">
                CGST
              </td>

              <td class="center bold">
                ${cgstRate}%
              </td>

              <td class="right bold">
                Rs. ${money(cgstAmount)}
              </td>

            </tr>

            <tr>

              <td colspan="2"></td>

              <td class="center bold">
                SGST
              </td>

              <td class="center bold">
                ${sgstRate}%
              </td>

              <td class="right bold">
                Rs. ${money(sgstAmount)}
              </td>

            </tr>

            <tr>

              <td colspan="2"></td>

              <td colspan="2" class="center bold">
                After Tax
              </td>

              <td class="right bold">
                Rs. ${money(afterTax)}
              </td>

            </tr>
          `
          : ''
      }

      <tr class="grand-total-row">

        <td colspan="2"></td>

        <td colspan="2" class="center bold">
          TOTAL
        </td>

        <td class="right bold total-amount">
          Rs. ${money(grandTotal)}
        </td>

      </tr>

    </table>
  `;

  // ==========================================================
  // SIGNATURE + SEAL
  // ==========================================================

  const renderSignature = () => `
    <div class="signature-section">

      <table class="signature-table">

        <tr>

          <td class="signature-left">

            <div class="sign-title">
              With regards,
            </div>

            <div class="signer-name">
              P.SRIDHAR
            </div>

            <div class="signer-role">
              ADMIN
            </div>

            <div class="signer-phone">
              &#9742; 044 &ndash; 45 000 775
            </div>

          </td>

          <td class="signature-right">

            <img
              src="data:image/png;base64,${sealBase64}"
              class="stamp-img"
              alt="Official Seal"
            />

          </td>

        </tr>

      </table>

    </div>
  `;

  // ==========================================================
  // CREATE EACH PAGE
  // ==========================================================

  const pagesHtml = servicePages
    .map((pageItems, pageIndex) => {

      const isFirstPage = pageIndex === 0;
      const isLastPage = pageIndex === servicePages.length - 1;

      return `
        <section class="invoice-page">

          <!-- ================================
               LETTERHEAD
               ================================ -->

          ${renderHeader()}


          <!-- ================================
               MAIN CONTENT
               ================================ -->

          <div class="page-content">

            ${
              isFirstPage
                ? `
                  ${renderBilling()}
                `
                : `
                  <div class="continuation-title">
                    ${escapeHtml(docTitle)}
                    &nbsp;&mdash;&nbsp;
                    CONTINUED
                  </div>
                `
            }


            <!-- ==============================
                 SERVICES TABLE
                 ============================== -->

            <table class="items-table">

              <colgroup>

                <col class="col-sno" />

                ${isGst ? `
                <col class="col-service" />

                <col class="col-measurement" />

                <col class="col-rate" />
                ` : `
                <col class="col-service" style="width:74%;" />
                `}

                <col class="col-total" />

              </colgroup>

              ${renderTableHeader()}

              <tbody>

                ${renderServiceRows(pageItems)}

              </tbody>

            </table>


            ${
              isLastPage
                ? `
                  ${renderHsn()}

                  ${renderTotals()}

                  ${renderSignature()}
                `
                : ''
            }

          </div>


          <!-- ================================
               COMPANY FOOTER
               ================================ -->

          ${renderFooter()}

        </section>
      `;
    })
    .join('');

  // ==========================================================
  // FINAL HTML
  // ==========================================================

  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="utf-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<style>

/* ============================================================
   A4 PAGE
   ============================================================ */

@page {
  size: A4;
  margin: 0;
}

html,
body {

  margin: 0;

  padding: 0;

  background: #ffffff;

  color: #000000;

  font-family:
    Helvetica,
    Arial,
    sans-serif;

  -webkit-print-color-adjust: exact;

  print-color-adjust: exact;
}


/* ============================================================
   EACH PHYSICAL PAGE
   ============================================================ */

.invoice-page {
  width: 210mm;
  height: 297mm;

  box-sizing: border-box;

  padding:
    13mm
    13mm
    18mm
    13mm;

  position: relative;

  background: #ffffff;

  /* PAGE BORDER */
  border: 1.5px solid #000000;

  page-break-after: always;
  break-after: page;

  overflow: hidden;
}


/*
 * Do NOT create another page after the final page.
 */

.invoice-page:last-child {

  page-break-after: auto;

  break-after: auto;
}


/* ============================================================
   LETTERHEAD
   ============================================================ */

.letterhead {

  width: 100%;

  height: 25mm;

  box-sizing: border-box;

  border-bottom: 1.5px solid #000000;

  margin-bottom: 7mm;
}


.header-table {

  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;
}


.header-table td {

  border: none;

  padding: 0;

  vertical-align: middle;
}


.header-logo-cell {

  width: 28%;

  text-align: left;
}


.header-logo {

  width: 82px;

  height: 62px;

  object-fit: contain;
}


.header-title-cell {

  width: 44%;

  text-align: center;
}


.document-title {

  font-size: 17px;

  font-weight: 900;

  text-decoration: underline;

  text-transform: uppercase;

  letter-spacing: 0.5px;
}


.header-meta-cell {

  width: 28%;

  text-align: right;

  font-size: 10.5px;

  font-weight: 900;

  line-height: 1.7;
}


/* ============================================================
   PAGE CONTENT
   ============================================================ */

.page-content {

  width: 100%;

  box-sizing: border-box;
}


/* ============================================================
   BILLING ADDRESS
   ============================================================ */

.billing-section {

  margin-bottom: 8mm;
}


.billing-title {

  font-size: 11px;

  font-weight: 900;

  text-decoration: underline;

  text-transform: uppercase;

  margin-bottom: 3px;
}


.billing-name {

  font-size: 11px;

  font-weight: 900;

  text-transform: uppercase;

  margin-bottom: 2px;
}


.billing-line {

  font-size: 10.5px;

  font-weight: 600;

  line-height: 1.35;
}


.gst-line {

  margin-top: 3px;

  font-weight: 900;
}


/* ============================================================
   SITE ADDRESS
   ============================================================ */

.site-address {

  text-align: center;

  font-size: 11px;

  font-weight: 900;

  text-transform: uppercase;

  margin-bottom: 5mm;

  line-height: 1.4;
}


/* ============================================================
   CONTINUATION PAGE
   ============================================================ */

.continuation-title {

  text-align: center;

  font-size: 10px;

  font-weight: 900;

  text-transform: uppercase;

  margin-bottom: 5mm;
}


/* ============================================================
   ITEMS TABLE
   ============================================================ */

.items-table {

  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;

  margin: 0;
}


.items-table th {

  border: 1.4px solid #000000;

  padding: 7px 4px;

  font-size: 10px;

  font-weight: 900;

  text-align: center;

  vertical-align: middle;

  background: #ffffff;
}


.items-table td {

  border: 1.4px solid #000000;

  padding: 6px 7px;

  font-size: 10px;

  vertical-align: middle;

  line-height: 1.3;
}


.items-table tr {

  page-break-inside: avoid;

  break-inside: avoid;
}


/* ============================================================
   COLUMNS
   ============================================================ */

.col-sno {

  width: 8%;
}


.col-service {

  width: 42%;
}


.col-measurement {

  width: 15%;
}


.col-rate {

  width: 17%;
}


.col-total {

  width: 18%;
}


/* ============================================================
   TEXT
   ============================================================ */

.center {

  text-align: center;
}


.right {

  text-align: right;
}


.bold {

  font-weight: 900;
}


.service-name {

  font-weight: 900;

  word-break: normal;

  overflow-wrap: break-word;
}


/* ============================================================
   HSN
   ============================================================ */

.hsn-row {

  page-break-inside: avoid;

  break-inside: avoid;
}


.hsn-row td {

  font-weight: 900;
}


/* ============================================================
   TOTALS
   ============================================================ */

.totals-table {

  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;
}


.totals-table td {

  border: 1.4px solid #000000;

  padding: 6px 7px;

  font-size: 10px;

  vertical-align: middle;
}


.grand-total-row td {

  font-size: 11px;

  font-weight: 900;
}


.total-amount {

  font-size: 12px !important;

  font-weight: 900;
}


/* ============================================================
   SIGNATURE
   ============================================================ */

.signature-section {

  margin-top: 9mm;

  page-break-inside: avoid;

  break-inside: avoid;
}


.signature-table {

  width: 100%;

  border-collapse: collapse;
}


.signature-table td {

  border: none;

  padding: 0;

  vertical-align: top;
}


.signature-left {

  width: 50%;
}


.signature-right {

  width: 50%;

  text-align: right;
}


.sign-title {

  font-size: 10px;

  margin-bottom: 5px;
}


.signer-name {

  font-size: 11px;

  font-weight: 900;

  text-transform: uppercase;
}


.signer-role {

  font-size: 10px;

  font-weight: 900;

  text-transform: uppercase;

  margin-top: 2px;
}


.signer-phone {

  font-size: 10px;

  font-weight: 900;

  margin-top: 3px;
}


.stamp-img {

  width: 105px;

  height: 105px;

  object-fit: contain;

  display: inline-block;

  transform: rotate(-6deg);
}


/* ============================================================
   COMPANY FOOTER
   ============================================================ */

.company-footer {

  position: absolute;

  left: 13mm;

  right: 13mm;

  bottom: 7mm;

  height: 18mm;

  box-sizing: border-box;
}


.footer-line {

  border-top: 1px dotted #000000;

  margin-bottom: 3mm;
}


.footer-table {

  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;
}


.footer-table td {

  border: none;

  padding: 0;

  vertical-align: middle;
}


.footer-company {

  width: 82%;

  font-size: 8px;

  line-height: 1.35;
}


.footer-logo-cell {

  width: 18%;

  text-align: right;
}


.footer-logo {

  width: 55px;

  height: 45px;

  object-fit: contain;
}

</style>

</head>


<body>

${pagesHtml}

</body>

</html>
`;
};


export default function ReceiptScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const isDark = colorScheme === 'dark';
  const [app, setApp] = React.useState(null);
  const [finalReceiptData, setFinalReceiptData] = React.useState(null);
  const [payView, setPayView] = React.useState(null);

  React.useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        setApp(res.appointment);
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            setApp(cRes.client || cRes.data);
          }
        });
      }
    });
  }, [params.id]);

  React.useEffect(() => {
    const qId =
      params.quotationId ||
      app?.confirmedQuoteId ||
      app?.activeQuotationId ||
      (Array.isArray(app?.quotations) && app.quotations.find((q) => q.isConfirmed)?.id);
    if (!qId) return;

    // Fetch payView for accurate ledger & services
    paymentRepository
      .getPayView(qId)
      .then((res) => {
        if (res?.success && res.data) {
          setPayView(res.data);
        } else {
          paymentRepository.getPaymentSummary(qId).then((sRes) => {
            if (sRes?.success && sRes.data) {
              setPayView(sRes.data);
            }
          }).catch(() => { });
        }
      })
      .catch(() => {
        paymentRepository.getPaymentSummary(qId).then((sRes) => {
          if (sRes?.success && sRes.data) {
            setPayView(sRes.data);
          }
        }).catch(() => { });
      });

    // If full service receipt, retrieve or generate official final receipt
    if (params.isFullServiceReceipt === 'true') {
      paymentRepository
        .getFinalReceipt(qId, params.gstNumber)
        .then((res) => {
          if (res?.success && res.data) {
            setFinalReceiptData(res.data);
          } else {
            paymentRepository
              .generateFinalReceipt(qId, params.gstNumber)
              .then((genRes) => {
                if (genRes?.success && genRes.data) {
                  setFinalReceiptData(genRes.data);
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          paymentRepository
            .generateFinalReceipt(qId, params.gstNumber)
            .then((genRes) => {
              if (genRes?.success && genRes.data) {
                setFinalReceiptData(genRes.data);
              }
            })
            .catch(() => {});
        });
    }
  }, [
    params.isFullServiceReceipt,
    params.quotationId,
    params.gstNumber,
    app?.confirmedQuoteId,
    app?.activeQuotationId,
    app?.quotations,
  ]);

  const customerGst =
    params.gstNumber ||
    finalReceiptData?.customerGstNumber ||
    finalReceiptData?.customer?.gstNumber ||
    payView?.customer?.gstNumber ||
    app?.gstNumber ||
    app?.gstin ||
    '';

  const {
    isGst,
    docTitle,
    invoiceNo,
    dateVal,
    clientName,
    addressLines,
    gstinVal,
    siteAddress,
    servicesList,
    subTotal: calculatedSubTotal,
    cgstRate,
    sgstRate,
    cgstAmount,
    sgstAmount,
    afterTax,
    grandTotal,
  } = getReceiptData(app, customerGst, finalReceiptData, params, payView);

  const getPdfUri = async () => {
    const htmlContent = generateTaxInvoiceHTML(app, customerGst, finalReceiptData, params, payView);
    const cleanClientName = toSafeFileName(clientName, 'Customer');
    const cleanDocTitle = toSafeFileName(docTitle, 'Receipt');
    const fileName = `${cleanDocTitle}_${cleanClientName}.pdf`;
    const uri = await createPdfFile({ html: htmlContent, fileName });
    return { uri, fileName };
  };

  // PDF Action Handlers
  const handleShare = async () => {
    try {
      const { uri } = await getPdfUri();
      await sharePdfFile({ uri, title: `Share ${docTitle} - ${clientName}` });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt PDF: ' + error.message);
    }
  };

  const handleWhatsApp = async () => {
    try {
      const { uri } = await getPdfUri();
      await sharePdfFile({ uri, title: `Send ${docTitle} to ${clientName} via WhatsApp` });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt via WhatsApp: ' + error.message);
    }
  };

  const handleShareRef = React.useRef(handleShare);
  React.useEffect(() => {
    handleShareRef.current = handleShare;
  });

  React.useEffect(() => {
    if (params.autoShare === 'true' && app) {
      const timer = setTimeout(() => {
        handleShareRef.current?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [params.autoShare, app]);

  if (!app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.errorText, isDark && styles.textDark]}>Loading receipt details...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title={docTitle} paddingTop={insets.top} isDark={isDark} />

      {/* Scrollable Document page container */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        {/* White PDF Sheet Document with Black Outer Border matching the photo */}
        <View style={[styles.receiptCanvas, isDark && styles.receiptCanvasDark]}>
          {/* Top Header */}
          <View style={styles.topHeaderRow}>
            <View style={styles.headerLogoContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${logoBase64}` }}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.docTitleText}>{docTitle}</Text>
            </View>
            <View style={styles.headerMetaContainer}>
              <Text style={styles.headerMetaText}>INV : {invoiceNo}</Text>
              <Text style={styles.headerMetaText}>DATE : {dateVal}</Text>
            </View>
          </View>

          {/* Billing Address */}
          <View style={styles.billingSection}>
            <Text style={styles.billingAddressHeading}>BILLING ADDRESS</Text>
            <Text style={styles.billingCustomerName}>{clientName}</Text>
            {addressLines.map((line, idx) => (
              <Text key={idx} style={styles.billingAddressLine}>
                {line}
              </Text>
            ))}
            {Boolean(gstinVal) && (
              <Text style={styles.billingGstText}>GST-{gstinVal}</Text>
            )}
          </View>

          {/* Site Address Bar */}
          <Text style={styles.siteAddressBarText}>
            Site ADDRESS: {siteAddress}
          </Text>

          {/* Table Grid */}
          <View style={styles.gridTable}>
            {/* Table Header */}
            <View style={styles.gridHeaderRow}>
              <Text style={[styles.gridTh, { width: '10%' }]}>S. No</Text>
              <Text style={[styles.gridTh, { width: isGst ? '40%' : '73%' }]}>Service</Text>
              {isGst && <Text style={[styles.gridTh, { width: '16%' }]}>Measurment</Text>}
              {isGst && <Text style={[styles.gridTh, { width: '17%' }]}>Cost / sft (Rs)</Text>}
              <Text style={[styles.gridTh, { width: '17%', borderRightWidth: 0 }]}>Total</Text>
            </View>

            {/* Service Rows */}
            {servicesList.map((svc, idx) => (
              <View key={idx} style={styles.gridDataRow}>
                <Text style={[styles.gridTdCenter, { width: '10%' }]}>{svc.sNo}</Text>
                <Text style={[styles.gridTdLeft, styles.gridTdBold, { width: isGst ? '40%' : '73%' }]}>
                  {svc.name}
                </Text>
                {isGst && <Text style={[styles.gridTdCenter, { width: '16%' }]}>{svc.measurement}</Text>}
                {isGst && <Text style={[styles.gridTdCenter, { width: '17%' }]}>{svc.rate}</Text>}
                <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                  Rs. {Number(svc.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            ))}

            {/* Empty spacing row */}
            <View style={[styles.gridDataRow, { height: 22 }]}>
              <View style={[styles.gridEmptyCell, { width: '10%' }]} />
              <View style={[styles.gridEmptyCell, { width: isGst ? '40%' : '73%' }]} />
              {isGst && <View style={[styles.gridEmptyCell, { width: '16%' }]} />}
              {isGst && <View style={[styles.gridEmptyCell, { width: '17%' }]} />}
              <View style={[styles.gridEmptyCell, { width: '17%', borderRightWidth: 0 }]} />
            </View>

            {/* HSN CODE Row */}
            {isGst && (
              <View style={styles.gridDataRow}>
                <View style={[styles.gridEmptyCell, { width: '10%' }]} />
                <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '40%' }]}>
                  HSN CODE : 995453
                </Text>
                <View style={[styles.gridEmptyCell, { width: '16%' }]} />
                <View style={[styles.gridEmptyCell, { width: '17%' }]} />
                <View style={[styles.gridEmptyCell, { width: '17%', borderRightWidth: 0 }]} />
              </View>
            )}

            {/* Sub Total Row */}
            <View style={styles.gridDataRow}>
              <View style={[styles.gridEmptyCell, { width: '50%' }]} />
              <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '33%' }]}>Sub Total</Text>
              <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                Rs. {Number(calculatedSubTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            {isGst ? (
              <>
                {/* CGST Row */}
                <View style={styles.gridDataRow}>
                  <View style={[styles.gridEmptyCell, { width: '50%' }]} />
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '16%' }]}>CGST</Text>
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '17%' }]}>{cgstRate}%</Text>
                  <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                    Rs. {Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* SGST Row */}
                <View style={styles.gridDataRow}>
                  <View style={[styles.gridEmptyCell, { width: '50%' }]} />
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '16%' }]}>SGST</Text>
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '17%' }]}>{sgstRate}%</Text>
                  <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                    Rs. {Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* After Tax Row */}
                <View style={styles.gridDataRow}>
                  <View style={[styles.gridEmptyCell, { width: '50%' }]} />
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '33%' }]}>After Tax</Text>
                  <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                    Rs. {Number(afterTax).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Total Row */}
                <View style={styles.gridDataRow}>
                  <View style={[styles.gridEmptyCell, { width: '50%' }]} />
                  <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '33%' }]}>Total</Text>
                  <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                    Rs. {Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.gridDataRow}>
                <View style={[styles.gridEmptyCell, { width: '50%' }]} />
                <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '33%' }]}>Total</Text>
                <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                  Rs. {Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>

          {/* Footer Signatures and Stamp */}
          <View style={styles.bottomSignRow}>
            <View style={styles.signBlockLeft}>
              <Text style={styles.withRegardsLabel}>With regards,</Text>
              <Text style={[styles.signerNameBold, { marginTop: 4 }]}>P.SRIDHAR</Text>
              <Text style={styles.signerRoleBold}>ADMIN</Text>
              <View style={styles.signerPhoneRow}>
                <Ionicons name="call" size={11} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.signerPhoneText}>044 &ndash; 45 000 775</Text>
              </View>
            </View>

            {/* Official Stamp / Seal */}
            <View style={styles.stampContainerRight}>
              <Image
                source={{ uri: `data:image/png;base64,${sealBase64}` }}
                style={styles.sealImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Dotted Divider */}
          <View style={styles.dottedDivider} />

          {/* Company Bottom Footer */}
          <View style={styles.companyFooterRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.companyFooterTitle}>
                Dr. Terrace water Proofing (ISO - 9001: 2008 Certified)
              </Text>
              <Text style={styles.companyFooterAddress}>
                Parsn Commercial Complex, C-13, B-13, 2nd floor, Kodambakkam High Road, Nungambakkam,{'\n'}
                Chennai- 600006, www.drterrace.com / www.drterracewaterproofing.com
              </Text>
              <Text style={styles.companyFooterGst}>
                GST NO 33AANFD9271D1ZE
              </Text>
            </View>
            <Image
              source={{ uri: `data:image/png;base64,${logoBase64}` }}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.whatsappBtn]} onPress={handleWhatsApp} activeOpacity={0.85}>
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#080808',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  scrollContainer: {
    paddingTop: 16,
  },

  // Document Canvas - formatted as an authentic Tax Invoice sheet with solid black outer border
  receiptCanvas: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    borderWidth: 1.8,
    borderColor: '#000000',
    padding: 18,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  receiptCanvasDark: {
    backgroundColor: '#FFFFFF',
  },

  // Top Header Row
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLogoContainer: {
    width: '28%',
  },
  brandLogo: {
    width: 80,
    height: 65,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  docTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerMetaContainer: {
    width: '32%',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  headerMetaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    lineHeight: 16,
  },

  // Billing Address Block
  billingSection: {
    marginBottom: 12,
  },
  billingAddressHeading: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#000000',
    textDecorationLine: 'underline',
    marginBottom: 3,
  },
  billingCustomerName: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  billingAddressLine: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 14,
  },
  billingGstText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    marginTop: 2,
  },

  // Site Address Bar
  siteAddressBarText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 10,
  },

  // Table Grid
  gridTable: {
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 16,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  gridTh: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gridDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 28,
    alignItems: 'center',
  },
  gridTdCenter: {
    fontSize: 9.5,
    color: '#000000',
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gridTdLeft: {
    fontSize: 9.5,
    color: '#000000',
    textAlign: 'left',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gridTdRight: {
    fontSize: 9.5,
    color: '#000000',
    textAlign: 'right',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gridTdBold: {
    fontWeight: '900',
  },
  gridEmptyCell: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    height: '100%',
  },

  // Footer Signatures and Stamp
  bottomSignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  signBlockLeft: {
    flex: 1,
    paddingRight: 10,
  },
  withRegardsLabel: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 2,
  },
  signatureImageContainer: {
    height: 38,
    justifyContent: 'center',
    marginVertical: 2,
  },
  signatureImage: {
    width: 125,
    height: 36,
  },
  signerNameBold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
  },
  signerRoleBold: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
  },
  signerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  signerPhoneText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
  },

  // Stamp / Seal Container
  stampContainerRight: {
    width: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  sealImage: {
    width: 100,
    height: 100,
    transform: [{ rotate: '-6deg' }],
  },

  // Dotted Divider
  dottedDivider: {
    borderTopWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dotted',
    marginVertical: 12,
  },

  // Company Footer
  companyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyFooterTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 2,
  },
  companyFooterAddress: {
    fontSize: 8.5,
    color: '#000000',
    lineHeight: 11,
    marginBottom: 2,
  },
  companyFooterGst: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  footerLogo: {
    width: 65,
    height: 50,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 20,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    backgroundColor: '#0052CC',
  },
  printBtn: {
    backgroundColor: '#64748B',
  },
  whatsappBtn: {
    backgroundColor: '#22C55E',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});