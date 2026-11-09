import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** A headline with a soft note or link on the right, like "Your rolls   3 rolls". */
export function SectionHeader({ title, meta, large = false, right }: { title: string; meta?: string; large?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText type={large ? 'display' : 'subtitle'} accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      {right ?? (meta ? <ThemedText type="caption" themeColor="textTertiary" style={large ? styles.metaLarge : undefined}>{meta}</ThemedText> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  metaLarge: { paddingBottom: 6 },
});
