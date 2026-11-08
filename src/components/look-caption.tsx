import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type Look, lookNumber } from '@/data/looks';

/** The line under an example photo: catalogue number and name on the left, the spec on the right. */
export function LookCaption({ look }: { look: Look }) {
  return (
    <View style={styles.row}>
      <ThemedText type="mono" numberOfLines={1} style={styles.name}>
        <ThemedText type="mono" themeColor="textTertiary">{`${lookNumber(look)}  `}</ThemedText>
        {look.name}
      </ThemedText>
      <ThemedText type="monoSmall" themeColor="textTertiary" numberOfLines={1} style={styles.spec}>
        {look.spec}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  name: { flexShrink: 0 },
  spec: { flex: 1, textAlign: 'right' },
});
