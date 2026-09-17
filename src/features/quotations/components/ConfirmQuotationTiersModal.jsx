import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text as RNText,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

const TIER_META = {
  economic: { label: 'Economic' },
  premium: { label: 'Premium' },
  elite: { label: 'Elite' },
};

export default function ConfirmQuotationTiersModal({
  visible = false,
  availableTiers = ['economic', 'premium', 'elite'],
  tierTotals = {},
  onClose,
  onConfirm,
  isSubmitting = false,
  isDark = false,
}) {
  const insets = useSafeAreaInsets();
  const [selectedTiers, setSelectedTiers] = useState({});

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      const initial = {};
      availableTiers.forEach((tier) => {
        initial[tier] = true;
      });
      setSelectedTiers(initial);
    }
  }, [visible, availableTiers]);

  const toggleTier = (tier) => {
    setSelectedTiers((prev) => ({
      ...prev,
      [tier]: !prev[tier],
    }));
  };

  const selectedCount = Object.keys(selectedTiers).filter((k) => selectedTiers[k]).length;
  const allSelected = availableTiers.length > 0 && selectedCount === availableTiers.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      const empty = {};
      availableTiers.forEach((t) => {
        empty[t] = false;
      });
      setSelectedTiers(empty);
    } else {
      // Select all
      const full = {};
      availableTiers.forEach((t) => {
        full[t] = true;
      });
      setSelectedTiers(full);
    }
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    const chosen = availableTiers.filter((t) => selectedTiers[t]);
    if (chosen.length === 0) return;
    onConfirm(chosen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                isDark && styles.sheetContainerDark,
                { paddingBottom: Math.max(28, insets.bottom + 16) },
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.dragHandleWrap}>
                <View style={[styles.dragHandle, isDark && styles.dragHandleDark]} />
              </View>

              {/* Header Row: Title, Available Badge, Close Button */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                    Confirm Quotation Tiers
                  </Text>
                  <View style={[styles.availableBadge, isDark && styles.availableBadgeDark]}>
                    <Text style={styles.availableBadgeText}>
                      {availableTiers.length} Available
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.closeBtn, isDark && styles.closeBtnDark]}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              {/* Subtitle */}
              <Text style={[styles.subTitle, isDark && styles.subtextDark]}>
                Select tier options to finalize customer quote
              </Text>

              {/* Count & Toggle All Row */}
              <View style={styles.counterRow}>
                <Text style={[styles.counterText, isDark && styles.subtextDark]}>
                  {`${selectedCount} of ${availableTiers.length} Tiers Included`}
                </Text>
                <TouchableOpacity
                  onPress={toggleSelectAll}
                  style={styles.toggleAllBtn}
                  activeOpacity={0.7}
                  disabled={isSubmitting}
                >
                  {allSelected && (
                    <Ionicons name="checkmark" size={15} color="#1E40AF" style={{ marginRight: 3 }} />
                  )}
                  <Text style={styles.toggleAllText}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tiers Cards List */}
              <View style={styles.tiersList}>
                {availableTiers.map((tier) => {
                  const isChecked = Boolean(selectedTiers[tier]);
                  const meta = TIER_META[tier] || { label: tier.charAt(0).toUpperCase() + tier.slice(1) };
                  const amountNum = Math.round(Number(tierTotals[tier]) || 0);
                  const amountFormatted = `₹${amountNum.toLocaleString('en-IN')}`;

                  return (
                    <TouchableOpacity
                      key={tier}
                      style={[
                        styles.tierCard,
                        isDark && styles.tierCardDark,
                        isChecked && styles.tierCardActive,
                        isChecked && isDark && styles.tierCardActiveDark,
                      ]}
                      onPress={() => toggleTier(tier)}
                      activeOpacity={0.8}
                      disabled={isSubmitting}
                    >
                      <View style={styles.tierCardLeft}>
                        <Ionicons
                          name={isChecked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isChecked ? '#2563EB' : isDark ? '#64748B' : '#94A3B8'}
                        />
                        <Text style={[styles.tierLabel, isDark && styles.textDark]}>
                          {meta.label}
                        </Text>
                      </View>

                      <View style={styles.tierCardRight}>
                        <Text style={[styles.totalLabel, isDark && styles.subtextDark]}>
                          Total
                        </Text>
                        <Text style={[styles.totalAmount, isDark && styles.textDark]}>
                          {amountFormatted}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bottom Actions: Cancel & Confirm & Proceed */}
              <View style={styles.footerBtnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, isDark && styles.cancelBtnDark]}
                  onPress={onClose}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.cancelBtnText, isDark && styles.textDark]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (selectedCount === 0 || isSubmitting) && { opacity: 0.6 },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                  disabled={selectedCount === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.confirmBtnText}>Confirm & Proceed</Text>
                      <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetContainerDark: {
    backgroundColor: '#1E1E1E',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dragHandleDark: {
    backgroundColor: '#475569',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  availableBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availableBadgeDark: {
    backgroundColor: '#1E293B',
    borderColor: '#2563EB40',
  },
  availableBadgeText: {
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
    backgroundColor: '#262626',
  },
  subTitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 12,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  tiersList: {
    gap: 10,
    marginBottom: 18,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tierCardDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  tierCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#FBFDFF',
  },
  tierCardActiveDark: {
    borderColor: '#3B82F6',
    backgroundColor: '#111827',
  },
  tierCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  tierCardRight: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 1,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDark: {
    backgroundColor: '#1E1E1E',
    borderColor: '#334155',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
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
