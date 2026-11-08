/**
 * The photo lab. Oat paper and ink carry the interface; photographs bring the colour.
 * Safelight red is a signal, not decoration: live states, selection and the sun in the mark.
 * Monospace labels carry the technical layer (frame numbers, specs, steps); everything a
 * person reads to decide something is set in the friendly sans.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#F3EEE6',
  surface: '#FBF8F3',
  surfaceRaised: '#E8E1D6',
  line: '#DCD3C6',
  text: '#1D1A17',
  textSecondary: '#5F574E',
  textTertiary: '#746B60',
  brand: '#1D1A17',
  onBrand: '#FBF8F3',
  /** Safelight red. */
  accent: '#C4462B',
  accentSoft: '#F2DED4',
  onAccent: '#FBF8F3',
  /** Errors and failed frames. */
  mark: '#B3261E',
  onPhoto: '#FFFFFF',
  scrim: 'rgba(29,26,23,0.55)',
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
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
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

/** Depth. Prints and raised cards cast soft, warm shadows, never grey ones. */
export const Shadow = {
  print: '0px 1px 2px rgba(60,40,20,0.10), 0px 10px 22px rgba(60,40,20,0.16)',
  card: '0px 1px 2px rgba(60,40,20,0.05), 0px 6px 18px rgba(60,40,20,0.08)',
  button: '0px 6px 14px rgba(29,26,23,0.22)',
} as const;

/** The warm glow behind key moments: apricot light falling onto paper. */
export const Glow = ['#F8D9C2', '#F6E2D6', '#F3EEE6'] as const;

/** Photo paper border colour. */
export const PrintWhite = '#FFFDF8';

/** The page gutter. */
export const Gutter = 20;

export const Radius = {
  /** Photographs stay nearly square, like prints. */
  print: 3,
  sm: 8,
  md: 14,
  /** Cards and sheets are soft. */
  lg: 22,
  pill: 999,
} as const;

/** Native tab bar plus the home indicator on iOS; the tab bar sits over the content there. */
export const BottomTabInset = Platform.select({ ios: 84, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 520;
