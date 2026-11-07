import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { DevelopingPhoto } from '@/components/developing-photo';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
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

/** Holds the screen on while frames develop; a locked phone would pause them. */
function StayAwake() {
  useKeepAwake();
  return null;
}

/** The contact sheet: every frame of a roll, developing in place, and what to do with the set. */
export default function RollScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rolls, removeRoll, updateFrame, removeFrames, credits, plan, paid, aiConsent, setAiConsent, printConfig } = useAppStore();
  const font = useSheetFont();
  const [busy, setBusy] = useState<'save' | 'sheet' | null>(null);
  const [asking, setAsking] = useState(false);
  /** The look's strength while the meter is being dragged; the sample roll keeps it here. */
  const [liveStrength, setLiveStrength] = useState<number | null>(null);
  const wasLocked = useRef(!paid);
  const [revealing, setRevealing] = useState(false);

  // Coming back from the paywall: the rest of the free frame drops into view.
  useFocusEffect(
    useCallback(() => {
      if (!paid) {
        wasLocked.current = true;
        return;
      }
      if (!wasLocked.current) return;
      wasLocked.current = false;
      setRevealing(true);
      const timer = setTimeout(() => setRevealing(false), 2200);
      return () => clearTimeout(timer);
    }, [paid])
  );

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
  const rollStrength = liveStrength ?? (finished.length ? finished.reduce((sum, frame) => sum + frame.strength, 0) / finished.length : 1);
  /** Before any purchase a finished frame shows only its top half, and nothing can leave the app. */
  const locked = !paid && !isSample;
  const teaser = locked || revealing ? finished[0] : undefined;
  const blocked = waiting > 0 && developing === 0 && credits === 0 && !(locked && done > 0);
  const needsConsent = waiting > 0 && !aiConsent;

  if (asking) {
    const first = roll.frames[0].sourceUri;
    return <AiConsent uri={typeof first === 'string' ? first : ''} onAgree={() => { setAiConsent(true); setAsking(false); }} onDecline={() => setAsking(false)} />;
  }

  const openFrame = (frame: Frame, index: number) => {
    if (locked && frame.status === 'done') router.push({ pathname: '/paywall', params: { rollId: roll.id } });
    else if (frame.status === 'done') router.push({ pathname: '/frame', params: { roll: roll.id, index } });
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
      {developing > 0 ? <StayAwake /> : null}
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
            {plan === 'free' ? 'Choose a plan or pack and they develop right here.' : 'They develop here when your new photos arrive at midnight, or add a pack now.'}
          </ThemedText>
          <Button
            title={plan === 'free' ? 'See plans' : 'Add photos'}
            size="md"
            onPress={() => (plan === 'free' ? router.push({ pathname: '/paywall', params: { rollId: roll.id } }) : router.push('/out-of-credits'))}
          />
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

      {teaser ? (
        <View style={styles.teaser}>
          <View style={[styles.teaserPhoto, { backgroundColor: theme.surfaceRaised }]} accessibilityLabel="Your first frame, half developed">
            <DevelopingPhoto source={teaser.resultUri} amount={locked ? 0.5 : 1} />
          </View>
          {locked ? (
            <>
              <ThemedText type="subtitle">Your first frame is halfway there.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {waiting > 0 ? `Choose a plan to finish it and develop your other ${waiting === 1 ? 'frame' : `${waiting} frames`}.` : 'Choose a plan to finish it and save it.'}
              </ThemedText>
              <Button title="Finish developing" onPress={() => router.push({ pathname: '/paywall', params: { rollId: roll.id } })} />
            </>
          ) : null}
        </View>
      ) : null}

      {done > 0 && !locked ? (
        <View style={styles.meter}>
          <SliderRow
            label={`Strength of ${look?.name ?? 'the look'}`}
            value={rollStrength}
            onChange={setLiveStrength}
            onComplete={(value) => {
              if (isSample) return;
              finished.forEach((frame) => updateFrame(roll.id, frame.id, { strength: value }));
              setLiveStrength(null);
            }}
          />
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
              {frame.status === 'done' && !locked && (liveStrength ?? frame.strength) < 0.995 ? <Image source={frame.sourceUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {frame.status === 'done' && locked ? (
                <DevelopingPhoto source={frame.thumbUri ?? frame.resultUri} amount={0.5} />
              ) : (
                <Image
                  source={frame.thumbUri ?? frame.resultUri ?? frame.sourceUri}
                  style={[StyleSheet.absoluteFill, frame.status === 'done' ? { opacity: liveStrength ?? frame.strength } : null]}
                  contentFit="cover"
                  transition={frame.status === 'done' ? 500 : 0}
                />
              )}
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
            {roll.frames.find((frame) => frame.status === 'failed')?.error ?? 'A frame did not develop.'} Trying again won’t charge you twice.
          </ThemedText>
          <Button title={failed === 1 ? 'Try this frame again' : `Try ${failed} frames again`} variant="secondary" size="md" onPress={retryFailed} />
          {failed < total ? (
            <Button
              title={failed === 1 ? 'Remove this frame' : 'Remove these frames'}
              variant="ghost"
              size="md"
              onPress={() => removeFrames(roll.id, roll.frames.filter((frame) => frame.status === 'failed').map((frame) => frame.id))}
            />
          ) : null}
        </View>
      ) : null}

      {isSample ? (
        <View style={styles.actions}>
          <Button title="Start your own roll" onPress={() => router.push('/new-roll')} />
        </View>
      ) : done > 0 && !locked ? (
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
  teaser: { gap: Spacing.two, paddingBottom: Spacing.three },
  teaserPhoto: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  meter: { paddingBottom: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '31.8%', gap: 3 },
  photo: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  veil: { backgroundColor: 'rgba(68,51,71,0.5)' },
  center: { textAlign: 'center', paddingHorizontal: Spacing.one },
  failNote: { gap: Spacing.two, paddingTop: Spacing.three },
  actions: { gap: Spacing.two, paddingTop: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
