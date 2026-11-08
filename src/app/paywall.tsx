import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { SAMPLE_ROLL } from '@/data/sample-roll';
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
  { id: 'yearly', name: 'Yearly', price: 'year', perDay: 10, note: 'about 300 a month', badge: 'Best value' },
  { id: 'weekly', name: 'Weekly', price: 'week', perDay: 5, note: 'cancel any time' },
];
const TEASER_FRAMES = [SAMPLE_ROLL.frames[8], SAMPLE_ROLL.frames[2], SAMPLE_ROLL.frames[3]];
const FEATURES = ['Every look, all ten of them', 'Rolls of up to 12 frames', 'Save and share every frame', 'New frames every day'];

/** The plan sheet. Prices come from the store when one is configured, otherwise the USD list prices. */
export default function PaywallScreen() {
  const theme = useTheme();
  const { buyPlan, restore, plan, canBuy, purchasesLive } = useAppStore();
  const { rollId } = useLocalSearchParams<{ rollId?: string }>();
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

  const headline = plan === 'yearly' ? 'You have everything.' : plan === 'weekly' ? 'Double your frames.' : rollId ? 'Unlock your roll.' : 'Keep every frame.';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark size={13} />
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Close" onPress={() => dismiss()} />
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.sheetHead}>
          <ThemedText type="monoSmall" themeColor="textTertiary">Contact sheet</ThemedText>
          <ThemedText type="monoSmall" themeColor="textTertiary">Sunny 200</ThemedText>
        </View>
        <View style={styles.strip}>
          {TEASER_FRAMES.map((frame, index) => (
            <View key={frame.id} style={styles.stripCell}>
              <View style={[styles.stripPhoto, { backgroundColor: theme.surfaceRaised }]}>
                <Image source={frame.resultUri} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <ThemedText type="monoSmall" themeColor="textTertiary">{`0${index + 1}`}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.copy}>
        <ThemedText type="display" accessibilityRole="header">{headline}</ThemedText>
        {plan === 'free' ? (
          <View style={styles.features}>
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.feature}>
                <ThemedText type="mono" themeColor="accent">+</ThemedText>
                <ThemedText type="small" style={styles.grow}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText themeColor="textSecondary">
            {plan === 'yearly' ? 'Ten frames a day in every look, banking for three days. Manage the plan in Settings.' : 'Ten frames a day instead of five. More room for every night out and weekend away.'}
          </ThemedText>
        )}
      </View>

      <View style={styles.tiers} accessibilityRole="radiogroup">
        {visibleTiers.map((tier) => {
          const isSelected = tier.id === selected.id;
          return (
            <Pressable
              key={tier.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${tier.name}, ${prices[PLAN_PRODUCTS[tier.id]]} a ${tier.price}. ${tier.perDay} frames a day.`}
              onPress={() => setSelected(tier)}
              style={[styles.tier, { backgroundColor: theme.surface, borderColor: isSelected ? theme.text : theme.line, borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth * 2 }]}>
              <View style={[styles.radio, { borderColor: isSelected ? theme.text : theme.line }]}>{isSelected ? <View style={[styles.radioDot, { backgroundColor: theme.text }]} /> : null}</View>
              <View style={styles.tierText}>
                <View style={styles.tierTitle}>
                  <ThemedText type="bodyStrong">{tier.name}</ThemedText>
                  {tier.badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                      <ThemedText type="monoSmall" style={{ color: theme.onAccent }}>{tier.badge}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="caption" themeColor="textSecondary">{tier.id === 'yearly' ? `${tier.perDay} frames a day` : `${tier.perDay} frames a day · ${tier.note}`}</ThemedText>
              </View>
              <View style={styles.price}>
                <ThemedText type="bodyStrong">{prices[PLAN_PRODUCTS[tier.id]]}</ThemedText>
                <ThemedText type="monoSmall" themeColor="textTertiary">{`per ${tier.price}`}</ThemedText>
              </View>
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
          <Button title={selected.id === 'yearly' && plan === 'free' ? 'Unlock Exposure' : `Choose ${selected.name}`} onPress={subscribe} loading={busy === 'buy'} disabled={busy !== null} />
        ) : visibleTiers.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Plans are not available in this build yet.
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
          {`Auto-renews until cancelled. Cancel any time in your device settings.${purchasesLive ? '' : ' Prices in USD, may vary by region.'}`}
        </ThemedText>
        <View style={styles.links}>
          {plan === 'free' ? <Button title="Photo packs" variant="ghost" size="md" onPress={() => router.replace('/out-of-credits')} disabled={busy !== null} /> : null}
          <Button title="Restore" variant="ghost" size="md" onPress={onRestore} loading={busy === 'restore'} disabled={busy !== null} />
          <Button title="Not now" variant="ghost" size="md" onPress={() => dismiss()} disabled={busy !== null} />
        </View>
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
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 52, marginRight: -6 },
  sheet: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 10, gap: 10, marginTop: Spacing.two },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  strip: { flexDirection: 'row', gap: 6 },
  stripCell: { flex: 1, gap: 5 },
  stripPhoto: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  copy: { gap: 16, paddingTop: 26, paddingBottom: 22 },
  features: { gap: 10 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
  tiers: { gap: 10 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: Radius.lg },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  tierText: { flex: 1, gap: 4 },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: Radius.pill },
  price: { alignItems: 'flex-end', gap: 2 },
  actions: { gap: 10, marginTop: 'auto', paddingTop: 22 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  underline: { textDecorationLine: 'underline' },
});
