import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
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
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { PAYMENT_DEFAULTS } from '../constants/paymentConstants';

// Helper function to generate Full Project Service & Settlement Receipt HTML
const generateFullServiceReceiptHTML = (app) => {
  const totalProjectCost = app.totalPayment || PAYMENT_DEFAULTS.TOTAL_PROJECT_COST;

  const isFullPaid = Boolean(app.fullPaid);
  const fullPaidAmt = isFullPaid ? Number(app.fullPaidDetails?.amount || totalProjectCost) : 0;
  const fullPaidDate = app.fullPaidDetails?.date || app.fullPaidDetails?.paymentDate || PAYMENT_DEFAULTS.DEFAULT_RECEIPT_DATE;
  const fullPaidMethod = app.fullPaidDetails?.method || app.fullPaidDetails?.paymentMethod || PAYMENT_DEFAULTS.DEFAULT_PAYMENT_METHOD;

  const m1Paid = Boolean(app.initialPaid) && !isFullPaid;
  const m1Amt = m1Paid ? Number(app.initialPaidAmount || app.initialPaidDetails?.amount || Math.round(totalProjectCost * PAYMENT_DEFAULTS.MILESTONE_RATIOS.INITIAL)) : 0;
  const m1Date = app.initialPaidDetails?.date || app.initialPaidDetails?.paymentDate || PAYMENT_DEFAULTS.DEFAULT_RECEIPT_DATE;
  const m1Method = app.initialPaidDetails?.method || app.initialPaidDetails?.paymentMethod || PAYMENT_DEFAULTS.DEFAULT_PAYMENT_METHOD;

  const m2Paid = Boolean(app.midTermPaid) && !isFullPaid;
  const m2Amt = m2Paid ? Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || Math.round(totalProjectCost * PAYMENT_DEFAULTS.MILESTONE_RATIOS.MID_TERM)) : 0;
  const m2Date = app.midTermPaidDetails?.date || app.midTermPaidDetails?.paymentDate || PAYMENT_DEFAULTS.DEFAULT_RECEIPT_DATE;
  const m2Method = app.midTermPaidDetails?.method || app.midTermPaidDetails?.paymentMethod || PAYMENT_DEFAULTS.DEFAULT_PAYMENT_METHOD;

  const m3Paid = Boolean(app.finalPaid) && !isFullPaid;
  const m3Amt = m3Paid ? Number(app.finalPaidAmount || app.finalPaidDetails?.amount || Math.max(0, totalProjectCost - m1Amt - m2Amt)) : 0;
  const m3Date = app.finalPaidDetails?.date || app.finalPaidDetails?.paymentDate || PAYMENT_DEFAULTS.DEFAULT_RECEIPT_DATE;
  const m3Method = app.finalPaidDetails?.method || app.finalPaidDetails?.paymentMethod || PAYMENT_DEFAULTS.DEFAULT_PAYMENT_METHOD;

  const extraCharges = app.extraCharges || [];
  const extraChargesTotal = extraCharges.reduce((acc, c) => acc + (c.isPaid ? Number(c.amount || 0) : 0), 0);

  const grandTotalPaid = isFullPaid ? (fullPaidAmt + extraChargesTotal) : ((m1Paid ? m1Amt : 0) + (m2Paid ? m2Amt : 0) + (m3Paid ? m3Amt : 0) + extraChargesTotal);
  const remainingBalance = Math.max(0, totalProjectCost - (isFullPaid ? fullPaidAmt : ((m1Paid ? m1Amt : 0) + (m2Paid ? m2Amt : 0) + (m3Paid ? m3Amt : 0))));
  const currentDate = new Date().toLocaleDateString('en-GB');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1E293B;
            margin: 0 auto;
            padding: 30px;
            max-width: 720px;
            background-color: #ffffff;
            font-size: 11px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .title {
            font-size: 18px;
            color: #0052CC;
            font-weight: 900;
            text-align: center;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .header-logo-container {
            width: 78px;
            vertical-align: top;
          }
          .header-logo-img {
            width: 70px;
            height: 70px;
          }
          .company-details {
            text-align: right;
            font-size: 9.5px;
            color: #334155;
            line-height: 1.35;
            vertical-align: top;
          }
          .divider {
            height: 3px;
            background-color: #0052CC;
            margin-bottom: 16px;
            border-radius: 2px;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .info-col-left {
            width: 58%;
            vertical-align: top;
          }
          .info-col-right {
            width: 42%;
            vertical-align: top;
            text-align: right;
          }
          .info-row {
            margin-bottom: 5px;
            font-size: 10px;
          }
          .info-label {
            display: inline-block;
            width: 70px;
            font-weight: bold;
            color: #1E293B;
          }
          .info-value {
            color: #475569;
          }
          .section-title {
            font-size: 12px;
            font-weight: 900;
            color: #0052CC;
            margin-top: 15px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #E5E7EB;
            margin-bottom: 16px;
            border-radius: 6px;
            overflow: hidden;
          }
          .grid-table th {
            background-color: #EFF6FF !important;
            color: #1E3A8A;
            font-weight: bold;
            padding: 9px;
            text-align: left;
            border: 1px solid #E5E7EB;
            font-size: 10.5px;
          }
          .grid-table td {
            padding: 10px 9px;
            border: 1px solid #E5E7EB;
            vertical-align: middle;
            font-size: 10.5px;
          }
          .status-settled {
            color: #16A34A;
            font-weight: bold;
          }
          .status-pending {
            color: #D97706;
            font-weight: bold;
          }
          .grand-total-box {
            background-color: #F0FDF4;
            border: 2px solid #10B981;
            border-radius: 8px;
            padding: 14px;
            margin-top: 20px;
            margin-bottom: 20px;
            text-align: center;
          }
          .grand-total-title {
            font-size: 11px;
            color: #065F46;
            font-weight: bold;
            text-transform: uppercase;
          }
          .grand-total-amount {
            font-size: 22px;
            color: #047857;
            font-weight: 900;
            margin-top: 4px;
          }
          .stamp-badge {
            display: inline-block;
            background-color: #10B981;
            color: #ffffff;
            font-size: 10px;
            font-weight: 900;
            padding: 4px 10px;
            border-radius: 4px;
            margin-top: 6px;
          }
          .footer-section {
            margin-top: 24px;
          }
          .signature-wrapper {
            margin-bottom: 8px;
          }
          .signature-text {
            font-family: 'Georgia', serif;
            font-style: italic;
            font-size: 22px;
            color: #1E3A8A;
            font-weight: bold;
          }
          .signature-line {
            width: 72px;
            height: 1px;
            background-color: #D1D5DB;
            margin-top: 2px;
          }
          .with-regards {
            font-size: 10.5px;
            color: #1E293B;
            margin-top: 6px;
          }
          .signer-name {
            font-weight: bold;
            font-size: 11.5px;
            margin: 2px 0;
          }
          .signer-phone {
            font-size: 9.5px;
            color: #000000;
          }
          .footnote {
            text-align: center;
            font-size: 8.5px;
            color: #2563EB;
            font-weight: bold;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="title">FULL SERVICE & PAYMENT RECEIPT</div>
        
        <table class="header-table">
          <tr>
            <td class="header-logo-container">
              <img src="data:image/png;base64,${logoBase64}" class="header-logo-img" />
            </td>
            <td class="company-details">
              2nd floor, C13, B13, Parsn commercial complex,<br>
              Kodambakkam High Rd, Nungambakkam, Chennai - 600 034<br>
              Email: admin@drterrace.com | Phone: +91 99621 19311
            </td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <table class="info-table">
          <tr>
            <td class="info-col-left">
              <div class="info-row"><span class="info-label">Bill To:</span> <span class="info-value">${app.clientName}</span></div>
              <div class="info-row"><span class="info-label">Mobile:</span> <span class="info-value">${app.clientPhone || '9123456789'}</span></div>
              <div class="info-row"><span class="info-label">Address:</span> <span class="info-value">No.99, 3rd cross street, Kamaraj street, Chennai</span></div>
            </td>
            <td class="info-col-right">
              <div class="info-row"><span class="info-label">Receipt No:</span> <span class="info-value">SR-${10000 + app.id}</span></div>
              <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">${currentDate}</span></div>
              <div class="info-row"><span class="info-label">Status:</span> <span class="status-settled">${remainingBalance === 0 ? 'SETTLED ✅' : 'PARTIAL'}</span></div>
            </td>
          </tr>
        </table>

        <div class="section-title">1. Project Milestone Payments Breakdown</div>
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width: 40%;">Milestone Stage</th>
              <th style="width: 20%; text-align: center;">Date</th>
              <th style="width: 20%; text-align: center;">Mode</th>
              <th style="width: 20%; text-align: right;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${isFullPaid ? `
              <tr>
                <td>1. Full Project Payment (100%)</td>
                <td style="text-align: center;">${fullPaidDate}</td>
                <td style="text-align: center;">${fullPaidMethod}</td>
                <td style="text-align: right;" class="bold">₹${fullPaidAmt.toLocaleString()}</td>
              </tr>
            ` : `
              <tr>
                <td>1. Initial Advance (50%)</td>
                <td style="text-align: center;">${m1Paid ? m1Date : '-'}</td>
                <td style="text-align: center;">${m1Paid ? m1Method : '-'}</td>
                <td style="text-align: right;" class="bold">${m1Paid ? '₹' + m1Amt.toLocaleString() : 'Pending'}</td>
              </tr>
              <tr>
                <td>2. Mid-Term Completion (40%)</td>
                <td style="text-align: center;">${m2Paid ? m2Date : '-'}</td>
                <td style="text-align: center;">${m2Paid ? m2Method : '-'}</td>
                <td style="text-align: right;" class="bold">${m2Paid ? '₹' + m2Amt.toLocaleString() : 'Pending'}</td>
              </tr>
              <tr>
                <td>3. Final Settlement (10%)</td>
                <td style="text-align: center;">${m3Paid ? m3Date : '-'}</td>
                <td style="text-align: center;">${m3Paid ? m3Method : '-'}</td>
                <td style="text-align: right;" class="bold">${m3Paid ? '₹' + m3Amt.toLocaleString() : 'Pending'}</td>
              </tr>
            `}
          </tbody>
        </table>

        ${extraCharges.length > 0 ? `
          <div class="section-title">2. Lump Sum & Extra Service Charges</div>
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 45%;">Service Description</th>
                <th style="width: 20%; text-align: center;">Date</th>
                <th style="width: 15%; text-align: center;">Status</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${extraCharges.map(chg => `
                <tr>
                  <td>
                    <strong>${chg.title}</strong>
                    ${chg.notes ? `<div style="font-size: 9px; color: #64748B;">${chg.notes}</div>` : ''}
                  </td>
                  <td style="text-align: center;">${chg.date || currentDate}</td>
                  <td style="text-align: center;" class="${chg.isPaid ? 'status-settled' : 'status-pending'}">${chg.isPaid ? 'PAID ✅' : 'PENDING'}</td>
                  <td style="text-align: right;" class="bold">₹${Number(chg.amount || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="grand-total-box">
          <div class="grand-total-title">Total Project Settlement Received</div>
          <div class="grand-total-amount">₹${grandTotalPaid.toLocaleString()}</div>
          <div class="stamp-badge">${remainingBalance === 0 ? '100% PAID & FULLY SETTLED ✅' : 'PAYMENT IN PROGRESS'}</div>
        </div>
        
        <div class="footer-section">
          <div class="signature-wrapper">
            <div class="signature-text">Guna</div>
            <div class="signature-line"></div>
          </div>
          <div class="with-regards">With regards,</div>
          <div class="signer-name">S.Guna</div>
          <div class="signer-phone">Phone: 044-45 000 775</div>
        </div>
        
        <div class="footnote">
          **This is an official system generated Service Receipt from Dr. Terrace Waterproofing**
        </div>
      </body>
    </html>
  `;
};

// Helper function to generate receipt HTML matching A4 document style with pixel-perfect layouts
const generateHTML = (
  app,
  stageLabel,
  dateVal,
  methodVal,
  receivedVal,
  displayBalanceVal,
  totalProjectValue,
  initialAmount,
  midTermAmount,
  finalAmount
) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1E293B;
            margin: 0 auto;
            padding: 30px;
            max-width: 720px;
            background-color: #ffffff;
            font-size: 11px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .title {
            font-size: 20px;
            color: #0052CC;
            font-weight: 900;
            text-align: center;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .header-logo-container {
            width: 78px;
            vertical-align: top;
          }
          .header-logo-img {
            width: 70px;
            height: 70px;
          }
          .header-logo-text {
            font-size: 20px;
            color: #0052CC;
            font-weight: 900;
            vertical-align: middle;
            padding-left: 10px;
          }
          .header-logo-sub {
            font-size: 10px;
            color: #475569;
            font-weight: normal;
            display: block;
            margin-top: 2px;
          }
          .company-details {
            text-align: right;
            font-size: 9.5px;
            color: #334155;
            line-height: 1.35;
            vertical-align: top;
          }
          .divider {
            height: 3px;
            background-color: #0052CC;
            margin-bottom: 16px;
            border-radius: 2px;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .info-col-left {
            width: 58%;
            vertical-align: top;
          }
          .info-col-right {
            width: 42%;
            vertical-align: top;
            text-align: right;
          }
          .info-row {
            margin-bottom: 5px;
            font-size: 10px;
          }
          .info-label {
            display: inline-block;
            width: 46px;
            font-weight: bold;
            color: #1E293B;
          }
          .info-sep {
            display: inline-block;
            width: 12px;
            color: #1E293B;
            text-align: center;
          }
          .info-value {
            color: #475569;
          }
          .info-row-right {
            margin-bottom: 5px;
            font-size: 10px;
          }
          .info-label-right {
            font-weight: bold;
            color: #1E293B;
            margin-right: 4px;
          }
          .info-value-right {
            color: #475569;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #E5E7EB;
            margin-bottom: 20px;
            border-radius: 6px;
            overflow: hidden;
          }
          .grid-table th {
            background-color: #EFF6FF !important;
            color: #1E3A8A;
            font-weight: bold;
            padding: 9px;
            text-align: left;
            border: 1px solid #E5E7EB;
            font-size: 10.5px;
          }
          .grid-table td {
            padding: 10px 9px;
            border: 1px solid #E5E7EB;
            vertical-align: middle;
            font-size: 10.5px;
          }
          .text-center {
            text-align: center;
          }
          .bold {
            font-weight: bold;
          }
          .breakdown-row td {
            padding: 10px 9px;
            background-color: #ffffff;
            border: 1px solid #E5E7EB;
            border-top: none;
          }
          .breakdown-text {
            font-size: 9.5px;
            color: #475569;
            margin-bottom: 4px;
          }
          .total-received-text {
            font-size: 10.5px;
            font-weight: 900;
            color: #000000;
          }
          .subtotal-row {
            background-color: transparent;
          }
          .subtotal-row td.subtotal-spacer {
            border: none;
            background-color: transparent;
          }
          .subtotal-label {
            font-weight: bold;
            color: #475569;
            padding: 8px 9px;
            border: 1px solid #E5E7EB !important;
            background-color: #EFF6FF !important;
          }
          .subtotal-value {
            font-weight: bold;
            color: #0F172A;
            padding: 8px 9px;
            text-align: center;
            border: 1px solid #E5E7EB !important;
            background-color: #EFF6FF !important;
          }
          .footer-section {
            margin-top: 24px;
          }
          .signature-wrapper {
            margin-bottom: 8px;
          }
          .signature-text {
            font-family: 'Georgia', serif;
            font-style: italic;
            font-size: 22px;
            color: #1E3A8A;
            font-weight: bold;
          }
          .signature-line {
            width: 72px;
            height: 1px;
            background-color: #D1D5DB;
            margin-top: 2px;
          }
          .with-regards {
            font-size: 10.5px;
            color: #1E293B;
            margin-top: 6px;
          }
          .signer-name {
            font-weight: bold;
            font-size: 11.5px;
            margin: 2px 0;
          }
          .signer-phone {
            font-size: 9.5px;
            color: #000000;
          }
          .footnote {
            text-align: center;
            font-size: 8.5px;
            color: #2563EB;
            font-weight: bold;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="title">Cash Receipt</div>
        
        <table class="header-table">
          <tr>
            <td class="header-logo-container">
              <img src="data:image/png;base64,${logoBase64}" class="header-logo-img" />
            </td>
            <td class="company-details">
              2nd floor, C13, B13, Parsn commercial complex,<br>
              Kodambakkam High Rd, Nungambakkam, Chennai - 600 034<br>
              Email: admin@drterrace.com | Phone: +91 99621 19311
            </td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <table class="info-table">
          <tr>
            <td class="info-col-left">
              <div class="info-row">
                <span class="info-label">Bill to</span>
                <span class="info-sep">-</span>
                <span class="info-value">${app.clientName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Mobile</span>
                <span class="info-sep">-</span>
                <span class="info-value">${app.clientPhone || '9123456789'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Address</span>
                <span class="info-sep">-</span>
                <span class="info-value">No.99, 3rd cross street, Kamaraj street, Teacher's colony, T.nagar, Chennai</span>
              </div>
            </td>
            <td class="info-col-right">
              <div class="info-row-right">
                <span class="info-label-right">Invoice No:</span>
                <span class="info-value-right">${12340 + app.id}</span>
              </div>
              <div class="info-row-right">
                <span class="info-label-right">Date:</span>
                <span class="info-value-right">${dateVal}</span>
              </div>
              <div class="info-row-right">
                <span class="info-label-right">Payment Stage:</span>
                <span class="info-value-right">${stageLabel}</span>
              </div>
              <div class="info-row-right">
                <span class="info-label-right">Payment Mode:</span>
                <span class="info-value-right">${methodVal}</span>
              </div>
            </td>
          </tr>
        </table>
        
          <table class="grid-table">
          <thead>
            <tr>
              <th style="width: 40%;">Service</th>
              <th style="width: 20%; text-align: center;">Project Value</th>
              <th style="width: 20%; text-align: center;">Received</th>
              <th style="width: 20%; text-align: center;">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${app.serviceType || 'Terrace Waterproofing Service'}</strong>
              </td>
              <td class="text-center bold">${totalProjectValue}</td>
              <td class="text-center bold">${receivedVal}</td>
              <td class="text-center bold">${displayBalanceVal}</td>
            </tr>
            ${(() => {
      const activeQuote = app.quotations?.[0];
      const tierName = app.chosenCategory || 'Basic';
      let rows = '';

      // Build quote services rows
      if (activeQuote && Array.isArray(activeQuote.servicesList)) {
        rows += activeQuote.servicesList.map(svc => {
          let rate = svc.rateBasic || 0;
          let sub = svc.subtotalBasic || 0;
          if (tierName === 'Mid' || tierName === 'Medium') { rate = svc.rateMid || svc.rateMedium || 0; sub = svc.subtotalMid || svc.subtotalMedium || 0; }
          else if (tierName === 'Luxury' || tierName === 'High') { rate = svc.rateLuxury || svc.rateHigh || 0; sub = svc.subtotalLuxury || svc.subtotalHigh || 0; }
          const specs = Array.isArray(svc.specs) ? svc.specs.join(', ') : (svc.specs || '');
          return `
                    <tr class="service-detail-row">
                      <td colspan="4" style="padding: 6px 9px; font-size: 9.5px; color: #475569; border-top: none; background-color: #F8FAFC;">
                        • <strong>${svc.serviceName}</strong> (${svc.area || activeQuote.area || '1000'} Sq.ft @ ₹${rate}) = ₹${sub.toLocaleString()}
                        ${specs ? `<br><span style="font-size: 8.5px; padding-left: 8px;">- ${specs}</span>` : ''}
                      </td>
                    </tr>
                  `;
        }).join('');

        const gstRate = activeQuote.gstRate || '18';
        if (activeQuote.gst !== '0%' && activeQuote.gst !== '0' && activeQuote.gstAdded !== false) {
          rows += `
                    <tr class="service-detail-row">
                      <td colspan="4" style="padding: 6px 9px; font-size: 9.5px; color: #475569; border-top: none; background-color: #F8FAFC; font-weight: bold;">
                        + GST (${gstRate}% Added)
                      </td>
                    </tr>
                  `;
        }
      }

      // Build extra charges rows
      if (app.extraCharges && app.extraCharges.length > 0) {
        rows += app.extraCharges.map(chg => `
                    <tr class="service-detail-row">
                      <td colspan="4" style="padding: 6px 9px; font-size: 9.5px; color: #475569; border-top: none; background-color: #F8FAFC; font-weight: bold;">
                        + Extra Charge: ${chg.title} = ₹${Number(chg.amount).toLocaleString()} (${chg.isPaid ? 'PAID' : 'PENDING'})
                      </td>
                    </tr>
                `).join('');
      }
      return rows;
    })()}
            <tr class="breakdown-row">
              <td colspan="4">
                <div class="breakdown-text">
                  (RS.${initialAmount.toLocaleString()}.00 + RS. &nbsp;${midTermAmount.toLocaleString()}.00 + RS.&nbsp;${finalAmount.toLocaleString()}.00)
                </div>
                <div class="total-received-text">
                  TOTAL RECEIVED : ${receivedVal}/-
                </div>
              </td>
            </tr>
            <tr class="subtotal-row">
              <td colspan="2" class="subtotal-spacer"></td>
              <td class="subtotal-label">Sub Total</td>
              <td class="subtotal-value">${receivedVal}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer-section">
          <div class="signature-wrapper">
            <div class="signature-text">Guna</div>
            <div class="signature-line"></div>
          </div>
          <div class="with-regards">With regards,</div>
          <div class="signer-name">S.Guna</div>
          <div class="signer-phone">Phone: 044-45 000 775</div>
        </div>
        
        <div class="footnote">
          **This is a system generated Invoice, hence does not require any signature**
        </div>
      </body>
    </html>
  `;
};

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const isDark = colorScheme === 'dark';
  const [app, setApp] = React.useState(null);

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

  if (!app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.errorText, isDark && styles.textDark]}>Loading receipt details...</Text>
      </View>
    );
  }

  // Determine stage info based on parameters
  const milestone = params.milestone || 'initialPaid'; // initialPaid, midTermPaid, finalPaid

  let stageLabel = params.stage || 'Initial Payment';
  let dateVal = app.initialPaidDetails?.paymentDate || app.initialPaidDetails?.date || new Date().toLocaleDateString('en-GB');
  let methodVal = app.initialPaidDetails?.paymentMethod || app.initialPaidDetails?.method || 'UPI';
  let receivedVal = Number(params.amount) || app.initialPaidDetails?.amount || 50000;

  if (milestone === 'midTermPaid') {
    stageLabel = params.stage || 'Mid-Term Payment';
    dateVal = app.midTermPaidDetails?.paymentDate || app.midTermPaidDetails?.date || new Date().toLocaleDateString('en-GB');
    methodVal = app.midTermPaidDetails?.paymentMethod || app.midTermPaidDetails?.method || 'UPI';
    receivedVal = Number(params.amount) || app.midTermPaidDetails?.amount || 30000;
  } else if (milestone === 'finalPaid') {
    stageLabel = params.stage || 'Final Payment';
    dateVal = app.finalPaidDetails?.paymentDate || app.finalPaidDetails?.date || new Date().toLocaleDateString('en-GB');
    methodVal = app.finalPaidDetails?.paymentMethod || app.finalPaidDetails?.method || 'UPI';
    receivedVal = Number(params.amount) || app.finalPaidDetails?.amount || 20000;
  }

  // Calculate project values
  const totalProjectValue = app.totalPayment || 100000;

  const initialAmount = app.initialPaidDetails?.amount || 50000;
  const midTermAmount = app.midTermPaidDetails?.amount || 30000;
  const finalAmount = app.finalPaidDetails?.amount || 20000;

  let balanceVal = totalProjectValue - initialAmount;
  if (milestone === 'midTermPaid') {
    balanceVal = totalProjectValue - initialAmount - midTermAmount;
  } else if (milestone === 'finalPaid') {
    balanceVal = totalProjectValue - initialAmount - midTermAmount - finalAmount;
  }

  // Guard balance display to prevent negative numbers
  const displayBalanceVal = Math.max(0, balanceVal);

  // PDF Action Handlers
  const handleShare = async () => {
    try {
      const htmlContent = params.isFullServiceReceipt === 'true'
        ? generateFullServiceReceiptHTML(app)
        : generateHTML(
          app,
          stageLabel,
          dateVal,
          methodVal,
          receivedVal,
          displayBalanceVal,
          totalProjectValue,
          initialAmount,
          midTermAmount,
          finalAmount
        );

      // Print HTML text directly to a local PDF file uri
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // Share the file URI itself using expo-sharing (WhatsApp detects this as a real PDF document)
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Service Receipt - ${app.clientName}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt PDF: ' + error.message);
    }
  };

  const handlePrint = async () => {
    try {
      const htmlContent = params.isFullServiceReceipt === 'true'
        ? generateFullServiceReceiptHTML(app)
        : generateHTML(
          app,
          stageLabel,
          dateVal,
          methodVal,
          receivedVal,
          displayBalanceVal,
          totalProjectValue,
          initialAmount,
          midTermAmount,
          finalAmount
        );

      // Print directly to printer
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      Alert.alert('Error', 'Failed to print receipt: ' + error.message);
    }
  };

  const handleWhatsApp = async () => {
    // WhatsApp sharing is handled identically to Share but focused on document delivery
    await handleShare();
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Cash Receipt" paddingTop={insets.top} isDark={isDark} />

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
        {/* White PDF Sheet Document */}
        <View style={[styles.receiptCanvas, isDark && styles.receiptCanvasDark]}>

          {/* Document Centered Title */}
          <Text style={styles.docCenteredTitle}>Cash Receipt</Text>

          {/* Brand Header block */}
          <View style={styles.brandRow}>
            {/* Logo */}
            <Image
              source={require('../../../../assets/images/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            {/* Company Info column */}
            <View style={styles.companyInfoCol}>
              <Text style={styles.companyAddressText}>
                2nd floor, C13, B13, Parsn commercial complex, Kodambakkam High Rd, Nungambakkam, Chennai - 600 034
              </Text>

              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={12} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.contactText}>admin@drterrace.com</Text>
              </View>

              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={12} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.contactText}>+91 99621 19311</Text>
              </View>
            </View>
          </View>

          {/* Thick Blue Divider */}
          <View style={styles.thickBlueDivider} />

          {/* Billing parameters columns - tight spacing for long name wrapping */}
          <View style={styles.billingSummaryRow}>
            {/* Left: Bill To */}
            <View style={styles.billingColLeft}>
              <View style={styles.billingItemRow}>
                <Text style={styles.billingLabelTitle}>Bill to</Text>
                <Text style={styles.billingLabelSep}>-</Text>
                <Text style={styles.billingLabelVal}>{app.clientName}</Text>
              </View>

              <View style={styles.billingItemRow}>
                <Text style={styles.billingLabelTitle}>Mobile</Text>
                <Text style={styles.billingLabelSep}>-</Text>
                <Text style={styles.billingLabelVal}>{app.clientPhone || '9123456789'}</Text>
              </View>

              <View style={styles.billingItemRow}>
                <Text style={styles.billingLabelTitle}>Address</Text>
                <Text style={styles.billingLabelSep}>-</Text>
                <Text style={styles.billingLabelVal}>
                  {"No.99, 3rd cross street, Kamaraj street, Teacher's colony, T.nagar, Chennai"}
                </Text>
              </View>
            </View>

            {/* Right: Invoice details */}
            <View style={styles.billingColRight}>
              <View style={styles.billingItemRowRight}>
                <Text style={styles.billingLabelTitleRight}>Invoice No:</Text>
                <Text style={styles.billingLabelValRight}>{12340 + app.id}</Text>
              </View>

              <View style={styles.billingItemRowRight}>
                <Text style={styles.billingLabelTitleRight}>Date:</Text>
                <Text style={styles.billingLabelValRight}>{dateVal}</Text>
              </View>

              <View style={styles.billingItemRowRight}>
                <Text style={styles.billingLabelTitleRight}>Payment Stage:</Text>
                <Text style={styles.billingLabelValRight}>{stageLabel}</Text>
              </View>

              <View style={styles.billingItemRowRight}>
                <Text style={styles.billingLabelTitleRight}>Payment Mode:</Text>
                <Text style={styles.billingLabelValRight}>{methodVal}</Text>
              </View>
            </View>
          </View>

          {/* Spreadsheet-like Table Grid with aligned vertical borders */}
          <View style={styles.tableContainer}>
            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableCellHeader, { flex: 2 }]}>
                <Text style={styles.tableCellHeaderText}>Service</Text>
              </View>
              <View style={[styles.tableCellHeader, { flex: 1 }]}>
                <Text style={styles.tableCellHeaderText}>Project Value</Text>
              </View>
              <View style={[styles.tableCellHeader, { flex: 1 }]}>
                <Text style={styles.tableCellHeaderText}>Received</Text>
              </View>
              <View style={[styles.tableCellHeader, { flex: 1, borderRightWidth: 0 }]}>
                <Text style={styles.tableCellHeaderText}>Balance</Text>
              </View>
            </View>

            {/* Table Content Row */}
            <View style={styles.tableContentRow}>
              <View style={[styles.tableCellContent, { flex: 2 }]}>
                <Text style={styles.tableCellContentText}>
                  {app.serviceType || 'Terrace Waterproofing Service'}
                </Text>
              </View>
              <View style={[styles.tableCellContent, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.tableCellContentValueText}>{totalProjectValue}</Text>
              </View>
              <View style={[styles.tableCellContent, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.tableCellContentValueText}>{receivedVal}</Text>
              </View>
              <View style={[styles.tableCellContent, { flex: 1, borderRightWidth: 0, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.tableCellContentValueText}>{displayBalanceVal}</Text>
              </View>
            </View>

            {/* Breakdown Row - Spans the entire table width (No vertical borders for empty cells) */}
            <View style={styles.tableBreakdownRow}>
              <View style={styles.breakdownContentCell}>
                <Text style={styles.breakdownDetailsText}>
                  (RS.{initialAmount.toLocaleString()}.00 + RS. &nbsp;${midTermAmount.toLocaleString()}.00 + RS.&nbsp;${finalAmount.toLocaleString()}.00)
                </Text>
                <Text style={styles.breakdownTotalReceivedText}>
                  TOTAL RECEIVED : {receivedVal}/-
                </Text>
              </View>
            </View>

            {/* Shaded Sub Total Footer Row - No vertical border lines on the empty left spacer */}
            <View style={styles.subtotalRow}>
              <View style={{ flex: 3 }} />
              <View style={[styles.subtotalCellLabel, { flex: 1 }]}>
                <Text style={styles.subtotalLabelText}>Sub Total</Text>
              </View>
              <View style={[styles.subtotalCellValue, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.subtotalValueText}>{receivedVal}</Text>
              </View>
            </View>
          </View>

          {/* Signature and footers */}
          <View style={styles.footerBrandBlock}>
            {/* Cursive Signature Doodle */}
            <View style={styles.signatureWrapper}>
              <Text style={styles.signatureCursiveText}>Guna</Text>
              <View style={styles.signatureLine} />
            </View>

            <Text style={styles.withRegardsText}>With regards,</Text>
            <Text style={styles.signerNameText}>S.Guna</Text>

            <View style={styles.signerContactRow}>
              <Ionicons name="call-outline" size={12} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.signerPhoneText}>044-45 000 775</Text>
            </View>

            {/* Footer warning footnote */}
            <Text style={styles.footnoteWarningText}>
              **This is a system generated Invoice, hence does not require any signature**
            </Text>
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

  scrollContainer: {
    paddingTop: 16,
  },

  // PDF Document Canvas - styled as a centered sheet
  receiptCanvas: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB', // Lighter container border
    padding: 16,
  },
  receiptCanvasDark: {
    backgroundColor: '#FFFFFF',
  },
  docCenteredTitle: {
    fontSize: 18,
    color: '#0052CC',
    textAlign: 'center',
    marginBottom: 14,
  },

  // Brand Header Block
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandLogo: {
    width: 72,
    height: 72,
  },
  companyInfoCol: {
    flex: 1,
    marginLeft: 14,
    alignItems: 'flex-end',
  },
  companyAddressText: {
    fontSize: 9,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 13,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  contactText: {
    fontSize: 9,
    color: '#475569',
  },

  // Thick Blue Divider
  thickBlueDivider: {
    height: 3,
    backgroundColor: '#0052CC',
    marginVertical: 12,
    borderRadius: 2,
  },

  // Billing parameters alignment grid
  billingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  billingColLeft: {
    flex: 1.25, // More space for left-side details to prevent excessive wrapping
  },
  billingColRight: {
    flex: 0.75,
    alignItems: 'flex-end',
  },
  billingItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  billingLabelTitle: {
    width: 44, // Slightly narrower fixed labels
    fontSize: 9.5, // Smaller font sizes to make it compact
    color: '#1E293B',
  },
  billingLabelSep: {
    width: 10,
    fontSize: 9.5,
    color: '#1E293B',
    textAlign: 'center',
  },
  billingLabelVal: {
    flex: 1,
    fontSize: 9.5,
    color: '#475569',
    lineHeight: 13,
  },
  billingItemRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'flex-end',
  },
  billingLabelTitleRight: {
    fontSize: 9.5,
    color: '#1E293B',
    marginRight: 4,
  },
  billingLabelValRight: {
    fontSize: 9.5,
    color: '#475569',
  },

  // Spreadsheet Billing Grid Table - much lighter borders
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB', // Light grey border
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    height: 32,
    alignItems: 'center',
  },
  tableCellHeader: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB', // Light header cell separator
  },
  tableCellHeaderText: {
    fontSize: 10,
    color: '#1E3A8A',
  },
  tableContentRow: {
    flexDirection: 'row',
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableCellContent: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
  },
  tableCellContentText: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 13,
  },
  tableCellContentValueText: {
    fontSize: 10.5,
    color: '#0F172A',
  },

  // Spreadsheet Breakdown Row - stretches full-width, no vertical separators
  tableBreakdownRow: {
    flexDirection: 'row',
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  breakdownContentCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  breakdownDetailsText: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 4,
    lineHeight: 11,
  },
  breakdownTotalReceivedText: {
    fontSize: 10,
    color: '#000000',
  },

  // Subtotal Shaded row footer - no vertical lines on the empty left portion
  subtotalRow: {
    flexDirection: 'row',
    height: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
  },
  subtotalCellLabel: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  subtotalLabelText: {
    fontSize: 10,
    color: '#475569',
  },
  subtotalCellValue: {
    height: '100%',
    justifyContent: 'center',
  },
  subtotalValueText: {
    fontSize: 11,
    color: '#0F172A',
  },

  // Signatures & footer notes
  footerBrandBlock: {
    alignItems: 'flex-start',
    marginTop: 6,
  },
  signatureWrapper: {
    width: 90,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  signatureCursiveText: {
    fontSize: 24,
    fontStyle: 'italic',
    color: '#1E3A8A',
    fontWeight: 'bold',
  },
  signatureLine: {
    width: 68,
    height: 1,
    backgroundColor: '#D1D5DB',
    marginTop: 1,
  },
  withRegardsText: {
    fontSize: 10.5,
    color: '#1E293B',
    marginTop: 2,
  },
  signerNameText: {
    fontSize: 11.5,
    color: '#000000',
    marginVertical: 1,
  },
  signerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  signerPhoneText: {
    fontSize: 9.5,
    color: '#000000',
  },
  footnoteWarningText: {
    width: '100%',
    fontSize: 8.5,
    color: '#2563EB',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 11,
  },
  textDark: {
    color: '#0F172A',
  },
  subtextDark: {
    color: '#475569',
  },

  // Action Buttons bottom styling
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
    backgroundColor: '#22C55E', // WhatsApp Green
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});
