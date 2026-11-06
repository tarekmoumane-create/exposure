import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CreditsPill } from '@/components/credits-pill';
import { IconButton } from '@/components/icon-button';
import { RollEnvelope } from '@/components/roll-envelope';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { SAMPLE_ROLL } from '@/data/sample-roll';
import { useAppStore } from '@/store/app-store';

export default function RollsScreen() {
  const { onboarded, rolls } = useAppStore();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <Wordmark />
        <View style={styles.headerRight}>
          <CreditsPill />
          <IconButton name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {rolls.length === 0 ? (
        <View style={styles.intro}>
          <ThemedText type="display">Turn your camera roll into a roll of film.</ThemedText>
          <ThemedText themeColor="textSecondary">Pick one camera and up to 12 photos. They come back as a set.</ThemedText>
        </View>
      ) : null}

      <Button title="Start a new roll" onPress={() => router.push('/new-roll')} />

      <View style={styles.list}>
        {rolls.map((roll) => (
          <RollEnvelope key={roll.id} roll={roll} onPress={() => router.push({ pathname: '/roll/[id]', params: { id: roll.id } })} />
        ))}
        <RollEnvelope roll={SAMPLE_ROLL} onPress={() => router.push({ pathname: '/roll/[id]', params: { id: SAMPLE_ROLL.id } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two, paddingBottom: Spacing.three },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  intro: { gap: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  list: { gap: Spacing.four, paddingTop: Spacing.four },
});
