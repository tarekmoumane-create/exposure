import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextType = 'wordmark' | 'display' | 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'photoLabel';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text maxFontSizeMultiplier={1.3} style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  wordmark: { fontFamily: Fonts.displayHeavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 39, letterSpacing: -0.8 },
  title: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  subtitle: { fontFamily: Fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: Fonts.sansSemi, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 17 },
  label: { fontFamily: Fonts.sansSemi, fontSize: 13, lineHeight: 17 },
  photoLabel: {
    fontFamily: Fonts.sansSemi,
    fontSize: 13,
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
