import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Sunset } from '@/constants/theme';
import { type Look } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { type Frame } from '@/store/app-store';

type Props = {
  frame: Frame;
  look: Look | undefined;
  /** Before purchase. Flips to false when a plan or pack is bought, and the frost lifts. */
  locked: boolean;
  onUnlock: () => void;
  onRetry: () => void;
  /** Fires once the result has flashed up and frosted over, so the plans can rise. */
  onFrosted: () => void;
};

type Phase = 'developing' | 'peek' | 'frosted' | 'open' | 'failed';

const LINES = ['Loading your photo…', 'Setting the light…', 'Developing…', 'Adding the grain…', 'Almost there…'];
/** How long the finished photo shows sharp before it frosts over. */
const PEEK_MS = 2200;
/** The slow part of the progress bar: it eases toward 90% over about half a minute, then jumps on done. */
const DEVELOP_MS = 32_000;

function nextPhase(current: Phase, status: Frame['status'], locked: boolean): Phase {
  if (status === 'failed') return 'failed';
  if (status !== 'done') return 'developing';
  if (!locked) return 'open';
  // Finished while we watched: the peek, then the frost.
  return current === 'developing' ? 'peek' : current;
}

/**
 * The first photo, big: it develops with a sweep of light and a progress bar, flashes up sharp for a
 * moment, then frosts over until a plan unlocks it. One photo, full width, nothing else on screen.
 */
