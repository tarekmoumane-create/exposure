import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, type PressableProps, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
};

/** Soft pill buttons. Ink is the one primary action on a screen; secondary is an outlined pill. */
export function Button({ title, variant = 'primary', size = 'lg', loading = false, icon, style, disabled, onPress, ...rest }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background = { primary: theme.brand, accent: theme.accent, secondary: theme.surface, ghost: 'transparent', danger: 'transparent' }[variant];
  const color = { primary: theme.onBrand, accent: theme.onAccent, secondary: theme.text, ghost: theme.text, danger: theme.mark }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: background, opacity: isDisabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'secondary' && { borderColor: theme.line, borderWidth: StyleSheet.hairlineWidth * 2 },
        (variant === 'ghost' || variant === 'danger') && styles.ghost,
        pressed && (variant === 'ghost' || variant === 'danger') && { opacity: 0.6 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <ThemedText type={size === 'lg' ? 'bodyStrong' : 'label'} style={[{ color }, size === 'md' && styles.mdText]}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, borderRadius: Radius.pill },
  lg: { paddingHorizontal: Spacing.four, minHeight: 54 },
  md: { paddingHorizontal: 18, minHeight: 44 },
  mdText: { fontSize: 14, lineHeight: 19 },
  ghost: { paddingHorizontal: Spacing.two },
});
