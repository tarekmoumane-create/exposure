import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Glow } from '@/components/glow';
import { IconButton } from '@/components/icon-button';
import { Print, PrintFan } from '@/components/print';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { SAMPLE_ROLL } from '@/data/sample-roll';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const HERO = getLook('y2k-digicam')!;
const STRIP = [SAMPLE_ROLL.frames[0], SAMPLE_ROLL.frames[3], SAMPLE_ROLL.frames[6]];
const STEPS = [
  { title: 'Pick a look', detail: 'Film, a 2000s digicam, flash. Real cameras, not filters.' },
  { title: 'Add a photo', detail: 'Start with a favourite. Nights out, trips, anything.' },
  { title: 'Watch it develop', detail: 'It comes back as if it was shot on that camera.' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { setOnboarded } = useAppStore();
  const [page, setPage] = useState<0 | 1>(0);
  const finishing = useRef(false);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    setOnboarded();
    router.replace('/');
    setTimeout(() => router.push('/new-roll'), 250);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <Glow height={560} />
      <View style={styles.header}>
        {page === 1 ? <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => setPage(0)} /> : <Wordmark size={14} />}
        <View style={styles.dots} accessibilityLabel={`Introduction, ${page + 1} of 2`}>
          {[0, 1].map((dot) => (
            <View key={dot} style={[styles.dot, { backgroundColor: dot === page ? theme.accent : theme.line }, dot === page && styles.dotActive]} />
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {page === 0 ? (
          <Animated.View key="intro" entering={FadeIn.duration(260)} style={styles.stage}>
            <View style={styles.figure}>
              {/* The finished photo only: no before/after switch or look name until someone pays. */}
              <Print rotate={-1.5} aspectRatio={0.9} border={7}>
                <Image source={HERO.after} style={styles.heroPhoto} contentFit="cover" accessibilityLabel="An example photo developed by Exposure" />
              </Print>
            </View>
            <View style={styles.copy}>
              <ThemedText type="display" accessibilityRole="header">
                {'Same night.\nDifferent camera.'}
              </ThemedText>
              <ThemedText themeColor="textSecondary">Exposure develops your photos as if they were taken on a real camera, film or light. Your faces and framing stay as they were.</ThemedText>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="steps" entering={FadeIn.duration(260)} style={styles.stage}>
            <View style={styles.fan}>
              <PrintFan sources={STRIP.map((frame) => frame.resultUri)} width={320} />
            </View>
            <View style={styles.copy}>
              <ThemedText type="display" accessibilityRole="header">
                {'One look.\nA whole roll.'}
              </ThemedText>
            </View>
            <View>
              {STEPS.map((step, index) => (
                <View key={step.title} style={styles.step}>
                  <View style={[styles.stepNo, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText type="label" themeColor="accent">{String(index + 1)}</ThemedText>
                  </View>
                  <View style={styles.stepText}>
                    <ThemedText type="bodyStrong">{step.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{step.detail}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={page === 0 ? 'See how it works' : 'Try it on my photo'} onPress={() => (page === 0 ? setPage(1) : finish())} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', height: 52, paddingHorizontal: Gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  stage: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Gutter, paddingVertical: Spacing.three, gap: 22 },
  figure: { gap: 14, paddingHorizontal: 6 },
  heroPhoto: { width: '100%', aspectRatio: 0.9 },
  copy: { gap: 12 },
  fan: { alignItems: 'center', paddingVertical: 8 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  stepNo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 20 },
  stepText: { flex: 1, gap: 2 },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Gutter, paddingTop: 10, paddingBottom: 12 },
});
