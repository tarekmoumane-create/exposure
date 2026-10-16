import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { FilteredImage } from '@/filters/filtered-image';
import { DEFAULT_CONFIG } from '@/filters/presets';
import { useTheme } from '@/hooks/use-theme';
import { type GalleryItem, useAppStore } from '@/store/app-store';

export default function GalleryScreen() {
  const theme = useTheme();
  const { shots, strips, unlocked } = useAppStore();
  const items = useMemo<GalleryItem[]>(() => [...shots, ...strips].sort((a, b) => b.createdAt - a.createdAt), [shots, strips]);

  if (items.length === 0) {
    return (
      <Screen scroll={false} withTabBar>
        <EmptyState
          title="Nothing here yet"
          message="Everything you make lives on this phone. Pick a look, or run the booth."
          action={
            <View style={styles.stack}>
              <Button title="Browse looks" onPress={() => router.navigate('/')} />
              <Button title="Run the booth" variant="secondary" onPress={() => router.navigate('/studio')} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <ThemedText type="wordmark" style={styles.title} accessibilityRole="header">
          gallery
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {countLabel(shots.length, strips.length)} · on this phone only
        </ThemedText>
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.kind === 'strip' ? 'Open strip' : `Open ${getLook(item.lookId)?.name ?? 'photo'}`}
            onPress={() =>
              item.kind === 'strip'
                ? router.push({ pathname: '/strip', params: { stripId: item.id } })
                : router.push({ pathname: '/edit', params: { shotId: item.id } })
            }
            style={({ pressed }) => [styles.cell, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.9 : 1 }]}>
            {item.kind === 'strip' ? (
              <Image source={{ uri: item.thumbUri ?? item.resultUri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={200} />
            ) : item.pending ? (
              // Waiting to be developed after a purchase: only a blurred, tinted preview.
              <View style={StyleSheet.absoluteFill}>
                <Image source={{ uri: item.resultUri }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.25 }] }]} contentFit="cover" blurRadius={30} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: getLook(item.lookId)?.colors[0] ?? '#000', opacity: 0.35 }]} />
              </View>
            ) : (
              <Cell uri={item.thumbUri ?? item.resultUri} configKey={item.id} />
            )}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} style={styles.scrim} pointerEvents="none" />
            <View style={styles.tag}>
              <ThemedText type="photoLabel" themeColor="onPhoto">
                {item.kind === 'strip' ? 'Strip' : item.pending ? (unlocked ? 'Tap to develop' : 'Tap to unlock') : getLook(item.lookId)?.name ?? 'Photo'}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function countLabel(shots: number, strips: number): string {
  const parts = [];
  if (shots) parts.push(`${shots} ${shots === 1 ? 'photo' : 'photos'}`);
  if (strips) parts.push(`${strips} ${strips === 1 ? 'strip' : 'strips'}`);
  return parts.join(' · ');
}

/** Live-filtered thumbnail so edits show in the gallery without re-rendering files. */
function Cell({ uri, configKey }: { uri: string; configKey: string }) {
  const { shots } = useAppStore();
  const shot = shots.find((item) => item.id === configKey);
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event: LayoutChangeEvent) => setBox({ w: Math.round(event.nativeEvent.layout.width), h: Math.round(event.nativeEvent.layout.height) })}>
      {box.w > 0 ? <FilteredImage source={uri} config={shot?.edit ?? DEFAULT_CONFIG} width={box.w} height={box.h} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  title: { fontSize: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '48.8%', aspectRatio: 4 / 5, borderRadius: Radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  tag: { padding: Spacing.three, paddingBottom: 14 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  stack: { gap: Spacing.two, alignSelf: 'stretch' },
});
