import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { extractApiErrorMessage } from '../../../core/api/apiClient';
import { statusUpdateRepository } from '../api/statusUpdateRepository';
import { Badge, Card, colors, dateTime, EmptyCard, ErrorCard, inr, reportStyles, shortDate } from './ReportsUi';
import UpdateStatusModal from './UpdateStatusModal';
import { VoicePlayer } from './VoiceNote';

function StatusDetailModal({ appointmentId, updateId, onClose }) {
  return updateId ? <StatusDetail appointmentId={appointmentId} updateId={updateId} onClose={onClose} /> : null;
}

function StatusDetail({ appointmentId, updateId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    statusUpdateRepository.getDetail(appointmentId, updateId).then((data) => {
      if (active) setDetail(data);
    }).catch((err) => {
      if (active) setError(extractApiErrorMessage(err, 'Could not load this update.'));
    });
    return () => { active = false; };
  }, [appointmentId, updateId]);

  const status = detail?.to;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={reportStyles.rowBetween}>
            <Text style={styles.title}>Status Update Detail</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !detail ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={{ gap: 14, paddingVertical: 12 }}>
              <Text style={reportStyles.rowSub}>{`${dateTime(detail.createdAt)}${detail.changedBy ? ` · ${detail.changedBy}` : ''}`}</Text>
              <Card style={{ backgroundColor: '#F0FDF4' }}>
                <Text style={reportStyles.rowSub}>Updated Stage & Deal Value</Text>
                <View style={reportStyles.rowBetween}>
                  <Badge label={status?.name} color={status?.color || colors.primary} />
                  {detail.dealValue !== undefined && detail.dealValue !== null && (
                    <Text style={styles.deal}>{inr(detail.dealValue)}</Text>
                  )}
                </View>
                {!!detail.paymentStatus && <Text style={reportStyles.rowSub}>{String(detail.paymentStatus).replace(/_/g, ' ')}</Text>}
              </Card>
              {!!detail.note && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Discussion & Visit Notes</Text>
                  <Text style={styles.body}>{detail.note}</Text>
                </View>
              )}
              {!!detail.nextFollowUpDate && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Follow-up Reminder</Text>
                  <Text style={styles.body}>{shortDate(detail.nextFollowUpDate)}</Text>
                </View>
              )}
              {(!!detail.audio || !!detail.audioExpired) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Voice Note Recording</Text>
                  <VoicePlayer audio={detail.audio} audioExpired={detail.audioExpired} entryId={detail.id} />
                </View>
              )}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.done} onPress={onClose}>
            <Text style={reportStyles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Status History card and Update Status button shown on the Customer Detail Site Info tab */
export default function StatusHistorySection({ appointmentId }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateVisible, setUpdateVisible] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      setError('');
      const history = await statusUpdateRepository.getHistory(appointmentId, { limit: 50 });
      setItems(history.items);
      setTotal(history.totalItems);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Could not load the status history.'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ gap: 12, marginBottom: 20 }}>
      <View style={reportStyles.rowBetween}>
        <Text style={reportStyles.sectionTitle}>{`Status History${total ? ` (${total})` : ''}`}</Text>
        <TouchableOpacity style={styles.update} onPress={() => setUpdateVisible(true)}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={reportStyles.link}>Update Status</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : loading && items.length === 0 ? (
        <ActivityIndicator color={colors.primary} />
      ) : items.length === 0 ? (
        <EmptyCard message="No status updates yet." />
      ) : (
        items.map((entry) => (
          <TouchableOpacity key={String(entry.id)} activeOpacity={0.8} onPress={() => setDetailId(entry.id)}>
            <Card>
              <View style={reportStyles.rowBetween}>
                <Badge label={entry.to?.name} color={entry.to?.color || colors.primary} />
                <View style={styles.when}>
                  <Text style={reportStyles.rowFoot}>{dateTime(entry.createdAt)}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.slate} />
                </View>
              </View>
              {!!entry.note && <Text style={styles.body}>{entry.note}</Text>}
              <VoicePlayer audio={entry.audio} audioExpired={entry.audioExpired} entryId={entry.id} />
            </Card>
          </TouchableOpacity>
        ))
      )}

      <UpdateStatusModal
        visible={updateVisible}
        appointmentId={appointmentId}
        onClose={() => setUpdateVisible(false)}
        onSaved={load}
      />
      <StatusDetailModal appointmentId={appointmentId} updateId={detailId} onClose={() => setDetailId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
  deal: { fontSize: 20, fontWeight: '800', color: colors.text },
  done: { backgroundColor: colors.text, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  error: { fontSize: 13, color: colors.red, marginVertical: 24 },
  update: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
