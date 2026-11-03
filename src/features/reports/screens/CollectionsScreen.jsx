import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { API_ENDPOINTS } from '../../../core/config/config';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal } from '../../../shared/components/material';
import { reportsRepository } from '../api/reportsRepository';
import ComparePopup from '../components/ComparePopup';
import TrendChart from '../components/TrendChart';
import {
  Avatar, Badge, Card, Chips, colors, currentMonth, EmptyCard, ErrorCard, inr, inrCompact,
  Metric, monthLabel, ReportFilters, reportStyles as rs, Segmented, shiftMonth, shortDate, useIsAdmin,
} from '../components/ReportsUi';

const STATUS_COLORS = { PAID: colors.green, PENDING: colors.primary, DUE_TODAY: '#0891B2', OVERDUE: colors.red };
const STATE_COLORS = { ...STATUS_COLORS, NOT_DUE: colors.slate, UNSCHEDULED: colors.amber };
const PAYMENT_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
];
const label = (code) => String(code || '').replace(/_/g, ' ');
const PAGE_SIZE = 20;

const paymentFoot = (row) => {
  if (row.kind === 'payment') return [row.methodLabel, shortDate(row.date || row.paidAt)].filter(Boolean).join(' · ');
  if (Number(row.daysLate) > 0) return `${row.daysLate} days late`;
  return row.kind === 'receivable' ? 'Balance to collect' : 'Awaiting payment';
};

const percent = (value) => Math.round(Number(value) || 0);

function StageBreakdown({ milestones = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[rs.rowBetween, styles.stageToggle]} onPress={() => setOpen((prev) => !prev)}>
        <View style={[rs.row, { gap: 4, alignItems: 'center' }]}>
          <Text style={styles.stageTitle}>Stage breakdown</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
        </View>
        <Text style={rs.rowFoot}>{`${milestones.length} milestones`}</Text>
      </TouchableOpacity>
      {open && milestones.map((stage) => (
        <View key={stage.key} style={styles.stage}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stageName}>{`${stage.label}${stage.percent ? ` (${stage.percent}%)` : ''}`}</Text>
            <Text style={rs.rowFoot}>
              {stage.dueDate ? `Due ${shortDate(stage.dueDate)}` : 'No due date'}{Number(stage.daysLate) > 0 ? ` · ${stage.daysLate} days late` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.stageName}>{`${inr(stage.balance)} left`}</Text>
            <Badge label={label(stage.state)} color={STATE_COLORS[stage.state] || colors.slate} />
          </View>
        </View>
      ))}
    </>
  );
}

const MODE_ICONS = { CASH: 'cash-outline', UPI: 'phone-portrait-outline', ACCOUNT: 'business-outline' };
const KIND_LABELS = { payment: 'Payment', invoice: 'Invoice', receivable: 'Balance' };

