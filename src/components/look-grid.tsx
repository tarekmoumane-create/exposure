import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LookCard } from '@/components/look-card';
import { Spacing } from '@/constants/theme';
import { LOOKS, type Look } from '@/data/looks';

type Props = {
  looks?: Look[];
  onPressLook: (look: Look) => void;
};

/** Two-column photo grid. Rendered inside a parent ScrollView. */
export function LookGrid({ looks = LOOKS, onPressLook }: Props) {
  const rows = useMemo(() => {
    const out: Look[][] = [];
    for (let i = 0; i < looks.length; i += 2) out.push(looks.slice(i, i + 2));
    return out;
  }, [looks]);

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((look) => look.id).join('+')} style={styles.row}>
          {row.map((look) => (
            <LookCard key={look.id} look={look} onPress={onPressLook} />
          ))}
          {row.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  spacer: { flex: 1 },
});
