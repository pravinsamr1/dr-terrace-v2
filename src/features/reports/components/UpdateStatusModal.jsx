import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { createClientRequestId, statusUpdateRepository } from '../api/statusUpdateRepository';
import { colors, DateField, reportStyles, toApiDate } from './ReportsUi';
import { VoiceRecorder } from './VoiceNote';

const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toApiDate(date);
};
const QUICK_DATES = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 Days', days: 2 },
  { label: 'Next Week', days: 7 },
];
const NO_QUOTATION_CODES = ['FOLLOW_UP', 'LOST'];

/**
 * hasQuotation: pass false when the customer has no quotation, which limits the options.
 * Leave it out when unknown; the server then rejects an option that is not allowed.
 */
export default function UpdateStatusModal({ visible, ...props }) {
  // Mounted only while open, so every opening starts with an empty form and a new request id
  return visible ? <UpdateStatusForm {...props} /> : null;
}

function UpdateStatusForm({ appointmentId, hasQuotation, onClose, onSaved }) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [audio, setAudio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(createClientRequestId());

  useEffect(() => {
    let active = true;
    statusUpdateRepository.getStatusOptions().then((list) => {
      if (active) setOptions(hasQuotation === false ? list.filter((s) => NO_QUOTATION_CODES.includes(s.code)) : list);
    }).catch((err) => {
      if (active) setError(extractApiErrorMessage(err, 'Could not load the status list.'));
    });
    return () => { active = false; };
  }, [hasQuotation]);

  const isLost = selected?.code === 'LOST';

  const save = async () => {
    if (!selected) return setError('Select a status.');
    if (isLost && !notes.trim()) return setError('Add the reason in the notes.');
    if (selected.requiresAudio && !audio) return setError(`An audio recording is required for ${selected.name}.`);
    try {
      setSaving(true);
      setError('');
      await statusUpdateRepository.create(appointmentId, {
        status: isLost ? 'NOT_INTERESTED' : selected.code,
        notes: notes.trim(),
        nextFollowUpDate: isLost ? '' : nextDate,
        audio,
        clientRequestId: requestIdRef.current,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not save the status. Please try again.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={reportStyles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Update Customer Status</Text>
              <Text style={styles.sub}>Log visit outcome, notes, reminders & audio</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
            <Text style={styles.label}>Customer Status</Text>
            <TouchableOpacity style={styles.select} onPress={() => setListOpen((open) => !open)}>
              <Text style={[styles.selectText, !selected && { color: colors.slate }]}>{selected?.name || 'Select status'}</Text>
              <Ionicons name={listOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </TouchableOpacity>
            {listOpen && options.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={styles.option}
                onPress={() => { setSelected(option); setListOpen(false); }}
              >
                <Text style={styles.selectText}>{option.name}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Visit & Discussion Notes{isLost ? ' (reason required)' : ''}</Text>
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={2000}
              placeholder="Enter client discussion details, site observations, or requirements..."
              placeholderTextColor={colors.slate}
            />

            {!isLost && (
              <View style={styles.reminder}>
                <Text style={styles.label}>When to Call Reminder</Text>
                <View style={reportStyles.row}>
                  {QUICK_DATES.map((quick) => {
                    const value = addDays(quick.days);
                    return (
                      <TouchableOpacity
                        key={quick.label}
                        style={[styles.quick, nextDate === value && styles.quickActive]}
                        onPress={() => setNextDate(value)}
                      >
                        <Text style={[styles.quickText, nextDate === value && { color: colors.primary }]}>{quick.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <DateField label="Date" value={nextDate} onChange={setNextDate} minimumDate={new Date()} onClear={() => setNextDate('')} />
              </View>
            )}

            <VoiceRecorder required={!!selected?.requiresAudio} value={audio} onChange={setAudio} onError={setError} />

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={reportStyles.row}>
            <TouchableOpacity style={reportStyles.outlineButton} onPress={onClose} disabled={saving}>
              <Text style={reportStyles.outlineButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={reportStyles.primaryButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={reportStyles.primaryButtonText}>Save & Update Status</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '92%' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  selectText: { fontSize: 14, color: colors.text },
  option: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderRadius: 10 },
  notes: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 84, fontSize: 14, color: colors.text, textAlignVertical: 'top' },
  reminder: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10 },
  quick: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  quickActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  quickText: { fontSize: 12, fontWeight: '600', color: colors.text },
  error: { fontSize: 13, color: colors.red },
});
