import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal } from '../../../shared/components/material';
import { monthToRange, reportsRepository } from '../api/reportsRepository';
import {
  Avatar, Badge, BreakdownBar, Card, Chips, colors, ComparisonBars, currentMonth, EmptyCard, ErrorCard, inr, Metric,
  monthLabel, ReportFilters, reportStyles as rs, Segmented, shiftMonth, shortDate, useIsAdmin,
} from '../components/ReportsUi';
import ComparePopup from '../components/ComparePopup';
import UpdateStatusModal from '../components/UpdateStatusModal';

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'WON', label: 'Won' },
  { value: 'OPEN', label: 'Open' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
  { value: 'NOT_QUOTED', label: 'Not quoted' },
  { value: 'NOT_VISITED', label: 'Not visited' },
];
const LEAD_COLORS = [colors.green, colors.primary, colors.amber, colors.purple, colors.red, colors.slate];
const PAGE_SIZE = 20;

const rangeLabel = ({ fromDate, toDate }) => `${shortDate(fromDate)} – ${shortDate(toDate)}`;

function OverviewTab({ onOpenFollowUps }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [month, setMonth] = useState(currentMonth());
  const [employeeId, setEmployeeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overview, setOverview] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [customRanges, setCustomRanges] = useState(null);
  const [compareVisible, setCompareVisible] = useState(false);
  const [list, setList] = useState({ items: [], page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');

  const defaultRanges = { primary: monthToRange(month), baseline: monthToRange(shiftMonth(month, -1)) };
  const listParams = { ...monthToRange(month), employeeId, appointmentStatus: statusFilter };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const ranges = customRanges || { primary: monthToRange(month), baseline: monthToRange(shiftMonth(month, -1)) };
      const [overviewData, bars, firstPage] = await Promise.all([
        reportsRepository.getAppointmentOverview({ month, employeeId }),
        reportsRepository.getAppointmentComparison({ ...ranges, employeeId }),
        reportsRepository.getAppointments({ ...monthToRange(month), employeeId, appointmentStatus: statusFilter, page: 1, limit: PAGE_SIZE }),
      ]);
      setOverview(overviewData);
      setComparison(bars);
      setList(firstPage);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load the appointment report.'));
    } finally {
      setLoading(false);
    }
  }, [month, employeeId, statusFilter, customRanges]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const next = await reportsRepository.getAppointments({ ...listParams, page: list.page + 1, limit: PAGE_SIZE });
      setList((prev) => ({ ...next, items: [...prev.items, ...next.items] }));
    } catch (err) {
      setAlert(extractApiErrorMessage(err, 'Could not load more appointments.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    try {
      await reportsRepository.exportCsv(`${API_ENDPOINTS.QUOTATION_REPORTS}/appointments/export`, listParams, `appointments-${month}.csv`);
    } catch (err) {
      setAlert(err.message || 'The report could not be exported.');
    }
  };

  const metrics = overview?.metrics;
  const attention = overview?.attention;
  const attentionTotal = attention?.total ?? (Number(attention?.overdue) || 0) + (Number(attention?.dueToday) || 0);
  const leadGroups = overview?.leadStatus?.groups?.map((group, index) => ({
    label: group.label || group.name || String(group.key || group.code).replace(/_/g, ' '),
    count: group.count,
    percent: group.percent,
    color: group.color || LEAD_COLORS[index % LEAD_COLORS.length],
  }));

  return (
    <ScrollView contentContainerStyle={rs.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      {attentionTotal > 0 && (
        <View style={rs.banner}>
          <View style={{ flex: 1 }}>
            <Text style={rs.bannerTitle}>{`${attention.overdue ?? 0} overdue · ${attention.dueToday ?? 0} due today`}</Text>
            <Text style={rs.bannerSub}>{`${attentionTotal} follow-ups need attention`}</Text>
          </View>
          <TouchableOpacity style={rs.bannerButton} onPress={onOpenFollowUps}>
            <Text style={rs.primaryButtonText}>{`View (${attentionTotal})`}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ReportFilters month={month} onMonthChange={(next) => { setMonth(next); setCustomRanges(null); }} employeeId={employeeId} onEmployeeChange={setEmployeeId} showEmployee={isAdmin} />

      {error ? <ErrorCard message={error} onRetry={load} /> : loading && !overview ? <ActivityIndicator color={colors.primary} /> : (
        <>
          <Text style={rs.sectionTitle}>Key metrics</Text>
          <View style={rs.row}>
            <Metric label="Total Visits" value={metrics?.totalVisits} />
            <Metric
              label="Converted"
              value={metrics?.converted}
              hint={metrics?.conversionRate !== undefined ? `${metrics.conversionRate}% rate${metrics?.winRate !== undefined ? ` · ${metrics.winRate}% win` : ''}` : undefined}
            />
          </View>
          <View style={rs.row}>
            <Metric label="Due Today" value={attention?.dueToday} hint="Follow-ups to do" />
            <Metric label="Overdue" value={attention?.overdue} hint="Call these first" valueColor={colors.red} />
          </View>

          <ComparisonBars
            title={customRanges ? 'Custom comparison' : `${monthLabel(shiftMonth(month, -1))} vs ${monthLabel(month)}`}
            rows={comparison}
            previousLabel={customRanges ? rangeLabel(customRanges.baseline) : monthLabel(shiftMonth(month, -1))}
            currentLabel={customRanges ? rangeLabel(customRanges.primary) : monthLabel(month)}
            onCompare={() => setCompareVisible(true)}
            onReset={customRanges ? () => setCustomRanges(null) : undefined}
          />
          <BreakdownBar title="Lead status" total={overview?.leadStatus?.total} totalLabel="total" groups={leadGroups} />

          <Chips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} />
          <View style={rs.rowBetween}>
            <Text style={rs.sectionTitle}>Reports</Text>
            <TouchableOpacity onPress={exportCsv}><Text style={rs.link}>Export CSV</Text></TouchableOpacity>
          </View>

          {list.items.length === 0 ? <EmptyCard message="No appointments for this filter." /> : list.items.map((row) => (
            <TouchableOpacity
              key={String(row.appointmentId)}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/customer-detail', params: { id: String(row.appointmentId) } })}
            >
              <Card>
                <View style={rs.rowBetween}>
                  <View style={[rs.row, { flex: 1, alignItems: 'center' }]}>
                    <Avatar name={row.customerName} />
                    <View style={{ flex: 1 }}>
                      <Text style={rs.rowTitle} numberOfLines={1}>{row.customerName}</Text>
                      <Text style={rs.rowSub}>{row.customerMobile}</Text>
                    </View>
                  </View>
                  <Badge label={row.appointmentStatus?.name} color={row.appointmentStatus?.color || colors.primary} />
                </View>
                {!!row.address && <Text style={rs.rowBody} numberOfLines={2}>{row.address}</Text>}
                {!!row.grandTotal && <Text style={rs.rowAmount}>{`${inr(row.grandTotal)} quoted`}</Text>}
                {!!row.lastFollowUp && (
                  <Text style={rs.rowFoot}>{`Status changed by ${row.lastFollowUp.changedBy} · ${shortDate(row.lastFollowUp.createdAt)}`}</Text>
                )}
              </Card>
            </TouchableOpacity>
          ))}
          {list.page < list.totalPages && (
            <TouchableOpacity style={rs.outlineButton} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={rs.outlineButtonText}>Load more</Text>}
            </TouchableOpacity>
          )}
        </>
      )}
      <ComparePopup
        visible={compareVisible}
        title="Compare Periods"
        mode="date"
        initialPrimary={(customRanges || defaultRanges).primary}
        initialBaseline={(customRanges || defaultRanges).baseline}
        onApply={setCustomRanges}
        onClose={() => setCompareVisible(false)}
      />
      <MaterialAlertModal visible={!!alert} title="Reports" message={alert} type="error" buttonText="OK" onClose={() => setAlert('')} onConfirm={() => setAlert('')} onDismiss={() => setAlert('')} />
    </ScrollView>
  );
}

function FollowUpsTab() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [page, counts] = await Promise.all([
        reportsRepository.getFollowUpsDue({ due: 'active', limit: 100 }),
        reportsRepository.getFollowUpSummary(),
      ]);
      setRows(page.items);
      setSummary(counts);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load follow-ups.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const call = async (row) => {
    try {
      const mobile = await reportsRepository.getCustomerMobile(row.appointmentId);
      if (!mobile) {
        setAlert('No phone number is saved for this customer.');
        return;
      }
      await Linking.openURL(`tel:${mobile}`);
    } catch (err) {
      setAlert(extractApiErrorMessage(err, 'Could not start the call.'));
    }
  };

  const renderRow = (row) => {
    const overdue = Number(row.daysOverdue) > 0;
    return (
      <Card key={String(row.appointmentId)}>
        <View style={rs.rowBetween}>
          <Text style={[rs.rowTitle, { flex: 1 }]} numberOfLines={1}>{row.customerName}</Text>
          <Badge label={overdue ? 'Overdue' : 'Today'} color={overdue ? colors.red : colors.primary} />
        </View>
        <Text style={rs.rowBody} numberOfLines={2}>{row.lastFollowUp?.note || `Follow up on the ${inr(row.grandTotal)} quote`}</Text>
        <Text style={rs.rowFoot}>
          {overdue ? `Due ${shortDate(row.nextFollowUpDate)} · ${row.daysOverdue} days late` : 'Due today'}
        </Text>
        <View style={[rs.row, { marginTop: 4 }]}>
          <TouchableOpacity style={rs.primaryButton} onPress={() => call(row)}>
            <Text style={rs.primaryButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rs.outlineButton} onPress={() => setUpdating(row)}>
            <Text style={rs.outlineButtonText}>Update Status</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const overdueRows = rows.filter((row) => Number(row.daysOverdue) > 0);
  const todayRows = rows.filter((row) => !(Number(row.daysOverdue) > 0));

  return (
    <ScrollView contentContainerStyle={rs.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <View style={rs.row}>
        <Metric label="Overdue" value={summary?.overdue ?? overdueRows.length} valueColor={colors.red} />
        <Metric label="Due today" value={summary?.dueToday ?? todayRows.length} valueColor={colors.primary} />
      </View>
      {error ? <ErrorCard message={error} onRetry={load} /> : loading && rows.length === 0 ? <ActivityIndicator color={colors.primary} /> : rows.length === 0 ? (
        <EmptyCard message="No follow-ups due." />
      ) : (
        <>
          {overdueRows.length > 0 && <Text style={[rs.sectionTitle, { color: colors.red }]}>Overdue</Text>}
          {overdueRows.map(renderRow)}
          {todayRows.length > 0 && <Text style={[rs.sectionTitle, { color: colors.primary }]}>Today</Text>}
          {todayRows.map(renderRow)}
        </>
      )}
      <UpdateStatusModal
        visible={!!updating}
        appointmentId={updating?.appointmentId}
        hasQuotation={!!updating?.leadQuotationId}
        onClose={() => setUpdating(null)}
        onSaved={load}
      />
      <MaterialAlertModal visible={!!alert} title="Follow-ups" message={alert} type="error" buttonText="OK" onClose={() => setAlert('')} onConfirm={() => setAlert('')} onDismiss={() => setAlert('')} />
    </ScrollView>
  );
}

export default function AppointmentReportsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab === 'follow-ups' ? 'Follow-ups' : 'Overview');

  return (
    <View style={rs.screen}>
      <InnerHeader title={tab === 'Overview' ? 'Appointment Overview' : 'Follow-ups'} paddingTop={insets.top} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented tabs={['Overview', 'Follow-ups']} value={tab} onChange={setTab} />
      </View>
      {tab === 'Overview' ? <OverviewTab onOpenFollowUps={() => setTab('Follow-ups')} /> : <FollowUpsTab />}
    </View>
  );
}
