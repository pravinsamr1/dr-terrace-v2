import { Platform, StyleSheet, Text, TextInput } from 'react-native';

const FONT_MAP = {
  '100': 'PlusJakartaSans_200ExtraLight',
  '200': 'PlusJakartaSans_200ExtraLight',
  '300': 'PlusJakartaSans_300Light',
  light: 'PlusJakartaSans_300Light',
  '400': 'PlusJakartaSans_400Regular',
  normal: 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  semibold: 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
  heavy: 'PlusJakartaSans_800ExtraBold',
  black: 'PlusJakartaSans_800ExtraBold',
};

// Known icon font names that should not be overridden
const ICON_FONTS = [
  'Ionicons',
  'MaterialIcons',
  'Material Icons',
  'MaterialCommunityIcons',
  'FontAwesome',
  'FontAwesome5',
  'FontAwesome6',
  'Feather',
  'AntDesign',
  'Entypo',
  'EvilIcons',
  'Fontisto',
  'Octicons',
  'SimpleLineIcons',
  'Zocial',
];

const LEGACY_FONT_MAP = {
  Poppins_300Light: 'PlusJakartaSans_300Light',
  Poppins_400Regular: 'PlusJakartaSans_400Regular',
  Poppins_500Medium: 'PlusJakartaSans_500Medium',
  Poppins_600SemiBold: 'PlusJakartaSans_600SemiBold',
  Poppins_700Bold: 'PlusJakartaSans_700Bold',
  Poppins_800ExtraBold: 'PlusJakartaSans_800ExtraBold',
  Lato_400Regular: 'PlusJakartaSans_400Regular',
  Lato_700Bold: 'PlusJakartaSans_700Bold',
};

export function transformStyleForJakarta(style, isDirectTextElement = true) {
  if (style === null || style === undefined) {
    return isDirectTextElement ? { fontFamily: 'PlusJakartaSans_400Regular' } : style;
  }

  if (Array.isArray(style)) {
    return style.map((s) => transformStyleForJakarta(s, isDirectTextElement));
  }

  if (typeof style !== 'object') {
    return style;
  }

  // Don't touch icon fonts or cursive signatures
  if (
    style.fontFamily &&
    (ICON_FONTS.some((f) => String(style.fontFamily).includes(f)) ||
      style.fontFamily === 'Cursive' ||
      style.fontFamily === 'cursive')
  ) {
    return style;
  }

  const isTextStyle =
    isDirectTextElement ||
    style.fontSize !== undefined ||
    style.fontWeight !== undefined ||
    style.lineHeight !== undefined ||
    style.letterSpacing !== undefined ||
    style.textAlign !== undefined ||
    style.textTransform !== undefined ||
    style.textDecorationLine !== undefined ||
    style.fontStyle !== undefined ||
    style.fontFamily !== undefined ||
    style.includeFontPadding !== undefined ||
    style.textAlignVertical !== undefined ||
    style.color !== undefined;

  if (!isTextStyle) {
    return style;
  }

  const rawWeight = style.fontWeight ? String(style.fontWeight).toLowerCase() : '400';
  let resolvedFontFamily = FONT_MAP[rawWeight] || 'PlusJakartaSans_400Regular';

  if (style.fontFamily) {
    if (style.fontFamily.startsWith('PlusJakartaSans_')) {
      resolvedFontFamily = style.fontFamily;
    } else if (LEGACY_FONT_MAP[style.fontFamily]) {
      resolvedFontFamily = LEGACY_FONT_MAP[style.fontFamily];
    }
  }

  const newStyle = {
    ...style,
    fontFamily: resolvedFontFamily,
  };

  // On Android, having fontWeight together with a custom font file name causes
  // the Android native font manager to fail matching and fallback to Roboto.
  // Normalizing fontWeight to 'normal' ensures Android renders the custom Plus Jakarta Sans font.
  if (Platform.OS === 'android') {
    newStyle.fontWeight = 'normal';
    if (newStyle.includeFontPadding === undefined) {
      newStyle.includeFontPadding = false;
    }
  }

  return newStyle;
}

// 1. Hook StyleSheet.create
const originalCreate = StyleSheet.create;
StyleSheet.create = function create(styles) {
  if (!styles || typeof styles !== 'object') {
    return originalCreate(styles);
  }

  const newStyles = {};
  for (const key of Object.keys(styles)) {
    const item = styles[key];
    if (item && typeof item === 'object') {
      newStyles[key] = transformStyleForJakarta(item, false);
    } else {
      newStyles[key] = item;
    }
  }

  return originalCreate(newStyles);
};

// 2. Hook StyleSheet.flatten
const originalFlatten = StyleSheet.flatten;
if (typeof originalFlatten === 'function') {
  StyleSheet.flatten = function flatten(style) {
    const flat = originalFlatten(style);
    return flat ? transformStyleForJakarta(flat, false) : flat;
  };
}

// 3. Fallback for Text.defaultProps & TextInput.defaultProps
const defaultTextStyle = {
  fontFamily: 'PlusJakartaSans_400Regular',
  letterSpacing: 0,
  ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : {}),
};

if (!Text.defaultProps) Text.defaultProps = {};
Text.defaultProps.style = [defaultTextStyle, Text.defaultProps.style];

if (!TextInput.defaultProps) TextInput.defaultProps = {};
TextInput.defaultProps.style = [defaultTextStyle, TextInput.defaultProps.style];

export default true;
