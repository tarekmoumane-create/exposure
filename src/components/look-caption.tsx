import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type Look } from '@/data/looks';

/** The line under an example photo: the look's name on the left, what it's for on the right. */
export function LookCaption({ look }: { look: Look }) {
  return (
    <View style={styles.row}>
      <ThemedText type="label" numberOfLines={1} style={styles.name}>
        {look.name}
      </ThemedText>
      <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1} style={styles.spec}>
        {look.bestFor}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 0 },
  spec: { flex: 1, textAlign: 'right' },
});
