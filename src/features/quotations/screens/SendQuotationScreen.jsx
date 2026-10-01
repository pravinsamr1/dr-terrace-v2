import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTabBar } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialOverlayLoader, MaterialPageLoader } from '../../../shared/components/material';
import { logoBase64 } from '../../../shared/constants/LogoBase64';
import { sealBase64 } from '../../../shared/constants/SealBase64';
import { quotationRepository as quotationService } from '../../quotations/api/quotationRepository';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { createPdfFile, sharePdfFile, shareToWhatsApp, toSafeFileName } from '../../../core/utils/pdfShare';
import { sendDocumentOnWhatsApp } from '../../whatsapp/utils/sendDocumentOnWhatsApp';
import { isWhatsAppBusinessConfigured } from '../../whatsapp/config/whatsappBusinessConfig';

export const generateHTML = (app, quote, isExport = false, fallbackQuoteId = '') => {
  const dateVal = formatDateDDMMYY(quote.quotationDate || quote.date) || formatDateDDMMYY(new Date());

  const qId = quote.id || quote.quotationId || quote._id || quote.quoteId || fallbackQuoteId || '';
  const quoteNoVal = qId
    ? (String(qId).startsWith('DRT-') ? String(qId) : `DRT-${qId}`)
    : (quote.quoteNo ? (String(quote.quoteNo).startsWith('DRT-') ? String(quote.quoteNo) : `DRT-${quote.quoteNo}`) : '');

  const qTier = String(quote.package?.name).toUpperCase();
  const rawWarranty = quote.package?.warranty ?? quote.warranty;
  const warrantyText = String(rawWarranty).toUpperCase().includes('WARRANTY')
    ? String(rawWarranty).toUpperCase()
    : `${String(rawWarranty).toUpperCase()} WARRANTY`;

  // Map quote tier to basic/mid/luxury keys
  let tKey = 'Basic';
  if (qTier.includes('PREMIUM') || qTier === 'MID') tKey = 'Mid';
  else if (qTier.includes('ELITE') || qTier === 'LUXURY') tKey = 'Luxury';

  const formatServiceTitle = (rawTitle, rawSub) => {
    let title = (rawTitle || '').trim();
    if (title.endsWith(':')) {
      title = title.slice(0, -1).trim();
    }
    const sub = (rawSub || '').trim();
    if (!sub || sub.toLowerCase() === 'default' || sub.toLowerCase() === 'none') {
      return title;
    }
    if (title.toLowerCase().includes(sub.toLowerCase())) {
      return title;
    }
    const cleanSub = sub.startsWith('(') && sub.endsWith(')') ? sub : `(${sub})`;
    return title ? `${title} ${cleanSub}` : cleanSub;
  };

  const servicesList = (Array.isArray(quote.services) && quote.services.length > 0)
    ? quote.services.map((s, idx) => {
      const baseTitle = s.title || s.serviceName || s.service || '';
      const baseSub = s.subtitle || s.serviceSubtitle || s.selectedSubtitle || s.subTitle || s.sub_title || '';
      return {
        id: s.serviceId || idx + 1,
        serviceName: formatServiceTitle(baseTitle, baseSub),
        service: formatServiceTitle(baseTitle, baseSub),
        rawServiceName: baseTitle,
        subtitle: baseSub,
        description: s.description || s.spec || '',
        spec: s.description || s.spec || '',
        area: s.area,
        rate: s.rate,
        subtotal: s.amount != null ? s.amount : (s.totalPrice != null ? s.totalPrice : Math.round((parseFloat(s.area) || 0) * (parseFloat(s.rate) || 0))),
      };
    })
    : (Array.isArray(quote.servicesList) && quote.servicesList.length > 0
      ? quote.servicesList.map((s, idx) => {
        const baseTitle = s.rawServiceName || s.title || s.serviceName || s.service || '';
        const baseSub = s.subtitle || s.serviceSubtitle || s.selectedSubtitle || s.subTitle || s.sub_title || '';
        return {
          ...s,
          serviceName: formatServiceTitle(baseTitle, baseSub),
          service: formatServiceTitle(baseTitle, baseSub),
          rawServiceName: baseTitle,
          subtitle: baseSub,
        };
      })
      : null);

  let calculatedServicesSubtotal = 0;
  if (servicesList && servicesList.length > 0) {
    servicesList.forEach(s => {
      calculatedServicesSubtotal += Number(s.subtotal || 0);
    });
  }

  let rate = quote.rate || (servicesList && servicesList[0] ? (servicesList[0].rate || servicesList[0][`rate${tKey}`]) : 0);

  // ─── Pricing (quotation object, API v2) ──────────────────────────────────
  // The server calculates every amount; render exactly what it returns.
  //   pricing.discount is null without a discount and pricing.gst is null without GST.
  //   isTaxCustomer only picks the discount order: before tax (tax customer) or after tax (non-tax customer).
  const isTaxCustomer = typeof quote.isTaxCustomer === 'boolean' ? quote.isTaxCustomer : true;
  const quotePricing = quote.pricing || {};
  const gstInfo = quotePricing.gst || null;
  const discountInfo = quotePricing.discount || null;

  const subTotal = Math.round(Number(quotePricing.subTotal ?? calculatedServicesSubtotal ?? 0) || 0);
  const hasGst = Boolean(gstInfo);
  const hasDiscount = Boolean(discountInfo);
  const discountPct = Number(discountInfo?.percentage || 0);
  const discountVal = Number(isTaxCustomer ? discountInfo?.amountForTax : discountInfo?.amountForNonTax) || 0;
  const gstPct = Number(gstInfo?.percentage || 0);
  const cgstPct = Number(gstInfo?.cgst?.percentage ?? gstPct / 2);
  const sgstPct = Number(gstInfo?.sgst?.percentage ?? gstPct / 2);
  const cgstVal = Number(gstInfo?.cgst?.amount || 0);
  const sgstVal = Number(gstInfo?.sgst?.amount || 0);
  const finalTotalRounded = Math.round(Number(quotePricing.grandTotal ?? (subTotal - discountVal + cgstVal + sgstVal)) || 0);

  const assignedEmpName = quote.employeeName
    || quote.employee?.name
    || quote.assignedEmployeeName
    || quote.assignedEmployee?.name
    || quote.assignedTo
    || app.assignedEmployeeName
    || app.assignedEmployee?.name
    || app.employeeName
    || app.employee?.name
    || app.assignedTo
    || app.assignedTechnician;

  const defaultWithRegards = assignedEmpName
    ? (/^(mr\.|mrs\.|ms\.|dr\.)/i.test(String(assignedEmpName).trim())
        ? String(assignedEmpName).trim()
        : `Mr. ${String(assignedEmpName).trim().toUpperCase()}`)
    : 'Mr. Ganesh';

  const withRegardsText = (
    quote.withRegards?.trim()
      || quote.withRegardsName?.trim()
      || quote.regardsName?.trim()
      || app.withRegards?.trim()
      || defaultWithRegards
  ).trim();

  const baseFontSize = isExport ? '12.5px' : '11px';
  const tableFontSize = isExport ? '12px' : '10.5px';
  const headerFontSize = isExport ? '12px' : '10.5px';
  const specFontSize = isExport ? '11.5px' : '10px';
  const breakdownFontSize = isExport ? '10px' : '9px';
  const totalAmountFontSize = isExport ? '12px' : '10.5px';
  const cellPadding = isExport ? '4px 4px' : '3px 3px';
  const servicePadding = isExport ? '4px 6px' : '3px 4px';
  const headerLogoWidth = isExport ? '84px' : '72px';
  const topTitleSize = isExport ? '17px' : '14px';
  const topSubtitleSize = isExport ? '13px' : '11.5px';
  const mainTitleSize = isExport ? '13px' : '11.5px';
  const footerLogoWidth = isExport ? '68px' : '56px';
  const footerFontSize = isExport ? '10px' : '9.5px';
  const pageMargin = isExport ? '4mm 4mm' : '2mm 2mm';

  const buildServiceRows = () => {
    if (!servicesList || servicesList.length === 0) {
      const areaVal = (parseFloat(quote.area || app.totalArea || 0)).toLocaleString();
      const specText = quote.spec || (Array.isArray(quote.specs) ? quote.specs.join(', ') : 'Waterproofing specifications based on selected package tier.');
      const fallbackTitle = formatServiceTitle(
        quote.title || quote.serviceName || quote.service || app.serviceType || '',
        quote.subtitle || quote.serviceSubtitle || quote.selectedSubtitle || quote.subTitle || quote.sub_title || ''
      );
      return `
        <tr>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; border-left: none; padding: ${cellPadding}; font-size: ${tableFontSize};">1</td>
          <td style="text-align:left; border: 1.2px solid #000000; padding: ${servicePadding}; line-height: 1.25; font-size: ${specFontSize};">
            ${fallbackTitle ? `<b>${fallbackTitle}:</b> ` : ''}${specText}
          </td>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; padding: ${cellPadding}; font-size: ${tableFontSize};">${areaVal}</td>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; padding: ${cellPadding}; font-size: ${tableFontSize};">${rate}</td>
          <td style="text-align:right; font-weight:bold; border: 1.2px solid #000000; border-right: none; padding: ${cellPadding}; font-size: ${totalAmountFontSize}; white-space: nowrap;">Rs. ${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
    }

    return servicesList.map((svc, idx) => {
      let sRate = svc.rate || svc[`rate${tKey}`] || 0;
      let sSubtotal = Math.round(svc.subtotal != null ? svc.subtotal : (svc[`totalPrice`] != null ? svc[`totalPrice`] : ((parseFloat(svc.area) || 0) * (parseFloat(sRate) || 0))));
      let tSpecs = svc.spec || svc.description || svc[`specs${tKey}`] || svc.specs;
      let sSpecs = Array.isArray(tSpecs) ? tSpecs.join(', ') : (tSpecs || '');
      const sDesc = sSpecs || '';
      const sBreakdown = svc.breakdownText || (svc.oldTerraceArea ? `(Old Terrace - ${svc.oldTerraceArea} Sft + Parapet Wall - ${svc.parapetArea} Sft)` : '');
      const sDisplayTitle = formatServiceTitle(
        svc.rawServiceName || svc.serviceName || svc.service || svc.title || '',
        svc.subtitle || svc.serviceSubtitle || svc.selectedSubtitle || svc.subTitle || svc.sub_title || ''
      );

      return `
        <tr>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; border-left: none; padding: ${cellPadding}; font-size: ${tableFontSize};">${idx + 1}</td>
          <td style="text-align:left; border: 1.2px solid #000000; padding: ${servicePadding}; line-height: 1.25; font-size: ${specFontSize};">
            ${sDisplayTitle ? `<b>${sDisplayTitle}:</b> ` : ''}${sDesc}
            ${sBreakdown ? `<br/><span style="font-size:${breakdownFontSize}; font-weight:bold;">${sBreakdown}</span>` : ''}
          </td>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; padding: ${cellPadding}; font-size: ${tableFontSize};">${(parseFloat(svc.area || quote.area || app.totalArea || 0)).toLocaleString()}</td>
          <td style="text-align:center; font-weight:bold; border: 1.2px solid #000000; padding: ${cellPadding}; font-size: ${tableFontSize};">${sRate}</td>
          <td style="text-align:right; font-weight:bold; border: 1.2px solid #000000; border-right: none; padding: ${cellPadding}; font-size: ${totalAmountFontSize}; white-space: nowrap;">Rs. ${sSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
    }).join('');
  };

  const buildTotalsRows = () => {
    const money = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const discountRow = { label: `DISCOUNT (${discountPct}%)`, value: `- Rs. ${money(discountVal)}`, color: '#DC2626' };
    const gstRows = [
      { label: `CGST ${cgstPct}%`, value: `Rs. ${money(cgstVal)}` },
      { label: `SGST ${sgstPct}%`, value: `Rs. ${money(sgstVal)}` },
    ];

    const rows = [{ label: 'SUBTOTAL', value: `Rs. ${money(subTotal)}` }];
    if (isTaxCustomer) {
      if (hasDiscount) {
        rows.push(discountRow);
        if (hasGst) rows.push({ label: 'TAXABLE AMOUNT', value: `Rs. ${money(subTotal - discountVal)}` });
      }
      if (hasGst) rows.push(...gstRows);
    } else {
      if (hasGst) rows.push(...gstRows);
      if (hasDiscount) rows.push(discountRow);
    }
    rows.push({ label: 'TOTAL', value: `Rs. ${money(finalTotalRounded)}`, strong: true });

    return rows.map((row, idx) => `
                <tr>
                  ${idx === 0 ? `<td colspan="3" rowspan="${rows.length}" style="vertical-align: middle; border: 1.2px solid #000000; border-left: none; padding: ${isExport ? '4px 8px' : '3px 6px'}; font-size: ${isExport ? '11px' : '9.5px'};">
                    <p style="text-decoration: underline; font-weight: bold; margin-bottom: 2px;">Payment terms:</p>
                    ${renderPaymentTerms(hasGst)}
                  </td>` : ''}
                  <td style="font-weight: ${row.strong ? '800' : 'bold'}; border: 1.2px solid #000000; padding: ${cellPadding}; font-size: ${tableFontSize};">${row.label}</td>
                  <td style="text-align: right; font-weight: ${row.strong ? '800' : 'bold'}; border: 1.2px solid #000000; border-right: none; ${row.color ? `color: ${row.color}; ` : (row.strong ? 'color: #000000; ' : '')}padding: ${cellPadding}; font-size: ${totalAmountFontSize}; white-space: nowrap;">${row.value}</td>
                </tr>`).join('');
  };

  const today = new Date();
  today.setDate(today.getDate() + 15);
  const validDateStr = formatDateDDMMYY(today);

  const percentOrDefault = (value, fallback) => (value != null && Number(value) <= 100 ? String(value) : fallback);
  const advanceVal = percentOrDefault(quote.advancePercent ?? quote.paymentTerms?.advance, '60');
  const midVal = percentOrDefault(quote.midPercent ?? quote.paymentTerms?.mid, '30');
  const finalVal = percentOrDefault(quote.finalPercent ?? quote.paymentTerms?.final, '10');
  const workStartText = quote.workCommencement || quote.paymentTerms?.workStart || quote.workStartNote || 'Work can be started 48hrs from the time of payment received';
  const validityText = quote.quoteValidateDate || quote.paymentTerms?.validity || quote.validityText || (`QUOTE VALID TILL ${validDateStr.toUpperCase()}`);
  const negotiationText = quote.negotiation || quote.notes || quote.paymentTerms?.negotiation || quote.negotiationNote || 'PRICE IS NEGOTIABLE FOR IMMEDIATE ORDER';

  const contact = quote.companyContact || app.companyContact || {};
  const officeAddress = contact.officeAddress || contact.address || '2nd floor, C13, B13, Parsn commercial complex, Kodambakkam High Rd, Nungambakkam, Chennai - 600 034';
  const mobileNumber = contact.mobileNumber || contact.mobile || contact.phone || '+91 99621 19311';
  const landlineNumber = contact.landlineNumber || contact.landline || '044-45000776';
  const emailAddress = contact.emailAddress || contact.email || 'admin@drterrace.com';

  const renderPaymentTerms = (forGst = false) => {
    const rawTerms = quote.terms || quote.termsAndConditions || quote.terms_and_conditions || '';
    if (rawTerms && typeof rawTerms === 'string' && rawTerms.trim().length > 0) {
      return `
        <div class="api-terms">
          ${rawTerms}
        </div>
      `;
    }
    return `
      <ul style="margin: 0; padding-left: 12px; list-style-type: disc; line-height: 1.3;">
        <li>${workStartText}</li>
        ${forGst ? `<li>${gstPct}% GST Applicable on above value${isTaxCustomer ? ' with Tax Invoice' : ''}</li>` : ''}
        <li>${advanceVal}% ${forGst ? '+ TAX ' : ''}Advance for material procurement before start the work</li>
        <li>${midVal}% ${forGst ? '+ TAX ' : ''}After completion of Two coats and Last ${finalVal}% ${forGst ? '+ TAX ' : ''}after completion</li>
      </ul>
    `;
  };

  const clientNameStr = (app.customerName || app.clientName || quote.customerName || quote.clientName || '').toUpperCase();
  const areaStr = (quote.address?.area || app.area || app.location || app.city || quote.address?.city || '').toUpperCase();
  const propStr = ((quote.propertyName || quote.propertyType || app.propertyType || 'House').toLowerCase() === 'house' ? 'INDIVIDUAL HOUSE' : (quote.propertyName || quote.propertyType || app.propertyType || 'House')).toUpperCase();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: ${pageMargin}; }
          * { box-sizing: border-box; }
          html, body { 
            font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; 
            color: #000000; 
            background: #FFFFFF; 
            margin: 0; 
            padding: ${isExport ? '0' : '3px 4px'}; 
            width: 100%;
            font-size: ${baseFontSize}; 
            line-height: 1.3; 
            -webkit-text-size-adjust: 100%;
          }
          
          /* Whole Page Border Container - Seamless & Fully Stretched on A4 */
          .page-container {
            border: 2.5px solid #000000;
            padding: ${isExport ? '3.5mm 0 3mm 0' : '3px 0 2px 0'};
            margin: 0;
            width: 100%;
            min-height: ${isExport ? '280mm' : 'auto'};
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #FFFFFF;
          }

          .content-padded {
            padding-left: ${isExport ? '4mm' : '6px'};
            padding-right: ${isExport ? '4mm' : '6px'};
          }

          /* Top Header */
          .header-table { 
            width: 100%; 
            margin-bottom: ${isExport ? '3px' : '2px'}; 
          }
          .logo { width: ${headerLogoWidth}; height: auto; }
          .top-title { 
            color: #C02626; 
            font-size: ${topTitleSize}; 
            font-weight: 800; 
            text-align: center; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.25;
          }
          .top-subtitle {
            color: #C02626;
            font-size: ${topSubtitleSize};
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: ${isExport ? '3px' : '2px'};
            line-height: 1.2;
          }
          
          .header-divider {
            border: none;
            border-top: 3px solid #0052CC;
            margin: ${isExport ? '5px 0 8px 0' : '4px 0 7px 0'};
          }

          .info-row { 
            display: flex; 
            justify-content: space-between; 
            font-weight: bold; 
            font-size: ${baseFontSize}; 
            margin-top: ${isExport ? '6px' : '5px'}; 
            margin-bottom: ${isExport ? '6px' : '5px'}; 
          }
          
          .main-title { 
            text-align: center; 
            font-weight: bold; 
            font-size: ${mainTitleSize}; 
            text-decoration: underline; 
            margin-bottom: ${isExport ? '3px' : '2px'}; 
          }
          
          .site-details { 
            text-align: center; 
            font-weight: bold; 
            font-size: ${baseFontSize}; 
            margin-bottom: ${isExport ? '5px' : '3px'}; 
          }
          
          /* Exact Table Structure - Black Borders */
          table.data-table { 
            width: 100%; 
            table-layout: fixed;
            border-collapse: collapse; 
            border-left: none;
            border-right: none;
            border-top: 1.2px solid #000000; 
            border-bottom: 1.2px solid #000000; 
            margin-top: ${isExport ? '4px' : '3px'};
            margin-bottom: ${isExport ? '4px' : '3px'}; 
          }
          table.data-table th, table.data-table td { 
            border: 1.2px solid #000000; 
            padding: ${cellPadding}; 
            word-break: break-word;
            vertical-align: middle;
          }
          table.data-table th:first-child, table.data-table td:first-child {
            border-left: none !important;
          }
          table.data-table th:last-child, table.data-table td:last-child {
            border-right: none !important;
          }
          table.data-table th { 
            background-color: #FFFFFF; 
            font-weight: bold; 
            text-align: center; 
            font-size: ${headerFontSize};
          }
          
          .red-bold { color: #C02626; font-weight: bold; }
          
          .sys-text {
            text-align: center; 
            font-size: ${isExport ? '10px' : '8px'}; 
            margin-top: ${isExport ? '4px' : '3px'}; 
            margin-bottom: ${isExport ? '3px' : '2px'}; 
            color: #64748B; 
          }
          
          .api-terms {
            font-size: ${isExport ? '10px' : '8.5px'};
            line-height: 1.25;
            color: #000000;
          }
          .api-terms p {
            margin: 1.5px 0 !important;
            padding: 0 !important;
            line-height: 1.25 !important;
          }
          .api-terms ul, .api-terms ol {
            margin: 1.5px 0 !important;
            padding-left: 14px !important;
          }

          .footer-divider {
            border: none;
            border-top: 3px solid #0052CC;
            margin: ${isExport ? '4px 0 3px 0' : '4px 0 2px 0'};
          }

          .footer-bottom { 
            text-align: left; 
            font-size: ${footerFontSize}; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
          }
          .footer-logo { width: ${footerLogoWidth}; height: auto; }

          @media print {
            @page {
              size: A4 portrait;
              margin: 4mm 4mm;
            }
            html, body {
              padding: 0 !important;
              margin: 0 !important;
              background: #FFFFFF !important;
              width: 100% !important;
              height: 100% !important;
            }
            .page-container {
              border: 3px solid #000000 !important;
              padding: 3mm 0 3mm 0 !important;
              min-height: 280mm !important;
              height: 280mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              box-sizing: border-box !important;
              width: 100% !important;
              margin: 0 auto !important;
              page-break-inside: avoid !important;
            }
            .content-padded {
              padding-left: 4mm !important;
              padding-right: 4mm !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <!-- Top Section (Header + Table) -->
          <div>
            <!-- Padded Top Header -->
            <div class="content-padded">
              <table class="header-table">
                <tr>
                  <td style="width: 18%; vertical-align: middle; text-align: left;">
                    <img src="data:image/png;base64,${logoBase64}" class="logo" />
                  </td>
                  <td style="width: 82%; text-align: center; vertical-align: middle;">
                    <div class="top-title">
                    <h3>${qTier}</h3>
                    </div>
                    <div class="top-subtitle">${warrantyText}</div>
                  </td>
                </tr>
              </table>

              <hr class="header-divider" />

              <div class="info-row">
                <div>Date : ${dateVal}</div>
                <div>Quote No : ${quoteNoVal}</div>
              </div>

              <div class="main-title">Quotation For German Tech Water Proofing</div>

              <div class="site-details">
                Site Details : ATTENTION TO MR. ${clientNameStr}-${areaStr}. <span class="red-bold">(${propStr})</span>
              </div>
            </div>

            <!-- Exact Table Merged with Outer Border -->
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 6%; white-space: nowrap; font-size: ${headerFontSize};">S.NO</th>
                  <th style="width: 44%; font-size: ${headerFontSize};">Service</th>
                  <th style="width: 14%; font-size: ${headerFontSize}; line-height: 1.15;">Measurement<br/>(Sq.ft)</th>
                  <th style="width: 14%; font-size: ${headerFontSize}; line-height: 1.15;">Cost / Sq.ft<br/>(Rs)</th>
                  <th style="width: 22%; white-space: nowrap; font-size: ${headerFontSize};">Total</th>
                </tr>
              </thead>
              <tbody>
                ${buildServiceRows()}
                <tr>
                  <td colspan="5" style="text-align: center; border: 1.2px solid #000000; border-left: none; border-right: none; padding: ${isExport ? '3px 2px' : '2.5px 2px'}; font-size: ${headerFontSize};">
                    <span class="red-bold">FINAL QUOTE VALUE BASED ON ACTUAL MEASUREMENT</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="5" style="text-align: center; border: 1.2px solid #000000; border-left: none; border-right: none; padding: ${isExport ? '3px 2px' : '2.5px 2px'}; font-size: ${headerFontSize};">
                    <span class="red-bold">KINDLY NOTE THE PRICE QUOTED FOR NON DILUTED ORIGINAL TOP COATING EXCEPT SEALER COTE</span>
                  </td>
                </tr>
                ${buildTotalsRows()}
              </tbody>
            </table>
          </div>

          <!-- Bottom Section (Payment Terms + Sign-off + Footer) -->
          <div class="content-padded">
            <!-- Payment Terms (Centered) -->
            <div style="text-align: center; margin-top: ${isExport ? '4px' : '3px'}; margin-bottom: ${isExport ? '3px' : '2px'}; font-size: ${baseFontSize};">
              
              <div class="red-bold">${validityText}</div>
              <div class="red-bold">${negotiationText}</div>
            </div>

            <!-- Sign-off & Seal / Signature Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: ${isExport ? '4px' : '3px'}; margin-bottom: ${isExport ? '3px' : '2px'};">
              <!-- Left: Technical Team Contact -->
              <div style="text-align: left; font-size: ${baseFontSize}; font-weight: bold; line-height: 1.25;">
                <div>With Regards,</div>
                <div style="margin-top: 1px; color: #0F172A;">${withRegardsText}</div>
                <div style="font-size: ${isExport ? '11px' : '9.5px'}; color: #334155;">Technical Team</div>
                <div style="font-size: ${isExport ? '10.5px' : '9px'}; color: #334155; margin-top: 2px;">📞 ${mobileNumber} ${landlineNumber ? `| ☎️ ${landlineNumber}` : ''}</div>
              </div>

              <!-- Right: Official Stamp & Authorized Signature Block -->
              <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
                <img 
                  src="data:image/png;base64,${sealBase64}" 
                  alt="Official Stamp & Authorized Signature" 
                  style="width: ${isExport ? '104px' : '90px'}; height: auto; object-fit: contain; display: block; margin: 0 auto 2px auto;" 
                />
                <div style="border-top: 1px solid #000000; width: ${isExport ? '115px' : '100px'}; padding-top: 2px; font-size: ${isExport ? '9.5px' : '8px'}; font-weight: bold; color: #000000; text-align: center;">
                  Authorized Signatory
                </div>
              </div>
            </div>

            <hr class="footer-divider" />

            <!-- Footer Company Info -->
            <div class="footer-bottom">
              <div style="width: 80%; line-height: 1.25;">
                <b>Dr. Terrace water Proofing (ISO - 9001: 2008 Certified)</b><br/>
                ${officeAddress}<br/>
                ${emailAddress ? `<span>Email: ${emailAddress} | </span>` : ''}www.drterrace.com / www.drterracewaterproofing.com
              </div>
              <img src="data:image/png;base64,${logoBase64}" class="footer-logo" />
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};
export default function SendQuotationScreen() {
  const router = useRouter();
  const { id, quoteId } = useLocalSearchParams();
  const { setTabBarVisible } = useTabBar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [app, setApp] = useState({});
  const [quote, setQuote] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  React.useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  React.useEffect(() => {
    let isMounted = true;
    const resolveAppAndQuote = async () => {
      setIsLoading(true);
      setLoadError(null);
      let targetApp = null;
      let targetQuote = null;

      const targetQuoteId = quoteId || id;

      // 1. Fetch quotation details + active terms and conditions + company contact from GET /quotations/:id/pdf-view
      if (targetQuoteId) {
        try {
          const qRes = await quotationService.getQuotationPdfView(targetQuoteId);
          if (qRes && qRes.success && qRes.quotation) {
            targetQuote = qRes.quotation;
          } else {
            // API Fallback: try getQuotationById
            const fallbackRes = await quotationService.getQuotationById(targetQuoteId);
            if (fallbackRes && fallbackRes.success && fallbackRes.quotation) {
              targetQuote = fallbackRes.quotation;
            }
          }

          if (targetQuote) {
            const customer = targetQuote.customer || {};
            const address = targetQuote.address || customer.address || {};
            targetApp = {
              ...targetQuote,
              clientName: targetQuote.clientName || targetQuote.customerName || customer.name,
              customerName: targetQuote.customerName || targetQuote.clientName || customer.name,
              mobileNumber: targetQuote.mobileNumber || targetQuote.phone || customer.mobile,
              phone: targetQuote.phone || targetQuote.mobileNumber || customer.mobile,
              area: address.area || address.city || targetQuote.area || '',
              location: address.area || address.city || targetQuote.location || '',
              city: address.city || targetQuote.city || '',
              propertyType: targetQuote.propertyType || targetQuote.property?.name,
            };
          }
        } catch (err) {
          console.warn('Error fetching quotation API data:', err?.message);
        }
      }

      if (isMounted) {
        if (targetApp) setApp(targetApp);
        if (targetQuote) {
          if (!targetQuote.id && !targetQuote.quotationId && quoteId) {
            targetQuote.id = quoteId;
          }
          setQuote(targetQuote);
        } else {
          setLoadError('Quotation data could not be loaded from server. Please go back and try again.');
        }
        setIsLoading(false);
      }
    };

    resolveAppAndQuote();
    return () => {
      isMounted = false;
    };
  }, [id, quoteId]);

  const clientFullName = String(quote.customer?.name || app.clientName || app.customerName || 'Customer').trim();
  const quotationTier = (() => {
    const raw = String(quote.package?.tier || quote.package?.name || quote.packageName || quote.quoteFor || '').toUpperCase();
    if (raw.includes('PREMIUM') || raw.includes('MID')) return 'Premium';
    if (raw.includes('ELITE') || raw.includes('LUXURY')) return 'Elite';
    return 'Economy';
  })();
  // Only generate HTML once real API data is loaded — never from empty/default state
  const isDataReady = !isLoading && !loadError && !!(quote.id || quote.quotationId || quoteId);
  const previewHtml = isDataReady ? generateHTML(app, quote, false, quoteId) : null;

  const getPdfUri = async () => {
    const exportHtml = generateHTML(app, quote, true, quoteId);
    const cleanClientName = toSafeFileName(clientFullName, 'Customer');
    const cleanTier = toSafeFileName(quotationTier, 'Economy');
    const fileName = `${cleanClientName}_${cleanTier}_quotation.pdf`;
    const uri = await createPdfFile({ html: exportHtml, fileName });
    return { uri, fileName };
  };

  const handleSharePDF = async () => {
    try {
      const { uri } = await getPdfUri();
      await sharePdfFile({ uri, title: `Share ${clientFullName}_${quotationTier}_quotation.pdf` });
    } catch (error) {
      Alert.alert('Error', `Failed to share PDF: ` + error.message);
    }
  };

  // Sends from the business WhatsApp number when WhatsApp Business is set up; otherwise opens the share sheet.
  // withoutTemplate: send the PDF as a plain document instead of the approved template (24-hour window only).
  const sendQuotationOnWhatsApp = async ({ withoutTemplate = false } = {}) => {
    try {
      const customerName = app.clientName || app.customerName || 'Customer';
      const rawQuoteNo = String(quote.id || quote.quotationId || quoteId || '');
      const quoteNo = rawQuoteNo && !rawQuoteNo.startsWith('DRT-') ? `DRT-${rawQuoteNo}` : rawQuoteNo;
      await sendDocumentOnWhatsApp({
        documentType: 'quotation',
        documentLabel: 'quotation',
        customerName,
        phone: app.mobileNumber || app.phone || quote.customer?.mobile,
        bodyParams: [customerName, quoteNo],
        withoutTemplate,
        caption: `Quotation${quoteNo ? ` ${quoteNo}` : ''} from Dr. Terrace Water Proofing`,
        buildPdf: getPdfUri,
        onBusyChange: setIsSendingWhatsApp,
        fallbackShare: async () => {
          const { uri } = await getPdfUri();
          await shareToWhatsApp({
            uri,
            title: `Send ${clientFullName}_${quotationTier}_quotation.pdf to ${customerName} via WhatsApp`,
          });
        },
      });
    } catch (error) {
      Alert.alert('Error', `Failed to send via WhatsApp: ${error.message}`);
    }
  };

  const handleWhatsApp = () => sendQuotationOnWhatsApp();
  const handleShareWithoutTemplate = () => sendQuotationOnWhatsApp({ withoutTemplate: true });

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      const targetId = id || app.id || app.appointmentId;
      if (targetId) {
        router.replace({ pathname: '/customer-detail', params: { id: targetId, initialTab: 'quotation' } });
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [id, app.id, app.appointmentId, router]);

  React.useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBack]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <InnerHeader title="View Quotation PDF" onBack={handleBack} paddingTop={insets.top} isDark={isDark} />

      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        {isLoading ? (
          <MaterialPageLoader
            title="Loading Quotation..."
            subtitle="Fetching quotation details & PDF preview"
            fullScreen={false}
          />
        ) : loadError ? (
          // Error state — API data could not be fetched
          <View style={styles.loaderContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Ready — render WebView only with real API data
          <WebView
            key={previewHtml ? `pdf-${quote?.id || quoteId || ''}-${previewHtml.length}` : 'loading'}
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={{ flex: 1, backgroundColor: '#FFFFFF' }}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
            bounces={true}
            scalesPageToFit={false}
            textZoom={100}
            overScrollMode="always"
          />
        )}
      </View>

      {/* Bottom Action Controls */}
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 14,
        backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
        borderTopWidth: 1,
        borderColor: isDark ? '#334155' : '#E2E8F0',
        paddingBottom: Math.max(insets.bottom, 16) + 85,
        gap: 10,
        zIndex: 1000,
      }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
        {/* WhatsApp Button */}
        <TouchableOpacity
          style={{
            flex: 1.2,
            backgroundColor: '#25D366',
            paddingVertical: 14,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={handleWhatsApp}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
            Send via WhatsApp
          </Text>
        </TouchableOpacity>

        {/* Generic Share PDF Button */}
        <TouchableOpacity
          style={{
            flex: 0.8,
            backgroundColor: isDark ? '#334155' : '#0052CC',
            paddingVertical: 14,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={handleSharePDF}
          activeOpacity={0.85}
        >
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
            Share PDF
          </Text>
        </TouchableOpacity>
        </View>

        {/* WhatsApp Business: send the PDF as a plain document, without a template (shown only when set up) */}
        {isWhatsAppBusinessConfigured() && (
          <TouchableOpacity
            style={{
              borderWidth: 1.5,
              borderColor: '#25D366',
              backgroundColor: isDark ? '#0F172A' : '#F0FDF4',
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleShareWithoutTemplate}
            activeOpacity={0.85}
          >
            <Ionicons name="document-attach-outline" size={18} color={isDark ? '#4ADE80' : '#15803D'} style={{ marginRight: 8 }} />
            <Text style={{ color: isDark ? '#4ADE80' : '#15803D', fontSize: 14, fontWeight: '700' }}>
              Share without Template
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <MaterialOverlayLoader
        visible={isSendingWhatsApp}
        title="Sending on WhatsApp..."
        subtitle="Preparing the PDF and sending it to the customer"
      />
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0052CC',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  scrollContainer: {
    paddingTop: 16,
  },
  receiptCanvas: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  receiptCanvasDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  docCenteredTitle: {
    fontSize: 16,
    color: '#0052CC',
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: 'bold',
  },
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
  thickBlueDivider: {
    height: 3,
    backgroundColor: '#0052CC',
    marginVertical: 14,
    borderRadius: 2,
  },
  billingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billingColLeft: {
    flex: 3,
    paddingRight: 8,
  },
  billingColRight: {
    flex: 2,
    alignItems: 'flex-end',
  },
  billingItemRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  billingLabelTitle: {
    width: 65,
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  billingLabelSep: {
    width: 12,
    fontSize: 10,
    color: '#1E293B',
    textAlign: 'center',
  },
  billingLabelVal: {
    flex: 1,
    fontSize: 10,
    color: '#475569',
  },
  billingItemRowRight: {
    flexDirection: 'row',
    marginBottom: 4,
    justifyContent: 'flex-end',
  },
  billingLabelTitleRight: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 6,
  },
  billingLabelValRight: {
    fontSize: 10,
    color: '#475569',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    flex: 1,
  },
  shareBtn: {
    backgroundColor: '#2563EB',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
