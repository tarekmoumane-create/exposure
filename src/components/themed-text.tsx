import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * display/title/subtitle: friendly headlines. body/small: reading. caption/label: UI text.
 * mono: the technical layer (frame numbers, specs, steps), always uppercase and tracked.
 */
export type TextType = 'display' | 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'mono' | 'monoSmall';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text maxFontSizeMultiplier={1.3} style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  title: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.7 },
  subtitle: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: -0.25 },
  body: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: Fonts.sansSemi, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  small: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 17 },
  label: { fontFamily: Fonts.sansSemi, fontSize: 13, lineHeight: 17 },
  mono: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, textTransform: 'uppercase' },
  monoSmall: { fontFamily: Fonts.mono, fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: 'uppercase' },
});
