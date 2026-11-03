/**
 * PersistentNavigation
 *
 * Renders the custom bottom tab bar and side drawer as absolute-positioned
 * overlays. Mounted at the root layout level so they stay visible on every
 * screen — not just those inside the (tabs) navigator group.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, useSegments } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBar } from '../../core/context/TabBarContext';
import { useColorScheme } from '../../core/hooks/useColorScheme';
import { authRepository } from '../../features/auth/api/authRepository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

// ─── Drawer Context ───────────────────────────────────────────────────────────

const DrawerContext = createContext({
  isDrawerOpen: false,
  openDrawer: () => { },
  closeDrawer: () => { },
});

export function DrawerProvider({ children }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  return (
    <DrawerContext.Provider value={{ isDrawerOpen, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  );
}

function useDrawer() {
  return useContext(DrawerContext);
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TAB_ROUTES = [
  { name: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  { name: 'support', label: 'Support', icon: 'headset-outline', activeIcon: 'headset' },
  { name: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
  { name: 'menu', label: 'Menu', icon: 'menu-outline', activeIcon: 'menu' },
];

// Screens where the tab bar should be hidden entirely (auth, splash, full forms)
const HIDDEN_SEGMENTS = new Set([
  'login',
  'index',
  'payment-form',
  'additional-payment',
  'payment-verification',
  'receipt',
]);

// Maps every stack-level route back to which tab should appear active
const SEGMENT_TO_TAB = {
  '(tabs)': 'index',
  'index': 'index',
  'search': 'search',
  'support': 'support',
  'settings': 'settings',
  'menu': 'menu',
  'all-appointments': 'index',
  'new-appointment': 'index',
  'edit-appointment': 'index',
  'customer-detail': 'index',
  'clients': 'index',
  'payment-detail': 'index',
  'payment-form': 'index',
  'receipt': 'index',
  'make-quotation': 'index',
  'edit-quotation': 'index',
  'quotation-history': 'index',
  'send-quotation': 'index',
  'send-quote': 'index',
  'reassign': 'index',
  'employee-add': 'settings',
  'employee-list': 'settings',
  'employee-detail': 'settings',
  'employee-edit': 'settings',
  'attendance-leave': 'settings',
  'salary-details': 'settings',
  'salary-advance': 'settings',
  'outstanding': 'index',
  'appointment-reports': 'index',
  'collections': 'index',
  'warranty': 'index',
  'warranty-letter': 'index',
  'notifications': 'index',
  'notification-detail': 'index',
  'policy': 'support',
  'terms': 'support',
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { openDrawer } = useDrawer();
  const router = useRouter();
  const segments = useSegments();
  const isDark = colorScheme === 'dark';

  const { tabBarVisible } = useTabBar();

  const lastSegment = segments[segments.length - 1] ?? '';
  const isInsideTabs = segments.includes('(tabs)');
  const shouldHide = !tabBarVisible || (HIDDEN_SEGMENTS.has(lastSegment) && !isInsideTabs);

  const activeTab = SEGMENT_TO_TAB[lastSegment] ?? 'index';

  const layoutsRef = useRef({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hasInitialized = useRef(false);

  const animateTo = (name) => {
    const layout = layoutsRef.current[name];
    if (!layout) return;
    if (!hasInitialized.current) {
      slideAnim.setValue(layout.x);
      widthAnim.setValue(layout.width);
      opacityAnim.setValue(1);
      hasInitialized.current = true;
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: layout.x, damping: 22, stiffness: 240, mass: 0.7, useNativeDriver: false }),
        Animated.spring(widthAnim, { toValue: layout.width, damping: 22, stiffness: 240, mass: 0.7, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      ]).start();
    }
  };

  useEffect(() => {
    animateTo(activeTab);
  }, [activeTab]);

  // Hide on splash / login — must be after all hooks
  if (shouldHide) {
    return null;
  }

  const onTabLayout = (name, event) => {
    const { x, width } = event.nativeEvent.layout;
    layoutsRef.current[name] = { x, width };
    if (name === activeTab) animateTo(name);
  };

  const navigate = (tabName) => {
    if (tabName === 'menu') {
      openDrawer();
      return;
    }
    const path = tabName === 'index' ? '/(tabs)/' : `/(tabs)/${tabName}`;
    router.push(path);
  };

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: isDark ? 'rgba(11, 15, 25, 0.96)' : 'rgba(255, 255, 255, 0.95)',
          borderTopColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(226, 232, 240, 0.8)',
        },
      ]}
    >
      {Platform.OS === 'ios' && (
        <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.slidingPill,
          isDark ? styles.slidingPillDark : styles.slidingPillLight,
          { left: slideAnim, width: widthAnim, opacity: opacityAnim },
        ]}
      />

      {TAB_ROUTES.map((tab) => {
        const isFocused = activeTab === tab.name;
        const iconColor = isFocused
          ? (isDark ? '#60A5FA' : '#0052CC')
          : (isDark ? '#94A3B8' : '#64748B');

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigate(tab.name)}
            onLayout={(e) => onTabLayout(tab.name, e)}
            style={styles.tabItem}
            activeOpacity={0.8}
          >
            <Ionicons name={isFocused ? tab.activeIcon : tab.icon} size={22} color={iconColor} />
            {isFocused && (
              <Text style={[styles.tabLabel, isDark && styles.tabLabelDark]}>
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Side Drawer ──────────────────────────────────────────────────────────────

function DrawerOverlay() {
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isDark = colorScheme === 'dark';
  const [userRole, setUserRole] = useState('master');

  useEffect(() => {
    authRepository.getUser().then((user) => {
      if (user?.role) setUserRole(user.role);
    });
  }, [isDrawerOpen]);

  const lastSegment = segments[segments.length - 1] ?? '';
  const activeTab = lastSegment === '(tabs)' ? 'index' : lastSegment;
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isDrawerOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen, slideAnim]);

  const handleNavigation = (tabName) => {
    closeDrawer();
    router.push(`/(tabs)/${tabName === 'index' ? '' : tabName}`);
  };

  const handleLogout = async () => {
    closeDrawer();
    await authRepository.logout();
    router.replace('/login');
  };

  const isFieldEmployee =
    userRole === 'FIELD_EMPLOYEE' || userRole === 'field-employee' || userRole === 'employee';

  const menuItems = [
    { label: 'Home', icon: 'home-outline', activeIcon: 'home', route: 'index' },
    { label: 'Our Clients', icon: 'people-outline', activeIcon: 'people', route: 'clients' },
    { label: 'Appointments', icon: 'calendar-outline', activeIcon: 'calendar', route: 'appointments' },
    { label: 'Outstanding Payments', icon: 'card-outline', activeIcon: 'card', route: 'outstanding' },
    { label: 'Warranty Tracker', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', route: 'warranty' },
    // Phase 2 modules disabled per client request:
    // { label: 'Attendance & Leave', icon: 'location-outline', activeIcon: 'location', route: 'attendance-leave' },
    // { label: 'Salary Details', icon: 'cash-outline', activeIcon: 'cash', route: 'salary-details' },
    // { label: 'Salary Advance', icon: 'wallet-outline', activeIcon: 'wallet', route: 'salary-advance' },
    ...(!isFieldEmployee ? [
      { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: 'settings' },
    ] : []),
    { label: 'Support', icon: 'headset-outline', activeIcon: 'headset', route: 'support' },
    { label: 'EMP Policy', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', route: 'policy' },
    { label: 'Terms & Conditions', icon: 'document-text-outline', activeIcon: 'document-text', route: 'terms' },
  ];

  return (
    <>
      {isDrawerOpen && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeDrawer} />
      )}
      <Animated.View
        style={[
          styles.drawerContainer,
          isDark && styles.drawerContainerDark,
          { transform: [{ translateX: slideAnim }], paddingTop: Math.max(insets.top, 24) },
        ]}
      >
        <View style={[styles.drawerHeader, isDark && styles.drawerHeaderDark]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerLogoWrapper, isDark && styles.headerLogoWrapperDark]}>
              <Image
                source={require('../../../assets/images/splash_logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerGreeting}>
              <Text style={[styles.headerGreetingTitle, isDark && styles.textDark]}>Hello!</Text>
              <Text style={[styles.headerGreetingSub, isDark && styles.subtextDark]}>Nexa CRM</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuList}>
          {menuItems.map((item) => {
            const isSelected = activeTab === item.route;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, isSelected && styles.menuItemActive]}
                onPress={() => {
                  if (['index', 'support', 'settings'].includes(item.route)) {
                    handleNavigation(item.route);
                  } else if (item.route === 'appointments') {
                    closeDrawer();
                    router.push('/all-appointments');
                  } else if (item.route === 'clients') {
                    closeDrawer();
                    router.push('/clients');
                  } else if (['outstanding', 'warranty', 'attendance-leave', 'salary-details', 'salary-advance', 'policy', 'terms', 'notifications'].includes(item.route)) {
                    closeDrawer();
                    router.push(`/${item.route}`);
                  } else {
                    closeDrawer();
                    Alert.alert('Info', `${item.label} view is not implemented yet.`);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSelected ? item.activeIcon : item.icon}
                  size={24}
                  color={isSelected ? '#0052CC' : (isDark ? '#CBD5E1' : '#1E293B')}
                  style={styles.menuItemIcon}
                />
                <Text style={[styles.menuItemLabel, isDark && styles.textDark, isSelected && styles.menuItemLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.drawerBottom, isDark && styles.drawerBottomDark]}>
          <TouchableOpacity style={[styles.logoutButton, isDark && styles.logoutButtonDark]} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={22} color={isDark ? '#FCA5A5' : '#DC2626'} style={{ marginRight: 8 }} />
            <Text style={[styles.logoutText, isDark && styles.logoutTextDark]}>Logout</Text>
          </TouchableOpacity>
          <Text style={[styles.versionText, isDark && styles.subtextDark]}>App Version 1.01</Text>
        </View>
      </Animated.View>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function PersistentNavigation() {
  return (
    <>
      <CustomTabBar />
      <DrawerOverlay />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
    zIndex: 900,
    elevation: 10,
  },
  slidingPill: {
    position: 'absolute',
    top: 12,
    height: 38,
    borderRadius: 20,
    zIndex: 1,
  },
  slidingPillLight: { backgroundColor: '#EBF4FE' },
  slidingPillDark: { backgroundColor: 'rgba(0, 82, 204, 0.25)', borderWidth: 1, borderColor: '#0052CC' },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 2,
  },
  tabLabel: {
    color: '#0052CC',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  tabLabelDark: {
    color: '#93C5FD',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  backdrop: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    justifyContent: 'space-between',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 20,
  },
  drawerContainerDark: { backgroundColor: '#0F172A', borderRightWidth: 1, borderRightColor: '#1E293B' },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20,
  },
  drawerHeaderDark: { backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogoWrapper: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headerLogoWrapperDark: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  headerLogo: { width: 44, height: 44, borderRadius: 12 },
  headerGreeting: { marginLeft: 12 },
  headerGreetingTitle: {
    fontSize: 20,
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    includeFontPadding: false,
  },
  headerGreetingSub: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: Platform.OS === 'android' ? 'normal' : '500',
    includeFontPadding: false,
  },
  menuList: { paddingVertical: 14, paddingHorizontal: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 6 },
  menuItemActive: { backgroundColor: '#EBF4FE' },
  menuItemIcon: { marginRight: 16 },
  menuItemLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontFamily: 'PlusJakartaSans_500Medium',
    includeFontPadding: false,
  },
  menuItemLabelActive: {
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    includeFontPadding: false,
  },
  drawerBottom: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  drawerBottomDark: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    height: 48,
    width: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutButtonDark: { backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.2)' },
  logoutText: {
    color: '#DC2626',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '600',
    includeFontPadding: false,
  },
  logoutTextDark: { color: '#FCA5A5' },
  versionText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_400Regular',
    includeFontPadding: false,
  },
  textDark: { color: '#F8FAFC' },
  subtextDark: { color: '#94A3B8' },
});
