import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { LOOK_GROUPS, LOOKS, type LookGroup } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** Large photographic previews, organized by the kind of camera or light. */
export default function LooksScreen() {
  const theme = useTheme();
  const [group, setGroup] = useState<LookGroup | 'all'>('all');
  const filters = [{ id: 'all' as const, label: 'All looks' }, ...LOOK_GROUPS];
  const looks = group === 'all' ? LOOKS : LOOKS.filter((look) => look.group === group);

  return (
    <Screen withTabBar contentStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" style={styles.heading}>Looks</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>Explore cameras, film, and light.</ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.filters}>
        {filters.map((filter) => <Pressable key={filter.id} accessibilityRole="radio" accessibilityState={{ selected: group === filter.id }} onPress={() => setGroup(filter.id)} style={[styles.filter, { borderBottomColor: group === filter.id ? theme.text : 'transparent' }]}><ThemedText type="small" style={{ color: group === filter.id ? theme.text : theme.textSecondary }}>{filter.label}</ThemedText></Pressable>)}
      </ScrollView>
      <View style={styles.list}>
        {looks.map((look) => (
          <Pressable key={look.id} accessibilityRole="button" accessibilityLabel={`${look.name}. ${look.bestFor}. Explore this look.`} onPress={() => router.push({ pathname: '/stock/[id]', params: { id: look.id } })} style={({ pressed }) => [styles.look, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.imageWrap, { backgroundColor: theme.surfaceRaised }]}>
              <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <View style={styles.caption}>
              <View style={styles.text}><ThemedText type="subtitle">{look.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{look.bestFor}</ThemedText></View>
              <View style={[styles.arrow, { borderColor: theme.line }]}><ThemedText style={styles.arrowText}>↗</ThemedText></View>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  header: { gap: 12, paddingTop: 28, paddingBottom: 24 },
  heading: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.7 },
  description: { fontSize: 14, lineHeight: 21 },
  bleed: { marginHorizontal: -24, flexGrow: 0 },
  filters: { gap: 24, paddingHorizontal: 24, paddingBottom: 24 },
  filter: { minHeight: 44, paddingHorizontal: 4, borderBottomWidth: 1.5, justifyContent: 'center' },
  list: { gap: 28 },
  look: { gap: 12 },
  imageWrap: { width: '100%', aspectRatio: 1.15, borderRadius: 2, overflow: 'hidden' },
  caption: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  text: { flex: 1, gap: 4 },
  arrow: { width: 40, height: 40, borderWidth: 0, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 21, lineHeight: 26 },
});
