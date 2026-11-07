import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LookPreview } from '@/components/look-preview';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const PAGES = [
  {
    id: 'y2k-digicam',
    label: 'Digi',
    title: 'Same night.',
    accent: 'Different camera.',
    description: 'Bright flash. Rich color. Give your going-out photos that little-digicam feeling.',
  },
  {
    id: 'film-35',
    label: '35 mm film',
    title: 'A little grain.',
    accent: 'A lot of feeling.',
    description: 'Soft color, warm light, and a little 35 mm grain. For the days you want to keep.',
  },
] as const;
const GUIDE = [
  { title: 'Find your look', detail: 'Flash, film, or a little digicam nostalgia.' },
  { title: 'Add a photo', detail: 'Start with one favorite.' },
  { title: 'Watch it develop', detail: 'It develops halfway for free. A plan finishes it and unlocks rolls of up to 12.' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { setOnboarded } = useAppStore();
  const [page, setPage] = useState(0);
  const finishing = useRef(false);
  const current = PAGES[page];
  const look = getLook(current.id)!;

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    setOnboarded();
    router.replace('/');
    setTimeout(() => router.push('/new-roll'), 250);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        {page === 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Previous introduction screen" onPress={() => setPage(0)} style={styles.back}>
            <ThemedText style={styles.backArrow}>←</ThemedText>
          </Pressable>
        ) : <Wordmark size={19} />}
        <View style={styles.progress} accessibilityLabel={`Introduction, ${page + 1} of 2`}>
          {[0, 1].map((step) => <View key={step} style={[styles.progressDot, { backgroundColor: step === page ? theme.brand : theme.line, width: step === page ? 22 : 6 }]} />)}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View key={page} entering={FadeIn.duration(220)} style={styles.stage}>
          <View style={styles.copy}>
            <ThemedText accessibilityRole="header" style={styles.headline}>
              {current.title}{`\n`}<ThemedText style={styles.headline}>{current.accent}</ThemedText>
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.description}>{current.description}</ThemedText>
          </View>
          <LookPreview key={look.id} look={look} label={current.label} />
          {page === 1 ? (
            <View style={styles.guide}>
              {GUIDE.map((step, index) => (
                <View key={step.title} style={[styles.guideRow, { borderBottomColor: theme.line }]}>
                  <View style={[styles.stepNumber, { backgroundColor: 'transparent' }]}>
                    <ThemedText type="label" themeColor="brand">{`0${index + 1}`}</ThemedText>
                  </View>
                  <View style={styles.guideText}>
                    <ThemedText type="bodyStrong">{step.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{step.detail}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={page === 0 ? 'Continue' : 'Choose a look'} onPress={() => page === 0 ? setPage(1) : finish()} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.footerNote}>{page === 0 ? 'Your photos. A different camera.' : 'Your first photo develops halfway for free.'}</ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', minHeight: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backArrow: { fontSize: 25, lineHeight: 30 },
  progress: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  progressDot: { height: 6, borderRadius: 3 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  stage: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 24 },
  copy: { gap: 10 },
  headline: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 39, letterSpacing: -1 },
  description: { fontSize: 15, lineHeight: 22, maxWidth: 310 },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 12 },
  footerNote: { textAlign: 'center', fontSize: 11, lineHeight: 16 },
  guide: { gap: 0 },
  guideRow: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  stepNumber: { width: 24, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 0 },
  guideText: { flex: 1, gap: 3 },
});
