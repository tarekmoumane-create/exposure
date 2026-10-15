/**
 * Exposure design tokens.
 * Cream, soft and photo-first, in the same family as the apps this audience already loves:
 * off-white background, dark plum ink, a rose accent, italic serif for the wordmark and status
 * lines, a clean sans for everything else. The app is light-only.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#F8F2E8',
  surface: '#FFFFFF',
  surfaceRaised: '#EFE6D9',
  line: '#E6DCCE',
  text: '#1E1419',
  textSecondary: '#6F5F66',
  textTertiary: '#A49399',
  accent: '#E8607C',
  accentSoft: '#FBE1E8',
  accentDeep: '#C9405E',
  onAccent: '#FFFFFF',
  onPhoto: '#FFFFFF',
  danger: '#D94848',
  success: '#3FA06B',
  overlay: 'rgba(30,20,25,0.55)',
  scrim: 'rgba(30,20,25,0.35)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof palette;

/** Font family names registered by useAppFonts(). */
export const Fonts = {
  serif: 'PlayfairDisplay_600SemiBold',
  serifItalic: 'PlayfairDisplay_600SemiBold_Italic',
  serifItalicLight: 'PlayfairDisplay_400Regular_Italic',
  sans: 'Manrope_500Medium',
  sansSemi: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
  sansExtra: 'Manrope_800ExtraBold',
  mono: Platform.select({ ios: 'Menlo', web: 'ui-monospace, Menlo, monospace', default: 'monospace' }) ?? 'monospace',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Native tab bar plus the home indicator on iOS; the tab bar sits over the content there. */
export const BottomTabInset = Platform.select({ ios: 84, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 520;
