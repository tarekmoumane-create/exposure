import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { PresetStrip } from '@/components/preset-strip';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { SliderRow } from '@/components/slider-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { FilteredImage } from '@/filters/filtered-image';
import { DEFAULT_CONFIG, type FilterConfig, LOOK_PRESET } from '@/filters/presets';
import { renderFilteredImage } from '@/filters/render';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { makeThumbnail } from '@/lib/image-io';
import { saveToPhotos, shareFile } from '@/lib/media';
import { dismiss } from '@/lib/navigation';
import { useImageRatio } from '@/lib/use-image-ratio';
import { useAppStore } from '@/store/app-store';

type Panel = 'look' | 'filters' | 'adjust';

/**
 * The result and editing screen. Opened after a generation (shotId) or for a free edit of any photo (uri).
 */
export default function EditScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { shotId, uri, reveal, fresh } = useLocalSearchParams<{ shotId?: string; uri?: string; reveal?: string; fresh?: string }>();
  const { shots, updateShot, removeShot } = useAppStore();
  const shot = shots.find((item) => item.id === shotId);
  const look = getLook(shot?.lookId);
  const source = shot?.resultUri ?? uri ?? '';
  const isFree = !shot;
  /** AI shots keep the original underneath so Strength can fade between the two. */
  const original = shot && shot.sourceUri !== shot.resultUri ? shot.sourceUri : null;

  const initial = useMemo<FilterConfig>(() => shot?.edit ?? DEFAULT_CONFIG, [shot?.edit]);
  const [config, setConfig] = useState<FilterConfig>(initial);
  const [panel, setPanel] = useState<Panel>(isFree ? 'filters' : 'look');
  const [width, setWidth] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [saved, setSaved] = useState(false);
  /** First photo: the result stays blurred under the plan sheet until it closes. */
  const [gated, setGated] = useState(Boolean(reveal));
  const sheetOpened = useRef(false);
  /** The reveal: a fresh AI result fades in from the original over ~0.9 s. */
  const revealProgress = useSharedValue(shot && fresh && !reveal ? 0 : 1);
  const ratio = useImageRatio(source, 0.8);
  /** Small copy for the 17 filter thumbnails so they never decode the full result. */
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    makeThumbnail(source, `edit-thumb-${shotId ?? 'free'}`, 320).then((uri) => {
      if (!cancelled) setThumb(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [source, shotId]);

  useEffect(() => {
    if (!gated) revealProgress.value = withTiming(1, { duration: 900 });
  }, [gated, revealProgress]);

  const revealStyle = useAnimatedStyle(() => ({ opacity: revealProgress.value }));
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useFocusEffect(
    useCallback(() => {
      if (!reveal || !shotId) return;
      if (!sheetOpened.current) {
        sheetOpened.current = true;
        const timer = setTimeout(() => router.push({ pathname: '/paywall', params: { intro: '1', shotId } }), 300);
        return () => clearTimeout(timer);
      }
      setGated(false);
    }, [reveal, shotId])
  );

  if (!source) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Nothing to edit" message="Pick a photo from the gallery or make a new one." />
      </Screen>
    );
  }

  const height = Math.round(width / ratio);
  const displayConfig = comparing ? { ...DEFAULT_CONFIG, intensity: 0 } : config;
  const lookStrengthPreset = look ? (LOOK_PRESET[look.id] ?? 'original') : 'original';
  const strength = original ? config.strength ?? 1 : 1;
  const strengthShown = comparing ? 0 : strength;

  // Live drags only touch local state; the store (and disk) is written when the finger lifts.
  const update = (patch: Partial<FilterConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const commit = () => {
    if (shot) updateShot(shot.id, { edit: configRef.current });
  };
  const set = (patch: Partial<FilterConfig>) => {
    update(patch);
    if (shot) updateShot(shot.id, { edit: { ...configRef.current, ...patch } });
  };

  const exportImage = async (action: 'save' | 'share') => {
    setBusy(action);
    try {
      const fileUri = await renderFilteredImage(source, config, original ? { base: original, blend: strength } : {});
      if (action === 'save') {
        const result = await saveToPhotos(fileUri);
        if (result === 'saved') {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        } else {
          toast.show(result === 'denied' ? 'Allow photo access in Settings' : 'Could not save');
        }
      } else {
        const ok = await shareFile(fileUri);
        if (!ok) toast.show('Sharing is not available here');
      }
    } catch {
      toast.show('Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    if (!shot) return;
    const ok = await confirm('Delete this photo?', 'This only removes it from Exposure on this phone.', 'Delete');
    if (!ok) return;
    dismiss();
    // Remove after the screen has gone, so it never flashes an empty state.
    setTimeout(() => removeShot(shot.id), 350);
  };

  const panels = isFree
    ? [{ id: 'filters' as Panel, label: 'Filters' }, { id: 'adjust' as Panel, label: 'Adjust' }]
    : [{ id: 'look' as Panel, label: look?.name ?? 'Look' }, { id: 'filters' as Panel, label: 'Filters' }, { id: 'adjust' as Panel, label: 'Adjust' }];

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        <ThemedText type="subtitle">{isFree ? 'Edit' : look?.name ?? 'Photo'}</ThemedText>
        {shot ? (
          <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete" onPress={onDelete} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Hold to compare with the original"
          onPressIn={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            setComparing(true);
          }}
          onPressOut={() => setComparing(false)}
          onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
          style={[styles.photo, { backgroundColor: theme.surfaceRaised }]}>
          {width > 0 && original ? <FilteredImage source={original} config={displayConfig} width={width} height={height} /> : null}
          {width > 0 ? (
            <Animated.View style={original ? [StyleSheet.absoluteFill, revealStyle] : undefined}>
              <FilteredImage source={source} config={displayConfig} width={width} height={height} style={original ? { opacity: strengthShown } : undefined} />
            </Animated.View>
          ) : null}
          {width > 0 && gated ? (
            <Animated.View exiting={FadeOut.duration(700)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: source }} style={{ width, height }} contentFit="cover" blurRadius={32} />
            </Animated.View>
          ) : null}
          {!gated ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(30,20,25,0.55)' }]} pointerEvents="none">
              <ThemedText type="label" style={{ color: theme.surface }}>
                {comparing ? 'Original' : 'Hold to compare'}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.controls}>
          <View style={styles.panelInner}>
            <Segmented options={panels} value={panel} onChange={setPanel} />
          </View>

          {panel === 'look' && look ? (
            <View style={styles.panel}>
              {original ? (
                <SliderRow label="Strength" value={strength} onChange={(value) => update({ strength: value })} onComplete={commit} />
              ) : (
                <SliderRow
                  label="Strength"
                  value={config.intensity}
                  onChange={(value) => update({ intensity: value, preset: config.preset === 'original' ? lookStrengthPreset : config.preset })}
                  onComplete={commit}
                />
              )}
              <ThemedText type="small" themeColor="textTertiary">
                Dial the look back until it feels like a photo you took.
              </ThemedText>
            </View>
          ) : null}

          {panel === 'filters' ? (
            <View style={styles.panelFlush}>
              <PresetStrip source={thumb ?? source} value={config.preset} onChange={(preset) => set({ preset, intensity: config.intensity || 1 })} />
              {config.preset !== 'original' ? (
                <View style={styles.panelInner}>
                  <SliderRow label="Amount" value={config.intensity} onChange={(value) => update({ intensity: value })} onComplete={commit} />
                </View>
              ) : null}
            </View>
          ) : null}

          {panel === 'adjust' ? (
            <View style={styles.panel}>
              <SliderRow label="Warmth" value={config.warmth} min={-1} max={1} onChange={(warmth) => update({ warmth })} onComplete={commit} format={signed} />
              <SliderRow label="Brightness" value={config.brightness} min={-1} max={1} onChange={(brightness) => update({ brightness })} onComplete={commit} format={signed} />
              <SliderRow label="Contrast" value={config.contrast} min={-1} max={1} onChange={(contrast) => update({ contrast })} onComplete={commit} format={signed} />
              <SliderRow label="Saturation" value={config.saturation} min={-1} max={1} onChange={(saturation) => update({ saturation })} onComplete={commit} format={signed} />
              <SliderRow label="Grain" value={config.grain} onChange={(grain) => update({ grain })} onComplete={commit} />
              <SliderRow label="Vignette" value={config.vignette} onChange={(vignette) => update({ vignette })} onComplete={commit} />
              <Button title="Reset adjustments" variant="ghost" size="md" onPress={() => set({ warmth: 0, brightness: 0, contrast: 0, saturation: 0, grain: 0, vignette: 0 })} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title={saved ? 'Saved ✓' : 'Save to Photos'} onPress={() => exportImage('save')} loading={busy === 'save'} disabled={busy !== null || saved} style={styles.grow} />
        <Button title="Share" variant="secondary" onPress={() => exportImage('share')} loading={busy === 'share'} disabled={busy !== null} style={styles.shareButton} />
      </View>
    </Screen>
  );
}

function signed(value: number): string {
  const v = Math.round(value * 100);
  return v > 0 ? `+${v}` : `${v}`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  headerSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.three },
  photo: { marginHorizontal: Spacing.three, borderRadius: Radius.lg, overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'flex-end' },
  badge: { position: 'absolute', top: Spacing.three, right: Spacing.three, paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.pill },
  controls: { paddingTop: Spacing.three, gap: Spacing.three, paddingHorizontal: 0 },
  panel: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  panelFlush: { gap: Spacing.two },
  panelInner: { paddingHorizontal: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  grow: { flex: 1 },
  shareButton: { minWidth: 110 },
});
