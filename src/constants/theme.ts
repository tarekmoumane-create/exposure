/** Warm paper, cocoa type and a restrained terracotta accent. Photography leads the UI. */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#FAF6EF',
  surface: '#FFFDFA',
  surfaceRaised: '#F0E8DF',
  line: '#E1D8CE',
  text: '#342A26',
  textSecondary: '#776B62',
  textTertiary: '#7A6C62',
  brand: '#A14E3B',
  onBrand: '#FFFDFA',
  accent: '#F0C5AC',
  accentSoft: '#F7E6D9',
  onAccent: '#342A26',
  /** A warm red reserved for marks and errors. */
  mark: '#AE4048',
  onPhoto: '#FFFFFF',
  scrim: 'rgba(36,27,23,0.60)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof palette;

/** Font family names registered by useAppFonts(). */
export const Fonts = {
  display: 'InstrumentSans_500Medium',
  displayHeavy: 'InstrumentSans_600SemiBold',
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
  print: 2,
  sm: 6,
  md: 8,
  lg: 10,
  pill: 999,
} as const;

/** Native tab bar plus the home indicator on iOS; the tab bar sits over the content there. */
export const BottomTabInset = Platform.select({ ios: 84, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 520;
