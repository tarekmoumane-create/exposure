import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { type Roll } from '@/store/app-store';

export type GalleryItem = {
  key: string;
  rollId: string;
  index: number;
  source: ImageSourcePropType;
  lookName: string;
};

/** Every developed photo across the user's rolls, newest roll first. */
export function galleryItems(rolls: Roll[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const roll of [...rolls].sort((a, b) => b.createdAt - a.createdAt)) {
    const lookName = getLook(roll.lookId)?.name ?? 'Film';
    roll.frames.forEach((frame, index) => {
      if (frame.status !== 'done') return;
      const ref = frame.thumbUri ?? frame.resultUri;
      if (ref === undefined) return;
      items.push({ key: `${roll.id}:${frame.id}`, rollId: roll.id, index, source: typeof ref === 'number' ? ref : { uri: ref }, lookName });
    });
  }
  return items;
}

const COLUMNS = 3;
const GAP = 6;

/** The user's finished photos as a tidy grid; tapping one opens it full screen. */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const tile = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {items.map((item, i) => (
        <Animated.View key={item.key} entering={FadeIn.delay(Math.min(i, 12) * 30).duration(300)} style={{ width: tile }}>
          <Tappable
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${item.index + 1}, ${item.lookName}`}
            scaleTo={0.96}
            onPress={() => router.push({ pathname: '/frame', params: { roll: item.rollId, index: item.index } })}
            style={[styles.tile, { backgroundColor: theme.surfaceRaised }]}>
            <Image source={item.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          </Tappable>
        </Animated.View>
      ))}
    </View>
  );
}

/** What the gallery says before any photo has been developed. */
export function GalleryEmpty() {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: theme.surface }]}>
      <ThemedText type="bodyStrong">Nothing here yet</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Every photo you develop lands here.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { aspectRatio: 1, borderRadius: Radius.sm, overflow: 'hidden' },
  empty: { borderRadius: Radius.lg, padding: 22, alignItems: 'center', gap: 4 },
  center: { textAlign: 'center' },
});
