import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** Frames left, like a camera's shot counter. Tapping opens plans for free users and packs for subscribers. */
export function CreditsPill() {
  const theme = useTheme();
  const { credits, plan } = useAppStore();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${credits} ${credits === 1 ? 'frame' : 'frames'} left. ${plan === 'free' ? 'See plans.' : 'Add frames.'}`}
      hitSlop={6}
      onPress={() => router.push(plan === 'free' ? '/paywall' : '/out-of-credits')}
      style={({ pressed }) => [styles.pill, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: credits > 0 ? theme.accent : theme.textTertiary }]} />
      <ThemedText type="mono" style={styles.count}>{`${String(credits).padStart(2, '0')} ${credits === 1 ? 'frame' : 'frames'}`}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 12, borderRadius: Radius.pill, boxShadow: Shadow.card },
  dot: { width: 6, height: 6, borderRadius: 3 },
  count: { fontVariant: ['tabular-nums'] },
});
