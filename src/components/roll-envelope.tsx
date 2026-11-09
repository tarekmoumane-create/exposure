import { StyleSheet, View } from 'react-native';

import { PrintFan } from '@/components/print';
import { StatusDot } from '@/components/status-dot';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { countFrames, rollSummary } from '@/lib/roll';
import { type Roll, useAppStore } from '@/store/app-store';

/** A roll on the shelf: its prints fanned out on its look's colour, with its name and state. */
export function RollEnvelope({ roll, onPress }: { roll: Roll; onPress?: () => void }) {
  const theme = useTheme();
  const { paid } = useAppStore();
  const { total, done, developing } = countFrames(roll);
  const look = getLook(roll.lookId);
  const tint = look?.tint ?? theme.surfaceRaised;
  const deep = look?.deep ?? theme.text;
  const date = roll.createdAt ? new Date(roll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  // Before any purchase only originals are shown here, so nothing developed leaks past the paywall.
  const sources = [0, 1, 2].map((i) => {
    const frame = roll.frames[i] ?? roll.frames[0];
    if (!frame) return undefined;
    return paid || typeof frame.sourceUri !== 'string' ? frame.thumbUri ?? frame.resultUri ?? frame.sourceUri : frame.sourceUri;
  });
  const status = developing > 0 ? `Developing ${done} of ${total}` : done === total ? `${total} ${total === 1 ? 'photo' : 'photos'}` : rollSummary(roll);

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${roll.name}, ${look?.name ?? 'film'}, ${rollSummary(roll)}`}
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.975}
      style={[styles.card, { backgroundColor: tint }]}>
      <PrintFan sources={sources} width={150} />
      <View style={styles.info}>
        <ThemedText type="caption" style={[styles.soft, { color: deep }]}>
          {date}
        </ThemedText>
        <ThemedText type="subtitle" numberOfLines={2} style={{ color: deep }}>
          {roll.name}
        </ThemedText>
        <ThemedText type="caption" numberOfLines={1} style={[styles.soft, { color: deep }]}>
          {look?.name ?? 'Film'}
        </ThemedText>
        <View style={[styles.status, { backgroundColor: 'rgba(255,255,255,0.72)' }]}>
          {developing > 0 ? <StatusDot live /> : null}
          <ThemedText type="tiny" style={{ color: developing > 0 ? theme.accent : deep }}>
            {status}
          </ThemedText>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: Radius.lg, paddingVertical: 18, paddingLeft: 8, paddingRight: 16 },
  info: { flex: 1, gap: 5, alignItems: 'flex-start' },
  soft: { opacity: 0.78 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 11, borderRadius: Radius.pill, marginTop: 6 },
});
