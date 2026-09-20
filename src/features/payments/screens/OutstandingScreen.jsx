import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';

export default function OutstandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useTabBarScroll();
  const [appointments, setAppointments] = useState([]);

  useFocusEffect(
    useCallback(() => {
      appointmentRepository.getAppointments(1, 50).then((res) => {
        if (res?.success) setAppointments(res.appointments || []);
      });
    }, [])
  );

  const [searchQuery, setSearchQuery] = useState('');

  // Filter appointments that have outstanding balance (i.e. finalPaid is false)
  const outstandingAppointments = appointments.filter((app) => {
    // Check if any milestone is unpaid
    const isUnpaid = !app.initialPaid || !app.midTermPaid || !app.finalPaid;

    const cName = (app.clientName || app.name || '').toLowerCase();
    const loc = (app.location || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    // Match search query
    const matchesSearch = cName.includes(query) || loc.includes(query);

    return isUnpaid && matchesSearch;
  });

  // Calculate total outstanding balance across all accounts
  const totalOutstandingSum = appointments.reduce((sum, app) => {
    const total = Number(app.totalPayment) || Number(app.totalCost) || Number(app.cost) || 0;
    const initialAmt = Number(app.initialPaidAmount || app.initialPaidDetails?.amount || 0);
    const midTermAmt = Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || 0);
    const finalAmt = Number(app.finalPaidAmount || app.finalPaidDetails?.amount || 0);
    let paid = 0;
    if (app.initialPaid) paid += initialAmt;
    if (app.midTermPaid) paid += midTermAmt;
    if (app.finalPaid) paid += finalAmt;
    return sum + Math.max(0, total - paid);
  }, 0);

  const handleCardPress = (id) => {
    router.push({
      pathname: '/payment-detail',
      params: { id: id },
    });
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Outstanding Payments" paddingTop={insets.top} isDark={isDark} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
      >
        {/* Total Outstanding Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Outstanding Balance</Text>
          <Text style={styles.summaryAmount}>Rs. {totalOutstandingSum.toLocaleString()}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summarySubLabel}>Accounts Pending</Text>
              <Text style={styles.summarySubVal}>
                {appointments.filter(a => !a.finalPaid).length}
              </Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summarySubLabel}>Fully Cleared</Text>
              <Text style={styles.summarySubVal}>
                {appointments.filter(a => a.finalPaid).length}
              </Text>
            </View>
          </View>
        </View>

        {/* Search bar inside page */}
        <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
          <Ionicons name="search-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isDark && styles.textDark]}
            placeholder="Search outstanding clients..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.listHeading, isDark && styles.textDark]}>
          Pending Milestone Invoices ({outstandingAppointments.length})
        </Text>

        {outstandingAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#059669" style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
              No outstanding payments found. All matches are settled!
            </Text>
          </View>
        ) : (
          outstandingAppointments.map((app) => {
            // Calculate details
            const total = Number(app.totalPayment) || Number(app.totalCost) || Number(app.cost) || 0;
            const initialAmt = Number(app.initialPaidAmount || app.initialPaidDetails?.amount || 0);
            const midTermAmt = Number(app.midTermPaidAmount || app.midTermPaidDetails?.amount || 0);
            const finalAmt = Number(app.finalPaidAmount || app.finalPaidDetails?.amount || 0);
            let paid = 0;
            if (app.initialPaid) paid += initialAmt;
            if (app.midTermPaid) paid += midTermAmt;
            if (app.finalPaid) paid += finalAmt;
            const balance = Math.max(0, total - paid);

            return (
              <TouchableOpacity
                key={app.id}
                style={[styles.clientCard, isDark && styles.clientCardDark]}
                onPress={() => handleCardPress(app.id)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.clientName, isDark && styles.textDark]}>
                    {app.clientName}
                  </Text>
                  <Text style={styles.clientCode}>DR{app.id}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={15} color={isDark ? '#60A5FA' : '#0052CC'} style={{ marginRight: 6 }} />
                  <Text style={[styles.infoValueText, isDark && styles.subtextDark]} numberOfLines={1}>
                    {app.location}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="construct-outline" size={15} color={isDark ? '#60A5FA' : '#0052CC'} style={{ marginRight: 6 }} />
                  <Text style={[styles.infoValueText, isDark && styles.subtextDark]} numberOfLines={1}>
                    {app.serviceType || 'Terrace Waterproofing'}
                  </Text>
                </View>

                {/* Milestones Horizontal Badges */}
                <View style={styles.milestonesContainer}>
                  <View style={styles.milestoneBox}>
                    <Text style={[styles.milestoneLabel, isDark && styles.subtextDark]}>Initial</Text>
                    <View style={[styles.badge, app.initialPaid ? styles.badgePaid : styles.badgeUnpaid]}>
                      <Text style={[styles.badgeText, app.initialPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                        {app.initialPaid ? 'Paid' : 'Unpaid'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.milestoneBox}>
                    <Text style={[styles.milestoneLabel, isDark && styles.subtextDark]}>Mid-Term</Text>
                    <View style={[styles.badge, app.midTermPaid ? styles.badgePaid : styles.badgeUnpaid]}>
                      <Text style={[styles.badgeText, app.midTermPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                        {app.midTermPaid ? 'Paid' : 'Unpaid'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.milestoneBox}>
                    <Text style={[styles.milestoneLabel, isDark && styles.subtextDark]}>Final</Text>
                    <View style={[styles.badge, app.finalPaid ? styles.badgePaid : styles.badgeUnpaid]}>
                      <Text style={[styles.badgeText, app.finalPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                        {app.finalPaid ? 'Paid' : 'Unpaid'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Pricing Info Footer */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} />

                <View style={styles.priceRow}>
                  <View>
                    <Text style={[styles.priceLabel, isDark && styles.subtextDark]}>Total Cost</Text>
                    <Text style={[styles.priceVal, isDark && styles.textDark]}>Rs. {total.toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.outstandingLabelText}>Outstanding</Text>
                    <Text style={styles.outstandingValueText}>Rs. {balance.toLocaleString()}</Text>
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
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#080808',
  },

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 20,
  },

  // Summary Outstanding Card
  summaryCard: {
    backgroundColor: '#0052CC',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#D1E5F7',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryAmount: {
    fontSize: 30,
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summarySubLabel: {
    fontSize: 11,
    color: '#D1E5F7',
  },
  summarySubVal: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: '100%',
  },

  // Search Container
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchContainerDark: {
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
    fontSize: 14,
  },

  listHeading: {
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 12,
  },

  // Client Cards
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  clientCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    color: '#0F172A',
  },
  clientCode: {
    fontSize: 11,
    color: '#0052CC',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoValueText: {
    fontSize: 13,
    color: '#475569',
  },

  // Milestones
  milestonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  milestoneBox: {
    alignItems: 'center',
    flex: 1,
  },
  milestoneLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 65,
  },
  badgePaid: {
    backgroundColor: '#E8F5E9',
  },
  badgeUnpaid: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
  },
  badgeTextPaid: {
    color: '#2E7D32',
  },
  badgeTextUnpaid: {
    color: '#C62828',
  },

  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  priceVal: {
    fontSize: 14,
    color: '#0F172A',
    marginTop: 2,
  },
  outstandingLabelText: {
    fontSize: 11,
    color: '#C62828',
  },
  outstandingValueText: {
    fontSize: 15,
    color: '#C62828',
    marginTop: 2,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
