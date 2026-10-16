import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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

/** Shown when a generation is attempted with no credits left. */
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
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Close" onPress={() => dismiss()} />
      </View>

      <View style={styles.copy}>
        <ThemedText type="title">{plan === 'free' ? 'Unlock Exposure.' : 'That’s all for today.'}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {plan === 'free'
            ? 'Join a plan for photos every day, or add a few and keep going.'
            : `${allowance} more arrive ${refresh}. Add a few now, or ${plan === 'weekly' ? 'double your daily photos with Yearly' : 'keep going with a pack'}.`}
        </ThemedText>
      </View>

      <View style={styles.packs}>
        {PACKS.map((pack) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            onPress={() => buy(pack.id)}
            disabled={busy !== null || !canBuy}
            style={({ pressed }) => [styles.pack, { backgroundColor: theme.surface, borderColor: busy === pack.id ? theme.accent : theme.line, opacity: pressed || (busy && busy !== pack.id) ? 0.7 : 1 }]}>
            <View style={styles.packText}>
              <View style={styles.packTitle}>
                <ThemedText type="bodyStrong">{PACK_PRODUCTS[pack.id].credits} photos</ThemedText>
                {pack.badge ? (
                  <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="caption" style={{ color: theme.accentDeep }}>
                      {pack.badge}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Never expire
              </ThemedText>
            </View>
            <ThemedText type="bodyStrong">{prices[PACK_PRODUCTS[pack.id].productId]}</ThemedText>
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
        {plan === 'free' ? <Button title="See plans" variant="accent" onPress={() => router.replace('/paywall')} /> : null}
        {plan === 'weekly' ? <Button title="Switch to Yearly" variant="accent" onPress={() => router.replace('/paywall')} /> : null}
        <Button title="Not now" variant="ghost" size="md" onPress={() => dismiss()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-end', paddingVertical: Spacing.two },
  copy: { gap: Spacing.two, paddingVertical: Spacing.three },
  packs: { gap: Spacing.two, paddingVertical: Spacing.three },
  pack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1.5 },
  packText: { gap: 2 },
  packTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { paddingVertical: 2, paddingHorizontal: Spacing.two, borderRadius: Radius.pill },
  actions: { gap: Spacing.two, marginTop: 'auto', paddingTop: Spacing.four },
  center: { textAlign: 'center' },
});
