import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { BeforeAfterSwitch } from '@/components/compare-photo';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SAMPLE_ROLL, SAMPLE_ROLL_ID } from '@/data/sample-roll';
import { saveToPhotos, shareFile } from '@/lib/media';
import { dismiss } from '@/lib/navigation';
import { blendFrame } from '@/lib/render';
import { type Frame, useAppStore } from '@/store/app-store';

/** One frame at full size. Swipe through the roll, hold to see the original, set how strong the look is. */
export default function FrameScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{ roll: string; index?: string }>();
  const { rolls, updateFrame, paid } = useAppStore();
  const isSample = params.roll === SAMPLE_ROLL_ID;
  const roll = isSample ? SAMPLE_ROLL : rolls.find((item) => item.id === params.roll);
  const frames = roll?.frames.filter((frame) => frame.status === 'done') ?? [];
  const startAt = Math.max(0, roll ? frames.indexOf(roll.frames[Number(params.index ?? 0)]) : 0);
  const [index, setIndex] = useState(startAt);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [holding, setHolding] = useState(false);
  const [pinnedBefore, setPinnedBefore] = useState(false);
  const comparing = holding || pinnedBefore;
  const [strength, setStrength] = useState<number | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const list = useRef<FlatList<Frame>>(null);
  const strip = useRef<ScrollView>(null);
  const theme = useTheme();
  const [swiped, setSwiped] = useState(false);

  if (!roll || frames.length === 0 || (!paid && !isSample)) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Frame not found" message="Go back to the roll to see what has developed." action={<Button title="Back" onPress={() => dismiss()} />} />
      </Screen>
    );
  }

  const current = frames[Math.min(index, frames.length - 1)];
  const shownStrength = strength ?? current.strength;

  const goTo = (next: number) => {
    setIndex(next);
    setStrength(null);
    setPinnedBefore(false);
    setSwiped(true);
    strip.current?.scrollTo({ x: Math.max(0, next * (THUMB + THUMB_GAP) - size.width / 2 + THUMB / 2), animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / size.width);
    if (next !== index) goTo(next);
    else setSwiped(true);
  };

  const jumpTo = (next: number) => {
    if (next === index) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    list.current?.scrollToIndex({ index: next, animated: true });
    goTo(next);
  };

  const exportFrame = async (action: 'save' | 'share') => {
    setBusy(action);
    try {
      const uri = await blendFrame({ ...current, strength: shownStrength });
      if (action === 'save') {
        const result = await saveToPhotos(uri);
        if (result === 'saved') {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.show('Saved to Photos');
        } else {
          toast.show(result === 'denied' ? 'Allow photo access in Settings to save' : 'The frame did not save. Try again.');
        }
      } else if (!(await shareFile(uri))) {
        toast.show('Sharing is not available here');
      }
    } catch {
      toast.show('That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        <ThemedText type="label" themeColor="textSecondary">
          {`${roll.frames.indexOf(current) + 1} of ${roll.frames.length}`}
        </ThemedText>
        <View style={styles.spacer} />
      </View>

      <View style={styles.stage} onLayout={(event: LayoutChangeEvent) => setSize({ width: Math.round(event.nativeEvent.layout.width), height: Math.round(event.nativeEvent.layout.height) })}>
        {size.width > 0 ? (
          <FlatList
            ref={list}
            data={frames}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startAt}
            getItemLayout={(_, i) => ({ length: size.width, offset: size.width * i, index: i })}
            keyExtractor={(frame) => frame.id}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item }) => {
              const active = item.id === current.id;
              const opacity = active ? (comparing ? 0 : shownStrength) : item.strength;
              return (
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Hold to see the original"
                  onPressIn={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setHolding(true);
                  }}
                  onPressOut={() => setHolding(false)}
                  style={[styles.page, { width: size.width, height: size.height }]}>
                  <Image source={item.sourceUri} style={StyleSheet.absoluteFill} contentFit="contain" />
                  <Image source={item.resultUri} style={[StyleSheet.absoluteFill, { opacity }]} contentFit="contain" transition={120} />
                </Pressable>
              );
            }}
          />
        ) : null}
        {frames.length > 1 && !swiped ? (
          <Animated.View entering={FadeIn.delay(600).duration(400)} exiting={FadeOut.duration(250)} pointerEvents="none" style={styles.hint}>
            <View style={[styles.hintPill, { backgroundColor: 'rgba(43,31,38,0.62)' }]}>
              <ThemedText type="tiny" style={{ color: theme.onPhoto }}>
                Swipe for the next photo →
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}
        <View style={styles.switch} pointerEvents="box-none">
          <BeforeAfterSwitch
            showingBefore={comparing}
            onChange={(side) => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setPinnedBefore(side === 'before');
            }}
          />
        </View>
      </View>

      {frames.length > 1 ? (
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripWrap}>
          {frames.map((frame, i) => (
            <Pressable
              key={frame.id}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${roll.frames.indexOf(frame) + 1}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => jumpTo(i)}
              style={[styles.thumb, { borderColor: i === index ? theme.brand : 'transparent', opacity: i === index ? 1 : 0.75 }]}>
              <Image source={frame.thumbUri ?? frame.resultUri} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.controls}>
        <SliderRow
          label="Strength"
          value={shownStrength}
          onChange={setStrength}
          onComplete={(value) => {
            if (!isSample) updateFrame(roll.id, current.id, { strength: value });
          }}
        />
        {!isSample ? (
          <View style={styles.actions}>
            <Button title="Save to Photos" onPress={() => exportFrame('save')} loading={busy === 'save'} disabled={busy !== null} style={styles.grow} />
            <Button title="Share" variant="secondary" onPress={() => exportFrame('share')} loading={busy === 'share'} disabled={busy !== null} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const THUMB = 48;
const THUMB_GAP = 6;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingBottom: Spacing.two },
  hint: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
  hintPill: { height: 28, paddingHorizontal: 12, borderRadius: Radius.pill, justifyContent: 'center' },
  stripWrap: { flexGrow: 0, marginTop: 10 },
  strip: { paddingHorizontal: Gutter, gap: THUMB_GAP },
  thumb: { width: THUMB, height: THUMB * 1.25, borderRadius: 8, borderWidth: 2, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: 52 },
  spacer: { width: 44 },
  stage: { flex: 1 },
  page: { overflow: 'hidden' },
  switch: { position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' },
  controls: { gap: 10, paddingHorizontal: Gutter, paddingTop: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
