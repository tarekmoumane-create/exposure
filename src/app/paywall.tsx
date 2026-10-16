import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { dismiss } from '@/lib/navigation';
import { FALLBACK_PRICES, LEGAL_URLS, PLAN_PRODUCTS } from '@/data/products';
import { useTheme } from '@/hooks/use-theme';
import { fetchPrices } from '@/lib/purchases';
import { type Plan, useAppStore } from '@/store/app-store';

type Tier = {
  id: Exclude<Plan, 'free'>;
  name: string;
  price: string;
  perDay: number;
  note: string;
  badge?: string;
};

const TIERS: Tier[] = [
  { id: 'yearly', name: 'Yearly', price: 'year', perDay: 10, note: 'About 300 photos a month', badge: 'Best value' },
  { id: 'weekly', name: 'Weekly', price: 'week', perDay: 5, note: 'About 35 photos a week · cancel any time' },
];
const TEASER_LOOKS = ['golden-hour', 'after-dark', 'film-35', 'rouge'];

/** The plan sheet. Prices come from the store when one is configured, otherwise the USD list prices. */
export default function PaywallScreen() {
  const theme = useTheme();
  const { buyPlan, restore, shots, plan, canBuy, purchasesLive } = useAppStore();
  const { shotId } = useLocalSearchParams<{ intro?: string; shotId?: string }>();
  const teaser = shots.find((shot) => shot.id === shotId)?.thumbUri ?? shots.find((shot) => shot.id === shotId)?.resultUri;
  const [selected, setSelected] = useState<Tier>(TIERS[0]);
  const [prices, setPrices] = useState<Record<string, string>>(FALLBACK_PRICES);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  // Toasts render under native modals on iOS, so outcomes are shown inline.
  const [status, setStatus] = useState<string | null>(null);
  const strip = TEASER_LOOKS.map(getLook).filter((look) => look !== undefined);
  /** A subscriber only sees the upgrade (weekly → yearly); yearly has nowhere to go. */
  const visibleTiers = plan === 'yearly' ? [] : plan === 'weekly' ? TIERS.filter((tier) => tier.id === 'yearly') : TIERS;

  useEffect(() => {
    let cancelled = false;
    fetchPrices().then((next) => {
      if (!cancelled) setPrices(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    setBusy('buy');
    const result = await buyPlan(selected.id);
    setBusy(null);
    if (result.ok) return dismiss();
    if (result.message) setStatus(result.message);
  };

  const onRestore = async () => {
    setBusy('restore');
    const result = await restore();
    setBusy(null);
    if (result.ok) return dismiss();
    setStatus(result.message);
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Wordmark size={22} />
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Close" onPress={() => dismiss()} />
      </View>

      {teaser ? (
        <View style={styles.teaserWrap}>
          <View style={[styles.teaser, { backgroundColor: theme.surfaceRaised }]}>
            <Image source={{ uri: teaser }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} />
            <View style={[styles.teaserBadge, { backgroundColor: theme.surface }]}>
              <ThemedText type="label">Ready</ThemedText>
            </View>
          </View>
        </View>
      ) : (
      <View style={styles.strip}>
        {strip.map((look, index) => (
          <View
            key={look.id}
            style={[
              styles.stripItem,
              { backgroundColor: theme.surfaceRaised, transform: [{ rotate: `${(index - 1.5) * 4}deg` }, { translateY: index % 2 ? 6 : -6 }] },
            ]}>
            <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          </View>
        ))}
      </View>
      )}

      <View style={styles.copy}>
        <ThemedText type="title" style={styles.center}>
          {plan === 'yearly' ? 'You have everything.' : plan === 'weekly' ? 'Double your photos.' : teaser ? 'Your photo is ready.' : 'Every look, every day.'}
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
          {plan === 'yearly'
            ? 'Ten photos a day, every look, banking for three days. Manage the plan in Settings.'
            : plan === 'weekly'
              ? 'Yearly gives you ten a day instead of five, for about a fifth of the price per photo.'
              : teaser
                ? 'Join a plan to reveal it and save it, then keep making new photos every day.'
                : 'Photos every day. Unused ones bank for three days. Your photo stays exactly as it is.'}
        </ThemedText>
      </View>

      <View style={styles.tiers}>
        {visibleTiers.map((tier) => {
          const isSelected = tier.id === selected.id;
          return (
            <Pressable
              key={tier.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(tier)}
              style={[styles.tier, { backgroundColor: theme.surface, borderColor: isSelected ? theme.accent : theme.line }]}>
              <View style={styles.tierText}>
                <View style={styles.tierTitle}>
                  <ThemedText type="bodyStrong">{tier.name}</ThemedText>
                  {tier.badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="caption" style={{ color: theme.accentDeep }}>
                        {tier.badge}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {tier.perDay} photos a day · {tier.note}
                </ThemedText>
              </View>
              <ThemedText type="bodyStrong">
                {prices[PLAN_PRODUCTS[tier.id]]} / {tier.price}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        {status ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {status}
          </ThemedText>
        ) : null}
        {visibleTiers.length > 0 && canBuy ? (
          <Button title="Continue" variant="accent" onPress={subscribe} loading={busy === 'buy'} disabled={busy !== null} />
        ) : visibleTiers.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Plans are not available in this build yet.
          </ThemedText>
        ) : null}
        <Button title="Not now" variant="ghost" size="md" onPress={() => dismiss()} disabled={busy !== null} />
        <Button title="Restore purchases" variant="ghost" size="md" onPress={onRestore} loading={busy === 'restore'} disabled={busy !== null} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
          {`Auto-renews until cancelled. Cancel any time in your device settings.${purchasesLive ? '' : ' Prices in USD, may vary by region.'}`}
        </ThemedText>
        <View style={styles.legal}>
          <ExternalLink href={LEGAL_URLS.terms}>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.underline}>
              Terms of Use
            </ThemedText>
          </ExternalLink>
          <ExternalLink href={LEGAL_URLS.privacy}>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.underline}>
              Privacy Policy
            </ThemedText>
          </ExternalLink>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two },
  strip: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: Spacing.four },
  stripItem: { width: 72, aspectRatio: 4 / 5, borderRadius: Radius.sm, overflow: 'hidden' },
  teaserWrap: { alignItems: 'center', paddingVertical: Spacing.three },
  teaser: { width: 150, aspectRatio: 4 / 5, borderRadius: Radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  teaserBadge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: Radius.pill },
  copy: { gap: Spacing.two, paddingBottom: Spacing.three, paddingHorizontal: Spacing.two },
  center: { textAlign: 'center' },
  tiers: { gap: Spacing.two, paddingVertical: Spacing.two },
  tier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1.5 },
  tierText: { flex: 1, gap: 2 },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { paddingVertical: 2, paddingHorizontal: Spacing.two, borderRadius: Radius.pill },
  actions: { gap: Spacing.two, marginTop: 'auto', paddingTop: Spacing.four },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four, paddingTop: Spacing.one },
  underline: { textDecorationLine: 'underline' },
});
