import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Radius, Spacing } from '@/constants/theme';
import { FilteredImage } from '@/filters/filtered-image';
import { DEFAULT_CONFIG, type FilterConfig, PRESETS } from '@/filters/presets';
import { renderStrip, STRIP_FOOTER, STRIP_GAP, STRIP_MARGIN, STRIP_TILE_HEIGHT, STRIP_WIDTH } from '@/filters/render';
import { useStampFont } from '@/filters/use-stamp-font';
import { confirm } from '@/lib/confirm';
import { makeThumbnail } from '@/lib/image-io';
import { saveToPhotos, shareFile } from '@/lib/media';
import { dismiss } from '@/lib/navigation';
import { useAppStore } from '@/store/app-store';

const STRIP_PRESETS = ['original', 'gold', 'film35', 'portra', 'glow', 'blush', 'booth', 'mono'];
/** Font size of the date stamp in the export, at STRIP_WIDTH. */
const STAMP_SIZE = 30;

function stampFor(date: Date): string {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

/** Preview, style and save a photobooth strip. Opens from the Studio or from a saved strip in the gallery. */
export default function StripScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{ frames?: string; preset?: string; stripId?: string }>();
  const { strips, addStrip, updateStrip, removeStrip } = useAppStore();
  /** Once exported, the strip lives in the gallery and later exports update it instead of adding another. */
  const [savedId, setSavedId] = useState<string | undefined>(params.stripId);
  const saved = strips.find((item) => item.id === savedId);
  const font = useStampFont();
  const fontReady = Platform.OS === 'web' || font !== null;

  const frames = useMemo<string[]>(() => {
    if (saved) return saved.frames;
    try {
      return params.frames ? (JSON.parse(params.frames) as string[]) : [];
    } catch {
      return [];
    }
  }, [params.frames, saved]);

  const [config, setConfig] = useState<FilterConfig>(saved?.edit ?? { ...DEFAULT_CONFIG, preset: params.preset ?? 'booth' });
  const [paper, setPaper] = useState<'white' | 'black'>(saved?.paper ?? 'white');
  const [stamp, setStamp] = useState(saved?.stamp ?? true);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  /** The look of the strip as it was last exported; used to know whether leaving loses anything. */
  const [exported, setExported] = useState<string | null>(saved ? JSON.stringify([saved.edit, saved.paper, saved.stamp ?? true]) : null);
  const current = JSON.stringify([config, paper, stamp]);

  if (frames.length === 0) {
    return (
      <Screen scroll={false}>
        <EmptyState title="No strip here" message="Run the booth to make one." action={<Button title="Open the Studio" onPress={() => router.replace('/studio')} />} />
      </Screen>
    );
  }

  const scale = width / STRIP_WIDTH;
  const tileW = Math.round((STRIP_WIDTH - STRIP_MARGIN * 2) * scale);
  const tileH = Math.round(STRIP_TILE_HEIGHT * scale);
  const margin = STRIP_MARGIN * scale;
  const gap = STRIP_GAP * scale;
  const footer = STRIP_FOOTER * scale;
  const paperColor = paper === 'white' ? '#F7F2EA' : '#141214';
  const inkColor = paper === 'white' ? '#2B2226' : '#EDE6DC';
  const stampText = stamp ? stampFor(saved ? new Date(saved.createdAt) : new Date()) : null;

  const exportStrip = async (action: 'save' | 'share') => {
    setBusy(action);
    try {
      const uri = await renderStrip({ frames, config, paper, stamp: stampText, font });
      const thumbUri = await makeThumbnail(uri, `strip-thumb-${Date.now()}`, 600);
      if (saved) updateStrip(saved.id, { resultUri: uri, thumbUri, edit: config, paper, stamp });
      else setSavedId(addStrip({ frames, resultUri: uri, thumbUri, edit: config, paper, stamp }).id);
      setExported(current);
      if (action === 'save') {
        const result = await saveToPhotos(uri);
        if (result === 'saved') {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 1800);
        } else {
          toast.show(result === 'denied' ? 'Allow photo access in Settings' : 'Could not save');
        }
      } else {
        const ok = await shareFile(uri);
        if (!ok) toast.show('Sharing is not available here');
      }
    } catch {
      toast.show('Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    if (exported === null) {
      const ok = await confirm('Leave without saving?', 'This strip is not in your gallery yet.', 'Leave');
      if (!ok) return;
    }
    dismiss();
  };

  const onDelete = async () => {
    if (!saved) return;
    const ok = await confirm('Delete this strip?', 'This only removes it from Exposure on this phone.', 'Delete');
    if (!ok) return;
    dismiss();
    setTimeout(() => {
      removeStrip(saved.id);
      toast.show('Strip deleted');
    }, 350);
  };

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={leave} />
        <ThemedText type="subtitle">Your strip</ThemedText>
        {saved ? <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete" onPress={onDelete} /> : <View style={styles.spacer} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.stripWrap}>
          <View
            onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
            style={[styles.strip, { backgroundColor: paperColor, paddingHorizontal: margin, paddingTop: margin, paddingBottom: footer, gap }]}>
            {width > 0
              ? frames.map((uri, index) => <FilteredImage key={`${uri}-${index}`} source={uri} config={config} width={tileW} height={tileH} />)
              : null}
            {width > 0 && stampText ? (
              <ThemedText
                type="caption"
                style={[styles.stamp, { color: inkColor, fontSize: STAMP_SIZE * scale, lineHeight: STAMP_SIZE * scale * 1.2, bottom: footer / 2 - (STAMP_SIZE * scale) / 2, left: margin + 4 * scale }]}>
                {stampText}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.options}>
          <View style={styles.chips}>
            {STRIP_PRESETS.map((id) => (
              <Chip key={id} label={PRESETS.find((p) => p.id === id)?.name ?? id} selected={config.preset === id} onPress={() => setConfig({ ...config, preset: id })} />
            ))}
          </View>
          <View style={styles.chips}>
            <Chip label="White paper" selected={paper === 'white'} onPress={() => setPaper('white')} />
            <Chip label="Black paper" selected={paper === 'black'} onPress={() => setPaper('black')} />
            <Chip label={stamp ? 'Date on' : 'Date off'} selected={stamp} onPress={() => setStamp((value) => !value)} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title={savedFlash ? 'Saved ✓' : saved && exported === current ? 'Save again' : 'Save strip'}
          onPress={() => exportStrip('save')}
          loading={busy === 'save'}
          disabled={busy !== null || !fontReady || savedFlash}
          style={styles.grow}
        />
        <Button title="Share" variant="secondary" onPress={() => exportStrip('share')} loading={busy === 'share'} disabled={busy !== null || !fontReady} style={styles.shareButton} />
      </View>
      {!saved ? <Button title="Retake" variant="ghost" size="md" onPress={leave} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two },
  spacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.two },
  stripWrap: { alignItems: 'center', paddingVertical: Spacing.two },
  strip: { width: '52%', borderRadius: Radius.sm, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  stamp: { position: 'absolute', letterSpacing: 1 },
  options: { gap: Spacing.two, paddingVertical: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two },
  grow: { flex: 1 },
  shareButton: { minWidth: 110 },
});
