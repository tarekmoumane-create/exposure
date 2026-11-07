import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

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

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  icon,
  style,
  disabled,
  onPress,
  ...rest
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background = {
    primary: theme.brand,
    accent: theme.accent,
    secondary: theme.surfaceRaised,
    ghost: 'transparent',
    danger: 'transparent',
  }[variant];
  const color = {
    primary: theme.onBrand,
    accent: theme.onAccent,
    secondary: theme.text,
    ghost: theme.textSecondary,
    danger: theme.mark,
  }[variant];

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
        { backgroundColor: background, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        (variant === 'ghost' || variant === 'danger') && styles.ghost,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon}
          <ThemedText type="bodyStrong" style={{ color }}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
  },
  lg: { paddingVertical: 16, paddingHorizontal: Spacing.four, minHeight: 54 },
  md: { paddingVertical: 10, paddingHorizontal: Spacing.three, minHeight: 42 },
  ghost: { paddingHorizontal: Spacing.two },
});
