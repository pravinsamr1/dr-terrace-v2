import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { authRepository, isAdminRole } from '../../auth/api/authRepository';
import { employeeRepository } from '../../employees/api/employeeRepository';
import { MONTH_NAMES } from '../../../shared/constants/fallbackDefaults';

export const colors = {
  background: '#F4F8FC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#0052CC',
  green: '#059669',
  red: '#DC2626',
  amber: '#F59E0B',
  purple: '#7C3AED',
  slate: '#94A3B8',
};

// Some totals can arrive as { amount, count }. Anything that isn't a number shows as a dash, never NaN.
export const inr = (value) => {
  const amount = Number(value !== null && typeof value === 'object' ? value.amount : value);
  return value === undefined || value === null || !Number.isFinite(amount) ? '—' : `₹${amount.toLocaleString('en-IN')}`;
};

/** Short amount for small spaces: ₹850, ₹85K, ₹3.4L, ₹1.2Cr */
export const inrCompact = (value) => {
  const amount = Number(value !== null && typeof value === 'object' ? value.amount : value);
  if (value === undefined || value === null || !Number.isFinite(amount)) return '—';
  const trim = (n) => String(Math.round(n * 10) / 10);
  if (Math.abs(amount) >= 1e7) return `₹${trim(amount / 1e7)}Cr`;
  if (Math.abs(amount) >= 1e5) return `₹${trim(amount / 1e5)}L`;
  if (Math.abs(amount) >= 1e3) return `₹${trim(amount / 1e3)}K`;
  return `₹${amount}`;
};

export const shortDate = (value) => {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
};

export const dateTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${shortDate(value)}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
};

export const currentMonth = () => toMonth(new Date());
export const toMonth = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const toApiDate = (date) => `${toMonth(date)}-${String(date.getDate()).padStart(2, '0')}`;
export const shiftMonth = (month, by) => {
  const [year, mon] = month.split('-').map(Number);
  return toMonth(new Date(year, mon - 1 + by, 1));
};
export const monthLabel = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return `${MONTH_NAMES[mon - 1].slice(0, 3)} ${year}`;
};

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    authRepository.getUser().then((user) => {
      if (active) setIsAdmin(user?.isAdmin === true || isAdminRole(user?.role));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return isAdmin;
};

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Segmented({ tabs, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.segment, value === tab && styles.segmentActive]}
          onPress={() => onChange(tab)}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, value === tab && styles.segmentTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[styles.chip, value === option.value && styles.chipActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.chipText, value === option.value && styles.chipTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export function Badge({ label, color = colors.primary }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.badgeText, { color }]}>{String(label || '').toUpperCase()}</Text>
    </View>
  );
}

