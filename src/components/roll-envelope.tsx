import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { rollSummary } from '@/lib/roll';
import { type Roll, useAppStore } from '@/store/app-store';

const FAN = [
  { rotate: '-7deg', left: '10%', top: 14 },
  { rotate: '4deg', left: '36%', top: 4 },
  { rotate: '-2deg', left: '60%', top: 12 },
] as const;

/** A roll as the lab hands it back: prints sticking out of an apricot envelope with its details on the front. */
export function RollEnvelope({ roll, onPress }: { roll: Roll; onPress?: () => void }) {
  const theme = useTheme();
  const { paid } = useAppStore();
  const shown = roll.frames.slice(0, FAN.length);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${roll.name}, ${rollSummary(roll)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.root, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View style={styles.fan}>
        {shown.map((frame, index) => (
          <View key={frame.id} style={[styles.print, { backgroundColor: theme.surface, left: FAN[index].left, top: FAN[index].top, transform: [{ rotate: FAN[index].rotate }] }]}>
            <Image source={paid || typeof frame.sourceUri !== 'string' ? frame.thumbUri ?? frame.resultUri ?? frame.sourceUri : frame.sourceUri} style={styles.photo} contentFit="cover" />
          </View>
        ))}
      </View>
      <View style={[styles.envelope, { backgroundColor: theme.accent }]}>
        <ThemedText type="title" numberOfLines={1}>
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
  root: { height: 236 },
  fan: { position: 'absolute', left: 0, right: 0, top: 0, height: 170 },
  print: { position: 'absolute', width: '32%', aspectRatio: 4 / 5, padding: 5, borderRadius: Radius.print, shadowColor: '#443347', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  photo: { flex: 1 },
  envelope: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 104, borderRadius: Radius.lg, borderTopWidth: 1, borderTopColor: 'rgba(112,82,120,0.12)', paddingHorizontal: Spacing.three, paddingVertical: 14, justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  grow: { flex: 1 },
});
