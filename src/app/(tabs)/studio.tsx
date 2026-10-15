import { CameraView, type CameraType, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { getPreset, PRESETS } from '@/filters/presets';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';

const FRAMES = 4;
const COUNTDOWN = 3;
/** Presets offered in the booth. Flash looks need the real flash, so they are left out. */
const BOOTH_PRESETS = ['original', 'gold', 'film35', 'portra', 'glow', 'blush', 'booth', 'mono'];
/** Approximate live tint per preset, drawn over the viewfinder. The real filter is applied to the captures. */
const LIVE_TINT: Record<string, string> = {
  original: 'transparent',
  gold: 'rgba(255,170,60,0.14)',
  film35: 'rgba(230,190,140,0.14)',
  portra: 'rgba(255,200,170,0.10)',
  glow: 'rgba(255,245,235,0.18)',
  blush: 'rgba(255,170,190,0.12)',
  booth: 'rgba(170,130,90,0.28)',
  mono: 'rgba(120,120,120,0.35)',
};

/** Classic photobooth: four shots on a timer, a filter, a strip. Free, on-device, no AI. */
export default function StudioScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<CameraType>('front');
  const [preset, setPreset] = useState('booth');
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const running = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    running.current = false;
    setCountdown(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => {
        setActive(false);
        clearTimers();
        setFrames([]);
      };
    }, [clearTimers])
  );

  useEffect(() => clearTimers, [clearTimers]);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      timers.current.push(id);
    });

  const captureOne = async (): Promise<string | null> => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    return photo?.uri ? persistTemporary(photo.uri) : null;
  };

  const runBooth = async () => {
    if (!ready || running.current) return;
    running.current = true;
    setBusy(true);
    const captured: string[] = [];
    setFrames([]);
    // A short "get ready" beat so the first count never lands while the thumb is still on the shutter.
    await wait(600);
    for (let shot = 0; shot < FRAMES && running.current; shot++) {
      for (let n = COUNTDOWN; n >= 1 && running.current; n--) {
        setCountdown(n);
        if (Platform.OS !== 'web') Haptics.impactAsync(n === 1 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
        await wait(850);
      }
      if (!running.current) break;
      setCountdown(null);
      // The flash is a quick bloom of its own, not tied to how long the capture takes.
      setFlash(true);
      const flashTimer = setTimeout(() => setFlash(false), 140);
      timers.current.push(flashTimer);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await captureOne();
      if (!running.current) break;
      if (uri) {
        captured.push(uri);
        setFrames([...captured]);
      }
      await wait(450);
    }
    const completed = running.current && captured.length === FRAMES;
    running.current = false;
    setBusy(false);
    if (completed) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/strip', params: { frames: JSON.stringify(captured), preset } });
    } else if (captured.length > 0 && captured.length < FRAMES) {
      toast.show('The camera hiccupped. Go again.');
      setFrames([]);
    }
  };

  const allowCamera = () => {
    if (permission && !permission.canAskAgain) Linking.openSettings();
    else requestPermission();
  };

  const editFromRoll = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) router.push({ pathname: '/edit', params: { uri: persistTemporary(uri) } });
  };

  if (!permission) return <Screen scroll={false} withTabBar />;

  if (!permission.granted) {
    return (
      <Screen scroll={false} withTabBar>
        <EmptyState
          title="The booth needs a camera"
          message="Four shots on a timer, a filter, a strip. Everything stays on your phone."
          action={
            <View style={styles.stack}>
              <Button title={permission.canAskAgain ? 'Allow camera' : 'Open Settings'} onPress={allowCamera} />
              <Button title="Edit a photo from your library instead" variant="ghost" onPress={editFromRoll} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (cameraError) {
    return (
      <Screen scroll={false} withTabBar>
        <EmptyState
          title="The camera didn’t start"
          message="Another app may be using it. Close that app and try again."
          action={
            <View style={styles.stack}>
              <Button title="Try again" onPress={() => { setCameraError(false); setActive(false); setTimeout(() => setActive(true), 50); }} />
              <Button title="Edit a photo from your library instead" variant="ghost" onPress={editFromRoll} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} withTabBar edges={['top']} contentStyle={styles.content}>
      <View style={styles.topBar}>
        <ThemedText type="wordmark" style={styles.title} accessibilityRole="header">
          studio
        </ThemedText>
        <IconButton name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} label="Edit a photo from your library" onPress={editFromRoll} />
      </View>

      <View style={[styles.viewfinder, { backgroundColor: theme.surfaceRaised }]}>
        {active ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === 'front'}
            onCameraReady={() => setReady(true)}
            onMountError={() => setCameraError(true)}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: LIVE_TINT[preset] ?? 'transparent' }]} pointerEvents="none" />
        {getPreset(preset).vignette > 0.2 ? <View style={styles.vignette} pointerEvents="none" /> : null}
        {flash ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF' }]} pointerEvents="none" /> : null}
        {countdown !== null ? (
          <Animated.View key={countdown} entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} style={styles.countdown} pointerEvents="none">
            <ThemedText type="title" style={styles.countdownText}>
              {countdown}
            </ThemedText>
          </Animated.View>
        ) : null}
        <View style={styles.frameDots} pointerEvents="none">
          {Array.from({ length: FRAMES }).map((_, index) => (
            <View key={index} style={[styles.frameDot, { backgroundColor: index < frames.length ? theme.surface : 'rgba(255,255,255,0.35)' }]} />
          ))}
        </View>
      </View>

      <View style={styles.presetRow}>
        {BOOTH_PRESETS.map((id) => (
          <Chip key={id} label={PRESETS.find((p) => p.id === id)?.name ?? id} selected={preset === id} disabled={busy} onPress={() => setPreset(id)} />
        ))}
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit a photo from your library"
          onPress={editFromRoll}
          disabled={busy}
          style={[styles.sideButton, { backgroundColor: theme.surfaceRaised, opacity: busy ? 0.4 : 1 }]}>
          <ThemedText type="caption">Library</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start the booth"
          onPress={runBooth}
          disabled={!ready || busy}
          style={({ pressed }) => [styles.shutter, { borderColor: theme.text, backgroundColor: theme.surface, opacity: ready ? 1 : 0.4, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={[styles.shutterInner, { backgroundColor: theme.text }]} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          onPress={() => setFacing((value) => (value === 'front' ? 'back' : 'front'))}
          disabled={busy}
          style={[styles.sideButton, { backgroundColor: theme.surfaceRaised, opacity: busy ? 0.4 : 1 }]}>
          <ThemedText type="caption">Flip</ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingBottom: BottomTabInset },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  title: { fontSize: 24 },
  viewfinder: { flex: 1, marginHorizontal: Spacing.three, borderRadius: Radius.xl, overflow: 'hidden' },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 60, borderColor: 'rgba(0,0,0,0.18)', borderRadius: 120 },
  countdown: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  countdownText: { color: '#FFF', fontSize: 120, lineHeight: 130, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  frameDots: { position: 'absolute', top: Spacing.three, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  frameDot: { width: 8, height: 8, borderRadius: 4 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.five, paddingVertical: Spacing.three },
  sideButton: { width: 64, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28 },
  stack: { gap: Spacing.two, alignSelf: 'stretch' },
});
