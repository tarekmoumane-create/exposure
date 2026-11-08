import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ComparePhoto } from '@/components/compare-photo';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Spacing } from '@/constants/theme';
import { getLook, LOOK_GROUPS, lookNumber } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { dismiss } from '@/lib/navigation';

/** One look as a spec sheet: the example, its range, and what it does. */
export default function StockScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const look = getLook(id);
  const [strength, setStrength] = useState(1);

  if (!look) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Look not found" message="This look is no longer available. Choose another from the Looks tab." />
      </Screen>
    );
  }

  const group = LOOK_GROUPS.find((item) => item.id === look.group)?.label ?? '';
  const rows = [
    ['Kind', group],
    ['Character', look.spec],
    ['Best for', look.bestFor],
  ];

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        <ThemedText type="mono" themeColor="textSecondary">{lookNumber(look)}</ThemedText>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ComparePhoto before={look.before} after={look.after} strength={strength} aspectRatio={4 / 5} accessibilityLabel={`${look.name} example. Press and hold to see the original.`} />

        <View style={styles.titleBlock}>
          <ThemedText type="display" accessibilityRole="header">{look.name}</ThemedText>
          <ThemedText type="subtitle" themeColor="textSecondary">{look.tagline}</ThemedText>
        </View>

        <SliderRow label="Strength" value={strength} onChange={setStrength} />

        <ThemedText themeColor="textSecondary">{look.description}</ThemedText>

        <View style={[styles.table, { borderTopColor: theme.line }]}>
          {rows.map(([label, value]) => (
            <View key={label} style={[styles.row, { borderBottomColor: theme.line }]}>
              <ThemedText type="mono" themeColor="textTertiary" style={styles.rowLabel}>{label}</ThemedText>
              <ThemedText type="small" style={styles.rowValue}>{value}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText type="small" themeColor="textTertiary">
          You can set the strength for a whole roll, or for one frame, once it develops.
        </ThemedText>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.line }]}>
        <Button title={`Start a roll on ${look.name}`} onPress={() => router.push({ pathname: '/new-roll', params: { lookId: look.id } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: Gutter, paddingBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, marginHorizontal: -6 },
  spacer: { width: 44 },
  scroll: { gap: 20, paddingTop: 6, paddingBottom: Spacing.four },
  titleBlock: { gap: 6 },
  table: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: 'row', gap: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  rowLabel: { width: 92, paddingTop: 3 },
  rowValue: { flex: 1 },
  footer: { paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
