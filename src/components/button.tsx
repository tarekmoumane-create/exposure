import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing, Sunset } from '@/constants/theme';
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

/** Soft pill buttons. The primary is a sunset gradient, the one thing to tap on a screen; secondary is a blush pill. */
export function Button({ title, variant = 'primary', size = 'lg', loading = false, icon, style, disabled, onPress, ...rest }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const gradient = variant === 'primary' || variant === 'accent';

  const background = { primary: 'transparent', accent: 'transparent', secondary: theme.surfaceRaised, ghost: 'transparent', danger: 'transparent' }[variant];
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
        { backgroundColor: background, opacity: isDisabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        gradient && !isDisabled && styles.lifted,
        (variant === 'ghost' || variant === 'danger') && styles.ghost,
        pressed && (variant === 'ghost' || variant === 'danger') && { opacity: 0.6 },
        style,
      ]}
      {...rest}>
      {gradient ? (
        // Clipped in its own layer, so the pill's shadow is not clipped with it.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
          <LinearGradient colors={Sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
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
  clip: { borderRadius: Radius.pill, overflow: 'hidden' },
  lg: { paddingHorizontal: Spacing.four, minHeight: 56 },
  md: { paddingHorizontal: 18, minHeight: 44 },
  mdText: { fontSize: 14, lineHeight: 19 },
  ghost: { paddingHorizontal: Spacing.two },
  lifted: { boxShadow: Shadow.button },
});
