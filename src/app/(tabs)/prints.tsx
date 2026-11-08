import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchPrintStatus, formatCents, type PrintStage } from '@/lib/prints';
import { useAppStore } from '@/store/app-store';

const ABANDONED_MS = 26 * 3_600_000;

const STAGE_LABEL: Record<PrintStage, string> = {
  payment: 'Payment not finished',
  printing: 'At the print lab',
  shipped: 'On its way',
  cancelled: 'Cancelled',
  problem: 'The lab couldn’t print this order, so it was refunded.',
};

export default function PrintsScreen() {
  const theme = useTheme();
  const { orders, updateOrder, removeOrder } = useAppStore();

  const latest = useRef(orders);
  useEffect(() => {
    latest.current = orders;
  }, [orders]);

  useFocusEffect(
    useCallback(() => {
      latest.current
        .filter((order) => order.stage === 'printing' || order.stage === 'payment')
        .forEach((order) => {
          fetchPrintStatus(order.id, order.secret).then((status) => {
            if (!status) return;
            if (status.stage !== 'payment') updateOrder(order.id, status);
            // Stripe closes an unpaid checkout after a day, so this one was abandoned.
            else if (order.stage === 'payment' && Date.now() - order.createdAt > ABANDONED_MS) removeOrder(order.id);
          });
        });
    }, [updateOrder, removeOrder])
  );

  if (orders.length === 0) {
    return (
      <Screen scroll={false} withTabBar>
        <EmptyState
          title="No prints yet"
          message="Develop a roll of at least 4 frames, then open it and choose Order prints."
          action={<Button title="Go to my rolls" onPress={() => router.navigate('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen withTabBar contentStyle={styles.content}>
      <View style={styles.title}>
        <SectionHeader large title="Prints" meta={String(orders.length).padStart(2, '0')} />
      </View>
      {orders.map((order) => (
        <View key={order.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {order.coverUri !== undefined ? <Image source={order.coverUri} style={[styles.photo, { backgroundColor: theme.surfaceRaised }]} contentFit="cover" /> : null}
          <View style={styles.text}>
            <ThemedText type="subtitle" numberOfLines={1}>{order.rollName}</ThemedText>
            <ThemedText type="mono" themeColor="textSecondary">
              {`${order.count} × 4×6  ·  ${formatCents(order.totalCents)}`}
            </ThemedText>
            <View style={styles.stage}>
              {order.stage === 'printing' || order.stage === 'shipped' ? <StatusDot live={order.stage === 'printing'} /> : null}
              <ThemedText type="label" themeColor={order.stage === 'problem' ? 'mark' : 'text'} style={styles.grow}>
                {STAGE_LABEL[order.stage]}
              </ThemedText>
            </View>
            {order.trackingUrl ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(order.trackingUrl!)}>
                <ThemedText type="small" themeColor="brand" style={styles.link}>
                  {`Track with ${order.carrier ?? 'the carrier'}`}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  title: { paddingTop: 52 + Spacing.three, paddingBottom: 18 },
  row: { flexDirection: 'row', gap: 14, padding: 8, paddingRight: 14, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: 10 },
  photo: { width: 76, height: 95, borderRadius: Radius.print },
  text: { flex: 1, gap: 5, paddingVertical: 6 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  grow: { flex: 1 },
  link: { textDecorationLine: 'underline' },
});
