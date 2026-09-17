import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialCardSkeleton, MaterialProgressBar } from '../../../shared/components/material';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { authRepository } from '../../auth/api/authRepository';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const getAppointmentDateBadge = (app) => {
  const rawDate = app.appointmentDate || app.appointment_date || app.date || app.fixDate || '';
  let month = app.month || app.displayMonth || '';
  let day = app.day || app.displayDay || '';

  if ((!month || !day) && rawDate) {
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

  let formattedMonth = month ? String(month).toUpperCase() : '';
  if (formattedMonth.length > 3) {
    formattedMonth = formattedMonth.substring(0, 3);
  }

  let formattedDay = day ? String(day) : '';

  return { month: formattedMonth, day: formattedDay };
};

const formatAddressString = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  if (typeof address === 'object') {
    const { doorNo, streetName, street, area, city, pincode, state } = address;
    return [doorNo, streetName || street, area, city, pincode, state].filter(Boolean).join(', ').trim();
  }
  return String(address).trim();
};

export default function AllAppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState('master');
  const { handleScroll } = useTabBarScroll();

  useEffect(() => {
    authRepository.getUser().then((u) => { if (u?.role) setUserRole(u.role); });
  }, []);

  const isDark = colorScheme === 'dark';
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstMountRef = useRef(true);

  const fetchAppointmentsPage = useCallback(async (pageToFetch = 1, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (pageToFetch === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await appointmentService.getAppointments(pageToFetch, 20);
      if (res && res.success) {
        const newItems = res.appointments || [];
        if (pageToFetch === 1) {
          setAppointmentsList(newItems);
        } else {
          setAppointmentsList((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const uniqueNew = newItems.filter((a) => !existingIds.has(a.id));
            return [...prev, ...uniqueNew];
          });
        }
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
        setHasMore(res.page < res.totalPages);
      }
    } catch (err) {
      console.warn('Failed to load appointments:', err.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        fetchAppointmentsPage(1, false);
      } else {
        fetchAppointmentsPage(1, false);
      }
    }, [fetchAppointmentsPage])
  );

  const onRefresh = async () => {
    await fetchAppointmentsPage(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore && page < totalPages) {
      fetchAppointmentsPage(page + 1, false);
    }
  };

  const isAdmin = userRole === 'ADMIN' || userRole === 'admin' || userRole === 'master';

  const renderAppointmentCard = (app) => {
    const isCompleted = app.status === 'Completed';
    const displayName = (app.clientName || app.customerName || app.name || '').trim();

    const { month: displayMonth, day: displayDay } = getAppointmentDateBadge(app);
    const hasDateBadge = Boolean(displayMonth || displayDay);
    const timeText = (app.appointmentTime || app.time || '').trim();
    const locationText = formatAddressString(app.address || app.location || '');
    const assignedTo = (app.assignedTo || app.assignedTechnician || app.employeeName || '').trim();

    return (
      <TouchableOpacity
        key={app.id}
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
          {hasDateBadge ? (
            <View
              style={[
                styles.dateBlock,
                { backgroundColor: isCompleted ? '#065F46' : '#1E3A8A' }
              ]}
            >
              {Boolean(displayMonth) && <Text style={styles.dateMonth}>{displayMonth}</Text>}
              {Boolean(displayDay) && <Text style={styles.dateDay}>{displayDay}</Text>}
            </View>
          ) : null}

          {/* Middle Details Text Column */}
          <View style={[styles.detailsCol, !hasDateBadge && { marginLeft: 0 }]}>
            {Boolean(displayName) && (
              <Text
                style={[
                  styles.clientName,
                  isDark && styles.textDark
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            )}

            {/* Location Row */}
            {Boolean(locationText) && (
              <View style={styles.detailIconRow}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={isDark ? '#94A3B8' : '#475569'}
                  style={styles.detailIcon}
                />
                <Text
                  style={[styles.addressText, isDark && styles.subtextDark]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {locationText}
                </Text>
              </View>
            )}

            {/* Time Row */}
            {Boolean(timeText) && (
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
            )}
          </View>

          {/* Right Status Badge */}
          {Boolean(assignedTo) && (
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
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {assignedTo}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 16 }} />

        {/* Bottom Segment: Interactive Action Buttons Row */}
        <View style={styles.cardBottomRow}>

          {/* Call and Maps pill buttons with text labels */}
          <View style={styles.bottomIconsContainer}>
            {/* Call Button */}
            <TouchableOpacity
              style={[
                styles.pillIconButton,
                isDark ? styles.pillIconButtonCallDark : styles.pillIconButtonCallLight
              ]}
              activeOpacity={0.75}
              onPress={() => {
                const phone = app.phone || app.mobileNumber || app.mobile || '';
                if (phone) {
                  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Unable to open phone dialer.'));
                } else {
                  Alert.alert('Notice', 'No phone number available for this client.');
                }
              }}
            >
              <Ionicons name="call-outline" size={13} color="#10B981" />
              <Text style={styles.buttonTextGreen}>Call</Text>
            </TouchableOpacity>

            {/* Location Maps Button */}
            <TouchableOpacity
              style={[
                styles.pillIconButton,
                isDark ? styles.pillIconButtonMapsDark : styles.pillIconButtonMapsLight
              ]}
              activeOpacity={0.75}
              onPress={() => {
                const loc = app.googleLocation || app.mapLocation || locationText;
                if (loc) {
                  Linking.openURL(`${loc}`).catch(() => Alert.alert('Error', 'Unable to open maps.'));
                } else {
                  Alert.alert('Notice', 'No location specified for this appointment.');
                }
              }}
            >
              <Ionicons name="location-outline" size={13} color="#3B82F6" />
              <Text style={styles.buttonTextBlue}>Maps</Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons (Edit / Reassign / View Details) */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push({ pathname: '/edit-appointment', params: { id: app.id } })}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>

            {isCompleted ? (
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => router.push({ pathname: '/customer-detail', params: { id: app.id } })}
                activeOpacity={0.8}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            ) : isAdmin ? (
              <TouchableOpacity
                style={styles.reassignButton}
                onPress={() => router.push({ pathname: '/reassign', params: { id: app.id } })}
                activeOpacity={0.8}
              >
                <Text style={styles.reassignButtonText}>Reassign</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => router.push({ pathname: '/customer-detail', params: { id: app.id } })}
                activeOpacity={0.8}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader
        title={`All Appointments${totalItems > 0 ? ` (${totalItems})` : ''}`}
        paddingTop={insets.top}
        isDark={isDark}
      />

      {/* Top Material Progress Bar */}
      {isLoading && appointmentsList.length > 0 && (
        <MaterialProgressBar indeterminate visible={true} style={{ marginHorizontal: 16, marginBottom: 4 }} />
      )}

      {/* Paginated FlatList with Infinite Scroll */}
      <FlatList
        data={appointmentsList}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => renderAppointmentCard(item)}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#000000', '#0F172A']}
            tintColor={isDark ? '#FFFFFF' : '#000000'}
            progressBackgroundColor={isDark ? '#1E293B' : '#FFFFFF'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom + 90, 120),
            flexGrow: appointmentsList.length === 0 ? 1 : undefined,
          },
        ]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.footerLoaderText, isDark && styles.subtextDark]}>
                Loading more appointments...
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <MaterialCardSkeleton count={4} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="calendar-clear-outline"
                size={48}
                color={isDark ? '#475569' : '#CBD5E1'}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
                No appointments found.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#090D16',
  },

  scrollContainer: {
    paddingHorizontal: 12,
  },
  centerLoadingContainer: {
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  emptyContainer: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
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
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
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

  // Details Section styles
  detailsCol: {
    flex: 1,
    marginLeft: 14,
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
    marginRight: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
  },

  // Status Badge styles
  statusCol: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: 120,
  },
  statusBadgeBlue: {
    backgroundColor: '#E0F2FE',
  },
  statusBadgeBlueDark: {
    backgroundColor: '#075985',
  },
  statusBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeGreenDark: {
    backgroundColor: '#065F46',
  },
  statusTextBlue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  statusTextBlueDark: {
    color: '#E0F2FE',
  },
  statusTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  statusTextGreenDark: {
    color: '#DCFCE7',
  },

  // Bottom action bar
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomIconsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pillIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  pillIconButtonCallLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pillIconButtonCallDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#059669',
  },
  pillIconButtonMapsLight: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  pillIconButtonMapsDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#2563EB',
  },
  buttonTextGreen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  buttonTextBlue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0052CC',
  },
  editButton: {
    backgroundColor: '#0052CC',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reassignButton: {
    backgroundColor: '#FF8A00',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reassignButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsButton: {
    backgroundColor: '#059669',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
