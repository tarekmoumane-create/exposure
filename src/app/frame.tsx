import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { BeforeAfterSwitch } from '@/components/compare-photo';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Gutter, Spacing } from '@/constants/theme';
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

  if (!roll || frames.length === 0 || (!paid && !isSample)) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Frame not found" message="Go back to the roll to see what has developed." action={<Button title="Back" onPress={() => dismiss()} />} />
      </Screen>
    );
  }

  const current = frames[Math.min(index, frames.length - 1)];
  const shownStrength = strength ?? current.strength;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width === 0) return;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / size.width));
    setStrength(null);
    setPinnedBefore(false);
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: 52 },
  spacer: { width: 44 },
  stage: { flex: 1 },
  page: { overflow: 'hidden' },
  switch: { position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' },
  controls: { gap: 10, paddingHorizontal: Gutter, paddingTop: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
