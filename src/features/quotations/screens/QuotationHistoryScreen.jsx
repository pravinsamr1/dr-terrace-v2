import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { clientRepository as clientService } from '../../clients/api/clientRepository';
import { appointmentRepository as appointmentService } from '../../appointments/api/appointmentRepository';
import { MaterialDetailSkeleton } from '../../../shared/components/material';
import InnerHeader from '../../../shared/components/InnerHeader';

export default function QuotationHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [apiQuotations, setApiQuotations] = useState([]);
  const [apiPackages, setApiPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedActiveId, setSelectedActiveId] = useState(null);

  // Clear client data when customer id changes
  useEffect(() => {
    setClientData(null);
    setApiQuotations([]);
    setApiPackages([]);
  }, [params.id]);

  // Fetch client/appointment details and quotations
  useEffect(() => {
    let isMounted = true;
    const fetchAppOrClient = async () => {
      if (!params.id) return;
      setIsLoading(true);
      try {
        const clientRes = await clientService.getClientById(params.id);
        if (clientRes && clientRes.success && clientRes.client) {
          if (isMounted) setClientData(clientRes.client);
        } else {
          const appRes = await appointmentService.getAppointmentById(params.id);
          if (appRes && appRes.success && appRes.appointment) {
            if (isMounted) setClientData(appRes.appointment);
          }
        }

        // Fetch API package-grouped quotations
        const quotsRes = await clientService.getCustomerQuotations(params.id);
        if (quotsRes && quotsRes.success) {
          if (isMounted) {
            if (Array.isArray(quotsRes.packages)) setApiPackages(quotsRes.packages);
            if (Array.isArray(quotsRes.quotations)) setApiQuotations(quotsRes.quotations);
          }
        }
      } catch (e) {
        console.warn('Failed to load client for quotation-history:', e?.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchAppOrClient();
    return () => {
      isMounted = false;
    };
  }, [params.id]);

  // Find corresponding appointment
  const app = useMemo(() => {
    if (clientData && (String(clientData.id) === String(params.id) || String(clientData.appointmentId) === String(params.id))) {
      return clientData;
    }
    return params.id ? { id: params.id, appointmentId: params.id, clientName: 'Valued Client' } : null;
  }, [clientData, params.id]);

  const DEFAULT_TIERS_CONFIG = [
    {
      id: 'Economic',
      packageId: 1,
      packages: 'Economic',
      packageName: 'Polymer Method',
      title: 'Economic Package (Polymer Method)',
      subtitle: 'Polymer Method (5 Years Warranty)',
      quoteForDefault: 'Polymer Method',
      warranty: '5 Years',
      color: '#2563EB',
      lightBg: '#EFF6FF',
      darkBg: '#172554',
      badgeBg: '#DBEAFE',
      activeBorder: '#7C9EE9',
      icon: 'shield-checkmark',
    },
    {
      id: 'Premium',
      packageId: 2,
      packages: 'Premium',
      packageName: 'Polyurethane Method',
      title: 'Premium Package (Polyurethane Method)',
      subtitle: 'Polyurethane Method (10 Years Warranty)',
      quoteForDefault: 'Polyurethane Method',
      warranty: '10 Years',
      color: '#D97706',
      lightBg: '#FFFBEB',
      darkBg: '#451A03',
      badgeBg: '#FEF3C7',
      activeBorder: '#FCD34D',
      icon: 'star',
    },
    {
      id: 'Elite',
      packageId: 3,
      packages: 'Elite',
      packageName: 'Polyurea Method',
      title: 'Elite Package (Polyurea Method)',
      subtitle: 'Polyurea Method (15 Years Warranty)',
      quoteForDefault: 'Polyurea Method',
      warranty: '15 Years',
      color: '#7C3AED',
      lightBg: '#F5F3FF',
      darkBg: '#2E1065',
      badgeBg: '#EDE9FE',
      activeBorder: '#C4B5FD',
      icon: 'diamond',
    },
    {
      id: 'None',
      packageId: null,
      packages: 'None',
      packageName: 'Single Tier Services',
      title: 'Single Tier Services',
      subtitle: 'Single Tier Services (Standard Warranty)',
      quoteForDefault: 'Single Tier Services',
      warranty: 'Single Tier',
      color: '#0D9488',
      lightBg: '#F0FDFA',
      darkBg: '#134E4A',
      badgeBg: '#CCFBF1',
      activeBorder: '#5EEAD4',
      icon: 'layers-outline',
    },
  ];

  const getQuoteTierCategory = (quote) => {
    if (!quote) return 'Economic';
    const pkgId = quote.packageId != null ? Number(quote.packageId) : null;
    if (pkgId === 3) return 'Elite';
    if (pkgId === 2) return 'Premium';
    if (pkgId === 1) return 'Economic';
    if (pkgId === 0 || (quote.packageId === null && quote.packageId !== undefined)) {
      const lower = String(quote.tier || quote.packages || quote.packageName || '').toLowerCase();
      if (!lower || lower === 'none' || lower.includes('single tier')) return 'None';
    }

    const cat = (quote.tier || quote.tierCategory || quote.selectedTier || quote.category || quote.packages || quote.packageName || quote.quoteFor || '').toString().toLowerCase();
    if (cat.includes('elite') || cat.includes('luxury') || cat.includes('polyurea') || cat === 'elite' || cat === '3') return 'Elite';
    if (cat.includes('prem') || cat.includes('polyurethane') || cat === 'premium' || cat === '2') return 'Premium';
    if (cat.includes('none') || cat.includes('single tier')) return 'None';
    return 'Economic';
  };

  const quotationsList = useMemo(() => {
    const localQuotes = app?.quotations || (app?.quotation ? [{ ...app.quotation, id: app.quotation.id || Date.now() }] : []);
    if (apiQuotations.length === 0) return localQuotes;
    const mergedMap = new Map();
    apiQuotations.forEach((q) => {
      const k = String(q.id || q.quotationId || '');
      if (k) mergedMap.set(k, q);
    });
    localQuotes.forEach((q) => {
      const qKey = String(q.id || q.quotationId || '');
      if (qKey) {
        if (mergedMap.has(qKey)) {
          mergedMap.set(qKey, { ...mergedMap.get(qKey), ...q });
        } else {
          mergedMap.set(qKey, q);
        }
      }
    });
    return Array.from(mergedMap.values());
  }, [app?.quotations, app?.quotation, apiQuotations]);

  const displayPackages = useMemo(() => {
    const tierMap = new Map();

    if (Array.isArray(apiPackages) && apiPackages.length > 0) {
      apiPackages.forEach((pkg) => {
        const rawPkgName = pkg.packages || pkg.packageName || pkg.name || pkg.tier || '';
        const lowerName = rawPkgName.toLowerCase();
        const pId = pkg.packageId != null ? Number(pkg.packageId) : null;

        let tierId = 'Economic';
        if (pId === 3 || lowerName.includes('elite') || lowerName.includes('luxury') || lowerName.includes('polyurea') || lowerName === 'elite') {
          tierId = 'Elite';
        } else if (pId === 2 || lowerName.includes('premium') || lowerName.includes('polyurethane') || lowerName === 'premium') {
          tierId = 'Premium';
        } else if (pId === 0 || lowerName === 'none' || lowerName.includes('single tier') || pkg.packageId === null) {
          tierId = 'None';
        } else if (pId === 1 || lowerName.includes('economic') || lowerName.includes('elastomeric') || lowerName === 'economic') {
          tierId = 'Economic';
        } else {
          tierId = 'Economic';
        }

        const base = DEFAULT_TIERS_CONFIG.find(t => t.id === tierId) || DEFAULT_TIERS_CONFIG[0];

        tierMap.set(tierId.toLowerCase(), {
          ...base,
          packageId: pId != null ? pId : base.packageId,
          packages: pkg.packages || base.packages,
          packageName: pkg.packageName || base.packageName,
          warranty: pkg.warranty || base.warranty,
          subtitle: pkg.packageName && pkg.packageName !== tierId ? `${pkg.packageName} (${pkg.warranty || base.warranty})` : base.subtitle,
        });
      });
    }

    // Also populate from quotationsList if any quotation matches a tier
    quotationsList.forEach((q) => {
      const tierId = getQuoteTierCategory(q);
      if (!tierMap.has(tierId.toLowerCase())) {
        const base = DEFAULT_TIERS_CONFIG.find(t => t.id === tierId) || DEFAULT_TIERS_CONFIG[0];
        tierMap.set(tierId.toLowerCase(), { ...base });
      }
    });

    const list = Array.from(tierMap.values());

    // Filter to only packages that have at least one quotation
    const withQuotes = list.filter((pkg) => {
      return quotationsList.some(q => getQuoteTierCategory(q).toLowerCase() === pkg.id.toLowerCase());
    });

    // Sort in standard order: Economic -> Premium -> Elite -> None
    const ORDER = { economic: 1, premium: 2, elite: 3, none: 4 };
    withQuotes.sort((a, b) => (ORDER[a.id.toLowerCase()] || 99) - (ORDER[b.id.toLowerCase()] || 99));

    // If there are packages with quotations, only display those packages
    if (withQuotes.length > 0) {
      return withQuotes;
    }

    // If no quotations exist yet, show only Economic Method as default
    return [DEFAULT_TIERS_CONFIG[0]];
  }, [apiPackages, quotationsList]);

  const activeQuotationId = selectedActiveId || app?.confirmedQuoteId || app?.activeQuotationId || (quotationsList.length > 0 ? quotationsList[quotationsList.length - 1]?.id : null);
  const activeQuote = quotationsList.find(q => q.id === activeQuotationId) || (quotationsList.length > 0 ? quotationsList[quotationsList.length - 1] : null);

  const getQuotationCatTotal = (quoteObj, catName) => {
    if (!quoteObj) return 0;
    if (quoteObj.total != null && !isNaN(Number(quoteObj.total))) {
      return Math.round(Number(quoteObj.total));
    }
    if (quoteObj.amount != null && !isNaN(Number(quoteObj.amount))) {
      return Math.round(Number(quoteObj.amount));
    }
    const catKey = catName ? catName.toString().toLowerCase() : 'basic';
    if (quoteObj.totals && quoteObj.totals[catKey]) {
      return Math.round(quoteObj.totals[catKey]);
    }
    const gstFact = quoteObj.gst !== '0%' && quoteObj.gst !== '0' ? (parseFloat(quoteObj.gstRate || 18) / 100) : 0;
    const sList = quoteObj.servicesList && quoteObj.servicesList.length > 0 ? quoteObj.servicesList : [{
      area: quoteObj.area,
      rateBasic: quoteObj.rates?.basic,
      rateMid: quoteObj.rates?.mid || quoteObj.rates?.medium,
      rateLuxury: quoteObj.rates?.luxury || quoteObj.rates?.high,
    }];
    const sub = sList.reduce((acc, s) => {
      const area = parseFloat(s.area || quoteObj.area) || 0;
      const rateKey = catKey.includes('mid') || catKey.includes('premium') ? (s.rateMid || s.rateMedium) : (catKey.includes('lux') || catKey.includes('elite') ? (s.rateLuxury || s.rateHigh) : (s.rateBasic || s.rate));
      const rate = parseFloat(rateKey) || parseFloat(s.rate) || 0;
      return acc + (area * rate);
    }, 0);
    return Math.round(sub * (1 + gstFact));
  };

  const getShortServiceName = (sName) => (sName || '').replace(' Waterproofing', '').replace('& Toilet', '');

  if (isLoading && !app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialDetailSkeleton headerTitle="Quotations" />
      </View>
    );
  }

  if (!app) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Appointment not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <InnerHeader title="Quotation History & Packages" paddingTop={insets.top} isDark={isDark} />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Customer Info Subcard */}
        <View style={[styles.customerCard, isDark && styles.customerCardDark]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{app.clientName?.charAt(0) || 'C'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.clientName, isDark && styles.textDark]}>{app.clientName || app.customerName}</Text>
              <Text style={[styles.clientSubtext, isDark && styles.subtextDark]}>
                📱 {app.clientPhone || app.mobileNumber || 'Phone N/A'} • 📍 {app.area || app.city || 'Chennai'}
              </Text>
            </View>
            <View style={styles.revisionBadge}>
              <Text style={styles.revisionBadgeText}>
                {quotationsList.length} {quotationsList.length === 1 ? 'Quotation' : 'Quotations'}
              </Text>
            </View>
          </View>

          <View style={styles.metaDivider} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
              Site Area: <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>{app.totalArea || '1,200'} sq.ft</Text>
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
              Appt ID: <Text style={{ fontWeight: '700', color: '#0052CC' }}>DR{app.appointmentId || app.id}</Text>
            </Text>
          </View>
        </View>

        {/* PACKAGE SECTIONS AND REVISIONS */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <Ionicons name="layers-outline" size={18} color={isDark ? '#38BDF8' : '#0052CC'} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', flexShrink: 1 }} numberOfLines={1}>
                Package Quotations & Revisions
              </Text>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2563EB',
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 10,
              }}
              onPress={() => router.push({
                pathname: '/make-quotation',
                params: { id: app.id, customerName: app?.customerName || app?.clientName, phone: app?.mobileNumber || app?.clientPhone, ts: Date.now() }
              })}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 3 }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Add</Text>
            </TouchableOpacity>
          </View>

          {displayPackages.map((tierCfg) => {
            const tierQuotes = quotationsList.filter(q => getQuoteTierCategory(q).toLowerCase() === tierCfg.id.toLowerCase());
            const sortedTierQuotes = [...tierQuotes].sort((a, b) => {
              if (a.id === app?.confirmedQuoteId) return -1;
              if (b.id === app?.confirmedQuoteId) return 1;
              return (Number(b.revisionNo || b.revision || 0)) - (Number(a.revisionNo || a.revision || 0));
            });
            const currentQuote = sortedTierQuotes[0];
            const previousRevisions = sortedTierQuotes.slice(1);

            return (
              <View
                key={tierCfg.id}
                style={{
                  backgroundColor: isDark ? '#141414' : '#FFFFFF',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: isDark ? '#262626' : '#E2E8F0',
                }}
              >
                {/* Package Section Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? '#262626' : '#F1F5F9',
                }}>
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: isDark ? tierCfg.darkBg : tierCfg.lightBg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                  }}>
                    <Ionicons name={tierCfg.icon} size={18} color={tierCfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: tierCfg.color }}>
                        {tierCfg.title}
                      </Text>
                      <View style={{
                        backgroundColor: isDark ? tierCfg.darkBg : tierCfg.badgeBg,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: 9.5, fontWeight: '700', color: tierCfg.color }}>
                          {tierCfg.warranty || 'Warranty'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 1 }} numberOfLines={1}>
                      {tierCfg.subtitle}
                    </Text>
                  </View>
                </View>

                {/* Empty package tier state */}
                {sortedTierQuotes.length === 0 ? (
                  <TouchableOpacity
                    style={{
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      borderRadius: 12,
                      padding: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? '#0F172A22' : '#F8FAFC',
                    }}
                    onPress={() => router.push({
                      pathname: '/make-quotation',
                      params: { id: app.id, customerName: app?.customerName || app?.clientName, phone: app?.mobileNumber || app?.clientPhone, tier: tierCfg.id, quoteFor: tierCfg.quoteForDefault, packageId: tierCfg.packageId, ts: Date.now() }
                    })}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: tierCfg.color }}>
                      No {tierCfg.title} yet • Tap to create
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {/* 1. CURRENT / MAIN QUOTATION CARD */}
                    {(() => {
                      const quote = currentQuote;
                      const revLabel = quote.revisionLabel || `Revision #${quote.revisionNo || quote.revision || sortedTierQuotes.length}`;
                      const isConfirmed = app?.confirmedQuoteId === quote.id;
                      const isActive = quote.id === activeQuotationId || isConfirmed;
                      const sCount = quote.servicesList?.length || 0;
                      const qAmount = Math.round(quote.total != null ? quote.total : (quote.amount != null ? quote.amount : (quote.totalAmount || 0)));

                      return (
                        <View
                          key={`current-${quote.id}`}
                          style={{
                            borderWidth: isConfirmed ? 1.8 : 1.2,
                            borderColor: isConfirmed ? '#10B981' : (isDark ? '#334155' : '#E2E8F0'),
                            borderRadius: 14,
                            padding: 12,
                            backgroundColor: isConfirmed
                              ? (isDark ? '#06281E' : '#F0FDF4')
                              : (isDark ? '#1A1A1A' : '#FFFFFF'),
                            marginBottom: previousRevisions.length > 0 ? 12 : 0,
                          }}
                        >
                          {/* Card Header: Revision badge + Date + Active Tag */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexWrap: 'wrap', gap: 6 }}>
                              <View style={{
                                backgroundColor: isConfirmed ? '#DCFCE7' : (isDark ? tierCfg.darkBg : tierCfg.badgeBg),
                                paddingHorizontal: 8,
                                paddingVertical: 3.5,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}>
                                {isConfirmed && <Ionicons name="lock-closed" size={11} color="#16A34A" style={{ marginRight: 3 }} />}
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: isConfirmed ? '#16A34A' : tierCfg.color }}>
                                  {isConfirmed ? 'CONFIRMED' : (previousRevisions.length > 0 ? `${revLabel} (Current)` : revLabel)}
                                </Text>
                              </View>

                              {(quote.quotationDate || quote.date) && (
                                <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '500' }}>
                                  • {quote.quotationDate || quote.date}
                                </Text>
                              )}
                            </View>

                            <TouchableOpacity
                              onPress={() => setSelectedActiveId(quote.id)}
                              style={{
                                backgroundColor: isActive ? '#DCFCE7' : (isDark ? '#334155' : '#E2E8F0'),
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? '#15803D' : (isDark ? '#CBD5E1' : '#475569') }}>
                                {isActive ? 'ACTIVE' : 'Set Active'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Price Row */}
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: sCount > 0 ? 6 : 10 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: isConfirmed ? '#10B981' : (isDark ? '#FFFFFF' : '#0F172A') }}>
                              ₹{qAmount.toLocaleString()}
                            </Text>
                            <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginLeft: 6, fontWeight: '600' }}>
                              {quote.gstAdded ? '(incl. GST)' : '(excl. GST)'}
                            </Text>
                          </View>

                          {/* Services preview if available */}
                          {sCount > 0 && (
                            <View style={{ marginBottom: 10 }}>
                              <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', lineHeight: 16 }} numberOfLines={2}>
                                Includes {sCount} {sCount === 1 ? 'service' : 'services'}: {quote.servicesList.map(s => s.serviceName || s.service).filter(Boolean).join(', ')}
                              </Text>
                            </View>
                          )}

                          {/* Action Buttons Row */}
                          <View style={{ flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: isDark ? '#262626' : '#F1F5F9', paddingTop: 9, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                height: 36,
                                backgroundColor: isDark ? '#334155' : '#E2E8F0',
                                borderRadius: 8,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => setSelectedHistoryQuote(quote)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="eye-outline" size={13} color={isDark ? '#F8FAFC' : '#334155'} style={{ marginRight: 3 }} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#F8FAFC' : '#334155' }}>Details</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1.1,
                                height: 36,
                                backgroundColor: isConfirmed ? '#10B981' : tierCfg.color,
                                borderRadius: 8,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: quote.id } })}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="document-text" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' }}>View PDF</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1,
                                height: 36,
                                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDark ? '#334155' : '#CBD5E1',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => {
                                const targetQId = quote.id || quote.quotationId;
                                router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="pencil-outline" size={13} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>Revise</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()}

                    {/* 2. PREVIOUS REVISIONS LIST */}
                    {previousRevisions.length > 0 && (
                      <View style={{
                        backgroundColor: isDark ? '#0D0D0D' : '#F8FAFC',
                        borderRadius: 14,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: isDark ? '#262626' : '#E2E8F0',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
                          <Ionicons name="git-branch-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 5 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
                            Previous Revisions ({previousRevisions.length})
                          </Text>
                        </View>

                        {previousRevisions.map((revQuote, rIdx) => {
                          const rRevLabel = revQuote.revisionLabel || `Revision #${revQuote.revisionNo || revQuote.revision || (previousRevisions.length - rIdx)}`;
                          const rAmount = Math.round(revQuote.total != null ? revQuote.total : (revQuote.amount != null ? revQuote.amount : (revQuote.totalAmount || 0)));

                          return (
                            <View
                              key={`rev-${revQuote.id || rIdx}`}
                              style={{
                                backgroundColor: isDark ? '#171717' : '#FFFFFF',
                                borderRadius: 10,
                                padding: 10,
                                marginBottom: rIdx === previousRevisions.length - 1 ? 0 : 8,
                                borderWidth: 1,
                                borderColor: isDark ? '#262626' : '#E2E8F0',
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                                  <View style={{
                                    backgroundColor: isDark ? '#334155' : '#E2E8F0',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                  }}>
                                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#E2E8F0' : '#475569' }}>
                                      {rRevLabel}
                                    </Text>
                                  </View>
                                  {(revQuote.quotationDate || revQuote.date) && (
                                    <Text style={{ fontSize: 10.5, color: isDark ? '#94A3B8' : '#64748B' }}>
                                      • {revQuote.quotationDate || revQuote.date}
                                    </Text>
                                  )}
                                </View>

                                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                                  ₹{rAmount.toLocaleString()}
                                </Text>
                              </View>

                              {/* Action Row */}
                              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                <TouchableOpacity
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 5,
                                    backgroundColor: isDark ? '#262626' : '#F1F5F9',
                                    borderRadius: 6,
                                  }}
                                  onPress={() => setSelectedHistoryQuote(revQuote)}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons name="eye-outline" size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>Details</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 5,
                                    backgroundColor: isDark ? '#262626' : '#F1F5F9',
                                    borderRadius: 6,
                                  }}
                                  onPress={() => router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: revQuote.id } })}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons name="document-text-outline" size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>View PDF</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 5,
                                    backgroundColor: isDark ? '#262626' : '#F1F5F9',
                                    borderRadius: 6,
                                  }}
                                  onPress={() => {
                                    const targetQId = revQuote.id || revQuote.quotationId;
                                    router.push({ pathname: '/edit-quotation', params: { id: targetQId, quoteId: targetQId, appointmentId: app.appointmentId || app.id, customerId: app.id } });
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons name="pencil-outline" size={12} color={isDark ? '#CBD5E1' : '#475569'} style={{ marginRight: 3 }} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>Revise</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* PREVIOUS QUOTATION DETAIL INSPECTION MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedHistoryQuote)}
        onRequestClose={() => setSelectedHistoryQuote(null)}
      >
        <TouchableOpacity
          style={styles.pickerModalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedHistoryQuote(null)}
        >
          {selectedHistoryQuote && (
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.pickerModalCard, isDark && styles.pickerModalCardDark, { maxHeight: '85%' }]}
            >
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      {selectedHistoryQuote?.revisionLabel || `Revision #${selectedHistoryQuote?.revision || 1}`}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                    Quotation Date: {selectedHistoryQuote?.quotationDate || selectedHistoryQuote?.date}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setSelectedHistoryQuote(null)}>
                  <Ionicons name="close-circle" size={28} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {/* Methodology & For info */}
                <View style={{ backgroundColor: isDark ? '#080808' : '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#334155' }}>
                    Methodology: <Text style={{ fontWeight: '400', color: isDark ? '#CBD5E1' : '#64748B' }}>{selectedHistoryQuote?.methodology || 'German Tech Waterproofing Methodology'}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#E2E8F0' : '#334155', marginTop: 4 }}>
                    Site Area: <Text style={{ fontWeight: '400', color: isDark ? '#CBD5E1' : '#64748B' }}>{selectedHistoryQuote?.area || '1000'} sq.ft</Text>
                  </Text>
                </View>

                {/* Itemized Services Table */}
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 8 }}>
                  Itemized Services & Rates ({selectedHistoryQuote?.servicesList?.length || 1})
                </Text>

                {(selectedHistoryQuote?.servicesList || []).map((s, idx) => (
                  <View key={idx} style={{ backgroundColor: isDark ? '#080808' : '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#D1E5F7' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0052CC', marginBottom: 4 }}>
                      {idx + 1}. {s.serviceName || s.service}
                    </Text>
                    
                    {s.specs && s.specs.length > 0 && (
                      <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8, fontStyle: 'italic' }}>
                        Specs: {s.specs.join(', ')}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '700' }}>BASIC RATE</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateBasic}/sq.ft</Text>
                        <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalBasic || 0)).toLocaleString()}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                        <Text style={{ fontSize: 10, color: '#0052CC', fontWeight: '700' }}>MID RATE</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateMid}/sq.ft</Text>
                        <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalMid || 0)).toLocaleString()}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '700' }}>LUXURY RATE</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>₹{s.rateLuxury}/sq.ft</Text>
                        <Text style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>Sub: ₹{(parseFloat(s.subtotalLuxury || 0)).toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Package Totals Summary Box */}
                <View style={{ backgroundColor: isDark ? '#080808' : '#F1F5F9', borderRadius: 14, padding: 14, marginTop: 6, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 8, textAlign: 'center' }}>
                    Category Package Totals Summary (incl. GST {selectedHistoryQuote?.gst || '18%'})
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>Basic Package Estimate:</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#2563EB' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'basic').toLocaleString()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#0052CC' }}>Mid Package Estimate:</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0052CC' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'mid').toLocaleString()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#7C3AED' }}>Luxury Package Estimate:</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#7C3AED' }}>₹{getQuotationCatTotal(selectedHistoryQuote, 'luxury').toLocaleString()}</Text>
                  </View>
                </View>

                {/* Modal Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#0052CC', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => {
                      const qId = selectedHistoryQuote.id;
                      setSelectedHistoryQuote(null);
                      router.push({ pathname: '/send-quotation', params: { id: app.id, quoteId: qId } });
                    }}
                  >
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>View PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => {
                      const qId = selectedHistoryQuote.id;
                      setSelectedHistoryQuote(null);
                      router.push({ pathname: '/make-quotation', params: { id: app.id, quoteId: qId } });
                    }}
                  >
                    <Ionicons name="create" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Edit / Revise</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 40,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0052CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  revisionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  revisionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0052CC',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  comparisonBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  comparisonBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  compCol: {
    flex: 1,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCardDark: {
    backgroundColor: '#1C1C1C',
    borderColor: '#334155',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  pickerModalCardDark: {
    backgroundColor: '#1C1C1C',
  },
});
