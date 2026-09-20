import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'M/s'];

/**
 * TitleDropdown Component
 * Compact, polished dropdown selector for titles / salutations: Mr, Mrs, Ms, M/s
 *
 * @param {Object} props
 * @param {string} props.value - Currently selected title ('Mr', 'Mrs', 'Ms', 'M/s')
 * @param {(val: string) => void} props.onChange - Callback when a title is selected
 * @param {boolean} [props.isDark=false] - Whether dark mode is active
 * @param {string[]} [props.options] - Custom options list, defaults to ['Mr', 'Mrs', 'Ms', 'M/s']
 * @param {boolean} [props.disabled=false] - Whether the dropdown is disabled
 * @param {object} [props.style] - Optional override style for the trigger button
 */
export default function TitleDropdown({
  value = 'Mr',
  onChange,
  isDark = false,
  options = TITLE_OPTIONS,
  disabled = false,
  style,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option) => {
    if (onChange) {
      onChange(option);
    }
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isDark && styles.buttonDark,
          disabled && styles.buttonDisabled,
          style,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Title prefix selector, currently ${value || 'Mr'}`}
      >
        <Text
          style={[
            styles.buttonText,
            isDark && styles.buttonTextDark,
            disabled && styles.buttonTextDisabled,
          ]}
          numberOfLines={1}
        >
          {value || 'Mr'}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isDark ? '#94A3B8' : '#64748B'}
          style={styles.chevronIcon}
        />
      </TouchableOpacity>

      {/* Modal Picker */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={[styles.modalCard, isDark && styles.modalCardDark]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={isDark ? '#38BDF8' : '#0052CC'}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                  Select Title
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close title picker"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={isDark ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <View style={styles.optionsList}>
              {options.map((opt) => {
                const isSelected = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.optionItem,
                      isDark && styles.optionItemDark,
                      isSelected && styles.optionItemSelected,
                      isSelected && isDark && styles.optionItemSelectedDark,
                    ]}
                    onPress={() => handleSelect(opt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isDark && styles.optionTextDark,
                        isSelected && styles.optionTextSelected,
                        isSelected && isDark && styles.optionTextSelectedDark,
                      ]}
                    >
                      {opt}
                    </Text>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={isDark ? '#38BDF8' : '#0052CC'}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={18}
                        color={isDark ? '#475569' : '#CBD5E1'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Self container
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 88,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  buttonDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  buttonTextDark: {
    color: '#F8FAFC',
  },
  buttonTextDisabled: {
    color: '#94A3B8',
  },
  chevronIcon: {
    marginLeft: 4,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderDark: {
    borderBottomColor: '#334155',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalTitleDark: {
    color: '#F8FAFC',
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  optionItemDark: {
    backgroundColor: '#0F172A',
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  optionItemSelectedDark: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  optionTextDark: {
    color: '#CBD5E1',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: '#0052CC',
  },
  optionTextSelectedDark: {
    fontWeight: '700',
    color: '#38BDF8',
  },
});
