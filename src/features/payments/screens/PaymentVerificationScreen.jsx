import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { paymentRepository } from '../api/paymentRepository';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { resolveProofImageUrl, getProofFilename } from '../../../core/utils/imageUtils';
import { MaterialDeleteModal } from '../../../shared/components/material';

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

  const [copiedField, setCopiedField] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

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

  // Fetch API v2 Single Payment Verification View (Section 9)
  useEffect(() => {
    const paymentId = params.paymentId || params.milestone;
    if (!paymentId) return;

    let isMounted = true;
    paymentRepository
      .getPaymentVerifyView(paymentId, quotationId ? String(quotationId) : null)
      .then((res) => {
        if (isMounted && res?.success && res.data) {
          setVerifyData(res.data);
        }
      })
      .catch((_err) => {})
      .finally(() => {
        if (isMounted) {
          setIsLoadingVerify(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [params.paymentId, params.milestone, quotationId]);

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

  // Quotation context resolution
  const quotationContext = (() => {
    if (verifyData?.quotation && Number(verifyData.quotation.totalWithGst || verifyData.quotation.totalAmount || 0) > 0) {
      return verifyData.quotation;
    }
    if (payView) {
      return {
        quotationId: payView.id || payView.quotationId || quotationId,
        quotationTitle: payView.title || `Quotation #${payView.id || quotationId}`,
        siteAddress:
          payView.propertyAddress ||
          payView.siteAddress ||
          payView.customer?.address ||
          payView.customer?.area ||
          client?.address ||
          '',
        clientName: payView.customer?.name || payView.clientName || client?.name || '',
        totalWithGst: payView.totalPrice || payView.totalWithGst || 0,
        totalPaid: payView.totalPaid || 0,
        balanceAmount: payView.balanceAmount || 0,
      };
    }
    return verifyData?.quotation || null;
  })();

  // Client and Appointment details
  const rawClientName =
    verifyData?.quotation?.clientName ||
    payView?.customer?.name ||
    client?.clientName ||
    client?.name ||
    client?.customerName ||
    params.clientName ||
    params.customerName ||
    '';
  const displayName = rawClientName.trim() ? `${rawClientName.trim()}` : '';
  const rawId = client?.id || params.id || '';
  const displayId = rawId ? `DR${rawId}` : '';

  // Payment specs
  const paymentId = verifyData?.paymentId || verifyData?.id || matchedPay?.id || params.paymentId || params.milestone || '';
  const voucherCode =
    verifyData?.voucher ||
    matchedPay?.voucher ||
    params.voucher ||
    params.voucherNumber ||
    params.voucherCode ||
    client?.finalPaidDetails?.transactionId ||
    client?.voucherNumber ||
    '';
  const paymentAmt = Number(
    verifyData?.amount !== undefined && verifyData.amount !== null
      ? verifyData.amount
      : matchedPay?.amount !== undefined && matchedPay.amount !== null
      ? matchedPay.amount
      : params.amount || client?.finalPaidAmount || client?.finalPaidDetails?.amount || client?.paymentAmount || 0
  );
  const stageName =
    serviceContext?.serviceTitle ||
    verifyData?.service?.serviceTitle ||
    params.stage ||
    params.paymentStage ||
    params.milestone ||
    client?.stageName ||
    client?.paymentStage ||
    (client?.finalPaid ? 'Final Payment' : '');
  const rawCollectedDate =
    verifyData?.paymentDate ||
    verifyData?.createdAt ||
    matchedPay?.createdAt ||
    matchedPay?.date ||
    params.date ||
    params.paymentDate ||
    client?.finalPaidDetails?.paymentDate ||
    client?.finalPaidDetails?.date ||
    '';
  const collectedDate = rawCollectedDate ? formatDateDDMMYY(rawCollectedDate) : '';
  const paymentMethod =
    verifyData?.paymentMethod ||
    matchedPay?.paymentMethod ||
    params.paymentMethod ||
    params.method ||
    params.mode ||
    client?.finalPaidDetails?.paymentMethod ||
    client?.finalPaidDetails?.method ||
    'CASH';

  const isUpi = Boolean(paymentMethod?.toLowerCase().includes('upi'));
  const isAccount = Boolean(
    paymentMethod?.toLowerCase().includes('account') ||
    paymentMethod?.toLowerCase().includes('bank') ||
    paymentMethod?.toLowerCase().includes('cheque')
  );
  const isCash = Boolean(
    paymentMethod?.toLowerCase().includes('cash') ||
    (!isUpi && !isAccount)
  );

  // UPI ID resolution
  const rawUpiId =
    verifyData?.upiId ||
    verifyData?.upiTransactionId ||
    matchedPay?.upiId ||
    params.upiId ||
    params.upiTransactionId ||
    params.transactionId ||
    client?.finalPaidDetails?.upiId ||
    client?.finalPaidDetails?.transactionId ||
    client?.upiId ||
    client?.transactionId ||
    '';
  const upiId = rawUpiId || (isUpi ? voucherCode : '');

  // Bank Account details resolution
  const rawAccount =
    verifyData?.account ||
    verifyData?.bankDetails ||
    verifyData?.bankAccount ||
    matchedPay?.bankDetails ||
    matchedPay?.bankAccount ||
    (Array.isArray(verifyData?.accounts) && verifyData?.accountId
      ? verifyData.accounts.find((a) => a.id === verifyData.accountId)
      : null) ||
    params.bankDetails ||
    params.bankAccount ||
    params.account ||
    client?.finalPaidDetails?.bankAccount ||
    client?.finalPaidDetails?.account ||
    client?.bankAccount ||
    null;

  let bankDetails = rawAccount;
  if (typeof rawAccount === 'string' && rawAccount.trim().startsWith('{')) {
    try {
      bankDetails = JSON.parse(rawAccount);
    } catch {
      bankDetails = rawAccount;
    }
  }
  const hasGst =
    params.hasGst === 'true' ||
    params.hasGst === true ||
    Boolean(client?.finalPaidDetails?.hasGst || client?.hasGst || verifyData?.quotation?.totalWithGst || payView?.withGst);
  const collectorName =
    verifyData?.receivedBy ||
    matchedPay?.receivedBy ||
    client?.employeeName ||
    params.collectorName ||
    params.receivedBy ||
    'Field Executive';

  const displayPaymentId =
    verifyData?.paymentId ||
    verifyData?.id ||
    matchedPay?.id ||
    params.paymentId ||
    params.milestone ||
    voucherCode ||
    (params.id ? `PAY-${params.id}` : '');

  const serviceTitle =
    serviceContext?.serviceTitle ||
    verifyData?.service?.serviceTitle ||
    stageName ||
    params.stage ||
    params.service ||
    client?.stageName ||
    client?.service ||
    'Terrace Waterproofing';

  // Verification states & sequential guard (Section 8 & 9)
  const isVerified = Boolean(
    verifyData?.verification?.isVerified ??
    verifyData?.isVerified ??
    matchedPay?.isVerified ??
    client?.isVerified
  );
  const verifiedBy =
    verifyData?.verification?.verifiedBy ||
    verifyData?.verifiedBy ||
    matchedPay?.verifiedBy ||
    null;
  const verifiedAt =
    verifyData?.verification?.verifiedAt ||
    verifyData?.verifiedAt ||
    matchedPay?.verifiedAt ||
    null;
  const canVerify = verifyData?.verification?.canVerify !== false;
  const blockingPaymentId = verifyData?.verification?.blockingPaymentId || null;

  // Proof Image URL resolution via imageUtils
  const rawProofUri =
    verifyData?.proofImageUrl ||
    verifyData?.proof?.proofImageUrl ||
    verifyData?.proofImage ||
    verifyData?.proof?.proofImage ||
    matchedPay?.proofImageUrl ||
    matchedPay?.proof?.proofImageUrl ||
    matchedPay?.proofImage ||
    matchedPay?.proof?.proofImage ||
    params.proofImage ||
    params.docUri ||
    client?.referenceImage ||
    client?.attachedDoc?.uri ||
    client?.finalPaidDetails?.documentUri ||
    client?.documentUri ||
    '';
  const docUri = resolveProofImageUrl(rawProofUri);
  const docName = getProofFilename(rawProofUri, 'Reference_Payment_Proof.jpg');

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

  const handleApprove = () => {
    if (!canVerify) {
      Alert.alert(
        'Sequential Verification Required',
        `An earlier payment (#${blockingPaymentId}) is unverified.\n\nAccording to API v2 verification rules, all prior payments on the quotation must be verified by Admin in sequential order.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Verify & Approve Payment',
      `Are you sure you want to approve the payment of ₹${paymentAmt.toLocaleString()} for ${displayName || 'this customer'}?\n\nThis will record Admin verification in the ledger and unlock receipt sharing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Verify',
          style: 'default',
          onPress: async () => {
            const appId = client?.id || params.id;
            const quoteId =
              params.quotationId ||
              verifyData?.quotation?.quotationId ||
              payView?.id ||
              payView?.quotationId ||
              client?.confirmedQuoteId ||
              client?.activeQuotationId;
            const payId = paymentId || matchedFromPayView?.payment?.id || params.paymentId || params.milestone;

            setIsSubmittingApprove(true);
            try {
              let targetPayId = payId || matchedFromPayView?.payment?.id;
              const isGstPayment = Boolean(
                params.isGst === 'true' ||
                params.stage === 'GST Tax Clearance' ||
                params.serviceTitle === 'GST Tax Clearance' ||
                serviceContext?.serviceTitle === 'GST Tax Clearance' ||
                stageName === 'GST Tax Clearance' ||
                String(targetPayId).startsWith('gst_') ||
                matchedFromPayView?.type === 'gst'
              );

              // API v2 verification: If it's a GST clearance, ensure backend has it recorded and verified
              if (isGstPayment && quoteId) {
                try {
                  const recRes = await paymentRepository.recordGstPayment(quoteId, {
                    amount: paymentAmt,
                    paymentMethod: paymentMethod || 'CASH',
                    voucher: voucherCode || 'GST-REC',
                    notes: 'GST clearance payment verified by Admin',
                  });
                  const newPayId =
                    recRes?.data?.payment?.id ||
                    recRes?.data?.gstPayment?.payments?.[0]?.id ||
                    recRes?.data?.gstPayments?.[0]?.id;
                  if (newPayId) {
                    targetPayId = newPayId;
                  }
                } catch (_e) {}
              }

              if (targetPayId) {
                const res = await paymentRepository.verifyPayment(
                  quoteId ? String(quoteId) : null,
                  targetPayId,
                  'Approved in verification screen'
                );
                if (!res?.success && !isGstPayment) {
                  Alert.alert('Verification Failed', res?.message || 'Could not verify payment. Please try again.');
                  setIsSubmittingApprove(false);
                  return;
                }
              }

              if (appId) {
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

                const updatePayload = {
                  isVerified: true,
                  verificationStatus: 'approved',
                };
                if (isGstPayment) {
                  updatePayload.hasGst = true;
                  updatePayload.gstPaid = true;
                  updatePayload.gstVerificationStatus = 'verified';
                  updatePayload.gstPaidDetails = {
                    amount: paymentAmt,
                    paymentMethod: paymentMethod || 'CASH',
                    transactionId: voucherCode || 'GST-REC',
                    verificationStatus: 'verified',
                    isVerified: true,
                    paymentDate: formatDateDDMMYY(new Date()),
                  };
                } else if (isFinal) {
                  updatePayload.finalPaid = true;
                  updatePayload.fullPaid = true;
                } else if (isMid) {
                  updatePayload.midTermPaid = true;
                } else if (isInitial) {
                  updatePayload.initialPaid = true;
                }

                await appointmentRepository
                  .updateAppointment(appId, updatePayload)
                  .catch(() => {});
              }

              Alert.alert(
                'Payment Verified Successfully! 🎉',
                `The transaction #${voucherCode || targetPayId || 'GST-REC'} of ₹${paymentAmt.toLocaleString()} has been verified and recorded by Admin.`,
                [
                  {
                    text: 'View Customer Detail',
                    onPress: () => {
                      router.replace({
                        pathname: '/customer-detail',
                        params: { id: appId, initialTab: 'payments' },
                      });
                    },
                  },
                ]
              );
            } catch (err) {
              Alert.alert('Error', err?.message || 'Failed to verify payment');
            } finally {
              setIsSubmittingApprove(false);
            }
          },
        },
      ]
    );
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

      // 1. Attempt deleting from backend API if payId exists (Rule 14 & 18)
      if (payId) {
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

        {/* Sequential Verification Guard Warning */}
        {!isVerified && !canVerify && (
          <View style={styles.guardWarningBox}>
            <Ionicons name="warning" size={20} color="#DC2626" style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guardWarningTitle}>Sequential Verification Guard</Text>
              <Text style={styles.guardWarningText}>
                An earlier payment {blockingPaymentId ? `(#${String(blockingPaymentId).slice(0, 8)}...)` : ''} on this quotation has not been verified yet. Per API v2 rules, payments must be verified in order.
              </Text>
            </View>
          </View>
        )}

        {/* Payment Specifications Card */}
        <View style={[styles.specCard, isDark && styles.specCardDark]}>
          <Text style={styles.specSectionTitle}>PAYMENT SPECIFICATIONS</Text>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Customer</Text>
            <Text style={[styles.specValue, isDark && styles.textDark]}>
              {displayName || 'N/A'}{Boolean(displayId) ? ` (${displayId})` : ''}
            </Text>
          </View>


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
              <Text style={[styles.specValue, isDark && styles.textDark]}>{paymentMethod || 'N/A'}</Text>
            </View>
          </View>

          {/* Conditional Method Details: UPI -> UPI ID, Account -> Bank Details, Cash -> Voucher Number */}
          {isUpi && (
            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>UPI ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.voucherPill}>
                  <Text style={styles.voucherPillText}>{upiId || 'N/A'}</Text>
                </View>
                {Boolean(upiId) && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(upiId, 'upi')}
                    style={{ marginLeft: 8 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={copiedField === 'upi' ? 'checkmark-circle' : 'copy-outline'}
                      size={18}
                      color={copiedField === 'upi' ? '#16A34A' : '#64748B'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {isAccount && (
            <View style={[styles.specRow, { alignItems: 'flex-start', borderBottomWidth: 0 }]}>
              <Text style={[styles.specLabel, { marginTop: 4 }]}>Bank Details</Text>
              <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 16 }}>
                {bankDetails ? (
                  typeof bankDetails === 'object' ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      {Boolean(bankDetails.bankName || bankDetails.name || bankDetails.accountName) && (
                        <Text style={[styles.specValue, { fontWeight: '700' }, isDark && styles.textDark]}>
                          {bankDetails.bankName || bankDetails.name || bankDetails.accountName}
                        </Text>
                      )}
                      {Boolean(bankDetails.accountNumber) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Text style={[styles.bankSpecSubText, isDark && { color: '#94A3B8' }]}>
                            A/C: {bankDetails.accountNumber}
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
                      )}
                      {Boolean(bankDetails.ifscCode || bankDetails.ifsc) && (
                        <Text style={[styles.bankSpecSubText, isDark && { color: '#94A3B8' }, { marginTop: 2 }]}>
                          IFSC: {bankDetails.ifscCode || bankDetails.ifsc}
                        </Text>
                      )}
                      {Boolean(bankDetails.branchName || bankDetails.branch) && (
                        <Text style={[styles.bankSpecSubText, isDark && { color: '#94A3B8' }, { marginTop: 2 }]}>
                          Branch: {bankDetails.branchName || bankDetails.branch}
                        </Text>
                      )}
                      {Boolean(bankDetails.beneficiary || bankDetails.beneficiaryName) && (
                        <Text style={[styles.bankSpecSubText, isDark && { color: '#94A3B8' }, { marginTop: 2 }]}>
                          Beneficiary: {bankDetails.beneficiary || bankDetails.beneficiaryName}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.voucherPill}>
                        <Text style={styles.voucherPillText}>{String(bankDetails)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCopyText(String(bankDetails), 'account')}
                        style={{ marginLeft: 8 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={copiedField === 'account' ? 'checkmark-circle' : 'copy-outline'}
                          size={18}
                          color={copiedField === 'account' ? '#16A34A' : '#64748B'}
                        />
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <Text style={[styles.specValue, isDark && styles.textDark]}>
                    {verifyData?.accountId ? `Account #${verifyData.accountId}` : 'N/A'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {isCash && (
            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Voucher Number</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.voucherPill}>
                  <Text style={styles.voucherPillText}>{voucherCode || 'N/A'}</Text>
                </View>
                {Boolean(voucherCode) && (
                  <TouchableOpacity
                    onPress={() => handleCopyText(voucherCode, 'voucher')}
                    style={{ marginLeft: 8 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={copiedField === 'voucher' ? 'checkmark-circle' : 'copy-outline'}
                      size={18}
                      color={copiedField === 'voucher' ? '#16A34A' : '#64748B'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Service Context Card (From API v2 Section 9) */}
        {Boolean(serviceContext) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>SERVICE CONTEXT</Text>

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Service</Text>
              <Text style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}>
                {serviceContext.serviceTitle}
              </Text>
            </View>

            {serviceContext.sqft != null && Number(serviceContext.sqft) > 0 && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Area / Rate</Text>
                <Text style={[styles.specValue, isDark && styles.textDark]}>
                  {serviceContext.sqft} sq.ft @ ₹{serviceContext.rate || 0}/sq.ft
                </Text>
              </View>
            )}

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Total Service Price</Text>
              <Text style={[styles.specValue, isDark && styles.textDark]}>
                ₹{Number(serviceContext.totalPrice || 0).toLocaleString()}
              </Text>
            </View>

            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Balance After Payment</Text>
              <Text style={[styles.specValue, { color: Number(serviceContext.balanceAmount || 0) > 0 ? '#B45309' : '#16A34A', fontWeight: '700' }]}>
                ₹{Number(serviceContext.balanceAmount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Quotation Context Card (From API v2 Section 9) */}
        {Boolean(quotationContext) && (
          <View style={[styles.specCard, isDark && styles.specCardDark]}>
            <Text style={styles.specSectionTitle}>QUOTATION DETAILS</Text>


            {Boolean(quotationContext.siteAddress) && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Site Address</Text>
                <Text
                  style={[styles.specValue, isDark && styles.textDark, { flex: 1, textAlign: 'right', marginLeft: 12 }]}
                  numberOfLines={2}
                >
                  {quotationContext.siteAddress}
                </Text>
              </View>
            )}

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Total (with GST)</Text>
              <Text style={[styles.specValue, isDark && styles.textDark]}>
                ₹{Number(quotationContext.totalWithGst || 0).toLocaleString()}
              </Text>
            </View>

            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specLabel}>Overall Balance</Text>
              <Text style={[styles.specValue, { color: Number(quotationContext.balanceAmount || 0) > 0 ? '#B45309' : '#16A34A', fontWeight: '700' }]}>
                ₹{Number(quotationContext.balanceAmount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Attached Proof Document Card */}
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
                <View style={styles.pdfIconBox}>
                  <Ionicons name="image" size={24} color="#E11D48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docFilename, isDark && styles.textDark]} numberOfLines={1}>
                    {docName}
                  </Text>
                  <Text style={styles.docFilesize}>Backend Payment Proof Document</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.85}
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  overflow: 'hidden',
                  backgroundColor: '#F1F5F9',
                  borderWidth: 1,
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                }}
              >
                <Image
                  source={{ uri: docUri }}
                  style={{ width: '100%', height: 200 }}
                  resizeMode="cover"
                />
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
              </TouchableOpacity>

              <View style={styles.docActionRow}>
                <TouchableOpacity
                  style={styles.docActionBtn}
                  onPress={() => setShowImageModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={16} color="#1E488F" style={{ marginRight: 6 }} />
                  <Text style={styles.docActionBtnText}>View Full Image</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.docPreviewCard, isDark && styles.docPreviewCardDark, { paddingVertical: 18, alignItems: 'center' }]}>
              <Ionicons name="document-outline" size={28} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 13, textAlign: 'center' }}>
                No payment proof image found in backend records.
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
              (!canVerify || isSubmittingApprove || isDeletingPayment) && { opacity: 0.6, backgroundColor: '#94A3B8' },
            ]}
            disabled={isSubmittingApprove || isDeletingPayment}
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
                  color={canVerify ? '#34D399' : '#FFFFFF'}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.approveBtnText}>Verify & Approve Payment</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Material Delete Confirmation Modal */}
      <MaterialDeleteModal
        visible={deleteModalVisible}
        title="Delete Payment Record?"
        message={`Are you sure you want to delete this payment of ₹${paymentAmt.toLocaleString()} (${voucherCode || displayPaymentId || 'Payment'})? This action cannot be undone and will remove the transaction record.`}
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
});
