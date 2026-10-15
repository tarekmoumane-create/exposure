import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { DEFAULT_CONFIG } from '@/filters/presets';
import { useTheme } from '@/hooks/use-theme';
import { GenerateError, type GenerateStage, generateLook } from '@/lib/generate';
import { dismiss } from '@/lib/navigation';
import { useAppStore } from '@/store/app-store';

/**
 * Generation screen. Sends the photo to the Exposure API and lands in the editor with the result.
 * The response only arrives once the model is done (15–35 s), so progress is driven by elapsed
 * time against a typical render and eases toward 95% without ever stalling visibly. A credit is
 * spent only once a result has come back; Cancel and Back never charge.
 */

/** A typical render; the bar reaches ~90% here and creeps toward 95% after. */
const EXPECTED_MS = 26_000;

const STAGE_HINT: Record<GenerateStage, string> = {
  preparing: 'Getting your photo ready.',
  uploading: 'Sending it off.',
  generating: 'Rebuilding the light and the camera.',
  retrying: 'The studio is busy. Trying again.',
  finishing: 'Almost there.',
};

const REASSURANCE = [
  'Everything in your photo stays exactly where it is. Only the light and the camera change.',
  'Usually takes 20 to 30 seconds.',
  'Only the camera and the light change.',
  'Nothing is charged until the photo comes back.',
];

export default function ProcessScreen() {
  const theme = useTheme();
  const { lookId, uri, first } = useLocalSearchParams<{ lookId: string; uri: string; first?: string }>();
  const look = getLook(lookId);
  const { addShot, spendCredit, plan, credits, hydrated } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<GenerateStage>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [line, setLine] = useState(0);
  const stageRef = useRef<GenerateStage>('preparing');
  const startedAt = useRef(0);
  const firstRef = useRef(first);
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const outOfCredits = hydrated && credits <= 0;

  // Time-based progress: fast at first, easing toward 95% as the render runs long.
  useEffect(() => {
    if (error) return;
    startedAt.current = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const t = elapsed / EXPECTED_MS;
      const eased = 1 - Math.exp(-t * 2.3); // 0 → ~0.9 at EXPECTED_MS
      const current = stageRef.current;
      const floor = current === 'preparing' ? 0 : current === 'uploading' ? 6 : current === 'finishing' ? 96 : 12;
      setProgress((prev) => Math.max(prev, floor, Math.min(95, eased * 100)));
    }, 100);
    return () => clearInterval(timer);
  }, [error, attempt]);

  // Rotate the reassurance line while the model works.
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => setLine((n) => (n + 1) % REASSURANCE.length), 5500);
    return () => clearInterval(timer);
  }, [error, attempt]);

  useEffect(() => {
    if (!look || !uri || outOfCredits) return;
    const controller = new AbortController();
    const { signal } = controller;
    generateLook({
      uri,
      lookId: look.id,
      signal,
      onStage: (next) => {
        stageRef.current = next;
        setStage(next);
      },
    })
      .then((result) => {
        if (signal.aborted) return;
        setProgress(100);
        const shot = addShot({
          lookId: look.id,
          sourceUri: result.sourceUri,
          resultUri: result.resultUri,
          thumbUri: result.thumbUri,
          edit: { ...DEFAULT_CONFIG, intensity: 1 },
        });
        spendCredit();
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // First photo on a free plan: the editor opens the plan sheet over the blurred result.
        const reveal = firstRef.current && planRef.current === 'free' ? { reveal: '1' } : {};
        router.replace({ pathname: '/edit', params: { shotId: shot.id, fresh: '1', ...reveal } });
      })
      .catch((caught: unknown) => {
        if (signal.aborted || (caught as Error).name === 'AbortError') return;
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(caught instanceof GenerateError ? caught.message : 'Something went wrong.');
      });
    return () => controller.abort();
  }, [addShot, spendCredit, look, uri, attempt, outOfCredits]);

  const retry = () => {
    stageRef.current = 'preparing';
    setStage('preparing');
    setError(null);
    setProgress(0);
    setAttempt((n) => n + 1);
  };

  if (!look || !uri) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Nothing to make" message="Pick a look and a photo first." action={<Button title="Back" onPress={() => dismiss()} />} />
      </Screen>
    );
  }

  if (outOfCredits) {
    return (
      <Screen scroll={false}>
        <EmptyState
          title="No photos left"
          message="Add photos or join a plan, then make this one."
          action={<Button title="See options" onPress={() => router.replace('/out-of-credits')} />}
        />
      </Screen>
    );
  }

  const shown = Math.min(99, Math.round(progress));

  return (
    <LinearGradient colors={[theme.background, theme.accentSoft]} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Wordmark size={24} />
          </View>
          <View style={styles.statusRow}>
            <ThemedText type="body">{error ? "Didn't go through" : `Applying ${look.name}…`}</ThemedText>
            <ThemedText type="mono" themeColor="textSecondary">
              {error ? '' : `${shown}%`}
            </ThemedText>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: error ? 0 : shown, text: error ? 'Stopped' : `${shown} percent` }}>
            <View style={[styles.bar, { backgroundColor: error ? theme.textTertiary : theme.text, width: `${error ? 100 : shown}%` }]} />
          </View>
          <View style={[styles.frame, { backgroundColor: theme.surfaceRaised }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            {!error ? (
              <>
                <View style={[styles.veil, { height: `${shown}%` }]} pointerEvents="none" />
                <View style={[styles.scanLine, { top: `${shown}%` }]} pointerEvents="none" />
              </>
            ) : null}
            <View style={styles.lookChip} pointerEvents="none">
              <Image source={look.after} style={styles.lookThumb} contentFit="cover" />
              <ThemedText type="photoLabel" themeColor="onPhoto">
                {look.name}
              </ThemedText>
            </View>
          </View>
          {error ? (
            <View style={styles.errorBlock}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {error}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.hint}>
                Nothing was charged.
              </ThemedText>
              <View style={styles.errorActions}>
                <Button title="Try again" onPress={retry} style={styles.grow} />
                <Button title="Back" variant="secondary" onPress={() => dismiss()} />
              </View>
            </View>
          ) : (
            <View style={styles.waitBlock}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {STAGE_HINT[stage]}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.hint}>
                {REASSURANCE[line]}
              </ThemedText>
              <Button title="Cancel" variant="ghost" size="md" onPress={() => dismiss()} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three },
  header: { alignItems: 'center', paddingVertical: Spacing.three },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(30,20,25,0.12)' },
  bar: { height: '100%' },
  frame: { aspectRatio: 4 / 5, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.four },
  veil: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(30,20,25,0.35)' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' },
  lookChip: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(30,20,25,0.55)',
  },
  lookThumb: { width: 28, height: 28, borderRadius: 14 },
  hint: { textAlign: 'center' },
  waitBlock: { gap: Spacing.one, paddingTop: Spacing.three, alignItems: 'center' },
  errorBlock: { gap: Spacing.one, paddingTop: Spacing.three },
  errorActions: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two },
  grow: { flex: 1 },
});
