import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { SAMPLE_ROLL, SAMPLE_ROLL_ID } from '@/data/sample-roll';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { saveToPhotos, shareFile } from '@/lib/media';
import { dismiss } from '@/lib/navigation';
import { blendFrame, renderContactSheet } from '@/lib/render';
import { countFrames } from '@/lib/roll';
import { useSheetFont } from '@/lib/use-sheet-font';
import { type Frame, useAppStore } from '@/store/app-store';

/** The contact sheet: every frame of a roll, developing in place, and what to do with the set. */
export default function RollScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rolls, removeRoll, updateFrame, credits, aiConsent, setAiConsent, printConfig } = useAppStore();
  const font = useSheetFont();
  const [busy, setBusy] = useState<'save' | 'sheet' | null>(null);
  const [asking, setAsking] = useState(false);
  const isSample = id === SAMPLE_ROLL_ID;
  const roll = isSample ? SAMPLE_ROLL : rolls.find((item) => item.id === id);

  if (!roll) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Roll not found" message="This roll was deleted." action={<Button title="Back to rolls" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }

  const look = getLook(roll.lookId);
  const { total, done, developing, waiting, failed } = countFrames(roll);
  const finished = roll.frames.filter((frame) => frame.status === 'done');
  const blocked = waiting > 0 && developing === 0 && credits === 0;
  const needsConsent = waiting > 0 && !aiConsent;

  if (asking) {
    const first = roll.frames[0].sourceUri;
    return <AiConsent uri={typeof first === 'string' ? first : ''} onAgree={() => { setAiConsent(true); setAsking(false); }} onDecline={() => setAsking(false)} />;
  }

  const openFrame = (frame: Frame, index: number) => {
    if (frame.status === 'done') router.push({ pathname: '/frame', params: { roll: roll.id, index } });
    else if (frame.status === 'failed') updateFrame(roll.id, frame.id, { status: 'waiting', error: undefined });
  };

  const retryFailed = () => roll.frames.filter((frame) => frame.status === 'failed').forEach((frame) => updateFrame(roll.id, frame.id, { status: 'waiting', error: undefined }));

  const saveAll = async () => {
    setBusy('save');
    try {
      for (const frame of finished) {
        const result = await saveToPhotos(await blendFrame(frame));
        if (result !== 'saved') {
          toast.show(result === 'denied' ? 'Allow photo access in Settings to save' : 'Saving stopped. Try again.');
          return;
        }
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(finished.length === 1 ? 'Saved to Photos' : `${finished.length} frames saved to Photos`);
    } catch {
      toast.show('Saving stopped. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const shareSheet = async () => {
    setBusy('sheet');
    try {
      const uri = await renderContactSheet({ frames: finished, title: roll.name, subtitle: `Shot on ${look?.name ?? 'film'}`, font });
      if (!(await shareFile(uri))) toast.show('Sharing is not available here');
    } catch {
      toast.show('The contact sheet did not render. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm('Delete this roll?', 'Its frames are removed from Exposure on this phone. Anything saved to Photos stays.', 'Delete');
    if (!ok) return;
    dismiss();
    setTimeout(() => removeRoll(roll.id), 350);
  };

  const status =
    done === total
      ? `${total} ${total === 1 ? 'frame' : 'frames'} on ${look?.name ?? 'film'}`
      : developing > 0
        ? `Developing on ${look?.name ?? 'film'}. ${done} of ${total} done.`
        : `${done} of ${total} developed on ${look?.name ?? 'film'}`;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        {!isSample ? <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete roll" onPress={onDelete} /> : null}
      </View>

      <View style={styles.title}>
        <ThemedText type="title" accessibilityRole="header">
          {roll.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          {isSample ? `A real roll, developed on ${look?.name}. Tap any frame, then hold it to see the original.` : status}
        </ThemedText>
      </View>

      {blocked ? (
        <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="bodyStrong">{done > 0 ? `${waiting} more ${waiting === 1 ? 'frame is' : 'frames are'} waiting.` : 'This roll is ready to develop.'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Choose a plan or pack and they develop right here.
          </ThemedText>
          <Button title="See plans" size="md" onPress={() => router.push({ pathname: '/paywall', params: { rollId: roll.id } })} />
        </View>
      ) : null}

      {needsConsent && !blocked ? (
        <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="bodyStrong">Developing is paused.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Photo processing is off in Settings.
          </ThemedText>
          <Button title="Review and continue" size="md" onPress={() => setAsking(true)} />
        </View>
      ) : null}

      <View style={styles.grid}>
        {roll.frames.map((frame, index) => (
          <View key={frame.id} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={frame.status === 'done' ? `Open frame ${index + 1}` : frame.status === 'failed' ? `Frame ${index + 1} failed. Try again.` : `Frame ${index + 1}, ${frame.status}`}
              disabled={frame.status === 'developing' || frame.status === 'waiting'}
              onPress={() => openFrame(frame, index)}
              style={[styles.photo, { backgroundColor: theme.surfaceRaised }]}>
              <Image source={frame.thumbUri ?? frame.resultUri ?? frame.sourceUri} style={StyleSheet.absoluteFill} contentFit="cover" transition={frame.status === 'done' ? 500 : 0} />
              {frame.status !== 'done' ? <View style={[StyleSheet.absoluteFill, styles.veil]} /> : null}
              {frame.status === 'developing' ? <ActivityIndicator color={theme.onPhoto} /> : null}
              {frame.status === 'failed' ? (
                <ThemedText type="caption" themeColor="onPhoto" style={styles.center}>
                  Tap to retry
                </ThemedText>
              ) : null}
            </Pressable>
            <ThemedText type="caption" themeColor={frame.status === 'failed' ? 'mark' : 'textTertiary'}>
              {index + 1}
            </ThemedText>
          </View>
        ))}
      </View>

      {failed > 0 ? (
        <View style={styles.failNote}>
          <ThemedText type="small" themeColor="mark">
            {roll.frames.find((frame) => frame.status === 'failed')?.error ?? 'A frame did not develop.'} No photos were used.
          </ThemedText>
          <Button title={failed === 1 ? 'Try this frame again' : `Try ${failed} frames again`} variant="secondary" size="md" onPress={retryFailed} />
        </View>
      ) : null}

      {isSample ? (
        <View style={styles.actions}>
          <Button title="Start your own roll" onPress={() => router.push('/new-roll')} />
        </View>
      ) : done > 0 ? (
        <View style={styles.actions}>
          {printConfig.enabled && done >= printConfig.minPrints ? (
            <Button title="Order prints" onPress={() => router.push({ pathname: '/order-prints', params: { roll: roll.id } })} />
          ) : null}
          <View style={styles.row}>
            <Button title={done === 1 ? 'Save frame' : 'Save all'} variant="secondary" onPress={saveAll} loading={busy === 'save'} disabled={busy !== null} style={styles.grow} />
            <Button title="Contact sheet" variant="secondary" onPress={shareSheet} loading={busy === 'sheet'} disabled={busy !== null} style={styles.grow} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  title: { gap: Spacing.one, paddingBottom: Spacing.three },
  notice: { gap: Spacing.one, padding: Spacing.three, borderRadius: Radius.sm, marginBottom: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '31.8%', gap: 3 },
  photo: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  veil: { backgroundColor: 'rgba(20,26,107,0.45)' },
  center: { textAlign: 'center', paddingHorizontal: Spacing.one },
  failNote: { gap: Spacing.two, paddingTop: Spacing.three },
  actions: { gap: Spacing.two, paddingTop: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
