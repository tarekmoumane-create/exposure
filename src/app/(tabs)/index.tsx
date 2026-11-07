import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { CreditsPill } from '@/components/credits-pill';
import { IconButton } from '@/components/icon-button';
import { LookPreview } from '@/components/look-preview';
import { RollEnvelope } from '@/components/roll-envelope';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useAppStore } from '@/store/app-store';

export default function RollsScreen() {
  const { onboarded, rolls } = useAppStore();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen withTabBar contentStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark size={16} />
        <View style={styles.headerRight}>
          <CreditsPill />
          <IconButton name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {rolls.length === 0 ? (
        <View style={styles.intro}>
          <ThemedText type="display">Your photos</ThemedText>
          <ThemedText themeColor="textSecondary">Start with a photo you love. Choose a camera look and make it yours.</ThemedText>
        </View>
      ) : null}

      {rolls.length === 0 ? <View style={styles.feature}><LookPreview look={getLook('y2k-digicam')!} /></View> : <ThemedText type="display" style={styles.rollsTitle}>Your rolls</ThemedText>}
      <Button title={rolls.length === 0 ? 'Create a roll' : 'Create a new roll'} onPress={() => router.push('/new-roll')} />
      {rolls.length === 0 ? <ThemedText type="small" themeColor="textSecondary" style={styles.note}>One look. Your photos. All yours.</ThemedText> : null}

      <View style={styles.list}>
        {rolls.map((roll) => (
          <RollEnvelope key={roll.id} roll={roll} onPress={() => router.push({ pathname: '/roll/[id]', params: { id: roll.id } })} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  feature: { gap: 14, marginBottom: 24 },
  rollsTitle: { paddingVertical: 24 },
  note: { textAlign: 'center', paddingTop: 14, fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two, paddingBottom: Spacing.three },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  intro: { gap: 12, paddingTop: 24, paddingBottom: 24 },
  list: { gap: Spacing.four, paddingTop: Spacing.four },
});
