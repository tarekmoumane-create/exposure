import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * display/title/subtitle: playful headlines. body/small: reading. caption/label: UI text.
 * eyebrow/tiny: the small friendly labels over and under things, always sentence case.
 */
export type TextType = 'display' | 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'eyebrow' | 'tiny';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text maxFontSizeMultiplier={1.3} style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  subtitle: { fontFamily: Fonts.displaySoft, fontSize: 18, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: Fonts.sansSemi, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  small: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 17 },
  label: { fontFamily: Fonts.sansSemi, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: Fonts.sansSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  tiny: { fontFamily: Fonts.sansMedium, fontSize: 11, lineHeight: 14 },
});
