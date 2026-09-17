import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ServiceConfigCard({
  serviceName,
  index = 0,
  area = '',
  rate = '',
  spec = '',
  tierLabel = 'Premium',
  subtitles = [],
  selectedSubtitle = '',
  onSelectSubtitle,
  onUpdateField,
  onRemove,
  isDark = false,
}) {
  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [subtitleDropdownOpen, setSubtitleDropdownOpen] = useState(false);
  const areaNum = parseFloat(area) || 0;
  const rateNum = parseFloat(rate) || 0;
  const lineSubtotal = Math.round(areaNum * rateNum);

  const hasSubtitles = Array.isArray(subtitles) && subtitles.length > 0;
  const isSubtitleChosen = Boolean(selectedSubtitle && String(selectedSubtitle).trim() !== '');

  const currentSub = hasSubtitles && isSubtitleChosen
    ? (subtitles || []).find(
        (s) => String(s.subtitle || '').toLowerCase() === String(selectedSubtitle).toLowerCase()
      )
    : null;

  const currentSelectedTitle = currentSub
    ? `${currentSub.subtitle || 'Selected'}`
    : (isSubtitleChosen ? selectedSubtitle : 'Select Variation / Subtitle');

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      {/* Card Header: Service Index, Name, Line Subtotal, and Remove Button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.indexBadge, isDark && styles.indexBadgeDark]}>
            <Text style={styles.indexBadgeText}>{index + 1}</Text>
          </View>
          <Text style={[styles.serviceTitle, isDark && styles.textDark]} numberOfLines={1}>
            {serviceName}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {lineSubtotal > 0 && (
            <Text style={[styles.subtotalChipText, isDark && styles.subtotalChipTextDark]}>
              Rs.{lineSubtotal.toLocaleString()}
            </Text>
          )}
          {onRemove && (
            <TouchableOpacity
              onPress={() => onRemove(serviceName)}
              style={styles.removeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Variation / Subtitle Dropdown */}
      {hasSubtitles && (
        <View style={styles.dropdownContainer}>
          <Text style={[styles.fieldLabel, isDark && styles.labelDark]}>Variation / Subtitle</Text>
          <TouchableOpacity
            style={[
              styles.dropdownHeader,
              isDark && styles.dropdownHeaderDark,
              !isSubtitleChosen && styles.dropdownHeaderUnselected,
            ]}
            onPress={() => setSubtitleDropdownOpen(!subtitleDropdownOpen)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dropdownHeaderText,
                isDark && styles.textDark,
                !isSubtitleChosen && (isDark ? styles.subtextDark : styles.placeholderText),
              ]}
              numberOfLines={1}
            >
              {currentSelectedTitle}
            </Text>
            <Ionicons
              name={subtitleDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>

          {subtitleDropdownOpen && (
            <View style={[styles.dropdownList, isDark && styles.dropdownListDark]}>
              {subtitles.map((subItem) => {
                const sTitle = subItem.subtitle || 'Default';
                const isSelected = isSubtitleChosen && String(selectedSubtitle).toLowerCase() === sTitle.toLowerCase();
                const displayLabel = `${sTitle} (₹${subItem.rate}/sq.ft)`;
                return (
                  <TouchableOpacity
                    key={String(subItem.serviceDetailId || sTitle)}
                    style={[
                      styles.dropdownItem,
                      isDark && styles.dropdownItemDark,
                      isSelected && { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
                    ]}
                    onPress={() => {
                      if (onSelectSubtitle) onSelectSubtitle(serviceName, subItem);
                      setSubtitleDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isDark && styles.textDark,
                        isSelected && { color: '#2563EB', fontWeight: '700' },
                      ]}
                    >
                      {displayLabel}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!isSubtitleChosen && (
            <View style={[styles.variationHintBox, isDark && styles.variationHintBoxDark]}>
              <Ionicons name="information-circle-outline" size={14} color="#2563EB" style={{ marginRight: 5 }} />
              <Text style={[styles.variationHintText, isDark && styles.variationHintTextDark]}>
                Please choose a variation above to view specification & description
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Grid: Area (sq.ft) and Price / sq.ft side-by-side */}
      <View style={styles.gridRow}>
        {/* Area Input */}
        <View style={styles.gridCol}>
          <Text style={[styles.fieldLabel, isDark && styles.labelDark]}>Area (sq.ft)</Text>
          <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
            <TextInput
              style={[styles.numericInput, isDark && styles.textDark]}
              keyboardType="numeric"
              value={String(area ?? '')}
              onChangeText={(val) => onUpdateField(serviceName, 'area', val)}
              placeholder="e.g. 1000"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text style={[styles.unitTag, isDark && styles.subtextDark]}>sq.ft</Text>
          </View>
        </View>

        {/* Rate Input */}
        <View style={styles.gridCol}>
          <Text style={[styles.fieldLabel, isDark && styles.labelDark]}>Price / sq.ft</Text>
          <View style={[styles.inputWrap, isDark && styles.inputWrapDark]}>
            <Text style={[styles.currencyPrefix, isDark && styles.subtextDark]}>₹</Text>
            <TextInput
              style={[styles.numericInput, isDark && styles.textDark]}
              keyboardType="numeric"
              value={String(rate ?? '')}
              onChangeText={(val) => onUpdateField(serviceName, 'rate', val)}
              placeholder="45"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text style={[styles.unitTag, isDark && styles.subtextDark]}>/sq.ft</Text>
          </View>
        </View>
      </View>

      {/* Specification / Description Box - Only shown if variation is chosen (or if service has no variations) */}
      {(!hasSubtitles || isSubtitleChosen) && (
        <View style={styles.specContainer}>
          <View style={styles.specHeaderRow}>
            <Text style={[styles.fieldLabel, isDark && styles.labelDark]}>
              Service Description ({tierLabel})
            </Text>
            <TouchableOpacity
              onPress={() => setIsEditingSpec(!isEditingSpec)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.editSpecToggleText}>
                {isEditingSpec ? 'Done' : 'Edit Spec'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingSpec ? (
            <TextInput
              style={[styles.specInput, isDark && styles.specInputDark]}
              multiline
              numberOfLines={3}
              value={spec}
              onChangeText={(val) => onUpdateField(serviceName, 'spec', val)}
              placeholder="Enter technical specifications..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            />
          ) : (
            <TouchableOpacity
              style={[styles.specBox, isDark && styles.specBoxDark]}
              onPress={() => setIsEditingSpec(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.specText, isDark && styles.subtextDark]}>
                {spec || 'Standard waterproofing treatment as per package specification. Tap to edit.'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  cardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  indexBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2B59A2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  indexBadgeDark: {
    backgroundColor: '#2563EB',
  },
  indexBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  serviceTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtotalChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2B59A2',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  subtotalChipTextDark: {
    backgroundColor: '#1E293B',
    color: '#60A5FA',
  },
  removeBtn: {
    padding: 3,
  },
  dropdownContainer: {
    marginBottom: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  dropdownHeaderDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  dropdownHeaderText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownListDark: {
    backgroundColor: '#1E1E1E',
    borderColor: '#334155',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemDark: {
    borderBottomColor: '#262626',
  },
  dropdownItemText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#1E293B',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  gridCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  labelDark: {
    color: '#CBD5E1',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 40,
  },
  inputWrapDark: {
    backgroundColor: '#141414',
    borderColor: '#334155',
  },
  currencyPrefix: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 3,
  },
  numericInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },
  unitTag: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 3,
  },
  specContainer: {
    marginTop: 2,
  },
  specHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editSpecToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  specBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  specBoxDark: {
    backgroundColor: '#141414',
    borderColor: '#262626',
  },
  specText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  specInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 17,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  specInputDark: {
    backgroundColor: '#141414',
    borderColor: '#2563EB',
    color: '#F8FAFC',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  dropdownHeaderUnselected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  placeholderText: {
    color: '#64748B',
    fontWeight: '500',
  },
  variationHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  variationHintBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  variationHintText: {
    fontSize: 11.5,
    color: '#1D4ED8',
    fontWeight: '600',
    flex: 1,
  },
  variationHintTextDark: {
    color: '#93C5FD',
  },
});
