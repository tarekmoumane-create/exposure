/**
 * Exposure feels like a personal photo keepsake: vanilla paper, plum ink,
 * apricot envelopes and lilac details. Photos keep their printed edges;
 * controls are soft and rounded. The app is light-only.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#FBF5EB',
  surface: '#FFFCF7',
  surfaceRaised: '#F0E6F0',
  line: '#DFD2D9',
  text: '#443347',
  textSecondary: '#716173',
  textTertiary: '#7D6D7E',
  brand: '#705278',
  onBrand: '#FFFCF7',
  accent: '#F5D5B8',
  accentSoft: '#FAE9D8',
  onAccent: '#443347',
  /** A warm red reserved for marks and errors. */
  mark: '#AE4048',
  onPhoto: '#FFFCF7',
  scrim: 'rgba(49,34,52,0.62)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof palette;

/** Font family names registered by useAppFonts(). */
export const Fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
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
  print: 3,
  sm: 10,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

/** Native tab bar plus the home indicator on iOS; the tab bar sits over the content there. */
export const BottomTabInset = Platform.select({ ios: 84, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 520;