export function Avatar({ name }) {
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function Metric({ label, value, hint, valueColor, style }) {
  return (
    <Card style={[styles.metric, style]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor && { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? '—'}
      </Text>
      {!!hint && <Text style={styles.metricHint}>{hint}</Text>}
    </Card>
  );
}

/** Month stepper, plus an employee picker for admins (the server ignores employeeId for field employees) */
export function ReportFilters({ month, onMonthChange, hideMonth, employeeId, onEmployeeChange, showEmployee }) {
  const [employees, setEmployees] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  useEffect(() => {
    if (!showEmployee) return undefined;
    let active = true;
    employeeRepository.getEmployees().then((res) => {
      if (active && res?.success && Array.isArray(res.data)) setEmployees(res.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [showEmployee]);

  const selected = employees.find((emp) => String(emp.id) === String(employeeId));
  // The last 24 months, newest first
  const monthOptions = Array.from({ length: 24 }, (_, i) => shiftMonth(currentMonth(), -i));

  return (
    <View style={styles.filters}>
      {!hideMonth && (
      <TouchableOpacity style={{ flex: 1 }} onPress={() => setMonthPickerVisible(true)} activeOpacity={0.8}>
        <Card style={styles.filterInner}>
          <Text style={styles.metricLabel}>Month</Text>
          <View style={styles.monthRow}>
            <Text style={styles.filterValue}>{monthLabel(month)}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </View>
        </Card>
      </TouchableOpacity>
      )}
      <Modal visible={monthPickerVisible} transparent animationType="fade" onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMonthPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select month</Text>
            <ScrollView>
              {monthOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.pickerRow, styles.pickerRowSplit, option === month && styles.pickerRowActive]}
                  onPress={() => { onMonthChange(option); setMonthPickerVisible(false); }}
                >
                  <Text style={[styles.pickerText, option === month && { color: colors.primary, fontWeight: '700' }]}>
                    {option === currentMonth() ? `${monthLabel(option)} (This month)` : monthLabel(option)}
                  </Text>
                  {option === month && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      {showEmployee && (
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
          <Card style={styles.filterInner}>
            <Text style={styles.metricLabel}>Employee</Text>
            <Text style={styles.filterValue} numberOfLines={1}>{selected?.name || 'All employees'}</Text>
          </Card>
        </TouchableOpacity>
      )}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <ScrollView>
              {[{ id: '', name: 'All employees' }, ...employees].map((emp) => (
                <TouchableOpacity
                  key={String(emp.id)}
                  style={styles.pickerRow}
                  onPress={() => { onEmployeeChange(emp.id); setPickerVisible(false); }}
                >
                  <Text style={styles.pickerText}>{emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Previous vs current month bars. rows: [{ label, previous, current }] */
export function ComparisonBars({ title, rows, previousLabel, currentLabel, onCompare, onReset }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const max = Math.max(1, ...rows.flatMap((row) => [Number(row.previous) || 0, Number(row.current) || 0]));
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>{title}</Text>
        {!!onCompare && (
          <TouchableOpacity style={styles.compareButton} onPress={onCompare}>
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
            <Text style={styles.compareText}>Compare</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.legend}>
        <LegendDot color={colors.slate} label={previousLabel} />
        <LegendDot color={colors.primary} label={`${currentLabel} (Current)`} />
      </View>
      <View style={styles.bars}>
        {rows.map((row) => (
          <View key={row.key || row.label} style={styles.barGroup}>
            <Text style={styles.barValue}>{`${row.previous ?? 0} / ${row.current ?? 0}`}</Text>
            <View style={styles.barPair}>
              <View style={[styles.bar, { height: 90 * ((Number(row.previous) || 0) / max), backgroundColor: colors.slate }]} />
              <View style={[styles.bar, { height: 90 * ((Number(row.current) || 0) / max), backgroundColor: colors.primary }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={2}>{row.label}</Text>
            <Delta previous={row.previous} current={row.current} />
          </View>
        ))}
      </View>
      {!!onReset && (
        <TouchableOpacity onPress={onReset}>
          <Text style={styles.link}>Back to this month</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

function Delta({ previous, current }) {
  const before = Number(previous) || 0;
  const now = Number(current) || 0;
  if (before === 0) return <Text style={styles.delta}>—</Text>;
  const change = Math.round(((now - before) / before) * 1000) / 10;
  return (
    <Text style={[styles.delta, { color: change < 0 ? colors.red : colors.green }]}>
      {`${change > 0 ? '+' : ''}${change}%`}
    </Text>
  );
}

/** Stacked bar with one line per group. groups: [{ label, count, percent, color }] */
export function BreakdownBar({ title, total, totalLabel, groups }) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{title}</Text>
        {total !== undefined && <Text style={styles.metricHint}>{`${total} ${totalLabel}`}</Text>}
      </View>
      <View style={styles.stack}>
        {groups.map((group) => (
          <View key={group.label} style={{ flex: Number(group.count) || 0, backgroundColor: group.color }} />
        ))}
      </View>
      {groups.map((group) => (
        <View key={group.label} style={styles.rowBetween}>
          <LegendDot color={group.color} label={group.label} large />
          <Text style={[styles.breakdownValue, { color: group.color }]}>
            {`${group.count}${group.percent !== undefined ? ` · ${Math.round(group.percent)}%` : ''}`}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export function LegendDot({ color, label, large }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={large ? styles.legendLarge : styles.legendText}>{label}</Text>
    </View>
  );
}

/** segments: [{ value, color }] */
export function Donut({ segments, size = 104, centerValue, centerLabel }) {
  const stroke = size * 0.15;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, seg) => sum + (Number(seg.value) || 0), 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={stroke} fill="none" />
        {total > 0 && segments.map((seg, index) => {
          const length = ((Number(seg.value) || 0) / total) * circumference;
          const circle = (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += length;
          return circle;
        })}
      </Svg>
      <Text style={styles.donutValue} numberOfLines={1} adjustsFontSizeToFit>{centerValue}</Text>
      <Text style={styles.donutLabel}>{centerLabel}</Text>
    </View>
  );
}

export function ErrorCard({ message, onRetry }) {
  return (
    <Card style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={28} color={colors.slate} />
      <Text style={styles.emptyText}>{message}</Text>
      {!!onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.link}>Try Again</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

export function EmptyCard({ message }) {
  return (
    <Card style={styles.center}>
      <Text style={styles.emptyText}>{message}</Text>
    </Card>
  );
}

/** A tappable date row. onChange receives YYYY-MM-DD. */
export function DateField({ label, value, onChange, minimumDate, onClear }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T00:00:00`) : minimumDate || new Date();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateButton} onPress={() => setOpen((prev) => !prev)}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.dateText}>{value ? shortDate(value) : 'Not set'}</Text>
        </TouchableOpacity>
        {!!value && !!onClear && (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.slate} />
          </TouchableOpacity>
        )}
      </View>
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, picked) => {
            if (Platform.OS !== 'ios' || event.type === 'set') setOpen(false);
            if (event.type === 'set' && picked) onChange(toApiDate(picked));
          }}
        />
      )}
    </View>
  );
}

export const reportStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowBody: { fontSize: 13, color: colors.text, marginTop: 8 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  rowFoot: { fontSize: 11, color: colors.slate, marginTop: 6 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  outlineButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.card },
  outlineButtonText: { fontSize: 13, fontWeight: '700', color: colors.text },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 14 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: colors.red },
  bannerSub: { fontSize: 12, color: colors.red, marginTop: 2 },
  bannerButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  segmented: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.text, fontWeight: '700' },
  chips: { flexGrow: 0 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#FFFFFF' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  metric: { flex: 1, gap: 4 },
  metricLabel: { fontSize: 12, fontWeight: '500', color: colors.muted },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  metricHint: { fontSize: 11, color: colors.slate },
  filters: { flexDirection: 'row', gap: 12 },
  filter: { flex: 1, gap: 4 },
  filterInner: { gap: 4 },
  filterValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  pickerCard: { backgroundColor: colors.card, borderRadius: 16, maxHeight: '70%', paddingVertical: 8 },
  pickerRow: { paddingVertical: 12, paddingHorizontal: 16 },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingVertical: 10 },
  pickerRowSplit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerRowActive: { backgroundColor: '#EFF6FF' },
  pickerText: { fontSize: 14, color: colors.text },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.muted },
  legendLarge: { fontSize: 13, color: colors.text },
  bars: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barGroup: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 10, color: colors.muted },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 },
  bar: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  delta: { fontSize: 10, fontWeight: '700', color: colors.slate },
  compareButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  compareText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, marginVertical: 4 },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  donutValue: { fontSize: 15, fontWeight: '800', color: colors.text, maxWidth: '62%' },
  donutLabel: { fontSize: 9, color: colors.muted },
  center: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  dateText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
