import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ComparePhoto } from '@/components/compare-photo';
import { CreditsPill } from '@/components/credits-pill';
import { IconButton } from '@/components/icon-button';
import { LookCaption } from '@/components/look-caption';
import { LookTile } from '@/components/look-tile';
import { RollEnvelope } from '@/components/roll-envelope';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { getLook, LOOKS } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const FEATURED = getLook('gold-200')!;
const RAIL = ['night-flash', 'y2k-digicam', 'golden-hour', 'film-35'].map((id) => getLook(id)!);

export default function RollsScreen() {
  const theme = useTheme();
  const { onboarded, rolls, paid } = useAppStore();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen withTabBar contentStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark size={14} />
        <View style={styles.headerRight}>
          <CreditsPill />
          <IconButton name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <View style={styles.title}>
        <SectionHeader large title="Your rolls" meta={rolls.length ? String(rolls.length).padStart(2, '0') : undefined} />
      </View>

      {rolls.length === 0 ? (
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ComparePhoto before={FEATURED.before} after={FEATURED.after} aspectRatio={1.05} accessibilityLabel={`${FEATURED.name} example. Press and hold to see the original.`} />
          <View style={styles.heroCaption}>
            <LookCaption look={FEATURED} />
          </View>
          <View style={styles.heroCopy}>
            <ThemedText type="title">Develop your first roll</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {paid ? 'Pick a look and up to 12 photos. They develop together as one matching set.' : 'Pick a look and add a photo. Your first frame develops free.'}
            </ThemedText>
          </View>
          <Button title="Start a roll" onPress={() => router.push('/new-roll')} />
        </View>
      ) : (
        <View style={styles.rolls}>
          <Button title="New roll" variant="secondary" icon={<ThemedText type="subtitle">+</ThemedText>} onPress={() => router.push('/new-roll')} />
          {rolls.map((roll) => (
            <RollEnvelope key={roll.id} roll={roll} onPress={() => router.push({ pathname: '/roll/[id]', params: { id: roll.id } })} />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Looks to try" meta={`${LOOKS.length} in all`} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
        {RAIL.map((look) => (
          <LookTile key={look.id} look={look} style={styles.railTile} />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  title: { paddingTop: Spacing.three, paddingBottom: 18 },
  hero: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 8, paddingBottom: 12, gap: 12 },
  heroCaption: { paddingHorizontal: 4 },
  heroCopy: { gap: 6, paddingHorizontal: 4, paddingBottom: 4 },
  rolls: { gap: 12 },
  section: { paddingTop: 36, paddingBottom: 14 },
  bleed: { marginHorizontal: -Gutter, flexGrow: 0 },
  rail: { gap: 12, paddingHorizontal: Gutter },
  railTile: { width: 132 },
});
