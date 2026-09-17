import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialListSkeleton, MaterialProgressBar } from '../../../shared/components/material';
import { clientRepository as clientService } from '../../clients/api/clientRepository';

const formatAddressString = (address) => {
  if (!address) return 'Location not specified';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const { doorNo, streetName, street, area, city, pincode, state } = address;
    return [doorNo, streetName || street, area, city, pincode, state].filter(Boolean).join(', ') || 'Location not specified';
  }
  return String(address);
};

const getClientInitial = (name) => {
  if (!name) return 'C';
  const clean = name.replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/i, '').trim();
  return clean ? clean.charAt(0).toUpperCase() : 'C';
};

const AVATAR_COLORS = [
  { bg: '#EBF4FE', text: '#0052CC', border: '#BFDBFE', darkBg: '#1E293B', darkText: '#60A5FA', darkBorder: '#3B82F6' },
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', darkBg: '#064E3B', darkText: '#34D399', darkBorder: '#10B981' },
  { bg: '#FDF4FF', text: '#9333EA', border: '#F0ABFC', darkBg: '#3B0764', darkText: '#C084FC', darkBorder: '#A855F7' },
  { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA', darkBg: '#431407', darkText: '#FB923C', darkBorder: '#F97316' },
  { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', darkBg: '#14532D', darkText: '#4ADE80', darkBorder: '#22C55E' },
  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', darkBg: '#450A0A', darkText: '#F87171', darkBorder: '#EF4444' },
  { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD', darkBg: '#0C4A6E', darkText: '#38BDF8', darkBorder: '#0EA5E9' },
  { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8', darkBg: '#500724', darkText: '#F472B6', darkBorder: '#EC4899' },
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export default function ClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { handleScroll } = useTabBarScroll();

  const isDark = colorScheme === 'dark';

  // State to filter clients list
  const [clientsList, setClientsList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstMountRef = useRef(true);
  const isFetchingRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);

  const fetchClientsPage = useCallback(async (pageToFetch = 1, isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else if (pageToFetch === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await clientService.getClients(pageToFetch, 20);
      if (res && res.success) {
        const newItems = res.clients || [];
        if (pageToFetch === 1) {
          setClientsList(newItems);
        } else {
          setClientsList((prev) => {
            const existingKeys = new Set(
              prev.map((a) => String(a.clientId || a.customerId || a.id || a._id || '')).filter(Boolean)
            );
            const uniqueNew = newItems.filter((a) => {
              const key = String(a.clientId || a.customerId || a.id || a._id || '');
              return !key || !existingKeys.has(key);
            });
            return [...prev, ...uniqueNew];
          });
        }
        const currentPageNum = Number(res.page) || pageToFetch;
        pageRef.current = currentPageNum;
        setPage(currentPageNum);
        setTotalPages(res.totalPages || 1);

        const moreAvailable = res.hasMore !== undefined
          ? Boolean(res.hasMore)
          : (newItems.length >= 20);
        hasMoreRef.current = moreAvailable;
        setHasMore(moreAvailable);
      }
    } catch (err) {
      console.warn('Failed to load clients:', err.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      pageRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);
      fetchClientsPage(1, false);
    }, [fetchClientsPage])
  );

  const onRefresh = async () => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    await fetchClientsPage(1, true);
  };

  const handleLoadMore = () => {
    if (isFetchingRef.current || isLoading || isLoadingMore || !hasMoreRef.current) {
      return;
    }
    const nextPage = pageRef.current + 1;
    fetchClientsPage(nextPage, false);
  };

  const filteredClients = clientsList;

  const handleClientPress = (client) => {
    router.push({
      pathname: '/customer-detail',
      params: { id: client.customerId || client.clientId },
    });
  };

  const renderClientCard = (client) => {
    const rawName = client.clientName || client.customerName || client.name || 'Client';
    const prefix = rawName.trim().toLowerCase().startsWith('mr.') ? '' : 'Mr. ';
    const displayName = `${prefix}${rawName.trim()}`;
    const location = formatAddressString(client.address || client.location || client.client_address || client.client_location);
    const phone = client.phone || client.mobileNumber || client.mobile || 'N/A';
    const initial = getClientInitial(rawName);
    const avatarColor = getAvatarColor(rawName);

    return (
      <TouchableOpacity
        style={[styles.clientCard, isDark && styles.clientCardDark]}
        onPress={() => handleClientPress(client)}
        activeOpacity={0.9}
      >
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: isDark ? avatarColor.darkBg : avatarColor.bg,
              borderColor: isDark ? avatarColor.darkBorder : avatarColor.border,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarInitialText,
              {
                color: isDark ? avatarColor.darkText : avatarColor.text,
              },
            ]}
          >
            {initial}
          </Text>
        </View>

        <View style={styles.clientDetailsCol}>
          <Text style={[styles.clientNameText, isDark && styles.textDark]} numberOfLines={1}>
            {displayName}
          </Text>

          {/* Location Address row */}
          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={15}
              color={isDark ? '#60A5FA' : '#0052CC'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.infoValueText, isDark && styles.subtextDark]} numberOfLines={1}>
              {location}
            </Text>
          </View>

          {/* Phone number row */}
          <View style={styles.infoRow}>
            <Ionicons
              name="call-outline"
              size={15}
              color={isDark ? '#60A5FA' : '#0052CC'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.infoValueText, isDark && styles.subtextDark]}>
              {phone}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Subheader Title with Live Count */}
      {/* <Text style={[styles.subheaderTitleText, isDark && styles.textDark]}>
        Our All Clients {totalItems > 0 ? `(${totalItems})` : ''}
      </Text> */}

      {/* Filter Pills row */}
      {/* <View style={styles.filterRowContainer}>
        <Ionicons
          name="funnel-outline"
          size={22}
          color={isDark ? '#94A3B8' : '#1E293B'}
          style={{ marginRight: 8 }}
        />

        {['All', 'Quotation', 'Site Visit'].map((filter) => {
          const isSelected = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterPill,
                isSelected && styles.filterPillActive,
                isDark && styles.filterPillDark,
                isSelected && isDark && styles.filterPillActiveDark,
              ]}
              onPress={() => handleToggleFilter(filter)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSelected && styles.filterPillTextActive,
                  isSelected && isDark && styles.filterPillTextActiveDark,
                  isDark && !isSelected && styles.subtextDark,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View> */}
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="All Clients" paddingTop={insets.top} isDark={isDark} />

      {/* Top Material Progress Bar */}
      {isLoading && filteredClients.length > 0 && (
        <MaterialProgressBar indeterminate visible={true} style={{ marginHorizontal: 16, marginBottom: 4 }} />
      )}

      {/* Paginated Clients FlatList */}
      <FlatList
        data={filteredClients}
        keyExtractor={(item, index) => `${item.clientId || item.customerId || item.id || 'client'}-${index}`}
        renderItem={({ item }) => renderClientCard(item)}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0052CC']}
            tintColor={isDark ? '#F8FAFC' : '#0052CC'}
            progressBackgroundColor={isDark ? '#1E293B' : '#FFFFFF'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingBottom: Math.max(insets.bottom + 84, 110),
            flexGrow: filteredClients.length === 0 ? 1 : undefined,
          },
        ]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={isDark ? '#60A5FA' : '#0052CC'} />
              <Text style={[styles.footerLoaderText, isDark && styles.subtextDark]}>
                Loading more clients...
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <MaterialListSkeleton count={5} isCardStyle={true} />
            </View>
          ) : (
            <View style={styles.noClientsWrapper}>
              <Ionicons
                name="people-outline"
                size={48}
                color={isDark ? '#475569' : '#CBD5E1'}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.noClientsText, isDark && styles.subtextDark]}>
                No clients found matching the selected filter.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },
  containerDark: {
    backgroundColor: '#090D16',
  },

  scrollContainer: {
    paddingHorizontal: 12,
    paddingTop: 20,
  },

  // Subheader
  subheaderTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 14,
  },

  // Filtering bar
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  filterPillDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#0052CC',
  },
  filterPillActiveDark: {
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  filterPillText: {
    fontSize: 12,
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextActiveDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Client list cards
  clientCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  clientCardDark: {
    backgroundColor: '#161F33',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clientDetailsCol: {
    flex: 1,
    marginLeft: 16,
  },
  clientNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  infoValueText: {
    fontSize: 13,
    color: '#475569',
  },
  centerLoadingContainer: {
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  noClientsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noClientsText: {
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
