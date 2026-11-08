import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { DevelopingPhoto } from '@/components/developing-photo';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Print } from '@/components/print';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { UnlockSheet } from '@/components/unlock-sheet';
import { useToast } from '@/components/toast';
import { Gutter, Radius, Shadow, Spacing } from '@/constants/theme';
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
  /** The plans sheet over a locked roll; the blurred frame stays visible above it. */
  const [sheet, setSheet] = useState(false);

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

  // Before any purchase, a finished frame stays blurred and the paywall opens on its own, once per visit.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  const offered = useRef(false);
  const lockedReady = !paid && !isSample && !!roll?.frames.some((frame) => frame.status === 'done');
  useEffect(() => {
    if (!lockedReady || !focused || offered.current || !roll) return;
    const timer = setTimeout(() => {
      offered.current = true;
      setSheet(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [lockedReady, focused, roll]);

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
  /** Before any purchase a finished frame stays blurred, and nothing can be saved or shared. */
  const locked = !paid && !isSample;
  const teaser = locked || revealing ? finished[0] : undefined;
  const blocked = waiting > 0 && developing === 0 && credits === 0 && !(locked && done > 0);
  const needsConsent = waiting > 0 && !aiConsent;

  if (asking) {
    const first = roll.frames[0].sourceUri;
    return <AiConsent uri={typeof first === 'string' ? first : ''} onAgree={() => { setAiConsent(true); setAsking(false); }} onDecline={() => setAsking(false)} />;
  }

  const openFrame = (frame: Frame, index: number) => {
    if (locked && frame.status === 'done') setSheet(true);
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
      ? `${total} ${total === 1 ? 'frame' : 'frames'}`
      : developing > 0
        ? `Developing ${done}/${total}`
        : `${done}/${total} developed`;
  const date = roll.createdAt ? new Date(roll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const openPaywall = () => (locked ? setSheet(true) : router.push({ pathname: '/paywall', params: { rollId: roll.id } }));

  return (
    <View style={styles.fill}>
    <Screen edges={['top', 'left', 'right', 'bottom']} glow={look?.tint ?? true} contentStyle={styles.content}>
      {developing > 0 ? <StayAwake /> : null}
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        <ThemedText type="mono" themeColor="textSecondary">{isSample ? 'Example' : date}</ThemedText>
        {!isSample ? <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete roll" onPress={onDelete} /> : <View style={styles.spacer} />}
      </View>

      <View style={styles.title}>
        <ThemedText type="display" accessibilityRole="header">
          {roll.name}
        </ThemedText>
        <View style={styles.meta} accessibilityLiveRegion="polite">
          <ThemedText type="mono" themeColor="textSecondary">{`${look?.name ?? 'Film'}  ·  `}</ThemedText>
          {developing > 0 ? <StatusDot live /> : null}
          <ThemedText type="mono" themeColor={developing > 0 ? 'accent' : 'textSecondary'}>{status}</ThemedText>
        </View>
        {isSample ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.sampleNote}>
            {`A real roll, developed on ${look?.name}. Open any frame and switch to Before to see the original.`}
          </ThemedText>
        ) : null}
      </View>

      {blocked ? (
        <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="bodyStrong">{done > 0 ? `${waiting} more ${waiting === 1 ? 'frame is' : 'frames are'} waiting.` : 'This roll is ready to develop.'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plan === 'free' ? 'Choose a plan or pack and they develop right here.' : 'They develop here when your new frames arrive at midnight, or add a pack now.'}
          </ThemedText>
          <Button title={plan === 'free' ? 'See plans' : 'Add frames'} size="md" style={styles.noticeButton} onPress={() => (plan === 'free' ? openPaywall() : router.push('/out-of-credits'))} />
        </View>
      ) : null}

      {needsConsent && !blocked ? (
        <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="bodyStrong">Developing is paused.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Photo processing is off in Settings.
          </ThemedText>
          <Button title="Review and continue" size="md" style={styles.noticeButton} onPress={() => setAsking(true)} />
        </View>
      ) : null}

      {teaser ? (
        <View style={styles.teaser}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locked ? 'Your first frame, developed and locked. Unlock to see it.' : 'Your first frame'}
            disabled={!locked}
            onPress={openPaywall}>
            <Print rotate={-1.2} border={8}>
            <DevelopingPhoto source={teaser.resultUri} amount={locked ? 0 : 1} locked={locked} />
            {locked ? (
              <View style={styles.lockWrap} pointerEvents="none">
                <View style={[styles.lock, { backgroundColor: 'rgba(251,248,243,0.94)' }]}>
                  <StatusDot />
                  <ThemedText type="mono">Developed · Locked</ThemedText>
                </View>
              </View>
            ) : null}
            </Print>
          </Pressable>
          {locked ? (
            <View style={styles.teaserCopy}>
              <ThemedText type="title">Your first frame is ready.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {waiting > 0 ? `Unlock it to see it in full, save it and develop your other ${waiting === 1 ? 'frame' : `${waiting} frames`}.` : 'Unlock it to see it in full and save it to your photos.'}
              </ThemedText>
              <Button title="Unlock your frame" onPress={openPaywall} style={styles.teaserButton} />
            </View>
          ) : null}
        </View>
      ) : null}

      {done > 0 && !locked ? (
        <View style={styles.meter}>
          <SliderRow
            label={`Strength · ${look?.name ?? 'the look'}`}
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

      {/* Before purchase a one-frame roll is the locked teaser above; repeating it below adds nothing. */}
      {locked && total === 1 ? null : <View style={styles.grid}>
        {roll.frames.map((frame, index) => (
          <View key={frame.id} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={frame.status === 'done' ? `Open frame ${index + 1}` : frame.status === 'failed' ? `Frame ${index + 1} failed. Try again.` : `Frame ${index + 1}, ${frame.status}`}
              disabled={frame.status === 'developing' || frame.status === 'waiting'}
              onPress={() => openFrame(frame, index)}
              style={({ pressed }) => [styles.photo, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.85 : 1 }]}>
              {frame.status === 'done' && !locked && (liveStrength ?? frame.strength) < 0.995 ? <Image source={frame.sourceUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {frame.status === 'done' && locked ? (
                <DevelopingPhoto source={frame.thumbUri ?? frame.resultUri} amount={0} locked />
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
                <View style={[styles.retry, { backgroundColor: 'rgba(251,248,243,0.94)' }]}>
                  <ThemedText type="monoSmall" themeColor="mark">Retry</ThemedText>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.cellMeta}>
              <ThemedText type="monoSmall" themeColor={frame.status === 'failed' ? 'mark' : 'textTertiary'}>
                {String(index + 1).padStart(2, '0')}
              </ThemedText>
              {frame.status === 'developing' ? <StatusDot live size={5} /> : null}
            </View>
          </View>
        ))}
      </View>}

      {failed > 0 ? (
        <View style={[styles.notice, styles.failNote, { backgroundColor: theme.surface }]}>
          <ThemedText type="small" themeColor="mark">
            {roll.frames.find((frame) => frame.status === 'failed')?.error ?? 'A frame did not develop.'} Trying again won’t charge you twice.
          </ThemedText>
          <View style={styles.row}>
            <Button title={failed === 1 ? 'Try again' : `Try ${failed} again`} size="md" onPress={retryFailed} style={styles.grow} />
            {failed < total ? (
              <Button
                title="Remove"
                variant="secondary"
                size="md"
                style={styles.grow}
                onPress={() => removeFrames(roll.id, roll.frames.filter((frame) => frame.status === 'failed').map((frame) => frame.id))}
              />
            ) : null}
          </View>
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
    <UnlockSheet visible={sheet && locked} rollId={roll.id} onClose={() => setSheet(false)} onDone={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: Gutter },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 52, marginHorizontal: -6 },
  spacer: { width: 44 },
  title: { gap: 8, paddingTop: Spacing.two, paddingBottom: 22 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sampleNote: { paddingTop: 4 },
  notice: { gap: 6, padding: 18, borderRadius: Radius.lg, marginBottom: 18 },
  noticeButton: { alignSelf: 'flex-start', marginTop: 8 },
  teaser: { marginBottom: 22, gap: 8, paddingHorizontal: 10, paddingTop: 6 },
  lockWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 14, borderRadius: Radius.pill },
  teaserCopy: { gap: 6, paddingTop: 14, marginHorizontal: -10 },
  teaserButton: { marginTop: 10 },
  meter: { paddingBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  cell: { width: '31.8%', gap: 5 },
  photo: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cellMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  veil: { backgroundColor: 'rgba(29,26,23,0.45)' },
  retry: { paddingHorizontal: 10, height: 24, borderRadius: Radius.pill, justifyContent: 'center' },
  failNote: { boxShadow: Shadow.card, marginTop: 18, marginBottom: 0 },
  actions: { gap: 10, paddingTop: 28 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
