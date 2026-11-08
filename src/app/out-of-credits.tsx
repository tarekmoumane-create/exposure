import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { FALLBACK_PRICES, PACK_PRODUCTS, type PackId } from '@/data/products';
import { useTheme } from '@/hooks/use-theme';
import { dismiss } from '@/lib/navigation';
import { fetchPrices } from '@/lib/purchases';
import { DAILY_ALLOWANCE, useAppStore } from '@/store/app-store';

const PACKS: { id: PackId; badge?: string }[] = [
  { id: 'credits10' },
  { id: 'credits30', badge: 'Popular' },
  { id: 'credits80', badge: 'Best value' },
];

/** Packs, for when a roll needs more photos than are left. */
export default function OutOfCreditsScreen() {
  const theme = useTheme();
  const { plan, buyPack, canBuy } = useAppStore();
  const allowance = DAILY_ALLOWANCE[plan];
  const refresh = new Date().getHours() < 18 ? 'tonight at midnight' : 'at midnight';
  const [status, setStatus] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>(FALLBACK_PRICES);
  const [busy, setBusy] = useState<PackId | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPrices().then((next) => {
      if (!cancelled) setPrices(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const buy = async (pack: PackId) => {
    setBusy(pack);
    const result = await buyPack(pack);
    setBusy(null);
    if (result.ok) return dismiss();
    if (result.message) setStatus(result.message);
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="mono" themeColor="textSecondary">Photo packs</ThemedText>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Close" onPress={() => dismiss()} />
      </View>

      <View style={styles.copy}>
        <ThemedText type="display" accessibilityRole="header">{plan === 'free' ? 'Keep developing.' : 'That’s all for today.'}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {plan === 'free'
            ? 'Buy a pack to finish your roll, or join a plan for new frames every day.'
            : `${allowance} more arrive ${refresh}. Add a few now, or ${plan === 'weekly' ? 'double your daily frames with Yearly' : 'keep going with a pack'}.`}
        </ThemedText>
      </View>

      <View style={styles.packs}>
        {PACKS.map((pack) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            accessibilityLabel={`${PACK_PRODUCTS[pack.id].credits} frames for ${prices[PACK_PRODUCTS[pack.id].productId]}${pack.badge ? `, ${pack.badge}` : ''}`}
            onPress={() => buy(pack.id)}
            disabled={busy !== null || !canBuy}
            style={({ pressed }) => [styles.pack, { backgroundColor: theme.surface, borderColor: busy === pack.id ? theme.text : theme.line, opacity: busy && busy !== pack.id ? 0.5 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
            <ThemedText type="display" style={styles.count}>{PACK_PRODUCTS[pack.id].credits}</ThemedText>
            <View style={styles.packText}>
              <View style={styles.packTitle}>
                <ThemedText type="mono">Frames</ThemedText>
                {pack.badge ? (
                  <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                    <ThemedText type="monoSmall" style={{ color: theme.onAccent }}>{pack.badge}</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="caption" themeColor="textSecondary">Never expire</ThemedText>
            </View>
            <View style={[styles.price, { backgroundColor: theme.background }]}>
              {busy === pack.id ? <ThemedText type="label">…</ThemedText> : <ThemedText type="label">{prices[PACK_PRODUCTS[pack.id].productId]}</ThemedText>}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        {status ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {status}
          </ThemedText>
        ) : null}
        {!canBuy ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Purchases are not available in this build yet.
          </ThemedText>
        ) : null}
        {plan === 'free' ? <Button title="See plans" onPress={() => router.replace('/paywall')} /> : null}
        {plan === 'weekly' ? <Button title="Switch to Yearly" onPress={() => router.replace('/paywall')} /> : null}
        <Button title="Not now" variant="ghost" size="md" onPress={() => dismiss()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 52, marginRight: -6 },
  copy: { gap: 10, paddingTop: Spacing.three, paddingBottom: Spacing.four },
  packs: { gap: 10 },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 18, paddingRight: 12, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  count: { width: 52, fontVariant: ['tabular-nums'] },
  packText: { flex: 1, gap: 3 },
  packTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: Radius.pill },
  price: { minWidth: 76, height: 38, paddingHorizontal: 12, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: Spacing.two, marginTop: 'auto', paddingTop: Spacing.four },
  center: { textAlign: 'center' },
});
