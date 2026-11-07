import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { rollSummary } from '@/lib/roll';
import { type Roll, useAppStore } from '@/store/app-store';

/** A roll is a photographic cover with a quiet caption, rather than a simulated envelope. */
export function RollEnvelope({ roll, onPress }: { roll: Roll; onPress?: () => void }) {
  const theme = useTheme();
  const { paid } = useAppStore();
  const shown = roll.frames.slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${roll.name}, ${rollSummary(roll)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.root, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View style={styles.fan}>
        {shown.map((frame) => (
          <Image key={frame.id} source={paid || typeof frame.sourceUri !== 'string' ? frame.thumbUri ?? frame.resultUri ?? frame.sourceUri : frame.sourceUri} style={[styles.photo, { backgroundColor: theme.surfaceRaised }]} contentFit="cover" />
        ))}
      </View>
      <View style={[styles.envelope, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle" numberOfLines={1}>
          {roll.name}
        </ThemedText>
        <View style={styles.meta}>
          <ThemedText type="small" numberOfLines={1} style={styles.grow}>
            {getLook(roll.lookId)?.name ?? 'Film'}
          </ThemedText>
          <ThemedText type="label">{rollSummary(roll)}</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: 2, overflow: 'hidden' },
  fan: { flexDirection: 'row', gap: 3, height: 180 },
  photo: { flex: 1, height: '100%' },
  envelope: { gap: 6, paddingVertical: Spacing.three },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  grow: { flex: 1 },
});
