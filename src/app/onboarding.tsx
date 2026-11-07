import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { RollEnvelope } from '@/components/roll-envelope';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { SAMPLE_ROLL } from '@/data/sample-roll';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const FRAMES = SAMPLE_ROLL.frames;

function ContactSheet() {
  return (
    <View style={styles.sheet}>
      {FRAMES.map((frame) => (
        <Image key={frame.id} source={frame.resultUri} style={styles.sheetFrame} contentFit="cover" />
      ))}
    </View>
  );
}

function Envelope() {
  return <RollEnvelope roll={SAMPLE_ROLL} />;
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const { setOnboarded } = useAppStore();

  const pages = [
    { key: 'roll', title: 'Your favorite days, on film.', line: 'Give the night out, the weekend away, or just a favorite selfie a camera look you love.', art: <ContactSheet /> },
    { key: 'choose', title: 'One look. Your whole roll.', line: 'Pick a camera look, then add 1–12 photos. Not sure? Start with Sunny 200 for a warm, everyday film feel.', art: <Envelope /> },
    { key: 'develop', title: 'Make it yours.', line: 'Add your photos first, then choose a plan to develop them. Your finished roll stays together, ready to save and share.', art: <Envelope /> },
  ];
  const current = pages[page];
  const last = page === pages.length - 1;

  const finish = () => {
    setOnboarded();
    router.replace('/');
    setTimeout(() => router.push('/new-roll'), 250);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Wordmark />
      </View>
      <Animated.View key={current.key} entering={FadeIn.duration(260)} style={styles.stage}>
        <View style={styles.art}>{current.art}</View>
        <View style={styles.copy}>
          <ThemedText type="display">{current.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{current.line}</ThemedText>
        </View>
      </Animated.View>
      <View style={styles.footer}>
        <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center' }}>
          {`${page + 1} of ${pages.length}`}
        </ThemedText>
        <Button title={last ? 'Choose my photos' : 'Continue'} onPress={() => last ? finish() : setPage(page + 1)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  stage: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  art: { flex: 1, justifyContent: 'center', minHeight: 200 },
  copy: { gap: Spacing.two },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.two },
  sheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignSelf: 'center', aspectRatio: 0.82, height: '100%', maxWidth: '100%' },
  sheetFrame: { width: '31.5%', aspectRatio: 4 / 5, borderRadius: Radius.print },
});
