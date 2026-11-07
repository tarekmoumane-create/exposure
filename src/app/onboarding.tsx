import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

/** Press and hold swaps the developed frame for the phone photo it came from. */
function BeforeAfter() {
  const theme = useTheme();
  const [original, setOriginal] = useState(false);
  const frame = FRAMES[1];
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel="Hold to see the original" onPressIn={() => setOriginal(true)} onPressOut={() => setOriginal(false)} style={styles.single}>
      <Image source={original ? frame.sourceUri : frame.resultUri} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[styles.hint, { backgroundColor: theme.scrim }]}>
        <ThemedText type="caption" themeColor="onPhoto">
          {original ? 'Original' : 'Hold to see the original'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const { setOnboarded, printConfig } = useAppStore();

  const pages = [
    { key: 'roll', title: 'Your favorite days, on film.', line: 'The night out. The weekend away. Choose up to 12 photos and one camera to give them a look you love.', art: <ContactSheet /> },
    { key: 'same', title: 'Same photo. Better camera.', line: 'Exposure changes the light and the camera. It checks every frame so people and places stay as you shot them.', art: <BeforeAfter /> },
    printConfig.enabled
      ? { key: 'print', title: 'Then hold them.', line: 'Order your roll as real 4x6 prints, mailed to your door. Your first frame is free to develop.', art: <Envelope /> }
      : { key: 'print', title: 'Keep the whole roll.', line: 'Save every frame, or share the contact sheet. Your first frame is free to develop.', art: <Envelope /> },
  ];
  const current = pages[page];
  const last = page === pages.length - 1;

  const finish = (path: '/new-roll' | '/roll/sample') => {
    setOnboarded();
    router.replace('/');
    setTimeout(() => router.push(path), 250);
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
        {last ? (
          <>
            <Button title="Start my first roll" onPress={() => finish('/new-roll')} />
            <Button title="Look at a sample roll" variant="secondary" onPress={() => finish('/roll/sample')} />
          </>
        ) : (
          <Button title="Continue" onPress={() => setPage(page + 1)} />
        )}
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
  single: { height: '100%', maxWidth: '100%', aspectRatio: 4 / 5, alignSelf: 'center', borderRadius: Radius.print, overflow: 'hidden', justifyContent: 'flex-end' },
  hint: { margin: Spacing.two, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: Radius.sm },
});
