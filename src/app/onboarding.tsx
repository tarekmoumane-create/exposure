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
  { title: 'Add your photos', detail: 'Start with a favourite. Nights out, trips, anything.' },
  { title: 'Watch it develop', detail: 'Every frame comes back as if it was shot on a real camera.' },
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
        <ThemedText type="mono" themeColor="textSecondary" accessibilityLabel={`Introduction, ${page + 1} of 2`}>
          {`0${page + 1} / 02`}
        </ThemedText>
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
                <View key={step.title} style={[styles.step, { borderTopColor: theme.line }]}>
                  <ThemedText type="mono" themeColor="accent" style={styles.stepNo}>{`0${index + 1}`}</ThemedText>
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
        <Button title={page === 0 ? 'See how it works' : 'Add your photo'} onPress={() => (page === 0 ? setPage(1) : finish())} />
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
  step: { flexDirection: 'row', gap: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  stepNo: { width: 22, paddingTop: 4 },
  stepText: { flex: 1, gap: 2 },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Gutter, paddingTop: 10, paddingBottom: 12 },
});
