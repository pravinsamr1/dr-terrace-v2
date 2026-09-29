import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { employeeRepository } from '../../employees/api/employeeRepository';
import { authRepository } from '../../auth/api/authRepository';
import InnerHeader from '../../../shared/components/InnerHeader';
import { DEFAULT_FALLBACKS } from '../../../shared/constants/fallbackDefaults';
import { SALARY_DEFAULTS } from '../constants/salaryConstants';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';

export default function SalaryAdvanceScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [userRole, setUserRole] = useState('master');
  const [activeEmployee, setActiveEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [salaryAdvances, setSalaryAdvances] = useState([]);

  useEffect(() => {
    authRepository.getUser().then((u) => {
      if (u) {
        setUserRole(u.role || 'master');
        setActiveEmployee(u.name || '');
      }
    });
    employeeRepository.getEmployees().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        setEmployees(res.data);
      }
    });
  }, []);

  const submitAdvanceRequest = ({ employeeName, amount, reason, monthlyDeduction }) => {
    const newAdvance = {
      id: Date.now(),
      employeeName: employeeName || DEFAULT_FALLBACKS.EMPLOYEE_NAME,
      requestDate: formatDateDDMMYY(new Date()),
      amount: Number(amount),
      reason,
      status: SALARY_DEFAULTS.PAYOUT_STATUS.PENDING,
      monthlyDeduction: Number(monthlyDeduction) || (Number(amount) / 2),
      repaidAmount: 0,
      remainingAmount: Number(amount),
    };
    setSalaryAdvances(prev => [newAdvance, ...prev]);
    return { success: true, message: 'Salary advance request submitted.' };
  };

  const updateAdvanceStatus = (id, newStatus, approvedMonthlyDeduction = null) => {
    setSalaryAdvances(prev => prev.map(adv => {
      if (adv.id === id) {
        const d = approvedMonthlyDeduction ? Number(approvedMonthlyDeduction) : adv.monthlyDeduction;
        return { ...adv, status: newStatus, monthlyDeduction: d };
      }
      return adv;
    }));
  };

  const empList = employees || [];
  const advances = salaryAdvances || [];
  const currentEmpName = userRole === 'employee' ? (activeEmployee || empList[0]?.name || DEFAULT_FALLBACKS.EMPLOYEE_NAME) : null;

  // Filter requests based on role
  const displayedAdvances = advances.filter((adv) => {
    if (userRole === 'employee') {
      return adv.employeeName === currentEmpName;
    }
    return true;
  });

  // Advance Request Form state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [requestErrors, setRequestErrors] = useState({});

  // Admin Approval Modal state
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedEMI, setApprovedEMI] = useState('');
  const [approvalErrors, setApprovalErrors] = useState({});

  const validateRequestForm = () => {
    const newErrors = {};
    const amountNum = Number(advanceAmount.trim());

    if (!advanceAmount.trim() || isNaN(amountNum) || amountNum <= 0) {
      newErrors.advanceAmount = 'Please enter a valid positive advance amount.';
    }

    if (!advanceReason.trim()) {
      newErrors.advanceReason = 'Reason for salary advance is required.';
    } else if (advanceReason.trim().length < 5) {
      newErrors.advanceReason = 'Reason must be at least 5 characters.';
    }

    if (monthlyDeduction.trim()) {
      const deductionNum = Number(monthlyDeduction.trim());
      if (isNaN(deductionNum) || deductionNum <= 0) {
        newErrors.monthlyDeduction = 'Monthly deduction must be a positive number.';
      } else if (amountNum > 0 && deductionNum > amountNum) {
        newErrors.monthlyDeduction = 'Monthly deduction cannot exceed advance amount.';
      }
    }

    setRequestErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestSubmit = () => {
    if (!validateRequestForm()) {
      return;
    }

    const empName = userRole === 'employee' ? currentEmpName : (activeEmployee || empList[0]?.name || 'Employee');
    submitAdvanceRequest({
      employeeName: empName,
      amount: advanceAmount.trim(),
      reason: advanceReason.trim(),
      monthlyDeduction: monthlyDeduction.trim() || (Number(advanceAmount) / 2).toString(),
    });

    Alert.alert('Success', 'Salary advance request submitted successfully for approval.');
    setRequestModalOpen(false);
    setAdvanceAmount('');
    setAdvanceReason('');
    setMonthlyDeduction('');
    setRequestErrors({});
  };

  const handleAdminApproveConfirm = () => {
    if (!selectedAdvance) return;

    if (approvedEMI.trim()) {
      const emiNum = Number(approvedEMI.trim());
      const advAmount = Number(selectedAdvance.amount);
      if (isNaN(emiNum) || emiNum <= 0) {
        setApprovalErrors({ approvedEMI: 'Please enter a valid positive EMI amount.' });
        return;
      }
      if (emiNum > advAmount) {
        setApprovalErrors({ approvedEMI: `EMI cannot exceed requested amount ₹${advAmount}.` });
        return;
      }
    }

    updateAdvanceStatus(selectedAdvance.id, 'Approved', approvedEMI || selectedAdvance.monthlyDeduction);
    Alert.alert(
      'Request Approved',
      `Advance of ₹${selectedAdvance.amount} approved for ${selectedAdvance.employeeName}. Monthly deduction set to ₹${
        approvedEMI || selectedAdvance.monthlyDeduction
      }.`
    );
    setApprovalModalOpen(false);
    setSelectedAdvance(null);
    setApprovedEMI('');
    setApprovalErrors({});
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader
        title="Salary Advance Requests"
        paddingTop={insets.top}
        isDark={isDark}
        right={
          <TouchableOpacity onPress={() => setRequestModalOpen(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.actionBanner, isDark && styles.actionBannerDark]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, isDark && styles.textDark]}>
              {userRole === 'employee' ? 'Need Salary Advance?' : 'Manage Advance Requests'}
            </Text>
            <Text style={styles.bannerSub}>
              {userRole === 'employee'
                ? 'Submit an advance request. Approved amounts will be deducted monthly.'
                : 'Approve or reject employee salary advance requests.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.requestBtn} onPress={() => setRequestModalOpen(true)} activeOpacity={0.85}>
            <Ionicons name="cash-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.requestBtnText}>Request Advance</Text>
          </TouchableOpacity>
        </View>

        {/* List Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
            {userRole === 'employee' ? 'My Advance Requests' : 'All Advance Applications'}
          </Text>
          <Text style={styles.countBadge}>{displayedAdvances.length} Requests</Text>
        </View>

        {displayedAdvances.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={56} color="#94A3B8" />
            <Text style={[styles.emptyText, isDark && styles.subtextDark]}>No salary advance requests found.</Text>
          </View>
        ) : (
          displayedAdvances.map((adv) => (
            <View key={adv.id} style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empNameText, isDark && styles.textDark]}>{adv.employeeName}</Text>
                  <Text style={styles.dateSub}>Applied on {adv.requestDate}</Text>
                </View>

                <View
                  style={[
                    styles.statusTag,
                    adv.status === 'Approved'
                      ? styles.statusApproved
                      : adv.status === 'Rejected'
                      ? styles.statusRejected
                      : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTagText,
                      adv.status === 'Approved'
                        ? styles.statusTextApproved
                        : adv.status === 'Rejected'
                        ? styles.statusTextRejected
                        : styles.statusTextPending,
                    ]}
                  >
                    {adv.status}
                  </Text>
                </View>
              </View>

              {/* Amount Breakdown Box */}
              <View style={[styles.amountBox, isDark && styles.amountBoxDark]}>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Requested Amount</Text>
                  <Text style={styles.amountVal}>₹{adv.amount.toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Monthly EMI Deduction</Text>
                  <Text style={styles.emiVal}>₹{adv.monthlyDeduction.toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Remaining Balance</Text>
                  <Text style={styles.remVal}>₹{adv.remainingAmount.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <Text style={[styles.reasonText, isDark && styles.subtextDark]}>
                <Text style={{ fontWeight: '700' }}>Reason: </Text>
                {adv.reason}
              </Text>

              {/* Admin Action Row */}
              {userRole !== 'employee' && adv.status === 'Pending' && (
                <View style={styles.adminActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => {
                      setSelectedAdvance(adv);
                      setApprovedEMI(adv.monthlyDeduction.toString());
                      setApprovalModalOpen(true);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Approve Request</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => {
                      updateAdvanceStatus(adv.id, 'Rejected');
                      Alert.alert('Rejected', `Salary advance request rejected for ${adv.employeeName}.`);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* New Request Modal */}
      <Modal visible={requestModalOpen} animationType="slide" transparent onRequestClose={() => setRequestModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Request Salary Advance</Text>

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Advance Amount (₹) *</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark, requestErrors.advanceAmount && styles.modalInputError]}
              placeholder="e.g. 5000"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="number-pad"
              value={advanceAmount}
              onChangeText={(val) => {
                setAdvanceAmount(val);
                if (requestErrors.advanceAmount) setRequestErrors((prev) => ({ ...prev, advanceAmount: null }));
              }}
            />
            {requestErrors.advanceAmount && <Text style={styles.errorText}>{requestErrors.advanceAmount}</Text>}

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Proposed Monthly EMI Deduction (₹)</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark, requestErrors.monthlyDeduction && styles.modalInputError]}
              placeholder="e.g. 2500"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="number-pad"
              value={monthlyDeduction}
              onChangeText={(val) => {
                setMonthlyDeduction(val);
                if (requestErrors.monthlyDeduction) setRequestErrors((prev) => ({ ...prev, monthlyDeduction: null }));
              }}
            />
            {requestErrors.monthlyDeduction && <Text style={styles.errorText}>{requestErrors.monthlyDeduction}</Text>}

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Reason for Advance *</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark, { height: 70 }, requestErrors.advanceReason && styles.modalInputError]}
              placeholder="State reason for salary advance (min 5 chars)..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              value={advanceReason}
              onChangeText={(val) => {
                setAdvanceReason(val);
                if (requestErrors.advanceReason) setRequestErrors((prev) => ({ ...prev, advanceReason: null }));
              }}
            />
            {requestErrors.advanceReason && <Text style={styles.errorText}>{requestErrors.advanceReason}</Text>}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setRequestModalOpen(false); setRequestErrors({}); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleRequestSubmit}>
                <Text style={styles.modalSubmitText}>Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin Approval Confirmation Modal */}
      <Modal visible={approvalModalOpen} animationType="slide" transparent onRequestClose={() => setApprovalModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Approve Salary Advance</Text>
            <Text style={[styles.modalSub, isDark && styles.subtextDark]}>
              For {selectedAdvance?.employeeName} - Requested ₹{selectedAdvance?.amount}
            </Text>

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Set Monthly Deduction EMI (₹)</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark, approvalErrors.approvedEMI && styles.modalInputError]}
              placeholder="Monthly repayment amount"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="number-pad"
              value={approvedEMI}
              onChangeText={(val) => {
                setApprovedEMI(val);
                if (approvalErrors.approvedEMI) setApprovalErrors({});
              }}
            />
            {approvalErrors.approvedEMI && <Text style={styles.errorText}>{approvalErrors.approvedEMI}</Text>}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setApprovalModalOpen(false); setApprovalErrors({}); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAdminApproveConfirm}>
                <Text style={styles.modalSubmitText}>Approve & Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerDark: { backgroundColor: '#0F172A' },

  scrollContent: { padding: 16, paddingBottom: 40 },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBannerDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  bannerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  requestBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  countBadge: { fontSize: 12, fontWeight: '600', color: '#2563EB', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  empNameText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  dateSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusApproved: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusTagText: { fontSize: 12, fontWeight: '700' },
  statusTextApproved: { color: '#15803D' },
  statusTextPending: { color: '#B45309' },
  statusTextRejected: { color: '#B91C1C' },
  amountBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginVertical: 12 },
  amountBoxDark: { backgroundColor: '#0F172A' },
  amountCol: { alignItems: 'center' },
  amountLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  amountVal: { fontSize: 14, fontWeight: '800', color: '#2563EB', marginTop: 2 },
  emiVal: { fontSize: 14, fontWeight: '800', color: '#D97706', marginTop: 2 },
  remVal: { fontSize: 14, fontWeight: '800', color: '#DC2626', marginTop: 2 },
  reasonText: { fontSize: 13, color: '#334155' },
  adminActionRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  approveBtn: { backgroundColor: '#16A34A' },
  rejectBtn: { backgroundColor: '#DC2626' },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  modalCardDark: { backgroundColor: '#1E293B' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  modalSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 8, marginBottom: 4 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0F172A' },
  modalInputDark: { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' },
  modalInputError: { borderColor: '#EF4444', borderWidth: 1.5 },
  errorText: { color: '#DC2626', fontSize: 11, fontWeight: '600', marginTop: 2, paddingLeft: 2 },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#E2E8F0' },
  modalCancelText: { color: '#475569', fontWeight: '600' },
  modalSubmitBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#2563EB' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '700' },
  textDark: { color: '#F8FAFC' },
  subtextDark: { color: '#94A3B8' },
});
