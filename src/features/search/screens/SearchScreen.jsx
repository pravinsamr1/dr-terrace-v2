import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useOsmAreas, useOsmCities } from '../../../core/hooks/useOsmAreas';
import InnerHeader from '../../../shared/components/InnerHeader';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { handleScroll } = useTabBarScroll();
  
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  
  const [clientName, setClientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Live OpenStreetMap Nominatim Area suggestions
  const {
    suggestions: areaSuggestionsList,
    isLoading: isLoadingOsm,
    showSuggestions: showAreaSuggestions,
    setShowSuggestions: setShowAreaSuggestions,
  } = useOsmAreas(area, city);

  // Live OpenStreetMap Nominatim City suggestions
  const {
    citySuggestions: citySuggestionsList,
    isLoadingCity: isLoadingOsmCity,
    showCitySuggestions,
    setShowCitySuggestions,
  } = useOsmCities(city);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const res = await appointmentRepository.searchAppointments({
        city: city.trim(),
        area: area.trim(),
        clientName: clientName.trim(),
        phoneNumber: phoneNumber.trim(),
      }, 1, 50);

      if (res?.success) {
        setSearchResults(res.appointments || []);
      } else {
        setSearchResults([]);
      }
    } catch (_err) {
      setSearchResults([]);
    } finally {
      setIsLoading(false);
      setIsSearched(true);
    }
  };

  const handleReset = () => {
    setCity('');
    setArea('');
    setShowAreaSuggestions(false);
    setShowCitySuggestions(false);
    setClientName('');
    setPhoneNumber('');
    setIsSearched(false);
    setSearchResults([]);
  };

  const isAnyDropdownOpen = showAreaSuggestions || showCitySuggestions;

  const closeAllDropdowns = () => {
    setShowAreaSuggestions(false);
    setShowCitySuggestions(false);
    Keyboard.dismiss();
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'site visit': return '#FC6262';
      case 'quotation': return '#FF922B';
      case 'outstanding': return '#F59F00';
      case 'completed': return '#20C997';
      default: return '#FC6262';
    }
  };

  const getStatusText = (status) => {
    switch(status?.toLowerCase()) {
      case 'site visit': return 'Site Visit Pending';
      case 'quotation': return 'Quotation Pending';
      case 'outstanding': return 'Outstanding Payment';
      case 'completed': return 'Completed';
      default: return status || 'Pending';
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Search Client" paddingTop={insets.top} isDark={isDark} />

      {/* Global 1-Tap Outside Dismiss Backdrop */}
      {isAnyDropdownOpen && (
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={closeAllDropdowns}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 84, 110) },
        ]}
      >
        {/* Search Fields Form */}
        <View style={styles.formContainer}>
          {/* Area Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Area</Text>
            <View style={[
              styles.searchBarWrapper,
              isDark && styles.searchBarWrapperDark,
            ]}>
              <Ionicons 
                name="map-outline" 
                size={20} 
                color={isDark ? '#94A3B8' : '#64748B'} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.textDark]}
                placeholder="Type area (min 3 characters for suggestions)"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={area}
                onChangeText={(text) => {
                  setArea(text);
                }}
                onFocus={() => {
                  if (area.trim().length >= 3) setShowAreaSuggestions(true);
                  setShowCitySuggestions(false);
                }}
              />
              {isLoadingOsm && (
                <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#0F172A'} style={{ marginRight: 6 }} />
              )}
              {area.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setArea('');
                    setShowAreaSuggestions(false);
                  }}
                  style={styles.clearIcon}
                >
                  <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3+ Character Area Auto-Suggestions Dropdown */}
            {showAreaSuggestions && (areaSuggestionsList.length > 0 || isLoadingOsm) && (
              <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark, { marginTop: 4 }]}>
                <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    SUGGESTED AREAS ({areaSuggestionsList.length})
                  </Text>
                </View>
                {isLoadingOsm && areaSuggestionsList.length === 0 ? (
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#0F172A'} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#0F172A', fontWeight: '500' }}>
                      Searching OpenStreetMap...
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={true}
                    scrollEnabled={true}
                  >
                    {areaSuggestionsList.map((item, idx) => {
                      const areaName = item.name || item;
                      const isSelected = area.toLowerCase() === areaName.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.dropdownMenuItem,
                            isSelected && styles.dropdownMenuItemSelected,
                            isSelected && isDark && styles.dropdownMenuItemSelectedDark,
                            { paddingVertical: 10 },
                          ]}
                          onPress={() => {
                            setArea(areaName);
                            setShowAreaSuggestions(false);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="location-sharp" size={16} color="#2B4C99" style={{ marginRight: 8, marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.dropdownMenuItemText, isDark && styles.textDark, { fontWeight: '700' }]}>
                                {areaName}
                              </Text>
                              {item.displayName && item.displayName !== areaName && (
                                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }} numberOfLines={1}>
                                  {item.displayName}
                                </Text>
                              )}
                            </View>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark" size={18} color="#2B4C99" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* City Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textDark]}>City</Text>
            <View style={[
              styles.searchBarWrapper,
              isDark && styles.searchBarWrapperDark,
            ]}>
              <Ionicons 
                name="business-outline" 
                size={20} 
                color={isDark ? '#94A3B8' : '#64748B'} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.textDark]}
                placeholder="Enter city (e.g. Chennai)"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  setShowCitySuggestions(text.trim().length >= 3);
                }}
                onFocus={() => {
                  if (city.trim().length >= 3) setShowCitySuggestions(true);
                  setShowAreaSuggestions(false);
                }}
              />
              {isLoadingOsmCity && (
                <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#0F172A'} style={{ marginRight: 6 }} />
              )}
              {city.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCity('');
                    setShowCitySuggestions(false);
                  }}
                  style={styles.clearIcon}
                >
                  <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>

            {/* 3+ Character City Auto-Suggestions Dropdown */}
            {showCitySuggestions && (citySuggestionsList.length > 0 || isLoadingOsmCity) && (
              <View style={[styles.dropdownMenu, isDark && styles.dropdownMenuDark, { marginTop: 4 }]}>
                <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    SUGGESTED CITIES ({citySuggestionsList.length})
                  </Text>
                </View>
                {isLoadingOsmCity && citySuggestionsList.length === 0 ? (
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#0F172A'} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#0F172A', fontWeight: '500' }}>
                      Searching OpenStreetMap...
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={true}
                    scrollEnabled={true}
                  >
                    {citySuggestionsList.map((cName, idx) => {
                      const isSelected = city.toLowerCase() === cName.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.dropdownMenuItem,
                            isSelected && styles.dropdownMenuItemSelected,
                            isSelected && isDark && styles.dropdownMenuItemSelectedDark,
                            { paddingVertical: 10 },
                          ]}
                          onPress={() => {
                            setCity(cName);
                            setShowCitySuggestions(false);
                            Keyboard.dismiss();
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="business" size={16} color="#2B4C99" style={{ marginRight: 8 }} />
                            <Text style={[styles.dropdownMenuItemText, isDark && styles.textDark, { fontWeight: '700' }]}>
                              {cName}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark" size={18} color="#2B4C99" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Client Name Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Client Name</Text>
            <View style={[styles.searchBarWrapper, isDark && styles.searchBarWrapperDark]}>
              <Ionicons 
                name="person-outline" 
                size={20} 
                color={isDark ? '#94A3B8' : '#64748B'} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.textDark]}
                placeholder="Enter client name"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={clientName}
                onChangeText={setClientName}
              />
              {clientName.length > 0 && (
                <TouchableOpacity onPress={() => setClientName('')} style={styles.clearIcon}>
                  <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Phone Number Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && styles.textDark]}>Phone Number</Text>
            <View style={[styles.searchBarWrapper, isDark && styles.searchBarWrapperDark]}>
              <Ionicons 
                name="call-outline" 
                size={20} 
                color={isDark ? '#94A3B8' : '#64748B'} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.textDark]}
                placeholder="Enter phone number"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              {phoneNumber.length > 0 && (
                <TouchableOpacity onPress={() => setPhoneNumber('')} style={styles.clearIcon}>
                  <Ionicons name="close-circle" size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.searchButton, isLoading && { opacity: 0.8 }]}
              onPress={handleSearch}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="search" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.searchButtonText}>{isLoading ? 'Searching...' : 'Search'}</Text>
            </TouchableOpacity>

            {(city.length > 0 || area.length > 0 || clientName.length > 0 || phoneNumber.length > 0 || isSearched) && (
              <TouchableOpacity 
                style={[styles.resetButton, isDark && styles.resetButtonDark]}
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={[styles.resetButtonText, isDark && styles.subtextDark]}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results Display */}
        {isSearched && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, isDark && styles.textDark]}>
                Search Results ({searchResults.length})
              </Text>
            </View>
            
            {searchResults.length === 0 ? (
              <View style={styles.infoWrapper}>
                <Ionicons name="alert-circle-outline" size={56} color={isDark ? '#475569' : '#CBD5E1'} style={{ marginBottom: 12 }} />
                <Text style={[styles.infoTitle, isDark && styles.textDark]}>No Results Found</Text>
                <Text style={[styles.infoText, isDark && styles.subtextDark]}>
                  {`No clients found for city "${city}"${area ? `, area "${area}"` : ''}${clientName ? `, name "${clientName}"` : ''}${phoneNumber ? `, phone "${phoneNumber}"` : ''}. Try modifying your search criteria.`}
                </Text>
              </View>
            ) : (
              searchResults.map((app) => {
                const displayId = app.id === 1 ? '12345' : `DR${app.id}`;
                const nameDisplay = app.clientName || app.name || 'Unknown Client';
                const phoneDisplay = app.clientPhone || app.phone || 'N/A';
                const locationDisplay = app.address || app.location || 'N/A';
                const areaDisplay = app.area || app.location || '';
                const cityDisplay = app.city || '';

                return (
                  <TouchableOpacity
                    key={`app-${app.id}`}
                    style={[styles.resultCard, isDark && styles.resultCardDark]}
                    activeOpacity={0.9}
                    onPress={() => router.push({ pathname: '/customer-detail', params: { id: app.id }})}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.headerTop}>
                        <View style={styles.idContainer}>
                          <Text style={[styles.customerId, isDark && styles.textDark]}>ID: {displayId}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: getStatusColor(app.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(app.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(app.status) }]}>
                            {getStatusText(app.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardMain}>
                      <View style={styles.profileBox}>
                        <View style={[styles.avatarBox, isDark && styles.avatarBoxDark]}>
                          <Ionicons name="person" size={20} color="#0052CC" />
                        </View>
                        <View style={styles.nameBox}>
                          <Text style={[styles.clientNameText, isDark && styles.textDark]}>{nameDisplay}</Text>
                          <Text style={[styles.phoneText, isDark && styles.subtextDark]}>
                            <Ionicons name="call-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} /> {phoneDisplay}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
                      </View>

                      <View style={[styles.infoGrid, isDark && styles.infoGridDark]}>
                        <View style={styles.infoRow}>
                          <View style={styles.infoItem}>
                            <Ionicons name="business-outline" size={14} color="#0052CC" />
                            <Text style={styles.infoLabel}>City / Area</Text>
                          </View>
                          <Text style={[styles.infoValue, isDark && styles.textDark]} numberOfLines={1}>
                            {cityDisplay && areaDisplay ? `${cityDisplay} - ${areaDisplay}` : locationDisplay}
                          </Text>
                        </View>

                        <View style={styles.infoRow}>
                          <View style={styles.infoItem}>
                            <Ionicons name="construct-outline" size={14} color="#64748B" />
                            <Text style={styles.infoLabel}>Service</Text>
                          </View>
                          <Text style={[styles.infoValue, isDark && styles.textDark]} numberOfLines={1}>
                            {app.serviceType || 'Terrace Waterproofing'}
                          </Text>
                        </View>

                        <View style={styles.infoRow}>
                          <View style={styles.infoItem}>
                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                            <Text style={styles.infoLabel}>Date</Text>
                          </View>
                          <Text style={[styles.infoValue, isDark && styles.textDark]}>
                            {app.appointmentDate || '28/05/2026'}
                          </Text>
                        </View>

                        <View style={styles.infoRow}>
                          <View style={styles.infoItem}>
                            <Ionicons name="document-text-outline" size={14} color="#64748B" />
                            <Text style={styles.infoLabel}>Quotation</Text>
                          </View>
                          <Text style={[styles.infoValue, { color: app.quotations?.length > 0 ? '#10B981' : '#F59E0B' }]}>
                            {app.quotations?.length > 0 ? 'Generated' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.detailsBtn}>
                        <Text style={styles.detailsBtnText}>View Full Details</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
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
    backgroundColor: '#090D16',
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 6,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1', 
    height: 52,
    paddingHorizontal: 14,
  },
  searchBarWrapperDark: {
    backgroundColor: '#161F33',
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  searchButton: {
    backgroundColor: '#0052CC',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonDark: {
    backgroundColor: '#334155',
  },
  resetButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 12,
  },
  resultsHeader: {
    marginBottom: 14,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultCardDark: {
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  cardHeader: {
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idContainer: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customerId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMain: {
    gap: 14,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBoxDark: {
    backgroundColor: '#1E293B',
  },
  nameBox: {
    flex: 1,
  },
  clientNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  infoGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  infoGridDark: {
    backgroundColor: '#0F172A',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: '60%',
  },
  cardFooter: {
    marginTop: 16,
  },
  detailsBtn: {
    backgroundColor: '#0052CC',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    },
  detailsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    height: '100%',
  },
  dropdownValueText: {
    fontSize: 15,
    color: '#000000',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    zIndex: 99,
    },
  dropdownMenuDark: {
    borderColor: '#334155',
    backgroundColor: '#1C1C1C',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  dropdownMenuItemSelected: {
    backgroundColor: '#E0F2FE',
  },
  dropdownMenuItemSelectedDark: {
    backgroundColor: 'rgba(3, 105, 161, 0.25)',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    color: '#333333',
  },
  dropdownMenuItemTextSelected: {
    color: '#2B4C99',
    fontWeight: '700',
  },
  searchInputCustom: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: '#000000',
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  infoWrapper: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  infoTitle: {
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 6,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});

