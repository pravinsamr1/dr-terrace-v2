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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { employeeRepository } from '../../employees/api/employeeRepository';
import { authRepository } from '../../auth/api/authRepository';
import InnerHeader from '../../../shared/components/InnerHeader';
import { SALARY_DEFAULTS } from '../constants/salaryConstants';
import { DEFAULT_FALLBACKS } from '../../../shared/constants/fallbackDefaults';

export default function SalaryDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [userRole, setUserRole] = useState('master');
  const [activeEmployee, setActiveEmployee] = useState('');
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [salaryAdvances, setSalaryAdvances] = useState([]);
  const [salaryPayouts, setSalaryPayouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authRepository.getUser().then((u) => {
        if (u) {
          setUserRole(u.role || 'master');
          setActiveEmployee(u.name || '');
        }
      }),
      employeeRepository.getEmployees().then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setEmployees(res.data);
          if (res.data[0]?.name) {
            setSelectedEmployeeName(res.data[0].name);
          }
        }
      }),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const markSalaryAsPaid = (payoutRecord) => {
    const newPayout = {
      id: Date.now(),
      ...payoutRecord,
      status: SALARY_DEFAULTS.PAYOUT_STATUS.PAID,
      paymentDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    };
    setSalaryPayouts(prev => [newPayout, ...prev]);
  };

  const empList = employees || [];
  const leaveReqs = leaveRequests || [];
  const advances = salaryAdvances || [];
  const payouts = salaryPayouts || [];

  // Selected employee state for Master view
  const currentEmpName = userRole === 'employee' ? (activeEmployee || empList[0]?.name || '') : null;
  const [selectedEmployeeName, setSelectedEmployeeName] = useState(currentEmpName || empList[0]?.name || '');

  // Find target employee object
  const targetEmployee = empList.find(e => e.name === selectedEmployeeName) || empList[0] || null;
  const targetEmpName = targetEmployee?.name || selectedEmployeeName || DEFAULT_FALLBACKS.EMPLOYEE_NAME;

  const baseSalary = targetEmployee?.monthlySalary || SALARY_DEFAULTS.BASE_SALARY;
  const allowances = targetEmployee?.conveyanceAllowance || SALARY_DEFAULTS.ALLOWANCES;
  const workingDays = targetEmployee?.workingDaysPerMonth || SALARY_DEFAULTS.WORKING_DAYS_PER_MONTH;

  // Compute Unpaid Leaves count for selected employee
  const employeeLeaves = targetEmployee ? leaveReqs.filter(
    (req) => req.employeeName === targetEmployee.name && req.status === 'Approved' && !req.isPaid
  ) : [];
  const unpaidLeaveDays = employeeLeaves.reduce((acc, curr) => acc + (Number(curr.totalDays) || 1), 0);

  // Leave Deduction Calculation: (Base Salary / Working Days) * Unpaid Leaves
  const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;
  const leaveDeductionAmount = Math.round(unpaidLeaveDays * dailyRate);

  // Compute Salary Advance Deduction for selected employee
  const activeAdvance = targetEmployee ? advances.find(
    (adv) => adv.employeeName === targetEmployee.name && adv.status === 'Approved' && adv.remainingAmount > 0
  ) : null;
  const advanceDeductionAmount = activeAdvance ? Math.min(activeAdvance.monthlyDeduction, activeAdvance.remainingAmount) : 0;

  // Totals
  const grossSalary = baseSalary + allowances;
  const totalDeductions = leaveDeductionAmount + advanceDeductionAmount;
  const netPayable = Math.max(0, grossSalary - totalDeductions);

  // Payout Modal State for Admin
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState(SALARY_DEFAULTS.DEFAULT_PAYMENT_MODE);
  const [payoutNotes, setPayoutNotes] = useState('');

  const currentMonthYear = SALARY_DEFAULTS.CURRENT_MONTH_YEAR;

  // Check if payout already recorded for current month
  const isPaidThisMonth = targetEmployee ? payouts.some(
    p => p.employeeName === targetEmployee.name && p.monthYear === currentMonthYear && p.status === SALARY_DEFAULTS.PAYOUT_STATUS.PAID
  ) : false;

  const handleProcessSalaryPayout = () => {
    markSalaryAsPaid({
      employeeName: targetEmpName,
      monthYear: currentMonthYear,
      baseSalary,
      allowances,
      workingDays,
      unpaidLeaves: unpaidLeaveDays,
      leaveDeduction: leaveDeductionAmount,
      advanceDeduction: advanceDeductionAmount,
      grossSalary,
      totalDeduction: totalDeductions,
      netPay: netPayable,
      paymentMode,
      notes: payoutNotes,
    });

    Alert.alert('Payout Successful', `Salary of ₹${netPayable.toLocaleString('en-IN')} marked as PAID to ${targetEmpName}.`);
    setPayoutModalOpen(false);
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader title="Salary Details & Slips" paddingTop={insets.top} isDark={isDark} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Employee Selector for Master Admin */}
        {userRole !== 'employee' && (
          <View style={[styles.employeeSelectorCard, isDark && styles.cardDark]}>
            <Text style={[styles.selectorLabel, isDark && styles.subtextDark]}>Select Employee:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {empList.map((emp) => {
                const isSelected = emp.name === selectedEmployeeName;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.empPill, isSelected && styles.empPillActive]}
                    onPress={() => setSelectedEmployeeName(emp.name)}
                  >
                    <Ionicons
                      name="person"
                      size={14}
                      color={isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#475569')}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.empPillText, isSelected && styles.empPillTextActive]}>{emp.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Employee Info Header Card */}
        <View style={[styles.profileCard, isDark && styles.cardDark]}>
          <View style={styles.profileRow}>
            <View style={styles.avatarIcon}>
              <Ionicons name="person-circle" size={54} color="#2563EB" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.empName, isDark && styles.textDark]}>{targetEmpName}</Text>
              <Text style={styles.designationText}>{targetEmployee?.designation || 'Staff Technician'}</Text>
              <Text style={[styles.monthText, isDark && styles.subtextDark]}>Pay Statement for {currentMonthYear}</Text>
            </View>

            <View style={[styles.payoutBadge, isPaidThisMonth ? styles.paidBadge : styles.pendingBadge]}>
              <Text style={[styles.payoutBadgeText, isPaidThisMonth ? styles.paidText : styles.pendingText]}>
                {isPaidThisMonth ? 'PAID / RECEIVED' : 'PAYMENT PENDING'}
              </Text>
            </View>
          </View>
        </View>

        {/* Main Salary Slip Breakdown */}
        <View style={[styles.slipCard, isDark && styles.cardDark]}>
          <Text style={[styles.slipTitle, isDark && styles.textDark]}>Salary Computation Summary</Text>
          <View style={styles.divider} />

          {/* Gross Earnings */}
          <Text style={styles.sectionHeaderTitle}>1. Gross Earnings</Text>
          <View style={styles.slipRow}>
            <Text style={[styles.rowLabel, isDark && styles.subtextDark]}>Basic Monthly Salary</Text>
            <Text style={[styles.rowVal, isDark && styles.textDark]}>₹{baseSalary.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.slipRow}>
            <Text style={[styles.rowLabel, isDark && styles.subtextDark]}>Site / Conveyance Allowance</Text>
            <Text style={[styles.rowVal, isDark && styles.textDark]}>+ ₹{allowances.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.subtotalRow, isDark && styles.subtotalRowDark]}>
            <Text style={[styles.subtotalLabel, isDark && styles.textDark]}>Total Gross Earnings</Text>
            <Text style={styles.grossVal}>₹{grossSalary.toLocaleString('en-IN')}</Text>
          </View>

          {/* Deductions */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>2. Salary Deductions</Text>
          <View style={styles.slipRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, isDark && styles.subtextDark]}>
                Leave Deductions ({unpaidLeaveDays} Unpaid Leave{unpaidLeaveDays !== 1 ? 's' : ''})
              </Text>
              <Text style={styles.calculationSub}>
                Formula: (₹{baseSalary} ÷ {workingDays} Days) × {unpaidLeaveDays} Leave(s)
              </Text>
            </View>
            <Text style={styles.deductionVal}>- ₹{leaveDeductionAmount.toLocaleString('en-IN')}</Text>
          </View>

          <View style={[styles.slipRow, { marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, isDark && styles.subtextDark]}>Salary Advance Deduction</Text>
              {activeAdvance ? (
                <Text style={styles.calculationSub}>
                  Approved Advance EMI (Remaining: ₹{activeAdvance.remainingAmount})
                </Text>
              ) : (
                <Text style={styles.calculationSub}>No Active Salary Advance</Text>
              )}
            </View>
            <Text style={styles.deductionVal}>- ₹{advanceDeductionAmount.toLocaleString('en-IN')}</Text>
          </View>

          <View style={[styles.subtotalRow, isDark && styles.subtotalRowDark]}>
            <Text style={[styles.subtotalLabel, isDark && styles.textDark]}>Total Deductions</Text>
            <Text style={styles.totalDeductionVal}>- ₹{totalDeductions.toLocaleString('en-IN')}</Text>
          </View>

          {/* Final Net Pay Box */}
          <View style={styles.netPayCard}>
            <Text style={styles.netPayTitle}>NET SALARY PAYABLE / RECEIVED</Text>
            <Text style={styles.netPayAmount}>₹{netPayable.toLocaleString('en-IN')}</Text>
            <Text style={styles.netPaySub}>Net Amount after Leave & Advance Deductions</Text>
          </View>

          {/* Admin Payout Button */}
          {userRole !== 'employee' && !isPaidThisMonth && (
            <TouchableOpacity style={styles.processPayoutBtn} onPress={() => setPayoutModalOpen(true)} activeOpacity={0.85}>
              <Ionicons name="card-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.processPayoutText}>Mark Salary as PAID</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payout Receipts History Section */}
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.sectionHeading, isDark && styles.textDark]}>Salary Payout Receipts & History</Text>

          {payouts.filter(p => p.employeeName === targetEmpName).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={44} color="#94A3B8" />
              <Text style={[styles.emptyText, isDark && styles.subtextDark]}>No past salary receipts recorded.</Text>
            </View>
          ) : (
            payouts.filter(p => p.employeeName === targetEmpName).map((payout) => (
              <View key={payout.id} style={[styles.receiptCard, isDark && styles.cardDark]}>
                <View style={styles.receiptHeader}>
                  <View>
                    <Text style={[styles.receiptMonth, isDark && styles.textDark]}>{payout.monthYear}</Text>
                    <Text style={styles.receiptDate}>Paid on {payout.paymentDate} via {payout.paymentMode}</Text>
                  </View>
                  <View style={styles.paidSuccessBadge}>
                    <Ionicons name="checkmark-done-circle" size={16} color="#15803D" />
                    <Text style={styles.paidSuccessText}>PAID</Text>
                  </View>
                </View>

                <View style={styles.receiptGrid}>
                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Gross Pay</Text>
                    <Text style={[styles.gridVal, isDark && styles.textDark]}>₹{payout.grossSalary?.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Leave Deductions</Text>
                    <Text style={styles.gridValRed}>-₹{payout.leaveDeduction?.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Advance Deductions</Text>
                    <Text style={styles.gridValRed}>-₹{payout.advanceDeduction?.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Net Received</Text>
                    <Text style={styles.gridValGreen}>₹{payout.netPay?.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Admin Process Payout Modal */}
      <Modal visible={payoutModalOpen} animationType="slide" transparent onRequestClose={() => setPayoutModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Confirm Salary Payout</Text>
            <Text style={[styles.modalSub, isDark && styles.subtextDark]}>
              Record salary disbursement for {targetEmpName}
            </Text>

            <View style={styles.confirmPayBox}>
              <Text style={styles.confirmPayLabel}>NET DISBURSEMENT AMOUNT</Text>
              <Text style={styles.confirmPayVal}>₹{netPayable.toLocaleString('en-IN')}</Text>
            </View>

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Select Payment Mode</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {SALARY_DEFAULTS.PAYMENT_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modePill, paymentMode === mode && styles.modePillActive]}
                  onPress={() => setPaymentMode(mode)}
                >
                  <Text style={[styles.modePillText, paymentMode === mode && styles.modePillTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Transaction Ref / Notes</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholder="e.g. HDFC Bank UTR #982347"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={payoutNotes}
              onChangeText={setPayoutNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPayoutModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleProcessSalaryPayout}>
                <Text style={styles.modalSubmitText}>Confirm & Mark Paid</Text>
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
  employeeSelectorCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectorLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  empPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  empPillActive: { backgroundColor: '#2563EB' },
  empPillText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  empPillTextActive: { color: '#FFFFFF' },
  profileCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarIcon: { justifyContent: 'center', alignItems: 'center' },
  empName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  designationText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  monthText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  payoutBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  paidBadge: { backgroundColor: '#DCFCE7' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  payoutBadgeText: { fontSize: 10, fontWeight: '800' },
  paidText: { color: '#15803D' },
  pendingText: { color: '#B45309' },
  slipCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slipTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  sectionHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#2563EB', marginBottom: 8 },
  slipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { fontSize: 13, color: '#475569' },
  rowVal: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  calculationSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  grossVal: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  deductionVal: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
  },
  subtotalRowDark: { backgroundColor: '#0F172A' },
  subtotalLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  totalDeductionVal: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  netPayCard: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  netPayTitle: { color: '#93C5FD', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  netPayAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginVertical: 4 },
  netPaySub: { color: '#DBEAFE', fontSize: 11 },
  processPayoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  processPayoutText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, color: '#64748B', fontSize: 13 },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  receiptMonth: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  receiptDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  paidSuccessBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  paidSuccessText: { fontSize: 11, fontWeight: '700', color: '#15803D', marginLeft: 4 },
  receiptGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
  gridCol: { alignItems: 'center' },
  gridLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  gridVal: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  gridValRed: { fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  gridValGreen: { fontSize: 12, fontWeight: '700', color: '#16A34A', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  modalCardDark: { backgroundColor: '#1E293B' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  modalSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  confirmPayBox: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  confirmPayLabel: { fontSize: 11, color: '#2563EB', fontWeight: '800' },
  confirmPayVal: { fontSize: 26, fontWeight: '800', color: '#1E40AF', marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 8, marginBottom: 4 },
  modePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#E2E8F0' },
  modePillActive: { backgroundColor: '#2563EB' },
  modePillText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  modePillTextActive: { color: '#FFFFFF' },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0F172A' },
  modalInputDark: { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#E2E8F0' },
  modalCancelText: { color: '#475569', fontWeight: '600' },
  modalSubmitBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#16A34A' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '700' },
  cardDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  textDark: { color: '#F8FAFC' },
  subtextDark: { color: '#94A3B8' },
});
