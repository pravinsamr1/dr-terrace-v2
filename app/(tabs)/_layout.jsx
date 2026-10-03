import { Tabs } from 'expo-router';
import { usePushNotifications } from '../../src/features/notifications/hooks/usePushNotifications';

export default function TabLayout() {
  // Registers this phone for push notifications (logged-in users only) and handles notification taps
  usePushNotifications();

  return (
    <Tabs
      backBehavior="history"
      tabBar={() => null}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home'     }} />
      <Tabs.Screen name="search"   options={{ title: 'Search'   }} />
      <Tabs.Screen name="support"  options={{ title: 'Support'  }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="menu"     options={{ title: 'Menu'     }} />
    </Tabs>
  );
}
