import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { MaterialAlertModal } from '../../../shared/components/material';

function SettingRow({ icon, title, description, value, onValueChange, isDark, isLast }) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder, isDark && styles.settingRowBorderDark]}>
      <View style={[styles.iconBox, { backgroundColor: isDark ? '#1C1C1C' : '#E8F1FF' }]}>
        <Ionicons name={icon} size={20} color={isDark ? '#93C5FD' : '#2563EB'} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, isDark && styles.textDark]}>{title}</Text>
        <Text style={[styles.settingDescription, isDark && styles.subtextDark]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? '#383838' : '#CBD5E1', true: '#60A5FA' }}
        thumbColor={value ? '#FFFFFF' : '#F8FAFC'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [preferences, setPreferences] = useState({
    notificationAlerts: true,
    appointmentReminders: true,
    compactAppointmentCards: false,
  });
  const updatePreference = (key, val) => setPreferences(prev => ({ ...prev, [key]: val }));

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 24, 48), paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[styles.title, isDark && styles.textDark]}>Settings</Text>
          <Text style={[styles.subtitle, isDark && styles.subtextDark]}>Manage your app preferences</Text>
        </View>


        <Text style={[styles.sectionLabel, isDark && styles.subtextDark]}>NOTIFICATIONS</Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <SettingRow
            icon="notifications-outline"
            title="Notification alerts"
            description="Show alerts for new updates"
            value={preferences.notificationAlerts}
            onValueChange={(value) => updatePreference('notificationAlerts', value)}
            isDark={isDark}
          />
          <SettingRow
            icon="calendar-outline"
            title="Appointment reminders"
            description="Remind me about scheduled visits"
            value={preferences.appointmentReminders}
            onValueChange={(value) => updatePreference('appointmentReminders', value)}
            isDark={isDark}
            isLast
          />
        </View>

        <Text style={[styles.sectionLabel, isDark && styles.subtextDark]}>APPOINTMENTS</Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <SettingRow
            icon="list-outline"
            title="Compact appointment cards"
            description="Show more appointments on screen"
            value={preferences.compactAppointmentCards}
            onValueChange={(value) => updatePreference('compactAppointmentCards', value)}
            isDark={isDark}
            isLast
          />
        </View>

        <TouchableOpacity
          style={[styles.helpRow, isDark && styles.helpRowDark]}
          activeOpacity={0.75}
          onPress={() => setHelpModalVisible(true)}
        >
          <Ionicons name="help-circle-outline" size={22} color={isDark ? '#93C5FD' : '#2563EB'} />
          <Text style={[styles.helpText, isDark && styles.textDark]}>Need help with the app?</Text>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>
      </ScrollView>

      <MaterialAlertModal
        visible={helpModalVisible}
        type="info"
        title="Stay Tuned!"
        message="Help and app guides will be updated soon."
        buttonText="Got It"
        onClose={() => setHelpModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerDark: { backgroundColor: '#080808' },
  content: { paddingHorizontal: 12, gap: 12 },
  title: { color: '#0F172A', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#64748B', fontSize: 15, marginTop: 4 },
  sectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  cardDark: { backgroundColor: '#1C1C1C' },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 82, paddingHorizontal: 12, paddingVertical: 12 },
  settingRowBorder: { borderBottomColor: '#E2E8F0', borderBottomWidth: 1 },
  settingRowBorderDark: { borderBottomColor: '#2A2A2A' },
  iconBox: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
  settingDescription: { color: '#64748B', fontSize: 13, marginTop: 3 },
  textDark: { color: '#F8FAFC' },
  subtextDark: { color: '#94A3B8' },
  helpRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 18, padding: 18 },
  helpRowDark: { backgroundColor: '#1C1C1C' },
  helpText: { color: '#1E293B', flex: 1, fontSize: 15, fontWeight: '600' },
});
