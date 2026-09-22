import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import InnerHeader from '../../../shared/components/InnerHeader';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const getAreaAndCity = (app) => {
  const area = (
    app.area ||
    app.addressBreakdown?.area ||
    (typeof app.address === 'object' && app.address?.area) ||
    ''
  ).trim();

  const city = (
    app.city ||
    app.addressBreakdown?.city ||
    (typeof app.address === 'object' && app.address?.city) ||
    ''
  ).trim();

  if (area && city) {
    if (area.toLowerCase() === city.toLowerCase()) return area;
    return `${area}, ${city}`;
  }
  if (area) return area;
  if (city) return city;

  if (app.location && typeof app.location === 'string') {
    return app.location.trim();
  }

  if (typeof app.address === 'string' && app.address.trim()) {
    const parts = app.address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const withoutPincode = parts.filter(
        (p) => !/^\d{5,6}$/.test(p) && !p.toLowerCase().includes('tamil nadu') && !p.toLowerCase().includes('india')
      );
      if (withoutPincode.length >= 2) {
        return `${withoutPincode[withoutPincode.length - 2]}, ${withoutPincode[withoutPincode.length - 1]}`;
      } else if (withoutPincode.length === 1) {
        return withoutPincode[0];
      }
    }
    return app.address.trim();
  }

  return 'Location not specified';
};

const getAppointmentDateBadge = (app) => {
  let month = app.month || app.displayMonth;
  let day = app.day || app.displayDay;

  if (!month || !day) {
    const rawDate = app.appointmentDate || app.appointment_date || app.date || app.fixDate || '';
    if (rawDate) {
      const parts = String(rawDate).trim().split(/[-/]/);
      if (parts.length === 3) {
        let d, m;
        if (parts[0].length === 4) {
          m = parseInt(parts[1], 10) - 1;
          d = parseInt(parts[2], 10);
        } else {
          d = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10) - 1;
        }
        if (!isNaN(m) && m >= 0 && m < 12) {
          if (!month) month = MONTH_NAMES[m];
        }
        if (!isNaN(d)) {
          if (!day) day = String(d).padStart(2, '0');
        }
      }
    }
  }

  // Honest fallback: show '--' when no date info at all
  let formattedMonth = month ? String(month).toUpperCase() : '--';
  if (formattedMonth.length > 3 && formattedMonth !== '--') {
    formattedMonth = formattedMonth.substring(0, 3);
  }

  let formattedDay = day ? String(day) : '--';

  return { month: formattedMonth, day: formattedDay };
};

