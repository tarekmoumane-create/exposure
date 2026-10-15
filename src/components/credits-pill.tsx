import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

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
      accessibilityLabel={`${credits} photos left. ${plan === 'free' ? 'See plans.' : 'Add photos.'}`}
      hitSlop={6}
      onPress={() => router.push(plan === 'free' ? '/paywall' : '/out-of-credits')}
      style={({ pressed }) => [styles.pill, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      <ThemedText type="caption">{credits}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: Radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