function PaymentRow({ row, receivable }) {
  const router = useRouter();
  const name = row.customerName || row.clientName || receivable?.customerName;
  const mobile = row.clientMobile || row.customerMobile || receivable?.clientMobile;
  const employee = row.employee?.name || row.employee || receivable?.employee?.name || receivable?.employee;
  const appointmentId = row.appointmentId || receivable?.appointmentId;
  const details = (
    <Card>
      <View style={rs.rowBetween}>
        <View style={[rs.row, { flex: 1, alignItems: 'center' }]}>
          <Avatar name={name} />
          <View style={{ flex: 1 }}>
            <Text style={rs.rowTitle} numberOfLines={1}>{name}</Text>
            {!!mobile && <Text style={rs.rowSub}>{mobile}</Text>}
          </View>
        </View>
        {row.status === 'PAID' ? <Badge label="Paid" color={colors.green} /> : <Badge label="Due" color={colors.red} />}
      </View>
      <Text style={rs.rowAmount}>{`${inr(row.amount)} ${row.kind === 'payment' ? 'paid' : 'balance'}`}</Text>
      <View style={styles.kindRow}>
        <Ionicons name={MODE_ICONS[row.mode] || 'receipt-outline'} size={13} color={colors.muted} />
        <Text style={styles.kindText} numberOfLines={1}>{`${KIND_LABELS[row.kind] || 'Payment'} · ${paymentFoot(row)}`}</Text>
      </View>
      {!!receivable && (
        <View style={styles.dueBox}>
          <View style={rs.rowBetween}>
            <View>
              <Text style={styles.dueLabel}>PROJECT TOTAL</Text>
              <Text style={styles.dueValue}>{inr(receivable.contractValue)}</Text>
            </View>
            <View>
              <Text style={[styles.dueLabel, { color: colors.green }]}>{`PAID (${percent(receivable.paidPercent)}%)`}</Text>
              <Text style={[styles.dueValue, { color: colors.green }]}>{inr(receivable.paid)}</Text>
            </View>
            <View>
              <Text style={[styles.dueLabel, { color: colors.red }]}>{`BALANCE (${percent(receivable.balancePercent)}%)`}</Text>
              <Text style={[styles.dueValue, { color: colors.red }]}>{inr(receivable.outstanding)}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, Number(receivable.paidPercent) || 0))}%` }]} />
          </View>
          <Text style={rs.rowFoot}>
            {receivable.nextDueDate ? `Next due ${shortDate(receivable.nextDueDate)}` : 'No due date set'}
            {Number(receivable.daysLate) > 0 ? ` · ${receivable.daysLate} days late` : ''}
          </Text>
          <StageBreakdown milestones={receivable.milestones} />
        </View>
      )}
      {typeof employee === 'string' && !!employee && <Text style={rs.rowFoot}>{`Employee: ${employee}`}</Text>}
    </Card>
  );
  if (!appointmentId) return details;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/customer-detail', params: { id: String(appointmentId) } })}
    >
      {details}
    </TouchableOpacity>
  );
}

// Pending is every customer's balance as of today, so it has no month-to-month change
const STAT_CARDS = [
  { key: 'paid', label: 'Paid', icon: 'checkmark-circle-outline', color: '#059669', value: (s) => s?.collected, compare: true },
  { key: 'pending', label: 'Pending', icon: 'time-outline', color: '#DC2626', value: (s) => s?.receivables?.outstanding ?? s?.pending },
];
const TIMELINES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const MONTHLY_POINTS = 6;
const RECENT_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
];

function changePercent(current, previous) {
  const before = Number(previous);
  const now = Number(current);
  if (!Number.isFinite(before) || !Number.isFinite(now) || before === 0) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

function StatCard({ card, current, previous, baselineMonth }) {
  const value = card.value(current);
  const change = card.compare ? changePercent(value, card.value(previous)) : null;
  const up = change !== null && change >= 0;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${card.color}1A` }]}>
        <Ionicons name={card.icon} size={20} color={card.color} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{card.label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {inr(value)}
      </Text>
      {!card.compare ? (
        <Text style={styles.statChange}>As of today</Text>
      ) : change === null ? (
        <Text style={styles.statChange}>—</Text>
      ) : (
        <View style={styles.statChangeRow}>
          <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={11} color={up ? colors.green : colors.red} />
          <Text style={[styles.statChange, { color: up ? colors.green : colors.red }]}>{`${Math.abs(change)}% vs ${monthLabel(baselineMonth).slice(0, 3)}`}</Text>
        </View>
      )}
    </View>
  );
}

