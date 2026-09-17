/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0052CC';
const tintColorDark = '#fff';

export const BrandColors = {
  // Primary Royal Blue (from NEXA 3D "N" ribbon and "NEXA" wordmark)
  primary: '#0052CC',
  primaryDark: '#00388F',
  primaryDeep: '#002D72',
  primaryLight: '#2684FF',
  primarySurface: '#EBF4FE',
  primarySubtle: '#D8EAFD',

  // Accent Cyan (from glowing sphere and cyan pixel squares)
  cyan: '#00B4D8',
  cyanGlow: '#00D2FF',
  cyanLight: '#E0F7FA',

  // Accent Warm Amber / Orange (from warm pixels and bottom rim glow)
  accentOrange: '#FF8A00',
  accentOrangeDark: '#E06D00',
  accentOrangeLight: '#FFF4E5',

  // Functional Status Colors
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEF2F2',

  // Neutrals & Backgrounds
  background: '#F4F8FC',
  surface: '#FFFFFF',
  surfaceVariant: '#EBF2FA',
  border: '#E2E8F0',
  borderSubtle: '#EBF0F7',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
};

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F4F8FC',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    accent: '#FF8A00',
    cyan: '#00B4D8',
  },
  dark: {
    text: '#ECEDEE',
    background: '#080808',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    accent: '#FFA726',
    cyan: '#38BDF8',
  },
};

export const Typography = {
  extraLight: 'PlusJakartaSans_200ExtraLight',
  light: 'PlusJakartaSans_300Light',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'PlusJakartaSans_400Regular',
    serif: 'ui-serif',
    rounded: 'PlusJakartaSans_400Regular',
    mono: 'ui-monospace',
    extraLight: 'PlusJakartaSans_200ExtraLight',
    light: 'PlusJakartaSans_300Light',
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
  },
  android: {
    sans: 'PlusJakartaSans_400Regular',
    serif: 'serif',
    rounded: 'PlusJakartaSans_400Regular',
    mono: 'monospace',
    extraLight: 'PlusJakartaSans_200ExtraLight',
    light: 'PlusJakartaSans_300Light',
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
  },
  default: {
    sans: 'PlusJakartaSans_400Regular',
    serif: 'serif',
    rounded: 'PlusJakartaSans_400Regular',
    mono: 'monospace',
    extraLight: 'PlusJakartaSans_200ExtraLight',
    light: 'PlusJakartaSans_300Light',
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
  },
  web: {
    sans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Plus Jakarta Sans', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    extraLight: "'Plus Jakarta Sans', sans-serif",
    light: "'Plus Jakarta Sans', sans-serif",
    regular: "'Plus Jakarta Sans', sans-serif",
    medium: "'Plus Jakarta Sans', sans-serif",
    semiBold: "'Plus Jakarta Sans', sans-serif",
    bold: "'Plus Jakarta Sans', sans-serif",
    extraBold: "'Plus Jakarta Sans', sans-serif",
  },
});

export const paperLightTheme = {
  colors: {
    primary: '#0052CC',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EBF4FE',
    onPrimaryContainer: '#002D72',
    secondary: '#00B4D8',
    onSecondary: '#FFFFFF',
    tertiary: '#FF8A00',
    onTertiary: '#FFFFFF',
    background: '#F4F8FC',
    onBackground: '#0F172A',
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#EBF2FA',
    onSurfaceVariant: '#475569',
    outline: '#CBD5E1',
    error: '#EF4444',
    onError: '#FFFFFF',
  },
};

export const paperDarkTheme = {
  colors: {
    primary: '#38BDF8',
    onPrimary: '#002D72',
    primaryContainer: '#00388F',
    onPrimaryContainer: '#EBF4FE',
    secondary: '#00D2FF',
    onSecondary: '#002D72',
    tertiary: '#FFA726',
    onTertiary: '#1A0E00',
    background: '#0B1120',
    onBackground: '#F8FAFC',
    surface: '#1E293B',
    onSurface: '#F8FAFC',
    surfaceVariant: '#334155',
    onSurfaceVariant: '#94A3B8',
    outline: '#475569',
    error: '#EF4444',
    onError: '#FFFFFF',
  },
};

