import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** Photos left. Tapping opens plans for free users and packs for subscribers. */
export function CreditsPill() {
  const theme = useTheme();
  const { credits, plan } = useAppStore();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${credits} frames left. ${plan === 'free' ? 'See plans.' : 'Add frames.'}`}
      hitSlop={6}
      onPress={() => router.push(plan === 'free' ? '/paywall' : '/out-of-credits')}
      style={({ pressed }) => [styles.pill, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
      <ThemedText type="caption">{credits === 1 ? '1 frame' : `${credits} frames`}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingHorizontal: 12, borderRadius: Radius.pill },
});
