import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchPrintStatus, formatCents, type PrintStage } from '@/lib/prints';
import { useAppStore } from '@/store/app-store';

const STAGE_LABEL: Record<PrintStage, string> = {
  payment: 'Waiting for payment',
  printing: 'At the print lab',
  shipped: 'On its way',
  cancelled: 'Cancelled',
  problem: 'Needs attention. Email support.',
};

export default function PrintsScreen() {
  const theme = useTheme();
  const { orders, updateOrder } = useAppStore();

  useFocusEffect(
    useCallback(() => {
      orders
        .filter((order) => order.stage === 'printing' || order.stage === 'payment')
        .forEach((order) => {
          fetchPrintStatus(order.id, order.secret).then((status) => {
            if (status) updateOrder(order.id, status);
          });
        });
      // Status is read once per visit, not on every change it causes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateOrder])
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
    <Screen withTabBar>
      <ThemedText type="display" style={styles.title} accessibilityRole="header">
        Prints
      </ThemedText>
      {orders.map((order) => (
        <View key={order.id} style={[styles.row, { borderTopColor: theme.line }]}>
          {order.coverUri !== undefined ? <Image source={order.coverUri} style={styles.photo} contentFit="cover" /> : null}
          <View style={styles.text}>
            <ThemedText type="bodyStrong">{order.rollName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`${order.count} prints, ${formatCents(order.totalCents)} before tax`}
            </ThemedText>
            <ThemedText type="label" themeColor={order.stage === 'problem' ? 'mark' : 'brand'}>
              {STAGE_LABEL[order.stage]}
            </ThemedText>
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
  title: { paddingTop: Spacing.three, paddingBottom: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  photo: { width: 76, height: 95, borderRadius: Radius.print },
  text: { flex: 1, gap: 2 },
  link: { textDecorationLine: 'underline' },
});
