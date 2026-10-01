import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { authRepository, isAdminRole } from '../../auth/api/authRepository';
import { paymentRepository } from '../api/paymentRepository';
import { quotationPaymentRepository } from '../api/quotationPaymentRepository';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { resolveProofImageUrl, getProofFilename } from '../../../core/utils/imageUtils';
import ProofImagePreview from '../components/ProofImagePreview';
import VerifyPaymentModal from '../components/VerifyPaymentModal';
import {
  MaterialAlertModal,
  MaterialDeleteModal,
  MaterialSuccessModal,
} from '../../../shared/components/material';

export default function PaymentVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [client, setClient] = useState(null);
  const [verifyData, setVerifyData] = useState(null);
  const [payView, setPayView] = useState(null);
  const [isLoadingVerify, setIsLoadingVerify] = useState(Boolean(params.paymentId || params.milestone));
  const [isSubmittingApprove, setIsSubmittingApprove] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  const [copiedField, setCopiedField] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [failedProofUri, setFailedProofUri] = useState(null);
  const [loadedProofUri, setLoadedProofUri] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // Custom modal states
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successData, setSuccessData] = useState({ title: '', message: '', badge: '', appId: '' });
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', type: 'info' });

  // Load current user and admin role
  useEffect(() => {
    authRepository.getUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        setIsAdmin(user.isAdmin === true || isAdminRole(user.role));
      }
    });
  }, []);

  // Load appointment / client details
  useEffect(() => {
    if (!params.id) return;
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        setClient(res.appointment);
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            setClient(cRes.client || cRes.data);
          }
        });
      }
    });
  }, [params.id]);

  const quotationId =
    params.quotationId ||
    verifyData?.quotation?.quotationId ||
    client?.confirmedQuoteId ||
    client?.activeQuotationId;

  // Load quotation payView for rich service context
  useEffect(() => {
    if (!quotationId) return;
    paymentRepository
      .getPayView(quotationId)
      .then((res) => {
        if (res?.success && res.data) {
          setPayView(res.data);
        }
      })
      .catch(() => {});
  }, [quotationId]);

  // Fetch API v2 Quotation Payment Verification View (GET /api/v2/quotation-payments/:id/:paymentId/verify-view)
  useEffect(() => {
    const paymentId = params.paymentId || params.milestone || params.id;
    if (!paymentId && !quotationId) return;

    let isMounted = true;

    const fetchVerificationDossier = async () => {
      setIsLoadingVerify(true);
      try {
        // 1. Primary canonical: GET /api/v2/quotation-payments/:id/:paymentId/verify-view
        const qId = quotationId ? String(quotationId) : null;
        const pId = paymentId ? String(paymentId) : null;
        const res = await quotationPaymentRepository.getPaymentVerifyView(qId, pId);

        if (isMounted && res?.success && res.data) {
          setVerifyData(res.data);
          const initialNotes =
            res.data.verification?.verificationNotes ||
            res.data.payment?.verificationNotes ||
            res.data.verificationNotes ||
            '';
          if (initialNotes) {
            setVerificationNotes(initialNotes);
          }
          return;
        }

        // 2. Fallback to general paymentRepository
        const fallbackRes = await paymentRepository.getPaymentVerifyView(pId, qId);
        if (isMounted && fallbackRes?.success && fallbackRes.data) {
          setVerifyData(fallbackRes.data);
          const initialNotes =
            fallbackRes.data.verification?.verificationNotes ||
            fallbackRes.data.payment?.verificationNotes ||
            fallbackRes.data.verificationNotes ||
            '';
          if (initialNotes) {
            setVerificationNotes(initialNotes);
          }
        }
      } catch (_err) {
        // Error captured
      } finally {
        if (isMounted) {
          setIsLoadingVerify(false);
        }
      }
    };

    fetchVerificationDossier();

    return () => {
      isMounted = false;
    };
  }, [params.paymentId, params.milestone, params.id, quotationId]);

  // Match payment in payView for accurate service context
  const matchedFromPayView = (() => {
    if (!payView) return null;

    const targetPayId = String(params.paymentId || params.milestone || verifyData?.paymentId || verifyData?.id || '').trim();
    const targetVoucher = String(params.voucher || params.voucherCode || params.voucherNumber || verifyData?.voucher || '').trim();
    const targetUpi = String(params.upiId || params.upiTransactionId || verifyData?.upiId || '').trim();
    const targetServiceId = String(params.serviceId || '').trim();

    // 1. Search in main quotation services by serviceId, payment ID, voucher, or UPI
    if (Array.isArray(payView.services)) {
      for (const svc of payView.services) {
        if (targetServiceId && String(svc.id).trim() === targetServiceId) {
          const p = Array.isArray(svc.payments)
            ? svc.payments.find(
                (item) =>
                  (targetPayId && String(item.id).trim() === targetPayId) ||
                  (targetVoucher && item.voucher && String(item.voucher).trim() === targetVoucher) ||
                  (targetUpi && item.upiId && String(item.upiId).trim() === targetUpi)
              ) || svc.payments[0]
            : null;
          return { service: svc, payment: p, type: 'milestone' };
        }

        if (Array.isArray(svc.payments)) {
          const p = svc.payments.find(
            (item) =>
              (targetPayId && String(item.id).trim() === targetPayId) ||
              (targetVoucher && item.voucher && String(item.voucher).trim() === targetVoucher) ||
              (targetUpi && item.upiId && String(item.upiId).trim() === targetUpi)
          );
          if (p) {
            return { service: svc, payment: p, type: 'milestone' };
          }
        }
      }
    }

    // 2. Search in additionalPayment
    if (Array.isArray(payView.additionalPayment)) {
      for (const addSvc of payView.additionalPayment) {
        if (targetServiceId && String(addSvc.id).trim() === targetServiceId) {
          const p = Array.isArray(addSvc.payments)
            ? addSvc.payments.find(
                (item) =>
                  (targetPayId && String(item.id).trim() === targetPayId) ||
                  (targetVoucher && item.voucher && String(item.voucher).trim() === targetVoucher) ||
                  (targetUpi && item.upiId && String(item.upiId).trim() === targetUpi)
              ) || addSvc.payments[0]
            : null;
          return { service: addSvc, payment: p, type: 'additional' };
        }

        if (Array.isArray(addSvc.payments)) {
          const p = addSvc.payments.find(
            (item) =>
              (targetPayId && String(item.id).trim() === targetPayId) ||
              (targetVoucher && item.voucher && String(item.voucher).trim() === targetVoucher) ||
              (targetUpi && item.upiId && String(item.upiId).trim() === targetUpi)
          );
          if (p) {
            return { service: addSvc, payment: p, type: 'additional' };
          }
        }
      }
    }

    // 3. Search in gstPayment
    const isExplicitGst =
      params.isGst === 'true' ||
      params.stage === 'GST Tax Clearance' ||
      params.serviceTitle === 'GST Tax Clearance' ||
      (targetPayId && targetPayId.toLowerCase().startsWith('gst'));

    const gstPayments = [
      ...(Array.isArray(payView.gstPayment?.payments) ? payView.gstPayment.payments : []),
      ...(Array.isArray(payView.gstPayments) ? payView.gstPayments : []),
    ];

    if (isExplicitGst || gstPayments.length > 0) {
      const gp = gstPayments.find(
        (item) =>
          (targetPayId && String(item.id).trim() === targetPayId) ||
          (targetVoucher && item.voucher && String(item.voucher).trim() === targetVoucher)
      );
      if (gp || isExplicitGst) {
        return {
          service: payView.gstPayment || {
            title: 'GST Tax Clearance',
            totalPrice: payView.gstAmount || 0,
            paidAmount: payView.gstPaid || 0,
            balanceAmount: (payView.gstAmount || 0) - (payView.gstPaid || 0),
          },
          payment: gp || gstPayments[0] || null,
          type: 'gst',
        };
      }
    }

    // 4. If targetServiceId or serviceTitle matches a service by title
    const searchTitle = (params.serviceTitle || params.stage || '').toLowerCase().trim();
    if (searchTitle && searchTitle !== 'gst tax clearance') {
      if (Array.isArray(payView.services)) {
        const found = payView.services.find(
          (s) => s.title && s.title.toLowerCase().trim() === searchTitle
        );
        if (found) {
          return { service: found, payment: found.payments?.[0] || null, type: 'milestone' };
        }
      }
    }

    // 5. Check for any unverified payment in payView services
    if (Array.isArray(payView.services)) {
      for (const svc of payView.services) {
        if (Array.isArray(svc.payments)) {
          const p = svc.payments.find((item) => item.isVerified === false || item.verificationStatus === 'pending');
          if (p) return { service: svc, payment: p, type: 'milestone' };
        }
      }
    }

    // 6. Check for unverified in additionalPayment
    if (Array.isArray(payView.additionalPayment)) {
      for (const addSvc of payView.additionalPayment) {
        if (Array.isArray(addSvc.payments)) {
          const p = addSvc.payments.find((item) => item.isVerified === false || item.verificationStatus === 'pending');
          if (p) return { service: addSvc, payment: p, type: 'additional' };
        }
      }
    }

    // 7. Fallback to first service in quotation if available
    if (Array.isArray(payView.services) && payView.services.length > 0) {
      const firstSvc = payView.services[0];
      const firstPay = Array.isArray(firstSvc.payments) && firstSvc.payments.length > 0 ? firstSvc.payments[0] : null;
      return { service: firstSvc, payment: firstPay, type: 'milestone' };
    }

    return null;
  })();

  const matchedPay = matchedFromPayView?.payment;

  // Service context resolution
  const serviceContext = (() => {
    const isExplicitGst =
      params.isGst === 'true' ||
      params.stage === 'GST Tax Clearance' ||
      params.serviceTitle === 'GST Tax Clearance' ||
      matchedFromPayView?.type === 'gst';

    // 1. If we matched a service from payView:
    if (matchedFromPayView?.service) {
      const svc = matchedFromPayView.service;
      const sqftVal = svc.sqft != null ? svc.sqft : (params.sqft ? Number(params.sqft) : null);
      const rateVal = svc.rate != null ? svc.rate : (params.rate ? Number(params.rate) : null);
      const totalVal = Number(
        svc.totalPrice !== undefined
          ? svc.totalPrice
          : svc.originalPrice !== undefined
          ? svc.originalPrice
          : params.totalPrice
          ? Number(params.totalPrice)
          : (sqftVal && rateVal ? sqftVal * rateVal : 0)
      );
      const paidVal = Number(svc.paidAmount !== undefined ? svc.paidAmount : (params.amount || 0));
      const balVal = Number(
        svc.balanceAmount !== undefined
          ? svc.balanceAmount
          : Math.max(0, totalVal - paidVal)
      );

      return {
        serviceId: svc.id || params.serviceId || null,
        serviceTitle: svc.title || svc.serviceTitle || svc.name || params.serviceTitle || params.stage || (isExplicitGst ? 'GST Tax Clearance' : 'Service Payment'),
        sqft: sqftVal,
        rate: rateVal,
        totalPrice: totalVal,
        paidAmount: paidVal,
        balanceAmount: balVal,
        status: svc.status,
      };
    }

    // 2. If verifyData has service and it is NOT bogus GST for non-GST payment
    const isBogusVerifyGst = !isExplicitGst && verifyData?.service?.serviceTitle === 'GST Tax Clearance' && Number(verifyData?.service?.totalPrice || 0) === 0;
    if (verifyData?.service && !isBogusVerifyGst) {
      const sqftVal = verifyData.service.sqft != null ? verifyData.service.sqft : (params.sqft ? Number(params.sqft) : null);
      const rateVal = verifyData.service.rate != null ? verifyData.service.rate : (params.rate ? Number(params.rate) : null);
      const totalVal = Number(
        verifyData.service.totalPrice !== undefined
          ? verifyData.service.totalPrice
          : (sqftVal && rateVal ? sqftVal * rateVal : 0)
      );
      const paidVal = Number(verifyData.service.paidAmount !== undefined ? verifyData.service.paidAmount : (params.amount || 0));
      const balVal = Number(
        verifyData.service.balanceAmount !== undefined
          ? verifyData.service.balanceAmount
          : Math.max(0, totalVal - paidVal)
      );

      return {
        ...verifyData.service,
        serviceTitle: verifyData.service.serviceTitle || params.serviceTitle || params.stage || 'Service Payment',
        sqft: sqftVal,
        rate: rateVal,
        totalPrice: totalVal,
        paidAmount: paidVal,
        balanceAmount: balVal,
      };
    }

    // 3. Fallback to route params (passed from CustomerDetailScreen)
    if (params.serviceTitle || params.stage || params.totalPrice || params.sqft) {
      const title = params.serviceTitle || params.stage || params.service || 'Service Payment';
      const sqftVal = params.sqft ? Number(params.sqft) : null;
      const rateVal = params.rate ? Number(params.rate) : null;
      const totalVal = params.totalPrice ? Number(params.totalPrice) : (sqftVal && rateVal ? sqftVal * rateVal : Number(params.amount || 0));
      const paidVal = Number(params.amount || 0);

      return {
        serviceId: params.serviceId || null,
        serviceTitle: title,
        sqft: sqftVal,
        rate: rateVal,
        totalPrice: totalVal,
        paidAmount: paidVal,
        balanceAmount: Math.max(0, totalVal - paidVal),
      };
    }

    // 4. Fallback to client/appointment details
    if (client?.service || client?.stageName) {
      return {
        serviceId: null,
        serviceTitle: client?.service || client?.stageName || 'Terrace Waterproofing',
        sqft: client?.sqft || null,
        rate: client?.rate || null,
        totalPrice: Number(client?.totalCost || client?.finalPaidAmount || 0),
        paidAmount: Number(client?.advance || client?.finalPaidAmount || 0),
        balanceAmount: Number(client?.remainingBalance || 0),
      };
    }

    return null;
  })();

  // Quotation Payments verify-view data mapping (API v2 /api/v2/quotation-payments/:id/:paymentId/verify-view)
  const payment = verifyData?.payment || verifyData || {};
  const verification = verifyData?.verification || {};
  const proof = verifyData?.proof || {};
  const quotation = verifyData?.quotation || {};
  const pricing = quotation?.pricing || {};
  const progress = quotation?.progress || {};

  // Quotation context resolution
  const quotationContext = (() => {
    if (quotation && (quotation.quotationId || quotation.quotationTitle || quotation.clientName)) {
      return quotation;
    }
    if (payView) {
      return {
        quotationId: payView.id || payView.quotationId || quotationId,
        quotationTitle: payView.title || `Quotation #${payView.id || quotationId}`,
        propertyName: payView.propertyName || 'Property',
        siteAddress:
          payView.propertyAddress ||
          payView.siteAddress ||
          payView.customer?.address ||
          payView.customer?.area ||
          client?.address ||
          '',
        clientName: payView.customer?.name || payView.clientName || client?.name || '',
        mobileNumber: payView.customer?.mobile || client?.mobileNumber || '',
        isConfirmed: payView.isConfirmed ?? true,
        gstDecision: payView.gstDecision || (payView.isTaxCustomer ? 'APPLIED' : 'OPTED_OUT'),
        customerGstNumber: payView.customerGstNumber || null,
        pricing: {
          subTotal: payView.subTotal || payView.totalPrice || 0,
          grandTotal: payView.pricing?.grandTotal ?? payView.grandTotal ?? payView.totalPrice ?? 0,
        },
        progress: {
          totalPaid: payView.totalPaid || 0,
          balanceAmount: payView.progress?.balanceAmount ?? payView.balanceAmount ?? 0,
          paymentStatus: payView.status || 'PARTIALLY_PAID',
        },
        totalWithGst: payView.totalPrice || payView.totalWithGst || 0,
        totalPaid: payView.totalPaid || 0,
        balanceAmount: payView.balanceAmount || 0,
      };
    }
    return null;
  })();

  // Client details
  const rawClientName =
    quotation?.clientName ||
    verifyData?.clientName ||
    payView?.customer?.name ||
    client?.clientName ||
    client?.name ||
    client?.customerName ||
    params.clientName ||
    params.customerName ||
    '';
  const displayName = rawClientName.trim() ? `${rawClientName.trim()}` : '';

  // Payment specs
  const paymentId =
    payment.paymentId ||
    payment.id ||
    verifyData?.paymentId ||
    verifyData?.id ||
    matchedPay?.id ||
    params.paymentId ||
    params.milestone ||
    '';

  const voucherCode =
    payment.voucher ||
    verifyData?.voucher ||
    matchedPay?.voucher ||
    params.voucher ||
    params.voucherNumber ||
    params.voucherCode ||
    client?.finalPaidDetails?.transactionId ||
    client?.voucherNumber ||
    '';

  const paymentAmt = Number(
    payment.amount !== undefined && payment.amount !== null
      ? payment.amount
      : verifyData?.amount !== undefined && verifyData.amount !== null
      ? verifyData.amount
      : matchedPay?.amount !== undefined && matchedPay.amount !== null
      ? matchedPay.amount
      : params.amount || client?.finalPaidAmount || client?.finalPaidDetails?.amount || client?.paymentAmount || 0
  );

  const rawCollectedDate =
    payment.paymentDate ||
    verifyData?.paymentDate ||
    payment.createdAt ||
    verifyData?.createdAt ||
    matchedPay?.createdAt ||
    matchedPay?.date ||
    params.date ||
    params.paymentDate ||
    client?.finalPaidDetails?.paymentDate ||
    client?.finalPaidDetails?.date ||
    '';
  const collectedDate = rawCollectedDate ? formatDateDDMMYY(rawCollectedDate) : '';

  const rawCreatedAt =
    payment.createdAt ||
    verifyData?.createdAt ||
    '';
  const createdAtFormatted = rawCreatedAt ? formatDateDDMMYY(rawCreatedAt) : '';

  const paymentMethod = (
    payment.paymentMethod ||
    verifyData?.paymentMethod ||
    matchedPay?.paymentMethod ||
    params.paymentMethod ||
    params.method ||
    params.mode ||
    client?.finalPaidDetails?.paymentMethod ||
    client?.finalPaidDetails?.method ||
    'CASH'
  ).toUpperCase();

  const isUpi = Boolean(paymentMethod.includes('UPI'));
  const isAccount = Boolean(
    paymentMethod.includes('ACCOUNT') ||
    paymentMethod.includes('BANK') ||
    paymentMethod.includes('CHEQUE')
  );
  const isCash = Boolean(
    paymentMethod.includes('CASH') ||
    (!isUpi && !isAccount)
  );

  // UPI ID resolution
  const rawUpiId =
    payment.upiId ||
    verifyData?.upiId ||
    verifyData?.upiTransactionId ||
    matchedPay?.upiId ||
    params.upiId ||
    params.upiTransactionId ||
    params.transactionId ||
    '';
  const upiId = rawUpiId || (isUpi ? voucherCode : '');

  // Reference Number resolution
  const referenceNumber =
    payment.referenceNumber ||
    verifyData?.referenceNumber ||
    matchedPay?.referenceNumber ||
    params.referenceNumber ||
    '';

  // Bank Account details resolution
  const rawAccount =
    payment.account ||
    verifyData?.account ||
    verifyData?.bankDetails ||
    verifyData?.bankAccount ||
    matchedPay?.bankDetails ||
    matchedPay?.bankAccount ||
    params.bankDetails ||
    params.bankAccount ||
    params.account ||
    null;

  let bankDetails = rawAccount;
  if (typeof rawAccount === 'string' && rawAccount.trim().startsWith('{')) {
    try {
      bankDetails = JSON.parse(rawAccount);
    } catch {
      bankDetails = rawAccount;
    }
  }

  const collectorName =
    payment.receivedBy ||
    verifyData?.receivedBy ||
    matchedPay?.receivedBy ||
    client?.employeeName ||
    params.collectorName ||
    params.receivedBy ||
    'Field Executive';

  const notes = payment.notes || verifyData?.notes || '';

  const displayPaymentId =
    payment.paymentId ||
    payment.id ||
    verifyData?.paymentId ||
    verifyData?.id ||
    matchedPay?.id ||
    params.paymentId ||
    params.milestone ||
    voucherCode ||
    (params.id ? `PAY-${params.id}` : '');

  const serviceTitle =
    quotation?.quotationTitle ||
    serviceContext?.serviceTitle ||
    verifyData?.service?.serviceTitle ||
    params.stage ||
    params.service ||
    client?.stageName ||
    client?.service ||
    'Terrace Waterproofing';
  const stageName = serviceTitle;

  // Payment Financial Information (Section 7)
  const balanceBefore =
    payment.balanceBefore !== undefined && payment.balanceBefore !== null
      ? Number(payment.balanceBefore)
      : verifyData?.balanceBefore !== undefined && verifyData.balanceBefore !== null
      ? Number(verifyData.balanceBefore)
      : null;

  const balanceAfter =
    payment.balanceAfter !== undefined && payment.balanceAfter !== null
      ? Number(payment.balanceAfter)
      : verifyData?.balanceAfter !== undefined && verifyData.balanceAfter !== null
      ? Number(verifyData.balanceAfter)
      : null;

  // Final payment & payment chain (Section 15 & 16)
  const isFinalPayment = Boolean(payment.isFinalPayment ?? verifyData?.isFinalPayment);
  const applyGst = payment.applyGst ?? verifyData?.applyGst ?? null;
  const previousPaymentId = payment.previousPaymentId ?? verifyData?.previousPaymentId ?? null;

  // Verification states & sequential guard (Section 9 & 10)
  const isVerified = Boolean(
    verification.isVerified ??
    payment.isVerified ??
    verifyData?.isVerified ??
    matchedPay?.isVerified ??
    client?.isVerified
  );
  const verifiedBy =
    verification.verifiedBy ||
    payment.verifiedBy ||
    verifyData?.verifiedBy ||
    matchedPay?.verifiedBy ||
    null;
  const verifiedAt =
    verification.verifiedAt ||
    payment.verifiedAt ||
    verifyData?.verifiedAt ||
    matchedPay?.verifiedAt ||
    null;
  const verifiedAtFormatted = verifiedAt ? formatDateDDMMYY(verifiedAt) : '';
  const currentVerificationNotes =
    verification.verificationNotes ||
    payment.verificationNotes ||
    verifyData?.verificationNotes ||
    '';
  const canVerify = verification.canVerify !== false;
  const blockingPaymentId = verification.blockingPaymentId || null;

  // Proof resolution (Section 8). The stored relative path (proofImage) comes first: it is resolved against the API
  // origin the app is really connected to. The server-built proofImageUrl can carry the wrong scheme or host on a live
  // server, so it is the fallback.
  const rawProofUri =
    proof.proofImage ||
    verifyData?.proofImage ||
    payment.proofImage ||
    matchedPay?.proofImage ||
    proof.proofImageUrl ||
    verifyData?.proofImageUrl ||
    payment.proofImageUrl ||
    matchedPay?.proofImageUrl ||
    params.proofImage ||
    params.docUri ||
    '';
  const docUri = resolveProofImageUrl(rawProofUri);
  const proofPreviewFailed = Boolean(docUri) && failedProofUri === docUri;
  const proofPreviewLoading = Boolean(docUri) && !proofPreviewFailed && loadedProofUri !== docUri;
  const docName = getProofFilename(rawProofUri, 'Payment_Proof.jpg');
  const fileType = proof.fileType || (rawProofUri?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const isPdf = Boolean(fileType?.toLowerCase().includes('pdf') || rawProofUri?.toLowerCase().endsWith('.pdf'));

  // Quotation Details (Section 12)
  const quotationTitle = quotation.quotationTitle || quotationContext?.quotationTitle || 'Quotation';
  const propertyName = quotation.propertyName || quotationContext?.propertyName || 'Property';
  const clientMobile = quotation.clientMobile || quotation.mobileNumber || quotationContext?.mobileNumber || client?.mobileNumber || '';
  const siteAddress = quotation.siteAddress || quotationContext?.siteAddress || client?.address || '';
  const quoteIdDisplay = quotation.quotationId || quotationContext?.quotationId || quotationId || '';
  const isConfirmed = quotation.isConfirmed ?? quotationContext?.isConfirmed ?? true;

  // Quotation Financial Summary (Section 13)
  const subTotal = pricing.subTotal !== undefined ? pricing.subTotal : quotationContext?.pricing?.subTotal ?? quotationContext?.totalWithGst ?? null;
  const grandTotal = pricing.grandTotal !== undefined ? pricing.grandTotal : quotationContext?.pricing?.grandTotal ?? null;
  const totalPaid = progress.totalPaid !== undefined ? progress.totalPaid : quotationContext?.progress?.totalPaid ?? quotationContext?.totalPaid ?? null;
  const balanceAmount = progress.balanceAmount !== undefined ? progress.balanceAmount : quotationContext?.progress?.balanceAmount ?? quotationContext?.balanceAmount ?? null;
  const paymentStatus = progress.paymentStatus || quotationContext?.progress?.paymentStatus || quotation.paymentStatus || null;

  // GST Information (Section 14)
  const gstDecision = quotation.gstDecision || quotationContext?.gstDecision || '';
  const customerGstNumber = quotation.customerGstNumber || quotationContext?.customerGstNumber || null;

  const handleCopyText = async (text, fieldName = 'voucher') => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // ignore
    }
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenDocument = async () => {
    if (!docUri) return;
    // A PDF, or an image the app could not load itself, opens in the browser
    if (isPdf || proofPreviewFailed) {
      try {
        await WebBrowser.openBrowserAsync(docUri);
      } catch {
        Linking.openURL(docUri).catch(() => {});
      }
    } else {
      setShowImageModal(true);
    }
  };

  const handleApprove = () => {
    if (!isAdmin) {
      setAlertModal({
        visible: true,
        type: 'error',
        title: 'Admin Authorization Required',
        message: 'Only Admin users are authorized to verify payments.',
      });
      return;
    }

    if (!canVerify) {
      setAlertModal({
        visible: true,
        type: 'lock',
        title: 'Sequential Verification Guard',
        message: blockingPaymentId
          ? `This payment cannot be verified yet because Payment #${blockingPaymentId} must be verified first.\n\nPer sequential verification rules, all prior payments on this quotation must be verified in order.`
          : 'All earlier payments on this quotation must be verified by Admin in sequential order.',
      });
      return;
    }

    setVerifyModalVisible(true);
  };

  const confirmApprovePayment = async (notesParam) => {
    const finalNotes = notesParam || verificationNotes || 'Amount credited and verified';
    const appId = client?.id || params.id;
    const quoteId =
      quotation.quotationId ||
      quotationContext?.quotationId ||
      quotationId ||
      params.quotationId ||
      verifyData?.quotation?.quotationId ||
      client?.confirmedQuoteId ||
      client?.activeQuotationId;
    const targetPayId =
      paymentId ||
      matchedPay?.id ||
      matchedFromPayView?.payment?.id ||
      params.paymentId ||
      params.milestone;

    if (!targetPayId) {
      setAlertModal({
        visible: true,
        type: 'error',
        title: 'Missing Payment ID',
        message: 'Payment ID is required to verify this payment.',
      });
      return;
    }

    setIsSubmittingApprove(true);
    try {
      let res = null;
      if (quoteId) {
        res = await quotationPaymentRepository.verifyPayment(
          String(quoteId),
          String(targetPayId),
          finalNotes
        );
      } else {
        res = await paymentRepository.verifyPayment(
          null,
          String(targetPayId),
          finalNotes
        );
      }

      if (!res?.success) {
        setIsSubmittingApprove(false);
        setVerifyModalVisible(false);
        setAlertModal({
          visible: true,
          type: 'error',
          title: 'Verification Failed',
          message: res?.message || 'Could not verify payment. Please try again.',
        });
        return;
      }

      // Refresh verify-view data from backend (Section 17)
      if (quoteId) {
        const refreshed = await quotationPaymentRepository.getPaymentVerifyView(
          String(quoteId),
          String(targetPayId)
        );
        if (refreshed?.success && refreshed.data) {
          setVerifyData(refreshed.data);
          if (refreshed.data.verification?.verificationNotes) {
            setVerificationNotes(refreshed.data.verification.verificationNotes);
          }
        } else {
          setVerifyData((prev) => ({
            ...prev,
            isVerified: true,
            verification: {
              ...(prev?.verification || {}),
              isVerified: true,
              verifiedBy: currentUser?.name || 'Admin',
              verifiedAt: new Date().toISOString(),
              verificationNotes: finalNotes,
              canVerify: false,
            },
          }));
        }
      }

      // Sync appointment fields if appointment id exists
      if (appId) {
        appointmentRepository
          .updateAppointment(appId, {
            isVerified: true,
            verificationStatus: 'approved',
          })
          .catch(() => {});
      }

      setVerifyModalVisible(false);
      setIsSubmittingApprove(false);

      setSuccessData({
        title: 'Payment Verified!',
        message: `The payment of ₹${paymentAmt.toLocaleString()} has been verified and recorded by Admin.`,
        badge: voucherCode || String(targetPayId) || 'VERIFIED',
        appId: appId,
      });
      setSuccessModalVisible(true);
    } catch (err) {
      setIsSubmittingApprove(false);
      setVerifyModalVisible(false);
      const is403 = err?.response?.status === 403;
      const is404 = err?.response?.status === 404;
      setAlertModal({
        visible: true,
        type: 'error',
        title: is403 ? 'Unauthorized' : is404 ? 'Not Found' : 'Error',
        message: is403
          ? 'You do not have administrative permission to verify payments.'
          : is404
          ? 'The payment or quotation record could not be found.'
          : err?.message || 'Failed to verify payment.',
      });
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteModalVisible(true);
  };

  const confirmDeletePayment = async () => {
    const appId = client?.id || params.id;
    const quoteId =
      params.quotationId ||
      verifyData?.quotation?.quotationId ||
      payView?.id ||
      payView?.quotationId ||
      client?.confirmedQuoteId ||
      client?.activeQuotationId;
    const payId = paymentId || matchedFromPayView?.payment?.id || params.paymentId || params.milestone;

    // Rule 14 & 16: Receipt Lock Protection - Payments cannot be deleted if final receipt is locked
    if (payView?.isReceiptLocked || client?.isReceiptLocked) {
      setDeleteModalVisible(false);
      Alert.alert(
        'Quotation Locked',
        'Payments cannot be deleted because an official final receipt has already been generated and locked for this quotation.'
      );
      return;
    }

    setIsDeletingPayment(true);
    try {
      const isGstPayment = Boolean(
        params.isGst === 'true' ||
        params.stage === 'GST Tax Clearance' ||
        params.serviceTitle === 'GST Tax Clearance' ||
        serviceContext?.serviceTitle === 'GST Tax Clearance' ||
        stageName === 'GST Tax Clearance' ||
        String(payId).startsWith('gst_') ||
        matchedFromPayView?.type === 'gst'
      );

      const isFinal = Boolean(
        stageName.toLowerCase().includes('final') ||
        params.milestone?.toLowerCase().includes('final') ||
        (!isGstPayment && client?.finalPaid)
      );

      const isMid = Boolean(
        stageName.toLowerCase().includes('mid') ||
        params.milestone?.toLowerCase().includes('mid')
      );

      const isInitial = Boolean(
        stageName.toLowerCase().includes('initial') ||
        stageName.toLowerCase().includes('advance') ||
        params.milestone?.toLowerCase().includes('initial')
      );

      // 1. Delete from backend API using new quotation-payments endpoint
      if (payId && quoteId) {
        const delRes = await quotationPaymentRepository.deletePayment(String(quoteId), String(payId));
        if (!delRes?.success) {
          setIsDeletingPayment(false);
          setDeleteModalVisible(false);
          Alert.alert('Cannot Delete Payment', delRes?.message || 'Failed to delete payment from server.');
          return;
        }
      } else if (payId) {
        // Fallback to legacy delete if no quoteId
        const delRes = await paymentRepository.deletePayment(payId, quoteId ? String(quoteId) : null);
        if (!delRes?.success) {
          setIsDeletingPayment(false);
          setDeleteModalVisible(false);
          Alert.alert('Cannot Delete Payment', delRes?.message || 'Failed to delete payment from server.');
          return;
        }
      }

      // 2. Revert/reset corresponding payment fields on appointment
      if (appId) {
        const resetFields = {};
        if (isGstPayment) {
          resetFields.hasGst = false;
          resetFields.gstPaid = false;
          resetFields.gstPaidDetails = null;
          resetFields.gstVerificationStatus = null;
        } else if (isFinal) {
          resetFields.finalPaid = false;
          resetFields.fullPaid = false;
          resetFields.finalPaidAmount = 0;
          resetFields.finalPaidDetails = null;
          resetFields.isVerified = false;
          resetFields.verificationStatus = null;
        } else if (isMid) {
          resetFields.midTermPaid = false;
          resetFields.midTermPaidAmount = 0;
          resetFields.midTermPaidDetails = null;
        } else if (isInitial) {
          resetFields.initialPaid = false;
          resetFields.initialPaidAmount = 0;
          resetFields.initialPaidDetails = null;
        } else {
          // Fallback reset for milestone
          resetFields.finalPaid = false;
          resetFields.fullPaid = false;
          resetFields.finalPaidAmount = 0;
          resetFields.finalPaidDetails = null;
          resetFields.isVerified = false;
          resetFields.verificationStatus = null;
        }

        await appointmentRepository.updateAppointment(appId, resetFields).catch(() => {});
      }

      setDeleteModalVisible(false);

      Alert.alert(
        'Payment Deleted',
        `The payment record #${voucherCode || payId || 'N/A'} of ₹${paymentAmt.toLocaleString()} has been removed.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (appId) {
                router.replace({
                  pathname: '/customer-detail',
                  params: { id: appId, initialTab: 'payments' },
                });
              } else {
                router.back();
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to delete payment');
    } finally {
      setIsDeletingPayment(false);
    }
  };


  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Verification</Text>
        <View style={styles.headerRightContainer} />

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
      >
        {/* Loading Indicator for verify-view fetch */}
        {isLoadingVerify && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#1E488F" />
            <Text style={styles.loadingBannerText}>Fetching backend verification details & proof...</Text>
          </View>
        )}

        {/* Status & Amount Banner */}
        <View
          style={[
            styles.statusBanner,
            isDark && styles.statusBannerDark,
            isVerified && styles.statusBannerVerified,
          ]}
        >
          {/* Top Header: Service Title & Verified Badge */}
          <View style={styles.bannerHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.bannerTitle, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                {serviceTitle}
              </Text>
            </View>
            {isVerified && (
              <View style={[styles.pendingBadge, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' }]}>
                <Text style={[styles.pendingBadgeText, { color: '#065F46' }]}>✓ Verified & Approved</Text>
              </View>
            )}
          </View>

          {/* Payment Amount */}
          <View style={styles.bannerAmountRow}>
            <View>
              <Text style={[styles.amountLabel, isVerified && { color: '#065F46' }, isDark && { color: '#FCD34D' }]}>
                Payment Amount
              </Text>
              <Text style={[styles.amountValue, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                ₹{paymentAmt.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Key Details Section */}
          <View style={[styles.bannerDetailsBox, isVerified && styles.bannerDetailsBoxVerified, isDark && styles.bannerDetailsBoxDark]}>
            {/* Payment ID */}
            {Boolean(displayPaymentId) && (
              <TouchableOpacity
                style={styles.bannerDetailRow}
                onPress={() => handleCopyText(String(displayPaymentId), 'paymentId')}
                activeOpacity={0.7}
              >
                <View style={styles.bannerDetailLabelCol}>
                  <Ionicons name="receipt-outline" size={14} color={isVerified ? "#059669" : "#B45309"} style={{ marginRight: 6 }} />
                  <Text style={[styles.bannerDetailLabel, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>Payment ID</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                  <Text
                    style={[styles.bannerDetailValueMono, isVerified && { color: '#065F46' }, isDark && { color: '#FCD34D' }]}
                  >
                    #{displayPaymentId}
                  </Text>
                  <Ionicons
                    name={copiedField === 'paymentId' ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={copiedField === 'paymentId' ? '#16A34A' : isVerified ? '#059669' : '#92400E'}
                    style={{ marginLeft: 6 }}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Submitted by */}
            <View style={styles.bannerDetailRow}>
              <View style={styles.bannerDetailLabelCol}>
                <Ionicons
                  name={isVerified ? "shield-checkmark-outline" : "person-circle-outline"}
                  size={15}
                  color={isVerified ? "#059669" : "#B45309"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.bannerDetailLabel, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                  {isVerified && verifiedBy ? 'Verified by' : 'Submitted by'}
                </Text>
              </View>
              <Text style={[styles.bannerDetailValue, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                {isVerified && verifiedBy ? verifiedBy : collectorName}
              </Text>
            </View>

            {/* Date */}
            {Boolean(collectedDate) && (
              <View style={[styles.bannerDetailRow, { borderBottomWidth: 0 }]}>
                <View style={styles.bannerDetailLabelCol}>
                  <Ionicons name="calendar-outline" size={14} color={isVerified ? "#059669" : "#B45309"} style={{ marginRight: 6 }} />
                  <Text style={[styles.bannerDetailLabel, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                    {isVerified && verifiedAt ? 'Verified Date' : 'Date'}
                  </Text>
                </View>
                <Text style={[styles.bannerDetailValue, isVerified && { color: '#065F46' }, isDark && styles.textDark]}>
                  {collectedDate}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sequential Verification Guard Warning (Section 9) */}
        {!isVerified && !canVerify && (
          <View style={styles.guardWarningBox}>
            <Ionicons name="warning" size={20} color="#DC2626" style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guardWarningTitle}>Sequential Verification Guard</Text>
              <Text style={styles.guardWarningText}>
                {blockingPaymentId
                  ? `This payment cannot be verified yet because Payment #${blockingPaymentId} must be verified first.`
                  : 'An earlier payment on this quotation has not been verified yet. Per sequential verification rules, all prior payments must be verified in order.'}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Specifications Card (Section 5 & 6) */}
        <View style={[styles.specCard, isDark && styles.specCardDark]}>
          <Text style={styles.specSectionTitle}>PAYMENT SPECIFICATIONS</Text>

          {/* Payment ID */}
          {Boolean(displayPaymentId) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Payment ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                  #{displayPaymentId}
                </Text>
                <TouchableOpacity
                  onPress={() => handleCopyText(String(displayPaymentId), 'paymentId')}
                  style={{ marginLeft: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={copiedField === 'paymentId' ? 'checkmark-circle' : 'copy-outline'}
                    size={15}
                    color={copiedField === 'paymentId' ? '#16A34A' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Amount */}
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Amount</Text>
            <Text style={[styles.specValue, { color: isDark ? '#4ADE80' : '#15803D', fontWeight: '800', fontSize: 14 }]}>
              ₹{paymentAmt.toLocaleString()}
            </Text>
          </View>

          {/* Payment Method */}
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Payment Method</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={
                  isCash
                    ? 'cash-outline'
                    : isUpi
                    ? 'qr-code-outline'
                    : 'card-outline'
                }
                size={16}
                color={isCash ? '#16A34A' : isUpi ? '#2563EB' : '#8B5CF6'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.specValue, isDark && styles.textDark]}>{paymentMethod || 'CASH'}</Text>
            </View>
          </View>

          {/* Method Specific Details (Section 6) */}
          {/* CASH: Voucher Number */}
          {isCash && Boolean(voucherCode) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Voucher</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.voucherPill}>
                  <Text style={styles.voucherPillText}>{voucherCode}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopyText(voucherCode, 'voucher')}
                  style={{ marginLeft: 8 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={copiedField === 'voucher' ? 'checkmark-circle' : 'copy-outline'}
                    size={16}
                    color={copiedField === 'voucher' ? '#16A34A' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* UPI: UPI ID & Reference Number */}
          {isUpi && (
            <>
              {Boolean(upiId) && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>UPI ID</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.voucherPill}>
                      <Text style={styles.voucherPillText}>{upiId}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCopyText(upiId, 'upi')}
                      style={{ marginLeft: 8 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={copiedField === 'upi' ? 'checkmark-circle' : 'copy-outline'}
                        size={16}
                        color={copiedField === 'upi' ? '#16A34A' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {Boolean(referenceNumber) && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Reference Number</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.specValueMono, isDark && styles.textDark]}>{referenceNumber}</Text>
                    <TouchableOpacity
                      onPress={() => handleCopyText(referenceNumber, 'ref')}
                      style={{ marginLeft: 8 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={copiedField === 'ref' ? 'checkmark-circle' : 'copy-outline'}
                        size={16}
                        color={copiedField === 'ref' ? '#16A34A' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ACCOUNT: Bank & Account details */}
          {isAccount && (
            <>
              {bankDetails && typeof bankDetails === 'object' ? (
                <>
                  {Boolean(bankDetails.accountName || bankDetails.name || bankDetails.beneficiary) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Account Name</Text>
                      <Text style={[styles.specValue, isDark && styles.textDark]}>
                        {bankDetails.accountName || bankDetails.name || bankDetails.beneficiary}
                      </Text>
                    </View>
                  )}
                  {Boolean(bankDetails.bankName) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Bank Name</Text>
                      <Text style={[styles.specValue, isDark && styles.textDark]}>
                        {bankDetails.bankName}
                      </Text>
                    </View>
                  )}
                  {Boolean(bankDetails.accountNumber) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Account Number</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                          {bankDetails.accountNumber}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopyText(String(bankDetails.accountNumber), 'account')}
                          style={{ marginLeft: 6 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name={copiedField === 'account' ? 'checkmark-circle' : 'copy-outline'}
                            size={15}
                            color={copiedField === 'account' ? '#16A34A' : '#64748B'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {Boolean(bankDetails.ifscCode || bankDetails.ifsc) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>IFSC Code</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                          {bankDetails.ifscCode || bankDetails.ifsc}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopyText(String(bankDetails.ifscCode || bankDetails.ifsc), 'ifsc')}
                          style={{ marginLeft: 6 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name={copiedField === 'ifsc' ? 'checkmark-circle' : 'copy-outline'}
                            size={15}
                            color={copiedField === 'ifsc' ? '#16A34A' : '#64748B'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {Boolean(bankDetails.branchName || bankDetails.branch) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Branch Name</Text>
                      <Text style={[styles.specValue, isDark && styles.textDark]}>
                        {bankDetails.branchName || bankDetails.branch}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                Boolean(bankDetails) && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Account Details</Text>
                    <Text style={[styles.specValue, isDark && styles.textDark]}>
                      {String(bankDetails)}
                    </Text>
                  </View>
                )
              )}
              {Boolean(referenceNumber) && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Reference Number</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.specValueMono, isDark && styles.textDark]}>{referenceNumber}</Text>
                    <TouchableOpacity
                      onPress={() => handleCopyText(referenceNumber, 'ref')}
                      style={{ marginLeft: 8 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={copiedField === 'ref' ? 'checkmark-circle' : 'copy-outline'}
                        size={16}
                        color={copiedField === 'ref' ? '#16A34A' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Payment Date */}
          {Boolean(collectedDate) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Payment Date</Text>
              <Text style={[styles.specValue, isDark && styles.textDark]}>{collectedDate}</Text>
            </View>
          )}

          {/* Reference Number if not UPI/Account */}
          {!isUpi && !isAccount && Boolean(referenceNumber) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Reference Number</Text>
              <Text style={[styles.specValueMono, isDark && styles.textDark]}>{referenceNumber}</Text>
            </View>
          )}

          {/* Received By */}
          {Boolean(collectorName) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Received By</Text>
              <Text style={[styles.specValue, isDark && styles.textDark]}>{collectorName}</Text>
            </View>
          )}

          {/* Notes */}
          {Boolean(notes) && (
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Notes</Text>
              <Text style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}>
                {notes}
              </Text>
            </View>
          )}

          {/* Created At */}
          {Boolean(createdAtFormatted) && (
            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Created At</Text>
              <Text style={[styles.specValue, isDark && styles.textDark]}>{createdAtFormatted}</Text>
            </View>
          )}
        </View>

        {/* Payment Financial Information Card (Section 7) */}
        {(balanceBefore !== null || balanceAfter !== null) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>PAYMENT FINANCIAL INFORMATION</Text>

            {balanceBefore !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Balance Before</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  ₹{balanceBefore.toLocaleString()}
                </Text>
              </View>
            )}

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Payment Amount</Text>
              <Text style={[styles.specValue, { color: '#16A34A', fontWeight: '800' }]}>
                ₹{paymentAmt.toLocaleString()}
              </Text>
            </View>

            {balanceAfter !== null && (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Balance After</Text>
                <Text
                  style={[
                    styles.specValue,
                    { color: balanceAfter > 0 ? '#B45309' : '#16A34A', fontWeight: '800' },
                  ]}
                >
                  ₹{balanceAfter.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quotation Details Card (Section 12) */}
        {Boolean(quotationContext) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>QUOTATION DETAILS</Text>

            {Boolean(quotationTitle) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Quotation Title</Text>
                <Text
                  style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}
                  numberOfLines={2}
                >
                  {quotationTitle}
                </Text>
              </View>
            )}

            {Boolean(propertyName) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Property</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  {propertyName}
                </Text>
              </View>
            )}

            {Boolean(displayName) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Customer</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  {displayName}
                </Text>
              </View>
            )}

            {Boolean(clientMobile) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Mobile</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  {clientMobile}
                </Text>
              </View>
            )}

            {Boolean(siteAddress) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Site Address</Text>
                <Text
                  style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}
                  numberOfLines={2}
                >
                  {siteAddress}
                </Text>
              </View>
            )}

            {Boolean(quoteIdDisplay) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Quotation ID</Text>
                <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                  #{quoteIdDisplay}
                </Text>
              </View>
            )}

            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Confirmation Status</Text>
              <View style={[styles.statusTag, isConfirmed ? styles.statusTagConfirmed : styles.statusTagPending]}>
                <Text style={[styles.statusTagText, isConfirmed ? styles.statusTagTextConfirmed : styles.statusTagTextPending]}>
                  {isConfirmed ? '✓ Confirmed' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quotation Financial Summary Card (Section 13) */}
        {(subTotal !== null || grandTotal !== null || totalPaid !== null) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>QUOTATION FINANCIAL SUMMARY</Text>

            {subTotal !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Subtotal</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  ₹{Number(subTotal).toLocaleString()}
                </Text>
              </View>
            )}

            {grandTotal !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>{pricing?.gst ? 'Total Payable (incl. GST)' : 'Total Payable'}</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  ₹{Number(grandTotal).toLocaleString()}
                </Text>
              </View>
            )}

            {totalPaid !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Total Paid</Text>
                <Text style={[styles.specValue, { color: '#16A34A', fontWeight: '800' }]}>
                  ₹{Number(totalPaid).toLocaleString()}
                </Text>
              </View>
            )}

            {balanceAmount !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Balance</Text>
                <Text
                  style={[
                    styles.specValue,
                    { color: balanceAmount > 0 ? '#B45309' : '#16A34A', fontWeight: '800' },
                  ]}
                >
                  ₹{Number(balanceAmount).toLocaleString()}
                </Text>
              </View>
            )}

            {Boolean(paymentStatus) && (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Payment Status</Text>
                <Text
                  style={[
                    styles.specValue,
                    {
                      fontWeight: '800',
                      color: paymentStatus === 'FULLY_PAID' ? '#16A34A' : '#2563EB',
                    },
                  ]}
                >
                  {paymentStatus.replace(/_/g, ' ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* GST Information Card (Section 14) */}
        {Boolean(quotationContext) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>GST INFORMATION</Text>

            <View style={[styles.specRow, !customerGstNumber && { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>GST Status</Text>
              <Text style={[styles.specValue, isDark && styles.textDark, { fontWeight: '700' }]}>
                {gstDecision === 'APPLIED'
                  ? 'GST Applied (Tax invoice)'
                  : gstDecision === 'OPTED_OUT'
                  ? 'No GST (Cash bill)'
                  : '—'}
              </Text>
            </View>

            {gstDecision === 'APPLIED' && Boolean(customerGstNumber) && (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Customer GSTIN</Text>
                <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                  {customerGstNumber}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Final Payment & Payment Chain Information (Section 15 & 16) */}
        {(isFinalPayment || previousPaymentId) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>PAYMENT SETTLEMENT & AUDIT CHAIN</Text>

            {isFinalPayment && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Settlement Type</Text>
                <View style={[styles.statusTag, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[styles.statusTagText, { color: '#B45309' }]}>
                    FINAL PAYMENT
                  </Text>
                </View>
              </View>
            )}

            {isFinalPayment && applyGst !== null && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>GST Final Treatment</Text>
                <Text style={[styles.specValue, isDark && styles.textDark, { fontWeight: '700' }]}>
                  {applyGst ? 'Final Payment — GST Applied' : 'Final Payment — GST Not Applied'}
                </Text>
              </View>
            )}

            {Boolean(previousPaymentId) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Previous Payment</Text>
                <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                  #{previousPaymentId}
                </Text>
              </View>
            )}

            {Boolean(paymentId) && (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Current Payment</Text>
                <Text style={[styles.specValueMono, isDark && styles.textDark]}>
                  #{paymentId}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Verification Status & Notes Card (Section 9 & 11) */}
        {isVerified ? (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>VERIFICATION RECORD</Text>

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Verification Status</Text>
              <View style={[styles.statusTag, styles.statusTagConfirmed]}>
                <Text style={[styles.statusTagText, styles.statusTagTextConfirmed]}>
                  ✓ Verified
                </Text>
              </View>
            </View>

            {Boolean(verifiedBy) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Verified By</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>{verifiedBy}</Text>
              </View>
            )}

            {Boolean(verifiedAtFormatted || verifiedAt) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Verified At</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  {verifiedAtFormatted || verifiedAt}
                </Text>
              </View>
            )}

            {Boolean(currentVerificationNotes) && (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.specLabel}>Verification Notes</Text>
                <Text
                  style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}
                >
                  {currentVerificationNotes}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>VERIFICATION NOTES</Text>
            <Text style={[styles.specLabel, { marginBottom: 8, marginTop: 4 }]}>
              Official verification note (will be attached to payment approval):
            </Text>
            <TextInput
              style={[
                styles.notesInputScreen,
                isDark ? styles.notesInputScreenDark : styles.notesInputScreenLight,
              ]}
              placeholder="e.g. Amount credited and verified"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={verificationNotes}
              onChangeText={setVerificationNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Attached Proof Document Card (Section 8) */}
        <View style={styles.attachmentSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.attachmentHeading, isDark && styles.textDark]}>Payment Attachment & Proof</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{docUri ? '1' : '0'}</Text>
              </View>
            </View>
            {Boolean(docUri) && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                <Text style={styles.signedBadgeText}>Uploaded Proof</Text>
              </View>
            )}
          </View>

          {Boolean(docUri) ? (
            <View style={[styles.docPreviewCard, isDark && styles.docPreviewCardDark]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.pdfIconBox, isPdf && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                  <Ionicons name={isPdf ? "document-text" : "image"} size={24} color={isPdf ? "#DC2626" : "#E11D48"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docFilename, isDark && styles.textDark]} numberOfLines={1}>
                    {docName}
                  </Text>
                  <Text style={styles.docFilesize}>
                    {isPdf ? 'PDF Payment Proof Document' : 'Payment Proof Image'}
                  </Text>
                </View>
              </View>

              {!isPdf && (
                <TouchableOpacity
                  onPress={handleOpenDocument}
                  activeOpacity={0.85}
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  }}
                >
                  <ProofImagePreview
                    key={docUri}
                    uri={docUri}
                    isDark={isDark}
                    onLoaded={() => setLoadedProofUri(docUri)}
                    onFailed={() => setFailedProofUri(docUri)}
                  />
                  {!proofPreviewLoading && !proofPreviewFailed && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>Tap to Enlarge</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.docActionRow}>
                <TouchableOpacity
                  style={styles.docActionBtn}
                  onPress={handleOpenDocument}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPdf ? "open-outline" : "eye-outline"}
                    size={16}
                    color="#1E488F"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.docActionBtnText}>
                    {isPdf ? 'Open PDF Document' : 'View Full Image'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.docPreviewCard, isDark && styles.docPreviewCardDark, { paddingVertical: 18, alignItems: 'center' }]}>
              <Ionicons name="document-outline" size={28} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 13, textAlign: 'center' }}>
                No payment proof document found in backend records.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={[styles.bottomBar, isDark && styles.bottomBarDark, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        <TouchableOpacity
          style={[styles.deleteBtn, isDark && styles.deleteBtnDark]}
          onPress={handleDeleteClick}
          disabled={isDeletingPayment || isSubmittingApprove}
          activeOpacity={0.8}
        >
          {isDeletingPayment ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>

        {isVerified ? (
          <TouchableOpacity
            style={[styles.approveBtn, { backgroundColor: '#1E488F' }]}
            onPress={() => {
              const appId = client?.id || params.id;
              router.replace({
                pathname: '/customer-detail',
                params: { id: appId, initialTab: 'payments' },
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.approveBtnText}>Return to Customer Detail</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.approveBtn,
              (!canVerify || !isAdmin || isSubmittingApprove || isDeletingPayment) && { opacity: 0.6, backgroundColor: '#94A3B8' },
            ]}
            disabled={!canVerify || !isAdmin || isSubmittingApprove || isDeletingPayment}
            onPress={handleApprove}
            activeOpacity={0.85}
          >
            {isSubmittingApprove ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={canVerify && isAdmin ? '#34D399' : '#FFFFFF'}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.approveBtnText}>
                  {!isAdmin ? 'Admin Only' : !canVerify ? 'Verification Blocked' : 'Verify Payment'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Designed Verify Payment Confirmation Modal */}
      <VerifyPaymentModal
        visible={verifyModalVisible}
        amount={paymentAmt}
        clientName={displayName}
        stage={stageName || serviceContext?.serviceTitle}
        paymentMethod={paymentMethod}
        voucher={voucherCode || displayPaymentId}
        verificationNotes={verificationNotes}
        onChangeVerificationNotes={setVerificationNotes}
        isSubmitting={isSubmittingApprove}
        onConfirm={confirmApprovePayment}
        onCancel={() => setVerifyModalVisible(false)}
      />

      {/* Custom Success Alert Modal */}
      <MaterialSuccessModal
        visible={successModalVisible}
        title={successData.title}
        message={successData.message}
        badgeText={successData.badge}
        buttonText="View Customer Detail"
        onClose={() => {
          setSuccessModalVisible(false);
          router.replace({
            pathname: '/customer-detail',
            params: { id: successData.appId, initialTab: 'payments' },
          });
        }}
      />

      {/* Custom Notice / Error Alert Modal */}
      <MaterialAlertModal
        visible={alertModal.visible}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        buttonText="Got It"
        onClose={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* Material Delete Confirmation Modal */}
      <MaterialDeleteModal
        visible={deleteModalVisible}
        title="Delete Payment Record?"
        message={`Are you sure you want to delete this payment of ₹${paymentAmt.toLocaleString()} \n This action cannot be undone and will remove the transaction record.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDeleting={isDeletingPayment}
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeleteModalVisible(false)}
      />

      {/* Full-Screen Reference Image Viewer Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setShowImageModal(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          {Boolean(docUri) && (
            <Image
              source={{ uri: docUri }}
              style={styles.fullPreviewImage}
              resizeMode="contain"
              resizeMethod="resize"
            />
          )}
          <View style={styles.previewCaptionBox}>
            <Text style={styles.previewCaptionText}>{docName}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  textDark: {
    color: '#FFFFFF',
  },
  header: {
    backgroundColor: '#21498B',
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRightBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerRightBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  scrollContent: {
    padding: 16,
  },
  loadingBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBannerText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  statusBannerDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  statusBannerVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
  },
  bannerAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  gstBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gstBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  bannerDetailsBox: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    gap: 8,
  },
  bannerDetailsBoxVerified: {
    borderTopColor: '#A7F3D0',
  },
  bannerDetailsBoxDark: {
    borderTopColor: '#334155',
  },
  bannerDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  bannerDetailLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  bannerDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
  },
  bannerDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  bannerDetailValueMono: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    textAlign: 'right',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pendingBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  guardWarningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guardWarningTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  guardWarningText: {
    color: '#B91C1C',
    fontSize: 11,
    lineHeight: 16,
  },
  specCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  specCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  specSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  voucherPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voucherPillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bankSpecSubText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  attachmentSection: {
    marginBottom: 16,
  },
  attachmentHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  countBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  signedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  docPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
  },
  docPreviewCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  pdfIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docFilename: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  docFilesize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  docActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docActionBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E488F',
  },
  noticeBox: {
    backgroundColor: 'rgba(239, 246, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeText: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
  },
  bottomBarDark: {
    backgroundColor: '#1E293B',
    borderTopColor: '#334155',
  },
  approveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '100%',
    height: '75%',
  },
  previewCaptionBox: {
    marginTop: 16,
    alignItems: 'center',
  },
  previewCaptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSubCaptionText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  specValueMono: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagConfirmed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusTagPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTagTextConfirmed: {
    color: '#065F46',
  },
  statusTagTextPending: {
    color: '#92400E',
  },
  notesInputScreen: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  notesInputScreenLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    color: '#0F172A',
  },
  notesInputScreenDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
});
