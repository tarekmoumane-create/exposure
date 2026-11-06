/**
 * Exposure design tokens. The app borrows from the one-hour photo lab: white print paper, ballpoint
 * blue ink, and the butter yellow of a drugstore film envelope. Photos have near-square corners
 * because they are prints; controls are softer. The app is light-only.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#F5F6F1',
  surface: '#FFFFFF',
  surfaceRaised: '#E8EAE1',
  line: '#D5D8CC',
  text: '#141A6B',
  textSecondary: '#454B86',
  textTertiary: '#666CA3',
  brand: '#1F2BD8',
  onBrand: '#FFFFFF',
  accent: '#FFD84D',
  accentSoft: '#FFF1BD',
  onAccent: '#141A6B',
  /** The grease pencil on a contact sheet. Used for marks and errors only. */
  mark: '#D92D20',
  onPhoto: '#FFFFFF',
  scrim: 'rgba(20,26,107,0.55)',
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
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Native tab bar plus the home indicator on iOS; the tab bar sits over the content there. */
export const BottomTabInset = Platform.select({ ios: 84, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 520;
