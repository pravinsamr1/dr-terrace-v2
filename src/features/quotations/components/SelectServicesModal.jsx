import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SelectServicesModal({
  visible = false,
  availableServices = [],
  selectedMap = {},
  onClose,
  onApply,
  isDark = false,
}) {
  const [localSelectedMap, setLocalSelectedMap] = useState({});

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      setLocalSelectedMap({ ...selectedMap });
    }
  }, [visible, selectedMap]);

  const toggleService = (sName) => {
    setLocalSelectedMap((prev) => ({
      ...prev,
      [sName]: !prev[sName],
    }));
  };

  const clearAll = () => {
    setLocalSelectedMap({});
  };

  const selectedCount = Object.keys(localSelectedMap).filter((k) => localSelectedMap[k]).length;

  const handleApply = () => {
    onApply(localSelectedMap);
  };

  const services = Array.isArray(availableServices) && availableServices.length > 0
    ? availableServices
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogContainer, isDark && styles.dialogContainerDark]}>
              {/* Modal Header */}
              <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
                <View style={styles.headerLeft}>
                  <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                    Select Services
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {selectedCount} selected
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, isDark && styles.closeBtnDark]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Services List */}
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {services.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons
                      name="layers-outline"
                      size={28}
                      color={isDark ? '#64748B' : '#94A3B8'}
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={[styles.emptyText, isDark && styles.subtextDark]}>
                      No services available
                    </Text>
                  </View>
                ) : (
                  services.map((serviceName) => {
                    const isChecked = Boolean(localSelectedMap[serviceName]);
                    return (
                      <TouchableOpacity
                        key={serviceName}
                        style={[
                          styles.serviceItem,
                          isDark && styles.serviceItemDark,
                          isChecked && styles.serviceItemActive,
                          isChecked && isDark && styles.serviceItemActiveDark,
                        ]}
                        onPress={() => toggleService(serviceName)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.checkboxWrap}>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isChecked ? '#2B59A2' : isDark ? '#64748B' : '#94A3B8'}
                          />
                        </View>
                        <View style={styles.serviceInfo}>
                          <Text
                            style={[
                              styles.serviceTitle,
                              isDark && styles.textDark,
                              isChecked && styles.serviceTitleActive,
                            ]}
                          >
                            {serviceName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {/* Sticky Footer */}
              <View style={[styles.footer, isDark && styles.footerDark]}>
                <View style={styles.footerTopRow}>
                  <Text style={[styles.footerCountText, isDark && styles.subtextDark]}>
                    <Text style={[styles.footerCountBold, isDark && styles.textDark]}>
                      {selectedCount}
                    </Text>{' '}
                    services selected
                  </Text>
                  {selectedCount > 0 && (
                    <TouchableOpacity onPress={clearAll}>
                      <Text style={styles.clearAllText}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.footerBtnRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, isDark && styles.cancelBtnDark]}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cancelBtnText, isDark && styles.textDark]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={handleApply}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.applyBtnText}>
                      Apply ({selectedCount})
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 400,
    minHeight: 280,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  dialogContainerDark: {
    backgroundColor: '#1E1E1E',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRowDark: {
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDark: {
    backgroundColor: '#334155',
  },
  scrollArea: {
    minHeight: 140,
    maxHeight: 380,
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  serviceItemDark: {
    backgroundColor: '#262626',
    borderColor: '#383838',
  },
  serviceItemActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F7FF',
  },
  serviceItemActiveDark: {
    borderColor: '#2563EB',
    backgroundColor: '#172554',
  },
  checkboxWrap: {
    marginRight: 10,
  },
  serviceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  serviceTitleActive: {
    color: '#1E40AF',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  footerDark: {
    backgroundColor: '#171717',
    borderTopColor: '#334155',
  },
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  footerCountText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerCountBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  applyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2B59A2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
