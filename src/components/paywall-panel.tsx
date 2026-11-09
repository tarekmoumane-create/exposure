import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
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
  { id: 'yearly', name: 'Yearly', price: 'year', perDay: 10, note: 'about 300 a month', badge: 'Best value' },
  { id: 'weekly', name: 'Weekly', price: 'week', perDay: 5, note: 'cancel any time' },
];
const FEATURES = ['Every look, all ten of them', 'Rolls of up to 12 photos, yours to keep', 'Save and share every photo', 'New photos every day'];

type Props = {
  /** Set when the paywall opens over a locked roll. */
  rollId?: string;
  /** The short version, for the sheet that rises over a locked roll. */
  compact?: boolean;
  /** Called after a purchase or restore succeeds. */
  onDone: () => void;
  /** Called when the person declines. */
  onClose: () => void;
};

/** Plans, prices and the buy button. Prices come from the store when one is configured, otherwise the USD list prices. */
export function PaywallPanel({ rollId, compact = false, onDone, onClose }: Props) {
  const theme = useTheme();
  const { buyPlan, restore, plan, canBuy, purchasesLive } = useAppStore();
  const [selected, setSelected] = useState<Tier>(TIERS[0]);
  const [prices, setPrices] = useState<Record<string, string>>(FALLBACK_PRICES);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  // Toasts render under native modals on iOS, so outcomes are shown inline.
  const [status, setStatus] = useState<string | null>(null);
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
    if (result.ok) return onDone();
    if (result.message) setStatus(result.message);
  };

  const onRestore = async () => {
    setBusy('restore');
    const result = await restore();
    setBusy(null);
    if (result.ok) return onDone();
    setStatus(result.message);
  };

  const headline = plan === 'yearly' ? 'You have everything.' : plan === 'weekly' ? 'Double your photos.' : rollId ? 'Unlock your photo.' : 'Keep every photo.';

  return (
    <View style={compact ? styles.compact : styles.full}>
      <View style={compact ? styles.copyCompact : styles.copy}>
        <ThemedText type={compact ? 'title' : 'display'} accessibilityRole="header">{headline}</ThemedText>
        {plan !== 'free' ? (
          <ThemedText themeColor="textSecondary">
            {plan === 'yearly' ? 'Ten photos a day in every look, banking for three days. Manage the plan in Settings.' : 'Ten photos a day instead of five. More room for every night out and weekend away.'}
          </ThemedText>
        ) : compact ? (
          <ThemedText type="small" themeColor="textSecondary">See it in full, save it, and put any look on a whole roll. Every look, new photos every day.</ThemedText>
        ) : (
          <View style={styles.features}>
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.feature}>
                <View style={[styles.tick, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText type="tiny" themeColor="accent">✓</ThemedText>
                </View>
                <ThemedText type="small" style={styles.grow}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={compact ? styles.tiersCompact : styles.tiers} accessibilityRole="radiogroup">
        {visibleTiers.map((tier) => {
          const isSelected = tier.id === selected.id;
          return (
            <Pressable
              key={tier.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${tier.name}, ${prices[PLAN_PRODUCTS[tier.id]]} a ${tier.price}. ${tier.perDay} photos a day.`}
              onPress={() => setSelected(tier)}
              style={[styles.tier, compact && styles.tierCompact, { backgroundColor: theme.surface, borderColor: isSelected ? theme.accent : 'transparent' }]}>
              <View style={[styles.radio, { borderColor: isSelected ? theme.accent : theme.line }]}>{isSelected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}</View>
              <View style={styles.tierText}>
                <View style={styles.tierTitle}>
                  <ThemedText type="bodyStrong">{tier.name}</ThemedText>
                  {tier.badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                      <ThemedText type="tiny" style={{ color: theme.onAccent }}>{tier.badge}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="caption" themeColor="textSecondary">{tier.id === 'yearly' ? `${tier.perDay} photos a day` : `${tier.perDay} photos a day · ${tier.note}`}</ThemedText>
              </View>
              <View style={styles.price}>
                <ThemedText type="bodyStrong">{prices[PLAN_PRODUCTS[tier.id]]}</ThemedText>
                <ThemedText type="tiny" themeColor="textTertiary">{`per ${tier.price}`}</ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={compact ? styles.actionsCompact : styles.actions}>
        {status ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {status}
          </ThemedText>
        ) : null}
        {visibleTiers.length > 0 && canBuy ? (
          <Button title={selected.id === 'yearly' && plan === 'free' ? 'Unlock Exposure' : `Choose ${selected.name}`} onPress={subscribe} loading={busy === 'buy'} disabled={busy !== null} />
        ) : visibleTiers.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Plans are not available in this build yet.
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textTertiary" style={[styles.center, compact && styles.fine]}>
          {`Auto-renews until cancelled. Cancel any time in your device settings.${purchasesLive ? '' : ' Prices in USD, may vary by region.'}`}
        </ThemedText>
        <View style={styles.links}>
          {plan === 'free' ? <Button title="Photo packs" variant="ghost" size="md" onPress={() => router.push('/out-of-credits')} disabled={busy !== null} /> : null}
          <Button title="Restore" variant="ghost" size="md" onPress={onRestore} loading={busy === 'restore'} disabled={busy !== null} />
          <Button title="Not now" variant="ghost" size="md" onPress={onClose} disabled={busy !== null} />
        </View>
        <View style={styles.legal}>
          <ExternalLink href={LEGAL_URLS.terms}>
            <ThemedText type="caption" themeColor="textTertiary" style={[styles.underline, compact && styles.fine]}>
              Terms of Use
            </ThemedText>
          </ExternalLink>
          <ExternalLink href={LEGAL_URLS.privacy}>
            <ThemedText type="caption" themeColor="textTertiary" style={[styles.underline, compact && styles.fine]}>
              Privacy Policy
            </ThemedText>
          </ExternalLink>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flexGrow: 1 },
  compact: {},
  copy: { gap: 16, paddingTop: 22, paddingBottom: 22 },
  copyCompact: { gap: 6, paddingBottom: 16 },
  features: { gap: 10 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
  fine: { fontSize: 11, lineHeight: 15 },
  tiers: { gap: 10 },
  tiersCompact: { gap: 8 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: Radius.lg, borderWidth: 2, boxShadow: Shadow.card },
  tierCompact: { paddingVertical: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  tierText: { flex: 1, gap: 4 },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: Radius.pill },
  price: { alignItems: 'flex-end', gap: 2 },
  actions: { gap: 10, marginTop: 'auto', paddingTop: 22 },
  actionsCompact: { gap: 6, paddingTop: 14 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  underline: { textDecorationLine: 'underline' },
});
