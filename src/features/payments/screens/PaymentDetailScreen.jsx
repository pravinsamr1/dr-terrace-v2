import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialDetailSkeleton } from '../../../shared/components/material';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';

export default function PaymentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const isDark = colorScheme === 'dark';
  const [app, setApp] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) {
      setIsLoading(false);
      return;
    }
    const cleanId = String(params.id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        setApp(res.appointment);
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            setApp(cRes.client || cRes.data);
          }
        });
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, [params.id]);

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <InnerHeader title="Payment Detail" paddingTop={insets.top} isDark={isDark} />
        <MaterialDetailSkeleton isDark={isDark} />
      </View>
    );
  }

  if (!app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Appointment not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={{ color: '#FFFFFF' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawClientName = app?.clientName || app?.name || app?.customerName || '';
  const prefix = rawClientName.trim() ? (rawClientName.trim().toLowerCase().startsWith('mr.') ? '' : 'Mr. Mrs. ') : '';
  const displayName = rawClientName.trim() ? `${prefix}${rawClientName.trim()}` : '';
  const displayId = app?.id ? `DR${app.id}` : '';
  const displayPhone = app?.phone || app?.mobile || '';

  // Calculate balance dynamically
  const totalPayment = Number(app?.totalPayment) || Number(app?.totalCost) || Number(app?.cost) || 0;

  const initialPaid = Boolean(app?.initialPaid);
  const midTermPaid = Boolean(app?.midTermPaid);
  const finalPaid = Boolean(app?.finalPaid);

  const initialAmt = Number(app?.initialPaidAmount || app?.initialPaidDetails?.amount || 0);
  const midTermAmt = Number(app?.midTermPaidAmount || app?.midTermPaidDetails?.amount || 0);
  const finalAmt = Number(app?.finalPaidAmount || app?.finalPaidDetails?.amount || 0);

  let balance = totalPayment;
  if (initialPaid) balance -= initialAmt;
  if (midTermPaid) balance -= midTermAmt;
  if (finalPaid) balance -= finalAmt;
  balance = Math.max(0, balance);

  const handlePayNow = (milestoneName, amount) => {
    let contextFlag = 'initialPaid';
    if (milestoneName === 'Mid-Term') contextFlag = 'midTermPaid';
    if (milestoneName === 'Final') contextFlag = 'finalPaid';
    const payParams = {
      id: app.id,
      milestone: contextFlag,
    };
    if (amount && amount > 0) {
      payParams.amount = amount;
    }
    router.push({
      pathname: '/payment-form',
      params: payParams,
    });
  };

  const handleViewReceipt = (milestoneName) => {
    let milestoneKey = 'initialPaid';
    if (milestoneName === 'Mid-Term') milestoneKey = 'midTermPaid';
    if (milestoneName === 'Final') milestoneKey = 'finalPaid';

    router.push({
      pathname: '/receipt',
      params: {
        id: app.id,
        milestone: milestoneKey,
      },
    });
  };

  const handleSendReceipt = (milestoneName) => {
    Alert.alert('Send Receipt', `Sending payment receipt for ${milestoneName} Milestone via WhatsApp...`);
  };

  const handleCall = () => {
    Alert.alert('Make Call', `Calling customer ${displayName} at ${displayPhone}...`);
  };

  const handleSendMessage = () => {
    Alert.alert('Send Message', `Opening WhatsApp conversation with ${displayName}...`);
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header Area */}
      <InnerHeader title="Payment Detail" paddingTop={insets.top} isDark={isDark} />

      {/* Scroll View details card container */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        <View style={[styles.contentWrapper, isDark && styles.contentWrapperDark]}>
          {/* Profile Details Block */}
          <View style={styles.profileRow}>
            <Image
              source={require('../../../../assets/images/technician_avatar.png')}
              style={styles.avatarImage}
            />
            <View style={styles.profileTextCol}>
              <Text style={[styles.clientNameText, isDark && styles.textDark]}>
                {displayName}
              </Text>

              <View style={styles.profileBadgeRow}>
                <Ionicons name="card-outline" size={15} color={isDark ? '#94A3B8' : '#475569'} style={{ marginRight: 6 }} />
                <Text style={[styles.profileBadgeText, isDark && styles.subtextDark]}>{displayId}</Text>
              </View>

              {Boolean(displayPhone) && (
                <View style={styles.profileBadgeRow}>
                  <Ionicons name="call-outline" size={15} color={isDark ? '#94A3B8' : '#475569'} style={{ marginRight: 6 }} />
                  <Text style={[styles.profileBadgeText, isDark && styles.subtextDark]}>{displayPhone}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Floating Subcards list */}

          {/* Subcard 1: Payment overview */}
          <View style={[styles.subCard, isDark && styles.subCardDark]}>
            <Text style={[styles.cardTitleText, isDark && styles.textDark]}>Payment Details</Text>

            {/* Total Payment Row */}
            <View style={[styles.paymentOverviewRow, isDark && styles.paymentOverviewRowDark]}>
              <Text style={[styles.overviewLabel, isDark && styles.subtextDark]}>Total Payment</Text>
              <View style={styles.overviewValueContainer}>
                <Ionicons name="cash" size={18} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={[styles.overviewValueText, isDark && styles.textDark]}>Rs. {totalPayment.toLocaleString()}/-</Text>
              </View>
            </View>

            {/* Balance Payment Row */}
            <View style={[styles.paymentOverviewRow, isDark && styles.paymentOverviewRowDark, { marginBottom: 0 }]}>
              <Text style={[styles.overviewLabel, isDark && styles.subtextDark]}>Balance Payment</Text>
              <View style={styles.overviewValueContainer}>
                <Ionicons name="cash" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={[styles.overviewValueText, styles.balanceValueText]}>
                  Rs. {balance.toLocaleString()}/-
                </Text>
              </View>
            </View>
          </View>

          {/* Milestone Card 1: Initial Payment */}
          <View style={[styles.milestoneCard, isDark && styles.milestoneCardDark]}>
            <View style={[styles.milestoneHeader, initialPaid ? styles.greenHeader : styles.redHeader]}>
              <Text style={styles.milestoneHeaderTitle}>Initial Payment</Text>
              <View style={styles.milestoneHeaderRight}>
                <Ionicons name="cash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.milestoneHeaderAmount}>
                  {initialPaid ? `Rs. ${initialAmt.toLocaleString()}/-` : 'Unpaid'}
                </Text>
              </View>
            </View>

            <View style={styles.milestoneBody}>
              {initialPaid ? (
                <>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Mode of Payment</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.initialPaidDetails?.paymentMethod || app.initialPaidDetails?.method || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Transaction ID</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.initialPaidDetails?.transactionId || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Payment Date</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {formatDateDDMMYY(app.initialPaidDetails?.paymentDate || app.initialPaidDetails?.date) || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.milestoneActionsRow}>
                    <TouchableOpacity
                      style={styles.bluePillButton}
                      onPress={() => handleViewReceipt('Initial')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>View Receipt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.greenPillButton}
                      onPress={() => handleSendReceipt('Initial')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>Send Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.milestoneActionsRow}>
                  <TouchableOpacity
                    style={[styles.bluePillButton, { backgroundColor: '#2563EB', flex: 1, paddingVertical: 12, borderRadius: 12 }]}
                    onPress={() => handlePayNow('Initial', initialAmt)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="card" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={[styles.pillButtonText, { fontSize: 16 }]}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Milestone Card 2: Mid-Term Payment (Toggleable state) */}
          <View style={[styles.milestoneCard, isDark && styles.milestoneCardDark]}>
            <View style={[styles.milestoneHeader, midTermPaid ? styles.greenHeader : styles.redHeader]}>
              <Text style={styles.milestoneHeaderTitle}>Mid-Term Payment</Text>
              <View style={styles.milestoneHeaderRight}>
                <Ionicons name="cash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.milestoneHeaderAmount}>
                  {midTermPaid ? `Rs. ${midTermAmt.toLocaleString()}/-` : 'Unpaid'}
                </Text>
              </View>
            </View>

            <View style={styles.milestoneBody}>
              {midTermPaid ? (
                <>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Mode of Payment</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.midTermPaidDetails?.paymentMethod || app.midTermPaidDetails?.method || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Transaction ID</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.midTermPaidDetails?.transactionId || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Payment Date</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {formatDateDDMMYY(app.midTermPaidDetails?.paymentDate || app.midTermPaidDetails?.date) || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.milestoneActionsRow}>
                    <TouchableOpacity
                      style={styles.bluePillButton}
                      onPress={() => handleViewReceipt('Mid-Term')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>View Receipt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.greenPillButton}
                      onPress={() => handleSendReceipt('Mid-Term')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>Send Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.payNowWrapper}>
                  <TouchableOpacity
                    style={styles.payNowButtonActive}
                    onPress={() => handlePayNow('Mid-Term', midTermAmt)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.payNowButtonText}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Milestone Card 3: Final Payment (Disabled until Mid-Term Paid) */}
          <View style={[styles.milestoneCard, isDark && styles.milestoneCardDark]}>
            <View style={[styles.milestoneHeader, finalPaid ? styles.greenHeader : styles.coralHeader]}>
              <Text style={styles.milestoneHeaderTitle}>Final Payment</Text>
              <View style={styles.milestoneHeaderRight}>
                <Ionicons name="cash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.milestoneHeaderAmount}>
                  {finalPaid ? `Rs. ${finalAmt.toLocaleString()}/-` : 'Unpaid'}
                </Text>
              </View>
            </View>

            <View style={styles.milestoneBody}>
              {finalPaid ? (
                <>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Mode of Payment</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.finalPaidDetails?.paymentMethod || app.finalPaidDetails?.method || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Transaction ID</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {app.finalPaidDetails?.transactionId || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.milestoneDetailRow}>
                    <Text style={[styles.detailLabel, isDark && styles.subtextDark]}>Payment Date</Text>
                    <Text style={[styles.detailValue, isDark && styles.textDark]}>
                      {formatDateDDMMYY(app.finalPaidDetails?.paymentDate || app.finalPaidDetails?.date) || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.milestoneActionsRow}>
                    <TouchableOpacity
                      style={styles.bluePillButton}
                      onPress={() => handleViewReceipt('Final')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>View Receipt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.greenPillButton}
                      onPress={() => handleSendReceipt('Final')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.pillButtonText}>Send Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.payNowWrapper}>
                  {midTermPaid ? (
                    <TouchableOpacity
                      style={styles.payNowButtonActive}
                      onPress={() => handlePayNow('Final', finalAmt)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.payNowButtonText}>Pay Now</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.payNowButtonDisabled}>
                      <Text style={styles.payNowButtonText}>Pay Now</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Footer actions: Call & Send Message side by side */}
          <View style={styles.footerActionRow}>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  scrollContainer: {
    // Padding handled by contentWrapper now
  },
  contentWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingTop: 30,
    paddingHorizontal: 16,
    minHeight: '100%',
  },
  contentWrapperDark: {
    backgroundColor: '#121212',
  },

  // Profile Block
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 4,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileTextCol: {
    flex: 1,
    marginLeft: 16,
  },
  clientNameText: {
    fontSize: 22,
    color: '#0F172A',
    marginBottom: 4,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  profileBadgeText: {
    fontSize: 14,
    color: '#475569',
  },

  // Subcard base
  subCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  subCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  cardTitleText: {
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 14,
    textAlign: 'center',
  },

  // Overview row
  paymentOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderRadius: 24, // pill shape
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 12,
  },
  paymentOverviewRowDark: {
    backgroundColor: '#1E293B',
  },
  overviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  overviewValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  balanceValueText: {
    color: '#1E293B',
  },

  // Milestone Cards
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  milestoneCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  greenHeader: {
    backgroundColor: '#4ADE80',
  },
  redHeader: {
    backgroundColor: '#FF5A5F',
  },
  coralHeader: {
    backgroundColor: '#FB7185',
  },
  milestoneHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  milestoneHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneHeaderAmount: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  milestoneBody: {
    padding: 16,
  },
  milestoneDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
  },
  milestoneActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  bluePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  greenPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  payNowWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  payNowButtonActive: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 18,
  },
  payNowButtonDisabled: {
    backgroundColor: '#94A3B8',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 18,
    opacity: 0.6,
  },
  payNowButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
  },

  // Footer Actions Row
  footerActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0052CC', // Deep blue
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#22C55E', // WhatsApp Green
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
