import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { CreditsPill } from '@/components/credits-pill';
import { IconButton } from '@/components/icon-button';
import { LookTile } from '@/components/look-tile';
import { PrintFan } from '@/components/print';
import { RollEnvelope } from '@/components/roll-envelope';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Gutter, Radius, Shadow, Spacing } from '@/constants/theme';
import { getLook, LOOKS } from '@/data/looks';
import { SAMPLE_ROLL } from '@/data/sample-roll';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const HERO_FRAMES = [SAMPLE_ROLL.frames[3].resultUri, SAMPLE_ROLL.frames[8].resultUri, SAMPLE_ROLL.frames[0].resultUri];
const RAIL = ['film-35', 'y2k-digicam', 'night-flash', 'golden-hour'].map((id) => getLook(id)!);

export default function RollsScreen() {
  const theme = useTheme();
  const { onboarded, rolls, paid } = useAppStore();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen withTabBar glow contentStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark size={14} />
        <View style={styles.headerRight}>
          {paid ? <CreditsPill /> : null}
          <IconButton name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <View style={styles.title}>
        <SectionHeader large title="Your rolls" meta={rolls.length ? `${rolls.length} ${rolls.length === 1 ? 'roll' : 'rolls'}` : undefined} />
      </View>

      {rolls.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(420)} style={[styles.hero, { backgroundColor: theme.surface }]}>
          <View style={styles.heroFan}>
            <PrintFan sources={HERO_FRAMES} width={300} />
          </View>
          <View style={styles.heroCopy}>
            <ThemedText type="title" style={styles.heroText}>{paid ? 'Develop your first roll' : 'Try it on your photo'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroText}>
              {paid ? 'Pick a look and up to 12 photos. They develop together as one matching set.' : 'Pick a look, add a photo, and watch it develop right here.'}
            </ThemedText>
          </View>
          <Button title={paid ? 'Start a roll' : 'Try a look'} onPress={() => router.push('/new-roll')} />
        </Animated.View>
      ) : (
        <View style={styles.rolls}>
          {rolls.map((roll, index) => (
            <Animated.View key={roll.id} entering={FadeInDown.delay(index * 70).duration(380)}>
              <RollEnvelope roll={roll} onPress={() => router.push({ pathname: '/roll/[id]', params: { id: roll.id } })} />
            </Animated.View>
          ))}
          <Button title="New roll" icon={<ThemedText type="subtitle" style={{ color: theme.onBrand }}>+</ThemedText>} onPress={() => router.push('/new-roll')} style={styles.newRoll} />
        </View>
      )}

      {paid ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="Looks to try" meta={`${LOOKS.length} looks`} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
            {RAIL.map((look) => (
              <LookTile key={look.id} look={look} compact style={styles.railTile} />
            ))}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  title: { paddingTop: Spacing.three, paddingBottom: 18 },
  hero: { borderRadius: Radius.lg, padding: 16, paddingTop: 26, gap: 18, boxShadow: Shadow.card },
  heroFan: { alignItems: 'center' },
  heroCopy: { gap: 6, alignItems: 'center' },
  heroText: { textAlign: 'center' },
  rolls: { gap: 12 },
  newRoll: { marginTop: 6 },
  section: { paddingTop: 36, paddingBottom: 14 },
  bleed: { marginHorizontal: -Gutter, flexGrow: 0 },
  rail: { gap: 12, paddingHorizontal: Gutter },
  railTile: { width: 150 },
});
