import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { PaywallPanel } from '@/components/paywall-panel';
import { PrintFan } from '@/components/print';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { Gutter } from '@/constants/theme';
import { SAMPLE_ROLL } from '@/data/sample-roll';
import { dismiss } from '@/lib/navigation';

const TEASER_FRAMES = [SAMPLE_ROLL.frames[8], SAMPLE_ROLL.frames[2], SAMPLE_ROLL.frames[3]];

/** The full plans screen, from Settings, the frame counter or a waiting roll. A locked roll uses the sheet instead. */
export default function PaywallScreen() {
  const { rollId } = useLocalSearchParams<{ rollId?: string }>();
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} glow contentStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark size={13} />
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Close" onPress={() => dismiss()} />
      </View>
      <View style={styles.fan}>
        <PrintFan sources={TEASER_FRAMES.map((frame) => frame.resultUri)} width={300} />
      </View>
      <PaywallPanel rollId={rollId} onDone={() => dismiss()} onClose={() => dismiss()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 52, marginRight: -6 },
  fan: { alignItems: 'center', paddingTop: 10 },
});
