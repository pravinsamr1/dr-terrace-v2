import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import {
  Alert,
  Image,
  Platform,
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
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';

const formatSqft = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.toLowerCase().includes('sq')) return str;
  return `${str} sq.ft`;
};

// Helper function to extract unified receipt data model for Dr. Terrace receipts
const getReceiptData = (app, customerGst, finalReceiptData = null, params = {}, payView = null) => {
  const isFullReceipt = params?.isFullServiceReceipt === 'true';

  // For individual payment/cash receipts, only show the payment amount without GST.
  // The GST is only shown in the final bill based on user selection when creating the Final Receipt with GST.
  const isGst = Boolean(
    isFullReceipt && (
      params?.hasGst === 'true' ||
      finalReceiptData?.withGst ||
      payView?.withGst
    )
  );

  const docTitle = isGst ? 'TAX INVOICE' : 'PAYMENT RECEIPT';

  const invoiceNo =
    params?.receiptNumber ||
    params?.voucher ||
    finalReceiptData?.receiptNumber ||
    payView?.receiptNumber ||
    app?.receiptNumber ||
    app?.invoiceNumber ||
    (app?.id ? `DRT ATEG ${String(app.id).padStart(3, '0')}/26-27` : 'DRT ATEG 013/26-27');

  const dateVal = formatDateDDMMYY(
    params?.date
      ? new Date(params.date)
      : finalReceiptData?.receiptDate
      ? new Date(finalReceiptData.receiptDate)
      : (app?.finalPaidDetails?.paymentDate || app?.midTermPaidDetails?.paymentDate || app?.initialPaidDetails?.paymentDate || new Date())
  );

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
  if (customerObj.doorNo || customerObj.streetName) {
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
      if (Array.isArray(payView?.additionalPayment) && payView.additionalPayment.length > 0) {
        payView.additionalPayment.forEach((s) => {
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
    if (payView) {
      const allServices = [
        ...(Array.isArray(payView.services) ? payView.services : []),
        ...(Array.isArray(payView.additionalPayment) ? payView.additionalPayment : []),
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

    const sName = (
      matchedService?.title ||
      matchedService?.serviceName ||
      params?.stage ||
      app?.serviceType ||
      'TERRACE WATERPROOFING'
    ).toUpperCase();

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

    const paymentAmount = Number(
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

  const baseTotal = Number(
    finalReceiptData?.grossSubtotal ||
    finalReceiptData?.originalTotalPrice ||
    payView?.grossSubtotal ||
    payView?.totalPrice ||
    params?.totalCost ||
    params?.amount ||
    app?.totalPayment ||
    app?.totalCost ||
    app?.cost ||
    0
  );

  if (servicesList.length === 0) {
    servicesList = [
      {
        sNo: 1,
        name: (app?.serviceType || 'TERRACE WATERPROOFING').toUpperCase(),
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

  const subTotal = servicesList.reduce((acc, s) => acc + (s.total || 0), 0) || baseTotal;
  const gstPercent = Number(
    finalReceiptData?.gstPercentage ||
    payView?.gstPercentage ||
    app?.gstPercentage ||
    params?.gstPercent ||
    18
  );
  const cgstRate = gstPercent / 2;
  const sgstRate = gstPercent / 2;

  let cgstAmount = 0;
  let sgstAmount = 0;
  if (isGst) {
    if (finalReceiptData?.cgst && finalReceiptData?.sgst) {
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
const generateTaxInvoiceHTML = (app, customerGst, finalReceiptData = null, params = {}, payView = null) => {
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
  } = getReceiptData(app, customerGst, finalReceiptData, params, payView);

  const subTotalFormatted = Number(subTotal).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const cgstFormatted = Number(cgstAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sgstFormatted = Number(sgstAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const afterTaxFormatted = Number(afterTax).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const grandTotalFormatted = Number(grandTotal).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const serviceRowsHtml = servicesList
    .map(
      (svc) => `
      <tr>
        <td class="td-center">${svc.sNo}</td>
        <td class="td-bold" style="padding: 8px;">${svc.name}</td>
        <td class="td-center">${svc.measurement}</td>
        <td class="td-center">${svc.rate}</td>
        <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${Number(svc.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  const addressLinesHtml = addressLines
    .map((l) => `<div class="billing-line">${l}</div>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            color: #000000;
            margin: 0;
            padding: 10px;
            background-color: #ffffff;
            font-size: 11px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-frame {
            border: 2px solid #000000;
            padding: 24px 20px 16px 20px;
            box-sizing: border-box;
            min-height: 980px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .top-header {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .top-header td {
            vertical-align: top;
            border: none;
            padding: 0;
          }
          .header-logo-container {
            width: 25%;
          }
          .header-logo-img {
            width: 90px;
            height: 70px;
            object-fit: contain;
          }
          .header-title-container {
            width: 50%;
            text-align: center;
            padding-top: 15px;
          }
          .doc-title {
            font-size: 17px;
            font-weight: 900;
            text-decoration: underline;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header-meta-container {
            width: 25%;
            text-align: right;
            font-size: 11.5px;
            font-weight: bold;
            line-height: 1.6;
            padding-top: 10px;
          }
          .billing-section {
            margin-bottom: 16px;
          }
          .billing-title {
            font-size: 11.5px;
            font-weight: 900;
            text-decoration: underline;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .billing-name {
            font-size: 11.5px;
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .billing-line {
            font-size: 11px;
            font-weight: 600;
            line-height: 1.35;
          }
          .site-address-bar {
            text-align: center;
            font-size: 12px;
            font-weight: 900;
            margin-top: 12px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            margin-bottom: 20px;
          }
          .invoice-table th {
            border: 1.5px solid #000000;
            padding: 8px 4px;
            font-size: 11.5px;
            font-weight: 900;
            text-align: center;
            background-color: #ffffff;
          }
          .invoice-table td {
            border: 1.5px solid #000000;
            padding: 6px 8px;
            font-size: 11px;
            vertical-align: middle;
          }
          .td-center {
            text-align: center;
          }
          .td-right {
            text-align: right;
          }
          .td-bold {
            font-weight: 900;
          }
          .footer-section {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .footer-section td {
            border: none;
            padding: 0;
            vertical-align: middle;
          }
          .sign-block {
            font-size: 11px;
            line-height: 1.4;
          }
          .sign-title {
            font-size: 11px;
            margin-bottom: 2px;
          }
          .signature-container {
            margin: 4px 0 3px 0;
          }
          .signature-img {
            width: 140px;
            height: 48px;
            object-fit: contain;
            display: block;
          }
          .signer-name {
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .signer-role {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .signer-phone {
            font-size: 11px;
            font-weight: 900;
            margin-top: 2px;
          }
          .stamp-container {
            text-align: right;
            padding-right: 15px;
            vertical-align: middle;
          }
          .stamp-img {
            width: 120px;
            height: 120px;
            object-fit: contain;
            display: inline-block;
            transform: rotate(-6deg);
          }
          .divider-dotted {
            border-top: 1px dotted #000000;
            margin: 16px 0 10px 0;
          }
          .company-footer-table {
            width: 100%;
            border-collapse: collapse;
          }
          .company-footer-table td {
            border: none;
            padding: 0;
            vertical-align: middle;
          }
          .company-footer-text {
            font-size: 9.5px;
            line-height: 1.4;
            color: #000000;
          }
        </style>
      </head>
      <body>
        <div class="page-frame">
          <div>
            <!-- Top Header -->
            <table class="top-header">
              <tr>
                <td class="header-logo-container">
                  <img src="data:image/png;base64,${logoBase64}" class="header-logo-img" />
                </td>
                <td class="header-title-container">
                  <div class="doc-title">${docTitle}</div>
                </td>
                <td class="header-meta-container">
                  <div>INV : ${invoiceNo}</div>
                  <div>DATE : ${currentDate}</div>
                </td>
              </tr>
            </table>

            <!-- Billing Address -->
            <div class="billing-section">
              <div class="billing-title">BILLING ADDRESS</div>
              <div class="billing-name">${clientName}</div>
              ${addressLinesHtml}
              ${gstinVal ? `<div class="billing-line"><strong>GST-${gstinVal}</strong></div>` : ''}
            </div>

            <!-- Site Address Bar -->
            <div class="site-address-bar">
              Site ADDRESS: ${siteAddress}
            </div>

            <!-- Invoice Table Grid -->
            <table class="invoice-table">
              <thead>
                <tr>
                  <th style="width: 8%;">S. No</th>
                  <th style="width: 42%;">Service</th>
                  <th style="width: 15%;">Measurment</th>
                  <th style="width: 17%;">Cost / sft (Rs)</th>
                  <th style="width: 18%;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${serviceRowsHtml}
                
                <!-- Empty Row for visual spacing -->
                <tr>
                  <td class="td-center" style="height: 24px;"></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>

                <!-- HSN Code Row -->
                <tr>
                  <td></td>
                  <td class="td-center td-bold" style="padding: 7px;">HSN CODE : 995453</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>

                <!-- Sub Total Row -->
                <tr>
                  <td colspan="2"></td>
                  <td colspan="2" class="td-center td-bold">Sub Total</td>
                  <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${subTotalFormatted}</td>
                </tr>

                ${
                  isGst
                    ? `
                  <!-- CGST Row -->
                  <tr>
                    <td colspan="2" rowspan="4" style="border: 1.5px solid #000000;"></td>
                    <td class="td-center td-bold">CGST</td>
                    <td class="td-center td-bold">${cgstRate}%</td>
                    <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${cgstFormatted}</td>
                  </tr>
                  <!-- SGST Row -->
                  <tr>
                    <td class="td-center td-bold">SGST</td>
                    <td class="td-center td-bold">${sgstRate}%</td>
                    <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${sgstFormatted}</td>
                  </tr>
                  <!-- After Tax Row -->
                  <tr>
                    <td colspan="2" class="td-center td-bold">After Tax</td>
                    <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${afterTaxFormatted}</td>
                  </tr>
                  <!-- Total Row -->
                  <tr>
                    <td colspan="2" class="td-center td-bold">Total</td>
                    <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${grandTotalFormatted}</td>
                  </tr>
                `
                    : `
                  <!-- Total Row Without GST -->
                  <tr>
                    <td colspan="2" style="border: 1.5px solid #000000;"></td>
                    <td colspan="2" class="td-center td-bold">Total</td>
                    <td class="td-right td-bold">Rs.&nbsp;&nbsp;&nbsp;&nbsp;${grandTotalFormatted}</td>
                  </tr>
                `
                }
              </tbody>
            </table>
          </div>

          <!-- Bottom Signatures, Stamp & Footer -->
          <div>
            <table class="footer-section">
              <tr>
                <td style="width: 50%; vertical-align: top;">
                  <div class="sign-block">
                    <div class="sign-title">With regards,</div>
                    <div class="signer-name" style="margin-top: 6px;">P.SRIDHAR</div>
                    <div class="signer-role">ADMIN</div>
                    <div class="signer-phone">&#9742; 044 &ndash; 45 000 775</div>
                  </div>
                </td>
                <td style="width: 50%;" class="stamp-container">
                  <img src="data:image/png;base64,${sealBase64}" class="stamp-img" alt="Official Seal" />
                </td>
              </tr>
            </table>

            <!-- Dotted Divider -->
            <div class="divider-dotted"></div>

            <!-- Company Details Footer -->
            <table class="company-footer-table">
              <tr>
                <td style="width: 82%;">
                  <div class="company-footer-text">
                    <strong>Dr. Terrace water Proofing (ISO - 9001: 2008 Certified)</strong><br>
                    Parsn Commercial Complex, C-13, B-13, 2nd floor, Kodambakkam High Road, Nungambakkam,<br>
                    Chennai- 600006, www.drterrace.com / www.drterracewaterproofing.com<br>
                    <strong>GST NO 33AANFD9271D1ZE</strong>
                  </div>
                </td>
                <td style="width: 18%; text-align: right;">
                  <img src="data:image/png;base64,${logoBase64}" style="width: 65px; height: 55px; object-fit: contain;" />
                </td>
              </tr>
            </table>
          </div>
        </div>
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
        }
      })
      .catch(() => {});

    // If full service receipt, also fetch final receipt data
    if (params.isFullServiceReceipt === 'true') {
      paymentRepository
        .generateFinalReceipt(qId, params.gstNumber, params.hasGst === 'true')
        .then((res) => {
          if (res?.success && res.data) {
            setFinalReceiptData(res.data);
          }
        })
        .catch(() => {});
    }
  }, [
    params.isFullServiceReceipt,
    params.quotationId,
    params.gstNumber,
    params.hasGst,
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
    const { uri, base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
    const cleanClientName = (clientName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanDocTitle = (docTitle || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetName = `${cleanDocTitle}_${cleanClientName}.pdf`;
    const targetUri = cacheDirectory ? `${cacheDirectory}${targetName}` : null;

    if (targetUri && base64) {
      try {
        await writeAsStringAsync(targetUri, base64, { encoding: 'base64' });
        return targetUri;
      } catch (writeErr) {
        console.warn('writeAsStringAsync failed, attempting copyAsync fallback:', writeErr?.message);
      }
    }

    if (targetUri && uri) {
      try {
        const fileInfo = await getInfoAsync(targetUri);
        if (fileInfo.exists) {
          await deleteAsync(targetUri, { idempotent: true });
        }
        await copyAsync({
          from: uri,
          to: targetUri,
        });
        return targetUri;
      } catch (copyErr) {
        console.warn('copyAsync failed, using direct print URI:', copyErr?.message);
      }
    }

    return uri;
  };

  // PDF Action Handlers
  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      const namedUri = await getPdfUri();
      const shareOptions = {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${docTitle} - ${clientName}`,
      };
      if (Platform.OS === 'ios') {
        shareOptions.UTI = 'com.adobe.pdf';
      }
      await Sharing.shareAsync(namedUri, shareOptions);
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt PDF: ' + error.message);
    }
  };

  const handlePrint = async () => {
    try {
      const htmlContent = generateTaxInvoiceHTML(app, customerGst, finalReceiptData, params, payView);
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      Alert.alert('Error', 'Failed to print receipt: ' + error.message);
    }
  };

  const handleWhatsApp = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      const namedUri = await getPdfUri();
      const shareOptions = {
        mimeType: 'application/pdf',
        dialogTitle: `Send ${docTitle} to ${clientName} via WhatsApp`,
      };
      if (Platform.OS === 'ios') {
        shareOptions.UTI = 'com.adobe.pdf';
      }
      await Sharing.shareAsync(namedUri, shareOptions);
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt via WhatsApp: ' + error.message);
    }
  };

  const handleShareRef = React.useRef(handleShare);
  handleShareRef.current = handleShare;

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
              <Text style={[styles.gridTh, { width: '40%' }]}>Service</Text>
              <Text style={[styles.gridTh, { width: '16%' }]}>Measurment</Text>
              <Text style={[styles.gridTh, { width: '17%' }]}>Cost / sft (Rs)</Text>
              <Text style={[styles.gridTh, { width: '17%', borderRightWidth: 0 }]}>Total</Text>
            </View>

            {/* Service Rows */}
            {servicesList.map((svc, idx) => (
              <View key={idx} style={styles.gridDataRow}>
                <Text style={[styles.gridTdCenter, { width: '10%' }]}>{svc.sNo}</Text>
                <Text style={[styles.gridTdLeft, styles.gridTdBold, { width: '40%' }]}>
                  {svc.name}
                </Text>
                <Text style={[styles.gridTdCenter, { width: '16%' }]}>{svc.measurement}</Text>
                <Text style={[styles.gridTdCenter, { width: '17%' }]}>{svc.rate}</Text>
                <Text style={[styles.gridTdRight, styles.gridTdBold, { width: '17%', borderRightWidth: 0 }]}>
                  Rs. {Number(svc.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            ))}

            {/* Empty spacing row */}
            <View style={[styles.gridDataRow, { height: 22 }]}>
              <View style={[styles.gridEmptyCell, { width: '10%' }]} />
              <View style={[styles.gridEmptyCell, { width: '40%' }]} />
              <View style={[styles.gridEmptyCell, { width: '16%' }]} />
              <View style={[styles.gridEmptyCell, { width: '17%' }]} />
              <View style={[styles.gridEmptyCell, { width: '17%', borderRightWidth: 0 }]} />
            </View>

            {/* HSN CODE Row */}
            <View style={styles.gridDataRow}>
              <View style={[styles.gridEmptyCell, { width: '10%' }]} />
              <Text style={[styles.gridTdCenter, styles.gridTdBold, { width: '40%' }]}>
                HSN CODE : 995453
              </Text>
              <View style={[styles.gridEmptyCell, { width: '16%' }]} />
              <View style={[styles.gridEmptyCell, { width: '17%' }]} />
              <View style={[styles.gridEmptyCell, { width: '17%', borderRightWidth: 0 }]} />
            </View>

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

          <TouchableOpacity style={[styles.actionBtn, styles.printBtn]} onPress={handlePrint} activeOpacity={0.85}>
            <Ionicons name="print-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Print</Text>
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