function OverviewTab({ filters, onReview, onExport }) {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [timeline, setTimeline] = useState('monthly');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [recentFilter, setRecentFilter] = useState('ALL');
  const [custom, setCustom] = useState(null);
  const [compareVisible, setCompareVisible] = useState(false);
  const [error, setError] = useState('');

  // A comparison chosen for one month does not carry over to another
  const activeCustom = custom?.forMonth === filters.month ? custom : null;
  const { primary, baseline } = activeCustom || { primary: filters.month, baseline: shiftMonth(filters.month, -1) };

  const load = useCallback(async () => {
    try {
      setError('');
      const [overview, summaries] = await Promise.all([
        reportsRepository.getCollectionsOverview(filters),
        reportsRepository.getCollectionStats({ primary, baseline, employeeId: filters.employeeId }),
      ]);
      setData(overview);
      setStats(summaries);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load collections.'));
    }
  }, [filters, primary, baseline]);

  // The chart loads on its own, so a slow trend never holds up the rest of the tab
  const loadTrend = useCallback(async () => {
    try {
      if (timeline === 'monthly') {
        const months = await reportsRepository.getCollectionTrend({ endMonth: filters.month, count: MONTHLY_POINTS, employeeId: filters.employeeId });
        setTrend(months.map((point) => ({ label: monthLabel(point.month).slice(0, 3), value: point.collected })));
      } else {
        setTrend(await reportsRepository.getCollectionsByDay({
          month: filters.month,
          employeeId: filters.employeeId,
          groupBy: timeline === 'daily' ? 'day' : 'week',
        }) ?? 'undated');
      }
    } catch (_err) {
      setTrend([]);
    }
  }, [filters, timeline]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { loadTrend(); }, [loadTrend]));

  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!data || !stats) return <ActivityIndicator color={colors.primary} />;

  const overdue = data.receivables?.overdue;
  // Anything not paid yet (pending, due today, overdue) counts as Pending
  const recent = (data.recent || data.recentPayments || []).filter((row) => (
    recentFilter === 'ALL' || (recentFilter === 'PAID' ? row.status === 'PAID' : row.status !== 'PAID')
  ));

  return (
    <>
      {Number(overdue?.amount ?? overdue) > 0 && (
        <View style={rs.banner}>
          <View style={{ flex: 1 }}>
            <Text style={rs.bannerTitle}>{`${inr(overdue)} overdue`}</Text>
            <Text style={rs.bannerSub}>Follow up on these balances</Text>
          </View>
          <TouchableOpacity style={[rs.bannerButton, { backgroundColor: colors.red }]} onPress={onReview}>
            <Text style={rs.primaryButtonText}>Review</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={rs.rowBetween}>
        <Text style={styles.statsTitle}>{`${monthLabel(primary)} vs ${monthLabel(baseline)}`}</Text>
        <View style={[rs.row, { gap: 10, alignItems: 'center' }]}>
          {!!activeCustom && (
            <TouchableOpacity onPress={() => setCustom(null)}><Text style={rs.link}>Reset</Text></TouchableOpacity>
          )}
          <TouchableOpacity style={styles.pill} onPress={() => setCompareVisible(true)}>
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
            <Text style={[styles.pillText, { color: colors.primary }]}>Compare</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.statRow}>
        {STAT_CARDS.map((card) => <StatCard key={card.key} card={card} current={stats.current} previous={stats.previous} baselineMonth={baseline} />)}
      </View>
      <ComparePopup
        visible={compareVisible}
        title="Compare Collections"
        mode="month"
        initialPrimary={primary}
        initialBaseline={baseline}
        onApply={(chosen) => setCustom({ ...chosen, forMonth: filters.month })}
        onClose={() => setCompareVisible(false)}
      />

      <View style={[styles.chartCard, { zIndex: 2 }]}>
        <View style={rs.rowBetween}>
          <Text style={styles.chartTitle}>{`${TIMELINES.find((t) => t.value === timeline).label} Collections`}</Text>
          <TouchableOpacity style={styles.pill} onPress={() => setTimelineOpen((open) => !open)}>
            <Text style={styles.pillText}>{TIMELINES.find((t) => t.value === timeline).label}</Text>
            <Ionicons name={timelineOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
          </TouchableOpacity>
        </View>
        {timelineOpen && (
          <View style={styles.dropdown}>
            {TIMELINES.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.dropdownItem, option.value === timeline && styles.dropdownItemActive]}
                onPress={() => {
                  setTimelineOpen(false);
                  if (option.value !== timeline) { setTrend(null); setTimeline(option.value); }
                }}
              >
                <Text style={[styles.pillText, option.value === timeline && { color: colors.primary }]}>{option.label}</Text>
                {option.value === timeline && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={rs.rowSub}>
          {timeline === 'monthly' ? `Last ${MONTHLY_POINTS} months` : `${monthLabel(filters.month)}, ${timeline === 'daily' ? 'by day' : 'by week'}`}
        </Text>
        {trend === null ? (
          <ActivityIndicator style={{ height: 190 }} color={colors.primary} />
        ) : trend === 'undated' || trend.length === 0 ? (
          <Text style={[rs.rowSub, styles.chartMessage]}>
            {trend === 'undated' ? 'Payments have no dates, so this view is not available.' : 'Could not load the chart.'}
          </Text>
        ) : (
          <TrendChart
            points={trend}
            labelEvery={timeline === 'daily' ? 5 : 1}
            formatValue={inr}
            formatAxis={(value) => inrCompact(value).replace('₹', '')}
          />
        )}
      </View>

      <View style={rs.rowBetween}>
        <Text style={rs.sectionTitle}>Recent payments</Text>
        <TouchableOpacity onPress={onExport}><Text style={rs.link}>Export CSV</Text></TouchableOpacity>
      </View>
      <Chips options={RECENT_CHIPS} value={recentFilter} onChange={setRecentFilter} />
      {recent.length === 0 ? <EmptyCard message={recentFilter === 'ALL' ? 'No payments this month.' : `No ${recentFilter.toLowerCase()} payments.`} /> : recent.map((row, index) => <PaymentRow key={`${row.kind}-${row.id ?? index}`} row={row} />)}
    </>
  );
}

function PaymentsTab({ filters, onError, onExport }) {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('ALL');
  const [list, setList] = useState({ items: [], page: 1, totalPages: 1 });
  const [receivables, setReceivables] = useState({});
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [summaryData, firstPage, balances] = await Promise.all([
        reportsRepository.getCollectionsSummary(filters),
        reportsRepository.getPayments({ ...filters, status, page: 1, limit: PAGE_SIZE }),
        // Extra detail for the rows: the list still works without it
        reportsRepository.getReceivables({ employeeId: filters.employeeId, limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setReceivables(Object.fromEntries(balances.items.map((item) => [String(item.quotationId), item])));
      setSummary(summaryData);
      setList(firstPage);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load payments.'));
    }
  }, [filters, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const next = await reportsRepository.getPayments({ ...filters, status, page: list.page + 1, limit: PAGE_SIZE });
      setList((prev) => ({ ...next, items: [...prev.items, ...next.items] }));
    } catch (err) {
      onError(extractApiErrorMessage(err, 'Could not load more payments.'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!summary) return <ActivityIndicator color={colors.primary} />;

  return (
    <>
      <View style={rs.row}>
        <Metric
          label="Total Collected"
          value={inr(summary.collected)}
          hint={`${summary.paymentCount ?? 0} paid${summary.thisWeek ? ` · ${summary.thisWeek.paymentCount} this week` : ''}`}
        />
        <Metric label="Pending" value={inr(summary.receivables?.outstanding ?? summary.pending)} hint="Balance as of today" />
      </View>
      <View style={rs.row}>
        <Metric
          label="Total Invoiced"
          value={inr(summary.invoiced)}
          hint={summary.target ? `Target ${inr(summary.target.amount)}` : undefined}
        />
        <Metric label="Paid Invoices" value={summary.paidInvoices} hint={`of ${summary.invoiceCount ?? 0} this month`} />
      </View>
      <View style={rs.row}>
        <Metric label="Verified" value={inr(summary.verified)} valueColor={colors.green} />
        <Metric label="Awaiting Verification" value={inr(summary.unverified)} valueColor={colors.amber} />
      </View>
      <View style={rs.row}>
        <Metric
          label="vs Last Month"
          value={summary.changePct === null || summary.changePct === undefined ? '—' : `${summary.changePct > 0 ? '+' : ''}${summary.changePct}%`}
          valueColor={summary.changePct < 0 ? colors.red : colors.green}
          hint={summary.previousMonth ? `${inr(summary.previousMonth.collected)} collected` : undefined}
        />
        <Metric
          label="Overdue"
          value={inr(summary.receivables?.overdue ?? summary.overdue)}
          valueColor={colors.red}
          hint={summary.target ? `${summary.target.achievedPct}% of target reached` : undefined}
        />
      </View>
      <Chips options={PAYMENT_CHIPS} value={status} onChange={setStatus} />
      <View style={rs.rowBetween}>
        <Text style={rs.sectionTitle}>{`Payments (${list.totalItems})`}</Text>
        <TouchableOpacity onPress={() => onExport(status)}><Text style={rs.link}>Export CSV</Text></TouchableOpacity>
      </View>
      {list.items.length === 0 ? <EmptyCard message="No payments for this filter." /> : list.items.map((row, index) => (
        <PaymentRow
          key={`${row.kind}-${row.id ?? index}`}
          row={row}
          receivable={receivables[String(row.kind === 'receivable' ? row.id : row.quotationId)]}
        />
      ))}
      {list.page < list.totalPages && (
        <TouchableOpacity style={rs.outlineButton} onPress={loadMore} disabled={loadingMore}>
          {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={rs.outlineButtonText}>Load more</Text>}
        </TouchableOpacity>
      )}
    </>
  );
}

function DueCard({ row, onRecord }) {
  const color = STATE_COLORS[row.state] || colors.slate;
  return (
    <Card>
      <View style={[rs.row, { alignItems: 'center' }]}>
        <Avatar name={row.customerName} />
        <Text style={[rs.rowTitle, { flex: 1 }]} numberOfLines={1}>{row.customerName}</Text>
        <Badge label={row.state === 'OVERDUE' ? `${row.daysLate} days late` : label(row.state)} color={color} />
      </View>
      <View style={styles.dueBox}>
        <View style={rs.rowBetween}>
          <View>
            <Text style={styles.dueLabel}>PROJECT TOTAL</Text>
            <Text style={styles.dueValue}>{inr(row.contractValue)}</Text>
          </View>
          <View>
            <Text style={[styles.dueLabel, { color: colors.green }]}>{`PAID (${percent(row.paidPercent)}%)`}</Text>
            <Text style={[styles.dueValue, { color: colors.green }]}>{inr(row.paid)}</Text>
          </View>
          <View>
            <Text style={[styles.dueLabel, { color }]}>{`BALANCE (${percent(row.balancePercent)}%)`}</Text>
            <Text style={[styles.dueValue, { color }]}>{inr(row.outstanding)}</Text>
          </View>
        </View>
        <StageBreakdown milestones={row.milestones} />
      </View>
      <View style={rs.row}>
        <TouchableOpacity style={rs.outlineButton} onPress={onRecord}>
          <Text style={rs.outlineButtonText}>Record payment</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function DueTab({ employeeId }) {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [summaryData, page] = await Promise.all([
        reportsRepository.getReceivablesSummary({ employeeId }),
        reportsRepository.getReceivables({ employeeId, sort: 'daysLate', limit: 100 }),
      ]);
      setSummary(summaryData);
      setRows(page.items);
      setPendingCount(page.totalItems);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load dues.'));
    }
  }, [employeeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!summary) return <ActivityIndicator color={colors.primary} />;

  const groups = [
    { title: 'OVERDUE', color: colors.red, rows: rows.filter((row) => row.state === 'OVERDUE') },
    { title: 'DUE TODAY', color: STATUS_COLORS.DUE_TODAY, rows: rows.filter((row) => row.state === 'DUE_TODAY') },
    { title: 'NOT DUE YET', color: colors.muted, rows: rows.filter((row) => row.state === 'NOT_DUE') },
    { title: 'NEEDS DUE DATES', color: colors.amber, rows: rows.filter((row) => row.state === 'UNSCHEDULED') },
  ];

  return (
    <>
      <View style={rs.row}>
        <Metric label="Pending Count" value={pendingCount} />
        <Metric label="Pending Amount" value={inr(summary.outstanding)} valueColor={colors.red} />
      </View>
      {rows.length === 0 && <EmptyCard message="No balances to collect." />}
      {groups.filter((group) => group.rows.length > 0).map((group) => (
        <View key={group.title} style={{ gap: 12 }}>
          <Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text>
          {group.rows.map((row) => (
            <DueCard
              key={String(row.quotationId)}
              row={row}
              onRecord={() => router.push({ pathname: '/customer-detail', params: { id: String(row.appointmentId), quotationId: String(row.quotationId), initialTab: 'payment' } })}
            />
          ))}
        </View>
      ))}
    </>
  );
}

export default function CollectionsScreen() {
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab === 'payments' ? 'Payments' : 'Overview');
  const [month, setMonth] = useState(currentMonth());
  const [employeeId, setEmployeeId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState(null);

  const filters = useMemo(() => ({ month, employeeId }), [month, employeeId]);

  const exportPayments = async (status) => {
    try {
      await reportsRepository.exportCsv(
        `${API_ENDPOINTS.PAYMENT_REPORTS}/payments/export`,
        { ...filters, status: status || 'ALL', basis: 'receivable' },
        `payments-${month}.csv`
      );
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'The report could not be exported.' });
    }
  };

  const onError = (text) => setMessage({ type: 'error', text });

  return (
    <View style={rs.screen}>
      <InnerHeader title="Collections" paddingTop={insets.top} />
      <ScrollView
        contentContainerStyle={rs.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((key) => key + 1)} />}
      >
        <Segmented tabs={['Overview', 'Payments', 'Due']} value={tab} onChange={setTab} />
        {/* Due balances are as of today, so that tab has no month */}
        <ReportFilters month={month} onMonthChange={setMonth} hideMonth={tab === 'Due'} employeeId={employeeId} onEmployeeChange={setEmployeeId} showEmployee={isAdmin} />
        <View key={refreshKey} style={{ gap: 12 }}>
          {tab === 'Overview' && <OverviewTab filters={filters} onReview={() => setTab('Due')} onExport={() => exportPayments()} />}
          {tab === 'Payments' && <PaymentsTab filters={filters} onError={onError} onExport={exportPayments} />}
          {tab === 'Due' && <DueTab employeeId={employeeId} />}
        </View>
      </ScrollView>
      <MaterialAlertModal
        visible={!!message}
        title="Collections"
        message={message?.text || ''}
        type={message?.type || 'info'}
        buttonText="OK"
        onClose={() => setMessage(null)}
        onConfirm={() => setMessage(null)}
        onDismiss={() => setMessage(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statsTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 4, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.muted },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statChange: { fontSize: 11, fontWeight: '700', color: colors.slate },
  chartCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  dropdown: {
    position: 'absolute', top: 48, right: 14, zIndex: 10, width: 150, backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  chartMessage: { height: 190, textAlign: 'center', textAlignVertical: 'center', paddingTop: 80 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.card },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kindText: { flex: 1, fontSize: 12, color: colors.muted },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: colors.green },
  dueBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  dueLabel: { fontSize: 9, fontWeight: '700', color: colors.muted },
  dueValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  stageToggle: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  stageTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  stage: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  stageName: { fontSize: 12, fontWeight: '600', color: colors.text },
  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 4 },
});
