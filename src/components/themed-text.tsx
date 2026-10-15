import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextType =
  | 'wordmark'
  | 'serifTitle'
  | 'serifItalic'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'caption'
  | 'label'
  | 'photoLabel'
  | 'mono';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text maxFontSizeMultiplier={1.3} style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  wordmark: { fontFamily: Fonts.serifItalic, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  serifTitle: { fontFamily: Fonts.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  serifItalic: { fontFamily: Fonts.serifItalicLight, fontSize: 17, lineHeight: 24 },
  title: { fontFamily: Fonts.sansExtra, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  subtitle: { fontFamily: Fonts.sansBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: Fonts.sansBold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.sansSemi, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: Fonts.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  photoLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mono: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 16 },
});
