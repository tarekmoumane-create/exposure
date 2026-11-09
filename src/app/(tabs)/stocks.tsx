import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { LookTile } from '@/components/look-tile';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Spacing } from '@/constants/theme';
import { LOOK_GROUPS, LOOKS, type LookGroup } from '@/data/looks';

/** The catalogue: every look as a photograph on its colour, filtered by kind of camera or light. */
export default function LooksScreen() {
  const [group, setGroup] = useState<LookGroup | 'all'>('all');
  const filters = [{ id: 'all' as const, label: 'All' }, ...LOOK_GROUPS];
  const looks = group === 'all' ? LOOKS : LOOKS.filter((look) => look.group === group);

  return (
    <Screen withTabBar glow contentStyle={styles.content}>
      <View style={styles.header}>
        <SectionHeader large title="Looks" meta={`${looks.length} ${looks.length === 1 ? 'look' : 'looks'}`} />
        <ThemedText themeColor="textSecondary" style={styles.intro}>
          Real cameras, film and light. Pick one and your whole roll gets it.
        </ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
        {filters.map((filter) => (
          <Chip key={filter.id} label={filter.label} selected={group === filter.id} onPress={() => setGroup(filter.id)} />
        ))}
      </ScrollView>
      <View style={styles.grid}>
        {looks.map((look) => (
          <LookTile key={look.id} look={look} style={styles.tile} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  header: { gap: 8, paddingTop: 52 + Spacing.three, paddingBottom: 18 },
  intro: { maxWidth: 320 },
  bleed: { marginHorizontal: -Gutter, flexGrow: 0 },
  filters: { gap: 8, paddingHorizontal: Gutter, paddingBottom: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 26 },
  tile: { width: '47.5%', flexGrow: 1, maxWidth: '48.5%' },
});
