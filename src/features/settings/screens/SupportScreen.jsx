import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialAlertModal, MaterialCardSkeleton } from '../../../shared/components/material';
import { supportRepository } from '../api/supportRepository';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [contactInfo, setContactInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [callModalVisible, setCallModalVisible] = useState(false);
  const [phoneOptions, setPhoneOptions] = useState([]);
  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = (title, message, type = 'info') => {
    setAlertModal({ visible: true, type, title, message });
  };

  const fetchContactInfo = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await supportRepository.getContactInfo();
      if (res && res.success && res.data) {
        setContactInfo(res.data);
      } else {
        setContactInfo(null);
      }
    } catch (err) {
      console.warn('Failed to load contact info:', err.message);
      setContactInfo(null);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContactInfo(false);
  }, [fetchContactInfo]);

  const onRefresh = () => {
    fetchContactInfo(true);
  };

  // Build dynamic phone numbers list from API data
  const getDynamicPhoneOptions = () => {
    if (!contactInfo) return [];
    const options = [];

    if (contactInfo.mobileNumber && contactInfo.mobileNumber.trim()) {
      const num = contactInfo.mobileNumber.trim();
      options.push({
        id: 'mobile',
        title: 'Customer Support (Mobile)',
        displayNumber: num,
        dialUrl: `tel:${num.replace(/[^0-9+]/g, '')}`,
        icon: 'phone-portrait-outline',
        color: '#10B981',
        bgColorLight: '#ECFDF5',
        bgColorDark: '#064E3B',
      });
    }

    if (contactInfo.landlineNumber && contactInfo.landlineNumber.trim()) {
      const num = contactInfo.landlineNumber.trim();
      options.push({
        id: 'landline',
        title: 'Head Office (Landline)',
        displayNumber: num,
        dialUrl: `tel:${num.replace(/[^0-9+]/g, '')}`,
        icon: 'call-outline',
        color: '#3B82F6',
        bgColorLight: '#EFF6FF',
        bgColorDark: '#1E293B',
      });
    }

    return options;
  };

  const handleCallUs = () => {
    const options = getDynamicPhoneOptions();
    if (options.length === 0) {
      showAlert('Contact Number Unavailable', 'No phone number is currently available from the server.', 'info');
      return;
    }

    if (options.length === 1) {
      handleCallOption(options[0]);
    } else {
      setPhoneOptions(options);
      setCallModalVisible(true);
    }
  };

  const handleCallOption = async (item) => {
    setCallModalVisible(false);
    try {
      const supported = await Linking.canOpenURL(item.dialUrl);
      if (supported) {
        await Linking.openURL(item.dialUrl);
      } else {
        await Linking.openURL(item.dialUrl);
      }
    } catch (_err) {
      showAlert('Call Failed', `Unable to launch phone dialer for ${item.displayNumber}.`, 'error');
    }
  };

  const handleMailUs = async () => {
    const email = contactInfo?.emailAddress?.trim();
    if (!email) {
      showAlert('Email Unavailable', 'No support email address is currently available from the server.', 'info');
      return;
    }

    const mailUrl = `mailto:${email}?subject=Dr.%20Terrace%20Support%20Enquiry`;
    try {
      await Linking.openURL(mailUrl);
    } catch (_err) {
      showAlert('Mail Support', `Please send your email to: ${email}`, 'info');
    }
  };

  const handleWhatsAppChat = async () => {
    const phone = contactInfo?.mobileNumber?.trim();
    if (!phone) {
      showAlert('WhatsApp Unavailable', 'No WhatsApp support number is currently available from the server.', 'info');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const whatsappAppUrl = `whatsapp://send?phone=${cleanPhone}&text=Hello%20Dr.%20Terrace%20Support`;
    const whatsappWebUrl = `https://wa.me/${cleanPhone}?text=Hello%20Dr.%20Terrace%20Support`;

    try {
      const supported = await Linking.canOpenURL(whatsappAppUrl);
      if (supported) {
        await Linking.openURL(whatsappAppUrl);
      } else {
        await Linking.openURL(whatsappWebUrl);
      }
    } catch (_err) {
      try {
        await Linking.openURL(whatsappWebUrl);
      } catch (_err2) {
        showAlert('WhatsApp Support', `Unable to open WhatsApp. You can message us at ${phone}.`, 'info');
      }
    }
  };

  const phoneNumbersDisplay = [
    contactInfo?.mobileNumber?.trim(),
    contactInfo?.landlineNumber?.trim(),
  ].filter(Boolean).join(' • ') || 'Not available';

  const emailDisplay = contactInfo?.emailAddress?.trim() || 'Not available';
  const whatsappDisplay = contactInfo?.mobileNumber?.trim() || 'Not available';
  const officeAddressDisplay = contactInfo?.officeAddress?.trim();

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Support" paddingTop={insets.top} isDark={isDark} />

      {/* Main card list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#FFFFFF' : '#2563EB'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        {isLoading && !refreshing ? (
          <View style={{ paddingTop: 8 }}>
            <MaterialCardSkeleton count={3} />
          </View>
        ) : (
          <>
            {/* Card 1: Contact US */}
            <View style={[styles.supportCard, isDark && styles.supportCardDark]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                  <Ionicons
                    name="headset-outline"
                    size={28}
                    color={isDark ? '#60A5FA' : '#2563EB'}
                  />
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={[styles.cardTitleText, isDark && styles.textDark]}>Contact Us</Text>
                  <Text style={[styles.cardSubtitleText, isDark && styles.subtextDark]}>
                    {phoneNumbersDisplay}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCallUs}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>CALL US</Text>
              </TouchableOpacity>
            </View>

            {/* Card 2: Mail Us */}
            <View style={[styles.supportCard, isDark && styles.supportCardDark]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                  <Ionicons
                    name="mail-outline"
                    size={28}
                    color={isDark ? '#818CF8' : '#4F46E5'}
                  />
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={[styles.cardTitleText, isDark && styles.textDark]}>Mail Us</Text>
                  <Text style={[styles.cardSubtitleText, isDark && styles.subtextDark]}>
                    {emailDisplay}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, styles.mailActionButton]}
                onPress={handleMailUs}
                activeOpacity={0.8}
              >
                <Ionicons name="mail" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>MAIL US</Text>
              </TouchableOpacity>
            </View>

            {/* Card 3: WhatsApp Support */}
            <View style={[styles.supportCard, isDark && styles.supportCardDark]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                  <Ionicons
                    name="logo-whatsapp"
                    size={28}
                    color="#22C55E"
                  />
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={[styles.cardTitleText, isDark && styles.textDark]}>WhatsApp Support</Text>
                  <Text style={[styles.cardSubtitleText, isDark && styles.subtextDark]}>
                    {whatsappDisplay}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, styles.whatsappActionButton]}
                onPress={handleWhatsAppChat}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>CHAT WITH US</Text>
              </TouchableOpacity>
            </View>

            {/* Card 4: Office Address (if available from API) */}
            {officeAddressDisplay ? (
              <View style={[styles.supportCard, isDark && styles.supportCardDark]}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                    <Ionicons
                      name="business-outline"
                      size={28}
                      color={isDark ? '#F59E0B' : '#D97706'}
                    />
                  </View>
                  <View style={styles.cardTextCol}>
                    <Text style={[styles.cardTitleText, isDark && styles.textDark]}>Office Address</Text>
                    <Text style={[styles.cardSubtitleText, isDark && styles.subtextDark, { lineHeight: 20 }]}>
                      {officeAddressDisplay}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Dynamic Call Choice Popup Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={callModalVisible}
        onRequestClose={() => setCallModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            {/* Header Icon */}
            <View style={styles.modalHeaderIconContainer}>
              <View style={[styles.modalHeaderIconCircle, isDark && styles.modalHeaderIconCircleDark]}>
                <Ionicons name="call" size={26} color="#2563EB" />
              </View>
            </View>

            <Text style={[styles.modalTitle, isDark && styles.textDark]}>
              Choose Number to Call
            </Text>
            <Text style={[styles.modalSubtitle, isDark && styles.subtextDark]}>
              Select which support line you would like to connect with:
            </Text>

            {/* Dynamic List of Numbers from API */}
            <View style={styles.optionsList}>
              {phoneOptions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionItem,
                    isDark ? styles.optionItemDark : styles.optionItemLight,
                  ]}
                  onPress={() => handleCallOption(item)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.optionIconBox,
                      { backgroundColor: isDark ? item.bgColorDark : item.bgColorLight },
                    ]}
                  >
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>

                  <View style={styles.optionTextCol}>
                    <Text style={[styles.optionTitle, isDark && styles.textDark]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.optionNumber, { color: item.color }]}>
                      {item.displayNumber}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={isDark ? '#64748B' : '#94A3B8'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
              onPress={() => setCallModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelButtonText, isDark && styles.textDark]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Material Alert Modal */}
      <MaterialAlertModal
        visible={alertModal.visible}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
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
    backgroundColor: '#080808',
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },

  // Support Cards
  supportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  supportCardDark: {
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleDark: {
    backgroundColor: '#1E293B',
  },
  cardTextCol: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitleText: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  mailActionButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
  },
  whatsappActionButton: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCardDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  modalHeaderIconContainer: {
    marginBottom: 14,
  },
  modalHeaderIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderIconCircleDark: {
    backgroundColor: '#0F172A',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  optionsList: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionItemLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  optionItemDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  optionNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cancelButtonDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
