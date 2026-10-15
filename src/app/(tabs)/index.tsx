import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CreditsPill } from '@/components/credits-pill';
import { IconButton } from '@/components/icon-button';
import { LookGrid } from '@/components/look-grid';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function LooksScreen() {
  const { onboarded } = useAppStore();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <View style={styles.side}>
          <CreditsPill />
        </View>
        <Wordmark />
        <View style={[styles.side, styles.sideRight]}>
          <IconButton name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>
      <LookGrid onPressLook={(look) => router.push({ pathname: '/look/[id]', params: { id: look.id } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two, paddingBottom: Spacing.three },
  side: { width: 64, flexDirection: 'row' },
  sideRight: { justifyContent: 'flex-end' },
});
