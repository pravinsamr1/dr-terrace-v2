import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { reportsRepository } from '../api/reportsRepository';
import { Card, colors, currentMonth, Donut, ErrorCard, LegendDot, monthLabel, inr, Segmented, shiftMonth } from './ReportsUi';

const APPOINTMENT_GROUPS = [
  { key: 'attended', label: 'Attended', color: colors.primary },
  { key: 'visited', label: 'Visited', color: colors.green },
  { key: 'pending', label: 'Pending', color: colors.amber },
  { key: 'unattended', label: 'Unattended', color: colors.red },
];

const sum = (counts) => APPOINTMENT_GROUPS.reduce((total, group) => total + (Number(counts?.[group.key]) || 0), 0);

function AppointmentDonut({ title, counts }) {
  return (
    <View style={styles.donutCard}>
      <Text style={styles.donutTitle}>{title}</Text>
      <Donut
        centerValue={String(sum(counts))}
        centerLabel="TOTAL"
        segments={APPOINTMENT_GROUPS.map((group) => ({ value: counts?.[group.key], color: group.color }))}
      />
      <View style={styles.donutCounts}>
        {APPOINTMENT_GROUPS.map((group) => (
          <Text key={group.key} style={[styles.donutCount, { color: group.color }]}>
            {`${counts?.[group.key] ?? 0} ${group.label.slice(0, 3)}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function HomeReportsCard() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState('Appointments');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setReport(await reportsRepository.getHome(month));
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load reports.'));
    }
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isThisMonth = month === currentMonth();
  const appointments = report?.appointments;
  const payments = report?.payments;
  const showPayments = tab === 'Payments' && !!payments;
  const appointmentTotal = sum(appointments?.current);
  const previousTotal = sum(appointments?.previous);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.heading}>Performance & Reports</Text>
        <TouchableOpacity
          style={styles.monthPill}
          onPress={() => setMonth(isThisMonth ? shiftMonth(currentMonth(), -1) : currentMonth())}
        >
          <Text style={styles.monthText}>{isThisMonth ? 'This Month' : 'Last Month'}</Text>
          <Ionicons name="swap-vertical" size={14} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : (
        <Card style={styles.card}>
          {!!payments && <Segmented tabs={['Appointments', 'Payments']} value={tab} onChange={setTab} />}

          {!showPayments ? (
            <>
              <Text style={styles.overline}>CURRENT VS PREVIOUS</Text>
              <Text style={styles.total}>{appointmentTotal}<Text style={styles.totalUnit}>  Appointments</Text></Text>
              <Text style={styles.sub}>{`vs ${report?.previousMonth ? monthLabel(report.previousMonth) : 'previous month'} (${previousTotal} appts)`}</Text>
              <View style={styles.donuts}>
                <AppointmentDonut title={report?.previousMonth ? monthLabel(report.previousMonth) : 'Previous'} counts={appointments?.previous} />
                <AppointmentDonut title={monthLabel(month)} counts={appointments?.current} />
              </View>
              <View style={styles.legendRow}>
                {APPOINTMENT_GROUPS.map((group) => (
                  <LegendDot key={group.key} color={group.color} label={group.label} />
                ))}
              </View>
              <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/appointment-reports')}>
                <Text style={styles.linkText}>View Appointment Report</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.overline}>CURRENT VS PREVIOUS</Text>
                {payments.changePercent !== null && payments.changePercent !== undefined && (
                  <Text style={[styles.change, { color: payments.changePercent < 0 ? colors.red : colors.green }]}>
                    {`${payments.changePercent > 0 ? '+' : ''}${payments.changePercent}%`}
                  </Text>
                )}
              </View>
              <Text style={styles.total}>{inr(payments.current?.received)}</Text>
              <Text style={styles.sub}>{`received, vs ${inr(payments.previous?.received)} in ${report?.previousMonth ? monthLabel(report.previousMonth) : 'the previous month'}`}</Text>
              <View style={styles.donuts}>
                <Donut
                  size={120}
                  centerValue={inr((Number(payments.current?.received) || 0) + (Number(payments.current?.pending) || 0))}
                  centerLabel="TOTAL"
                  segments={[
                    { value: payments.current?.received, color: colors.green },
                    { value: payments.current?.pending, color: colors.red },
                  ]}
                />
              </View>
              <View style={styles.tiles}>
                <View style={[styles.tile, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={[styles.tileLabel, { color: colors.green }]}>Received</Text>
                  <Text style={[styles.tileValue, { color: colors.green }]}>{inr(payments.current?.received)}</Text>
                  <Text style={styles.tileHint}>{`${inr(payments.verified)} verified · ${inr(payments.awaitingVerification)} awaiting`}</Text>
                </View>
                <View style={[styles.tile, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.tileLabel, { color: colors.red }]}>Pending</Text>
                  <Text style={[styles.tileValue, { color: colors.red }]}>{inr(payments.current?.pending)}</Text>
                  <Text style={styles.tileHint}>Balance as of today</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.linkButton, { backgroundColor: '#ECFDF5' }]} onPress={() => router.push('/collections')}>
                <Text style={[styles.linkText, { color: colors.green }]}>View Payment Report</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.green} />
              </TouchableOpacity>
            </>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  monthPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  monthText: { fontSize: 12, fontWeight: '600', color: colors.text },
  card: { borderRadius: 20, gap: 10 },
  overline: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 },
  change: { fontSize: 12, fontWeight: '700' },
  total: { fontSize: 26, fontWeight: '800', color: colors.text },
  totalUnit: { fontSize: 13, fontWeight: '500', color: colors.muted },
  sub: { fontSize: 12, color: colors.muted },
  donuts: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  donutCard: { flex: 1, alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  donutTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  donutCounts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
  donutCount: { fontSize: 11, fontWeight: '600' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  linkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 18, fontWeight: '800' },
  tileHint: { fontSize: 10, color: colors.muted },
});
