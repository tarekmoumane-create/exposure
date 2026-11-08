import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { countFrames, rollSummary } from '@/lib/roll';
import { type Roll, useAppStore } from '@/store/app-store';

/** A roll on the shelf: a strip of its first frames and its details, like a lab sleeve. */
export function RollEnvelope({ roll, onPress }: { roll: Roll; onPress?: () => void }) {
  const theme = useTheme();
  const { paid } = useAppStore();
  const { total, done, developing } = countFrames(roll);
  const shown = roll.frames.slice(0, 4);
  const look = getLook(roll.lookId);
  const date = roll.createdAt ? new Date(roll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const status = developing > 0 ? `Developing ${done}/${total}` : done === total ? `${total} fr` : rollSummary(roll);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${roll.name}, ${look?.name ?? 'film'}, ${rollSummary(roll)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View style={styles.strip}>
        {shown.map((frame) => {
          // Before any purchase only the original is shown here, so nothing leaks past the paywall.
          const source = paid || typeof frame.sourceUri !== 'string' ? frame.thumbUri ?? frame.resultUri ?? frame.sourceUri : frame.sourceUri;
          return (
            <View key={frame.id} style={[styles.cell, { backgroundColor: theme.surfaceRaised }]}>
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
              {frame.status !== 'done' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(243,238,230,0.55)' }]} /> : null}
            </View>
          );
        })}
        {Array.from({ length: Math.max(0, 4 - shown.length) }, (_, i) => (
          <View key={`empty-${i}`} style={[styles.cell, styles.empty, { borderColor: theme.line }]} />
        ))}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.grow}>
            {roll.name}
          </ThemedText>
          <ThemedText type="subtitle" themeColor="textTertiary">
            ›
          </ThemedText>
        </View>
        <View style={styles.meta}>
          <ThemedText type="mono" themeColor="textSecondary" numberOfLines={1} style={styles.grow}>
            {[look?.name ?? 'Film', date].filter(Boolean).join('  ·  ')}
          </ThemedText>
          <View style={styles.status}>
            {developing > 0 ? <StatusDot live /> : null}
            <ThemedText type="mono" themeColor={developing > 0 ? 'accent' : 'textSecondary'}>
              {status}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 8 },
  strip: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  empty: { borderWidth: StyleSheet.hairlineWidth * 2, borderStyle: 'dashed', backgroundColor: 'transparent' },
  info: { gap: 4, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grow: { flex: 1 },
});
