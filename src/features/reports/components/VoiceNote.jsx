import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { cacheDirectory, deleteAsync, downloadAsync } from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_V1_BASE_URL } from '../../../core/config/config';
import { authRepository } from '../../auth/api/authRepository';
import { colors } from './ReportsUi';

export const clock = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Recordings need the Authorization header, so they are downloaded first and played from the device */
const downloadRecording = async (url, id) => {
  const token = await authRepository.getToken();
  const target = `${cacheDirectory}voice-note-${id}.m4a`;
  const result = await downloadAsync(`${API_V1_BASE_URL}${url}`, target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (result.status < 200 || result.status >= 300) {
    await deleteAsync(target, { idempotent: true });
    throw new Error('download failed');
  }
  return result.uri;
};

/** Plays a saved status update recording: pass `audio`, or `uri` for a local one */
export function VoicePlayer({ audio, audioExpired, entryId, uri, durationSec, label = 'Voice note' }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  if (audioExpired) return <Text style={styles.expired}>Recording removed by the retention setting</Text>;
  if (!audio && !uri) return null;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      setFailed(false);
      if (!loadedRef.current) {
        setLoading(true);
        const source = uri || (await downloadRecording(audio.url, entryId));
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        player.replace({ uri: source });
        loadedRef.current = true;
      }
      player.play();
    } catch (_err) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.player}>
      <TouchableOpacity style={styles.playButton} onPress={toggle} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
        )}
      </TouchableOpacity>
      <Text style={styles.playerLabel} numberOfLines={1}>{failed ? 'Could not play the recording' : label}</Text>
      <Text style={styles.time}>{clock(durationSec ?? audio?.durationSec)}</Text>
    </View>
  );
}

/** Records one voice note. onChange receives { uri, durationSec } or null when it is removed. */
export function VoiceRecorder({ required, value, onChange, onError }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 500);
  const stoppedRef = useRef(true);

  // Leaving the form while recording must release the microphone
  useEffect(() => () => {
    if (!stoppedRef.current) {
      try {
        recorder.stop().catch(() => {});
      } catch (_err) {
        // Already released with the component
      }
    }
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, [recorder]);

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError('Allow microphone access in your phone settings to record a voice note.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      stoppedRef.current = false;
      recorder.record();
    } catch (_err) {
      onError('Could not start recording. Please try again.');
    }
  };

  const stop = async () => {
    try {
      const durationSec = Math.round((state.durationMillis || 0) / 1000);
      await recorder.stop();
      stoppedRef.current = true;
      await setAudioModeAsync({ allowsRecording: false });
      if (recorder.uri) onChange({ uri: recorder.uri, durationSec });
    } catch (_err) {
      onError('Could not save the recording. Please try again.');
    }
  };

  return (
    <View style={styles.recorder}>
      <View style={styles.recorderRow}>
        <TouchableOpacity
          style={[styles.recordButton, state.isRecording && { backgroundColor: colors.red }]}
          onPress={state.isRecording ? stop : start}
        >
          <Ionicons name={state.isRecording ? 'stop' : 'mic'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.recorderTitle}>Voice Note Recorder{state.isRecording ? '  ● REC' : ''}</Text>
          <Text style={styles.recorderHint}>
            {required ? 'Audio note required for this status' : 'Optional'}
          </Text>
        </View>
        {state.isRecording && <Text style={styles.time}>{clock((state.durationMillis || 0) / 1000)}</Text>}
      </View>
      {!!value && !state.isRecording && (
        <View style={styles.recorderRow}>
          <View style={{ flex: 1 }}>
            <VoicePlayer key={value.uri} uri={value.uri} durationSec={value.durationSec} label="Ready to save" />
          </View>
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  expired: { fontSize: 11, color: colors.slate, fontStyle: 'italic' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: '#F8FAFC' },
  playButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  playerLabel: { flex: 1, fontSize: 12, color: colors.muted },
  time: { fontSize: 12, fontWeight: '600', color: colors.muted },
  recorder: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10 },
  recorderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  recorderTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  recorderHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