export default function SendQuoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useTabBarScroll();
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      appointmentRepository.getAppointments(1, 50).then((res) => {
        if (res?.success) setAppointments(res.appointments || []);
      });
    }, [])
  );

  const parseAppDate = (app) => {
    let month = app.month || app.displayMonth;
    let day = app.day || app.displayDay;
    let year = app.year || new Date().getFullYear();

    const rawDate = app.appointmentDate || app.appointment_date || app.date || app.fixDate || '';
    if (rawDate) {
      const parts = String(rawDate).trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
        }
      }
    } else if (typeof month === 'string') {
      const mIndex = MONTH_NAMES.indexOf(month.toUpperCase().substring(0, 3));
      if (mIndex !== -1) month = mIndex;
      else month = new Date().getMonth();
    }

    if (isNaN(year)) year = new Date().getFullYear();
    if (isNaN(month)) month = new Date().getMonth();
    if (isNaN(day)) day = new Date().getDate();

    return new Date(year, month, day);
  };

  const roleFilteredAppointments = appointments;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const past3Days = new Date(today);
  past3Days.setDate(today.getDate() - 3);

  const recentAppointments = useMemo(() => {
    return roleFilteredAppointments.filter(app => {
      const appDate = parseAppDate(app);
      appDate.setHours(0, 0, 0, 0);
      return appDate.getTime() >= past3Days.getTime() && appDate.getTime() <= today.getTime();
    }).sort((a, b) => parseAppDate(b) - parseAppDate(a));
  }, [roleFilteredAppointments]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();

    return roleFilteredAppointments.filter(a => {
      const fullLoc = `${a.city || ''} ${a.area || ''} ${a.location || ''} ${a.address || ''}`.toLowerCase();
      const nameMatch = (a.clientName || a.name || '').toLowerCase().includes(query);
      const phoneMatch = (a.phone || a.clientPhone || '').toLowerCase().includes(query);
      const locMatch = fullLoc.includes(query);
      return nameMatch || phoneMatch || locMatch;
    });
  }, [searchQuery, roleFilteredAppointments]);

  const displayList = searchQuery.trim() ? searchResults : recentAppointments;
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Send Quote" paddingTop={insets.top} isDark={isDark} />

      {/* Fixed Search Bar */}
      <View style={[styles.searchSection, isDark && styles.searchSectionDark]}>
        <View style={[styles.searchBarWrapper, isDark && styles.searchBarWrapperDark]}>
          <Ionicons name="search" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isDark && styles.textDark]}
            placeholder="Search by Name, Phone, or Area..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, isDark && styles.textDark]}>
            {isSearchActive ? `Search Results (${displayList.length})` : `Recent Appointments (${displayList.length})`}
          </Text>
        </View>

        {displayList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={56} color={isDark ? '#475569' : '#CBD5E1'} style={{ marginBottom: 12 }} />
            <Text style={[styles.infoTitle, isDark && styles.textDark]}>No Results Found</Text>
            <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
              {isSearchActive ? `No clients found matching "${searchQuery}".` : 'No recent appointments in the past 3 days.'}
            </Text>
          </View>
        ) : (
          displayList.map((app) => {
            const isCompleted = app.status === 'Completed';
            const clientName = app.clientName || app.client_name || app.name;
            const displayName = `${clientName}`;

            const { month: displayMonth, day: displayDay } = getAppointmentDateBadge(app);
            const timeText = (app.time || '').toLowerCase();
            const locationText = getAreaAndCity(app);

            return (
              <TouchableOpacity
                key={`app-${app.id}`}
                onPress={() => router.push({ pathname: '/customer-detail', params: { id: app.id } })}
                activeOpacity={0.9}
                style={[
                  styles.appointmentCard,
                  isDark && styles.appointmentCardDark
                ]}
              >
                {/* Top Segment: Date Badge, Details, and Status Pill */}
                <View style={styles.cardTopRow}>

                  {/* Modern Solid Date Block */}
                  <View
                    style={[
                      styles.dateBlock,
                      { backgroundColor: isCompleted ? '#065F46' : '#1E3A8A' }
                    ]}
                  >
                    <Text style={styles.dateMonth}>{displayMonth}</Text>
                    <Text style={styles.dateDay}>{displayDay}</Text>
                  </View>

                  {/* Middle Details Text Column */}
                  <View style={styles.detailsCol}>
                    <Text
                      style={[
                        styles.clientName,
                        isDark && styles.textDark
                      ]}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>

                    {/* Location Row */}
                    <View style={styles.detailIconRow}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={isDark ? '#94A3B8' : '#475569'}
                        style={styles.detailIcon}
                      />
                      <Text style={[styles.infoText, isDark && styles.subtextDark]} numberOfLines={1}>
                        {locationText}
                      </Text>
                    </View>

                    {/* Time Row */}
                    <View style={styles.detailIconRow}>
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isDark ? '#94A3B8' : '#475569'}
                        style={styles.detailIcon}
                      />
                      <Text style={[styles.infoText, isDark && styles.subtextDark]}>
                        {timeText}
                      </Text>
                    </View>
                  </View>

                  {/* Right Status Badge */}
                  <View style={styles.statusCol}>
                    <View
                      style={[
                        styles.statusBadge,
                        isCompleted ? styles.statusBadgeGreen : styles.statusBadgeBlue,
                        isCompleted && isDark && styles.statusBadgeGreenDark,
                        !isCompleted && isDark && styles.statusBadgeBlueDark
                      ]}
                    >
                      <Text
                        style={[
                          isCompleted ? styles.statusTextGreen : styles.statusTextBlue,
                          isCompleted && isDark && styles.statusTextGreenDark,
                          !isCompleted && isDark && styles.statusTextBlueDark
                        ]}
                      >
                        {app.assignedTo}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ height: 16 }} />

                {/* Bottom Segment: Interactive Action Buttons Row */}
                <View style={styles.cardBottomRow}>

                  {/* Call, WhatsApp and Maps pill buttons */}
                  <View style={styles.bottomIconsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.pillIconButton,
                        isDark ? styles.pillIconButtonCallDark : styles.pillIconButtonCallLight
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        const phone = app.mobileNumber || app.phone || app.clientPhone || app.mobile;
                        if (phone) {
                          const cleaned = String(phone).replace(/[^0-9+]/g, '');
                          Linking.openURL(`tel:${cleaned}`).catch(() =>
                            Alert.alert('Error', 'Unable to open phone dialer.')
                          );
                        } else {
                          Alert.alert('No Phone', 'No phone number available for this client.');
                        }
                      }}
                    >
                      <Ionicons name="call-outline" size={13} color="#10B981" />
                      <Text style={styles.buttonTextGreen}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pillIconButton,
                        isDark ? styles.pillIconButtonWaDark : styles.pillIconButtonWaLight
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        const phone = app.mobileNumber || app.phone || app.clientPhone || app.mobile;
                        if (phone) {
                          const cleaned = String(phone).replace(/[^0-9]/g, '');
                          const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                          Linking.openURL(`https://wa.me/${waNumber}`).catch(() =>
                            Alert.alert('Error', 'Unable to open WhatsApp.')
                          );
                        } else {
                          Alert.alert('No Phone', 'No phone number available for this client.');
                        }
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                      <Text style={styles.buttonTextWa}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pillIconButton,
                        isDark ? styles.pillIconButtonMapsDark : styles.pillIconButtonMapsLight
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        const mapUrl =
                          app.mapLocation || app.googleLocation || app.mapUrl || app.googleMapsUrl ||
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            app.fullAddress || (typeof app.address === 'string' ? app.address : '') || locationText
                          )}`;
                        Linking.openURL(mapUrl).catch(() =>
                          Alert.alert('Error', 'Could not open Google Maps.')
                        );
                      }}
                    >
                      <Ionicons name="location-outline" size={13} color="#3B82F6" />
                      <Text style={styles.buttonTextBlue}>Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  containerDark: {
    backgroundColor: '#080808',
  },

  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  searchSectionDark: {
    backgroundColor: '#121212',
    borderBottomColor: '#334155',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 52,
    paddingHorizontal: 14,
  },
  searchBarWrapperDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#0F172A',
    fontSize: 15,
  },
  clearIcon: {
    padding: 4,
  },
  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  resultsHeader: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptyContainer: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 6,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  appointmentCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBlock: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateMonth: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateDay: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: -2,
  },
  detailsCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    justifyContent: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
  },
  statusCol: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeBlue: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  statusBadgeBlueDark: {
    backgroundColor: 'rgba(3, 105, 161, 0.2)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  statusBadgeGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgeGreenDark: {
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  statusTextBlue: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextBlueDark: {
    color: '#38BDF8',
  },
  statusTextGreen: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextGreenDark: {
    color: '#34D399',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomIconsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pillIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillIconButtonCallLight: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pillIconButtonCallDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  pillIconButtonMapsLight: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  pillIconButtonMapsDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  buttonTextGreen: {
    fontSize: 11,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '600',
  },
  buttonTextBlue: {
    fontSize: 11,
    color: '#3B82F6',
    marginLeft: 4,
    fontWeight: '600',
  },
  pillIconButtonWaLight: {
    backgroundColor: 'rgba(37, 211, 102, 0.06)',
    borderColor: 'rgba(37, 211, 102, 0.30)',
  },
  pillIconButtonWaDark: {
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderColor: 'rgba(37, 211, 102, 0.40)',
  },
  buttonTextWa: {
    fontSize: 11,
    color: '#25D366',
    marginLeft: 4,
    fontWeight: '600',
  },
  reassignButton: {
    backgroundColor: '#FF7E36',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reassignButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
