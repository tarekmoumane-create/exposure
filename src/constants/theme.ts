/**
 * Soft and sunny. Blush paper, plum ink, and a rose-to-peach glow for the one thing to tap.
 * Photographs are big, rounded and warm. Nothing on screen reads as a spec sheet: every label is
 * a friendly sentence-case word, and headlines are set in a rounded, playful display face.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#FFF6F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FCEAE4',
  line: '#F3DAD2',
  text: '#2B1F26',
  textSecondary: '#6F5E67',
  textTertiary: '#9C8A93',
  /** Rose: the primary action and anything live or selected. */
  brand: '#F2557C',
  onBrand: '#FFFFFF',
  accent: '#F2557C',
  accentSoft: '#FFE3EA',
  onAccent: '#FFFFFF',
  /** Errors and failed frames. */
  mark: '#D93A5C',
  onPhoto: '#FFFFFF',
  scrim: 'rgba(43,31,38,0.5)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof palette;

/** Font family names registered by useAppFonts(). */
export const Fonts = {
  /** Headlines: rounded and a little playful. */
  display: 'BricolageGrotesque_700Bold',
  displaySoft: 'BricolageGrotesque_600SemiBold',
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

/** Depth. Cards and photos cast soft, rosy shadows, never grey ones. */
export const Shadow = {
  print: '0px 2px 4px rgba(120,60,90,0.08), 0px 14px 30px rgba(120,60,90,0.16)',
  card: '0px 1px 2px rgba(120,60,90,0.04), 0px 8px 22px rgba(120,60,90,0.08)',
  button: '0px 8px 18px rgba(242,85,124,0.32)',
} as const;

/** The glow behind key moments: lilac to blush, fading into the page. */
export const Glow = ['#F6E3FF', '#FFE4EA', '#FFF6F2'] as const;

/** The sunset gradient: primary buttons, progress and the reveal. */
export const Sunset = ['#FF5F8F', '#FF8E6E'] as const;

/** Photo paper border colour. */
export const PrintWhite = '#FFFFFF';

/** The page gutter. */
export const Gutter = 20;

export const Radius = {
  /** Photographs are soft-cornered cards. */
  print: 18,
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

/** The tab bar's row, above the home indicator. See components/app-tabs.tsx. */
export const TabBarHeight = 56;
/** Room to leave under scrolling content so nothing hides behind the tab bar. */
export const BottomTabInset = TabBarHeight + (Platform.select({ ios: 34, android: 24, web: 0 }) ?? 0);
export const MaxContentWidth = 520;
