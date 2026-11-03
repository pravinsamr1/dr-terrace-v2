import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, currentMonth, DateField, monthLabel, reportStyles, shiftMonth } from './ReportsUi';

function MonthPicker({ label, value, onChange }) {
  const isLatest = value >= currentMonth();
  return (
    <View style={styles.monthRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity onPress={() => onChange(shiftMonth(value, -1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{monthLabel(value)}</Text>
        <TouchableOpacity disabled={isLatest} onPress={() => onChange(shiftMonth(value, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={isLatest ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PeriodSection({ title, dotColor, children }) {
  return (
    <View style={styles.period}>
      <View style={styles.periodHeader}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.periodTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DateRange({ value, onChange, startLabel, endLabel }) {
  return (
    <>
      <DateField label={startLabel} value={value.fromDate} onChange={(fromDate) => onChange({ ...value, fromDate })} />
      <DateField label={endLabel} value={value.toDate} onChange={(toDate) => onChange({ ...value, toDate })} />
    </>
  );
}

/**
 * mode="date": primary and baseline are { fromDate, toDate }.
 * mode="month": primary and baseline are YYYY-MM (Payment reports only accept months).
 */
export default function ComparePopup({ visible, ...props }) {
  // Mounted only while open, so Cancel discards any unapplied change
  return visible ? <ComparePopupContent {...props} /> : null;
}

function ComparePopupContent({ title, mode, initialPrimary, initialBaseline, onApply, onClose }) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [baseline, setBaseline] = useState(initialBaseline);
  const [error, setError] = useState('');

  const apply = () => {
    if (mode === 'date' && (primary.fromDate > primary.toDate || baseline.fromDate > baseline.toDate)) {
      setError('The start date must be on or before the end date.');
      return;
    }
    onApply({ primary, baseline });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card}>
          <View style={reportStyles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.sub}>Select the periods to compare</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ marginVertical: 12 }} contentContainerStyle={{ gap: 12 }}>
            <PeriodSection title="Primary Period (Current)" dotColor={colors.primary}>
              {mode === 'date' ? (
                <DateRange value={primary} onChange={setPrimary} startLabel="Start Date" endLabel="End Date" />
              ) : (
                <MonthPicker label="Month" value={primary} onChange={setPrimary} />
              )}
            </PeriodSection>
            <PeriodSection title="Compare With (Baseline)" dotColor={colors.slate}>
              {mode === 'date' ? (
                <DateRange value={baseline} onChange={setBaseline} startLabel="Baseline Start" endLabel="Baseline End" />
              ) : (
                <MonthPicker label="Month" value={baseline} onChange={setBaseline} />
              )}
            </PeriodSection>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={reportStyles.row}>
            <TouchableOpacity style={reportStyles.outlineButton} onPress={onClose}>
              <Text style={reportStyles.outlineButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={reportStyles.primaryButton} onPress={apply}>
              <Text style={reportStyles.primaryButtonText}>Apply Comparison</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, maxHeight: '88%' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  period: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  periodTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthText: { fontSize: 14, fontWeight: '700', color: colors.text },
  error: { fontSize: 13, color: colors.red },
});