export function TrialStage({ frame, look, locked, onUnlock, onRetry, onFrosted }: Props) {
  const theme = useTheme();
  const done = frame.status === 'done';
  // A photo that was already finished when this opened has had its moment: it starts frosted.
  const [phase, setPhase] = useState<Phase>(() => (frame.status === 'failed' ? 'failed' : done ? (locked ? 'frosted' : 'open') : 'developing'));
  const [line, setLine] = useState(0);
  const [height, setHeight] = useState(0);

  const result = useSharedValue(done ? 1 : 0);
  const frost = useSharedValue(done && locked ? 1 : 0);
  const progress = useSharedValue(done ? 1 : 0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Phase changes driven by the frame and the lock, settled during render.
  const [seen, setSeen] = useState({ status: frame.status, locked });
  if (seen.status !== frame.status || seen.locked !== locked) {
    setSeen({ status: frame.status, locked });
    setPhase(nextPhase(phase, frame.status, locked));
  }

  useEffect(() => {
    if (phase !== 'peek') return;
    const timer = setTimeout(() => setPhase('frosted'), PEEK_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The animations for each phase.
  useEffect(() => {
    if (phase === 'developing') {
      progress.value = withTiming(0.9, { duration: DEVELOP_MS, easing: Easing.out(Easing.cubic) });
      sweep.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, false);
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, false);
      return;
    }
    cancelAnimation(sweep);
    cancelAnimation(pulse);
    sweep.value = withTiming(0, { duration: 300 });
    pulse.value = withTiming(0, { duration: 300 });
    if (phase === 'peek') {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      progress.value = withTiming(1, { duration: 400 });
      result.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      frost.value = 0;
    } else if (phase === 'frosted') {
      result.value = 1;
      frost.value = withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) });
    } else if (phase === 'open') {
      result.value = withTiming(1, { duration: 500 });
      frost.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
    }
  }, [phase, progress, sweep, pulse, result, frost]);

  // Tell the parent once the frost has settled, so the plans rise over it. Fires once per frosting,
  // whatever the parent re-renders in between.
  const frosted = useRef(onFrosted);
  useEffect(() => {
    frosted.current = onFrosted;
  }, [onFrosted]);
  useEffect(() => {
    if (phase !== 'frosted') return;
    const timer = setTimeout(() => frosted.current(), 750);
    return () => clearTimeout(timer);
  }, [phase]);

  // The status line changes every couple of seconds while developing.
  useEffect(() => {
    if (phase !== 'developing') return;
    const timer = setInterval(() => setLine((current) => (current + 1) % LINES.length), 2400);
    return () => clearInterval(timer);
  }, [phase]);

  const resultStyle = useAnimatedStyle(() => ({ opacity: result.value }));
  const frostStyle = useAnimatedStyle(() => ({ opacity: frost.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: (1 - result.value) * 0.28 }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: (1 - result.value) * 0.9,
    transform: [{ translateY: -height * 0.55 + sweep.value * height * 1.4 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.45, transform: [{ scale: 1 + pulse.value * 0.012 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }));

  const tint = look?.tint ?? theme.accentSoft;
  const name = look?.name ?? 'the look';

  return (
    <View style={styles.root}>
      <View style={styles.stageWrap}>
        {/* A soft halo in the look's colour that breathes while the photo develops. */}
        <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: tint }, haloStyle]} />
        <View style={[styles.stage, { backgroundColor: theme.surfaceRaised }]} onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}>
          <Image source={frame.sourceUri} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.text }, dimStyle]} />
          {height > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.sweep, { height: height * 0.5 }, sweepStyle]}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', `${tint}CC`, 'rgba(255,255,255,0)']} locations={[0, 0.4, 0.6, 1]} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
          {frame.resultUri !== undefined ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, resultStyle]}>
              <Image source={frame.resultUri} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Animated.View>
          ) : null}
          {frame.resultUri !== undefined ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, frostStyle]}>
              <Image source={frame.thumbUri ?? frame.resultUri} style={styles.frostPhoto} contentFit="cover" blurRadius={34} />
              <View style={[StyleSheet.absoluteFill, styles.frostTint]} />
            </Animated.View>
          ) : null}
          {phase === 'frosted' ? (
            <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.lockWrap} pointerEvents="none">
              <View style={[styles.lock, { backgroundColor: 'rgba(255,255,255,0.94)' }]}>
                <ThemedText type="label">Ready to unlock</ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={styles.copy}>
        {phase === 'developing' ? (
          <>
            <ThemedText type="eyebrow" themeColor="accent" style={styles.center}>{name}</ThemedText>
            <ThemedText type="title" style={styles.center} accessibilityLiveRegion="polite">{LINES[line]}</ThemedText>
            <View style={[styles.track, { backgroundColor: theme.line }]} accessibilityRole="progressbar">
              <Animated.View style={[styles.fill, barStyle]}>
                <LinearGradient colors={Sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>About 30 seconds. Keep the app open.</ThemedText>
          </>
        ) : null}
        {phase === 'peek' ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.copy}>
            <ThemedText type="eyebrow" themeColor="accent" style={styles.center}>{name}</ThemedText>
            <ThemedText type="title" style={styles.center}>There it is.</ThemedText>
          </Animated.View>
        ) : null}
        {phase === 'frosted' ? (
          <Animated.View entering={FadeInDown.delay(400).duration(420)} style={styles.copy}>
            <ThemedText type="title" style={styles.center}>Your photo is ready.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {`Unlock Exposure to see it in full, save it, and put ${name} on a whole roll.`}
            </ThemedText>
            <Button title="Unlock to keep it" onPress={onUnlock} style={styles.button} />
          </Animated.View>
        ) : null}
        {phase === 'failed' ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.copy}>
            <ThemedText type="title" style={styles.center}>That one didn’t develop.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{frame.error ?? 'Something went wrong on the way.'} Trying again is free.</ThemedText>
            <Button title="Try again" onPress={onRetry} style={styles.button} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22 },
  stageWrap: { paddingHorizontal: 4 },
  halo: { position: 'absolute', top: 14, left: 14, right: 14, bottom: -6, borderRadius: Radius.lg + 6 },
  stage: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.lg, overflow: 'hidden', boxShadow: Shadow.print },
  sweep: { position: 'absolute', left: 0, right: 0, top: 0 },
  frostPhoto: { width: '100%', height: '100%', transform: [{ scale: 1.15 }] },
  frostTint: { backgroundColor: 'rgba(255,246,242,0.35)' },
  lockWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  lock: { height: 38, paddingHorizontal: 18, borderRadius: Radius.pill, justifyContent: 'center', boxShadow: Shadow.card },
  copy: { gap: 10, alignItems: 'center', paddingHorizontal: 6 },
  center: { textAlign: 'center' },
  track: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  button: { alignSelf: 'stretch', marginTop: 8 },
});
