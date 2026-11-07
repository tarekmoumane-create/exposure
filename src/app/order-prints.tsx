import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCents, orderPrints, PrintError } from '@/lib/prints';
import { useAppStore } from '@/store/app-store';

/** Pick frames, see the price, pay on the hosted page. The address is entered there too. */
export default function OrderPrintsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ roll: string }>();
  const { rolls, printConfig, addOrder } = useAppStore();
  const roll = rolls.find((item) => item.id === params.roll);
  const frames = roll?.frames.filter((frame) => frame.status === 'done') ?? [];
  const [off, setOff] = useState<Set<string>>(new Set());
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!roll || !printConfig.enabled) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Prints are not available" message="Try again later, or save your frames to Photos." action={<Button title="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const chosen = frames.filter((frame) => !off.has(frame.id));
  const count = chosen.length;
  const printsCents = count * printConfig.pricePerPrintCents;
  const totalCents = printsCents + printConfig.shippingCents;
  const enough = count >= printConfig.minPrints;
  const working = uploaded !== null;

  const toggle = (id: string) =>
    setOff((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const checkout = async () => {
    setError(null);
    setUploaded(0);
    try {
      const result = await orderPrints(chosen, roll.name, setUploaded);
      if (!result.paid) return;
      addOrder({ id: result.orderId, secret: result.secret, rollName: roll.name, count, totalCents, coverUri: chosen[0].thumbUri ?? chosen[0].resultUri, stage: 'printing' });
      router.dismissAll();
      router.navigate('/prints');
    } catch (caught) {
      setError(caught instanceof PrintError ? caught.message : 'The order did not go through, and you were not charged. Try again.');
    } finally {
      setUploaded(null);
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} scroll={false} contentStyle={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <ThemedText type="title">Your roll, on paper.</ThemedText>
          <ThemedText themeColor="textSecondary">4x6 prints on real silver-halide photo paper, mailed to you. Your whole photo is printed, with a thin white edge if needed. Tap a frame to leave it out.</ThemedText>
        </View>
        <View style={styles.grid}>
          {frames.map((frame, index) => {
            const selected = !off.has(frame.id);
            return (
              <Pressable
                key={frame.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Frame ${index + 1}`}
                onPress={() => toggle(frame.id)}
                disabled={working}
                style={[styles.cell, { opacity: selected ? 1 : 0.35, borderColor: selected ? theme.brand : 'transparent' }]}>
                <Image source={frame.thumbUri ?? frame.resultUri} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.summary, { borderTopColor: theme.line }]}>
        <Line label={`${count} ${count === 1 ? 'print' : 'prints'} at ${formatCents(printConfig.pricePerPrintCents)}`} value={formatCents(printsCents)} />
        <Line label="Shipping" value={formatCents(printConfig.shippingCents)} />
        <Line label="Total before tax" value={formatCents(totalCents)} strong />
        <ThemedText type="caption" themeColor="textSecondary">
          {`Ships to the ${printConfig.country}. To print them, your photos go to our print lab, Prodigi, and are deleted from our servers within 21 days.`}
        </ThemedText>
        {error ? (
          <ThemedText type="small" themeColor="mark">
            {error}
          </ThemedText>
        ) : null}
        {!enough ? (
          <ThemedText type="small" themeColor="mark">
            {`Choose at least ${printConfig.minPrints} prints.`}
          </ThemedText>
        ) : null}
        <Button title={working ? `Uploading ${uploaded} of ${count}` : 'Continue to payment'} onPress={checkout} disabled={!enough || working} />
      </View>
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <ThemedText type={strong ? 'bodyStrong' : 'small'}>{label}</ThemedText>
      <ThemedText type={strong ? 'bodyStrong' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: Spacing.two },
  scroll: { paddingVertical: Spacing.three, gap: Spacing.three },
  intro: { gap: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '31.8%', aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden', borderWidth: 3 },
  summary: { gap: Spacing.two, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
});
