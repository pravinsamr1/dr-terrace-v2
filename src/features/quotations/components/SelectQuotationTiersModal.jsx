import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text as RNText,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

const ALL_TIERS = [
  { id: 'economic', label: 'Economic' },
  { id: 'premium', label: 'Premium' },
  { id: 'elite', label: 'Elite' },
];

export default function SelectQuotationTiersModal({
  visible = false,
  initialTiers = ['economic', 'premium', 'elite'],
  existingTiers = [],
  disabledTiers = [],
  onClose,
  onConfirm,
  isDark = false,
}) {
  const insets = useSafeAreaInsets();

  // Normalize disabled/existing tier IDs
  const disabledSet = React.useMemo(() => {
    return new Set(
      [...(existingTiers || []), ...(disabledTiers || [])]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase().trim())
    );
  }, [existingTiers, disabledTiers]);

  const [selectedTiers, setSelectedTiers] = useState({
    economic: false,
    premium: false,
    elite: false,
  });

  useEffect(() => {
    if (visible) {
      const state = { economic: false, premium: false, elite: false };
      const raw = initialTiers || ['economic', 'premium', 'elite'];
      raw.forEach((t) => {
        const key = String(t).toLowerCase().trim();
        // Only select if the tier is not already created / disabled
        if (state.hasOwnProperty(key) && !disabledSet.has(key)) {
          state[key] = true;
        }
      });
      setSelectedTiers(state);
    }
  }, [visible, initialTiers, disabledSet]);

  const toggleTier = (id) => {
    if (disabledSet.has(id.toLowerCase())) return;
    setSelectedTiers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectedCount = Object.keys(selectedTiers).filter(
    (k) => selectedTiers[k] && !disabledSet.has(k)
  ).length;

  const allDisabled = ALL_TIERS.every((t) => disabledSet.has(t.id.toLowerCase()));

  const handleConfirm = () => {
    const chosen = ALL_TIERS
      .filter((t) => selectedTiers[t.id] && !disabledSet.has(t.id))
      .map((t) => t.id);
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
            <View style={[styles.sheetContainer, isDark && styles.sheetContainerDark]}>
              {/* Drag Handle */}
              <View style={styles.dragHandleWrap}>
                <View style={[styles.dragHandle, isDark && styles.dragHandleDark]} />
              </View>

              {/* Sheet Header */}
              <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
                <View style={styles.headerLeft}>
                  <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                    Select Quotation Tiers
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.closeBtn, isDark && styles.closeBtnDark]}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              {/* Subtitle */}
              <Text style={[styles.subtitle, isDark && styles.subtextDark]}>
                {allDisabled
                  ? 'All quotation tiers have already been created for this project.'
                  : 'Choose quotation tiers to generate.'}
              </Text>

              {/* Scrollable Content */}
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Tier Checklist Options */}
                {ALL_TIERS.map((tier) => {
                  const isDisabled = disabledSet.has(tier.id.toLowerCase());
                  const isChecked = !isDisabled && Boolean(selectedTiers[tier.id]);

                  return (
                    <TouchableOpacity
                      key={tier.id}
                      style={[
                        styles.tierCard,
                        isDark && styles.tierCardDark,
                        isDisabled && (isDark ? styles.tierCardDisabledDark : styles.tierCardDisabled),
                      ]}
                      onPress={() => toggleTier(tier.id)}
                      disabled={isDisabled}
                      activeOpacity={isDisabled ? 1 : 0.75}
                    >
                      <View style={styles.tierInfoRow}>
                        <Text
                          style={[
                            styles.tierName,
                            isDark && styles.textDark,
                            isDisabled && (isDark ? styles.tierNameDisabledDark : styles.tierNameDisabled),
                          ]}
                        >
                          {tier.label}
                        </Text>
                        {isDisabled && (
                          <View style={[styles.existingBadge, isDark && styles.existingBadgeDark]}>
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={isDark ? '#34D399' : '#059669'}
                              style={{ marginRight: 3 }}
                            />
                            <Text style={[styles.existingBadgeText, isDark && styles.existingBadgeTextDark]}>
                              Already Created
                            </Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={[
                          styles.checkboxBox,
                          isChecked && styles.checkboxBoxActive,
                          isDark && styles.checkboxBoxDark,
                          isChecked && isDark && styles.checkboxBoxActiveDark,
                          isDisabled && (isDark ? styles.checkboxBoxDisabledDark : styles.checkboxBoxDisabled),
                        ]}
                      >
                        {isChecked && (
                          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                        )}
                        {isDisabled && (
                          <Ionicons name="lock-closed" size={11} color={isDark ? '#52525B' : '#94A3B8'} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Sheet Footer */}
              <View
                style={[
                  styles.footer,
                  isDark && styles.footerDark,
                  { paddingBottom: Math.max(24, insets.bottom + 16) },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.createBtn,
                    (selectedCount === 0 || allDisabled) && styles.createBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={selectedCount === 0 || allDisabled}
                  activeOpacity={0.85}
                >
                  <Text style={styles.createBtnText}>
                    {allDisabled
                      ? 'All Tiers Already Created'
                      : selectedCount > 0
                      ? `✨ Create Quotation (${selectedCount} Selected)`
                      : 'Select at least 1 Tier'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, isDark && styles.subtextDark]}>
                    Cancel
                  </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetContainerDark: {
    backgroundColor: '#1E1E1E',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
  },
  dragHandleDark: {
    backgroundColor: '#475569',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerRowDark: {
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
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
    backgroundColor: '#1E293B',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollArea: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tierCardDark: {
    backgroundColor: '#262626',
    borderColor: '#383838',
  },
  tierCardDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.65,
  },
  tierCardDisabledDark: {
    backgroundColor: '#1E1E24',
    borderColor: '#2D2D35',
    opacity: 0.6,
  },
  tierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  tierName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  tierNameDisabled: {
    color: '#64748B',
  },
  tierNameDisabledDark: {
    color: '#94A3B8',
  },
  existingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  existingBadgeDark: {
    backgroundColor: '#064E3B',
    borderColor: '#065F46',
  },
  existingBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  existingBadgeTextDark: {
    color: '#6EE7B7',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxDark: {
    borderColor: '#64748B',
  },
  checkboxBoxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxBoxActiveDark: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxBoxDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  checkboxBoxDisabledDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  footerDark: {
    backgroundColor: '#171717',
    borderTopColor: '#334155',
  },
  createBtn: {
    backgroundColor: '#1D4ED8',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
