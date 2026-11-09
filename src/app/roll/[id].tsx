import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { TrialStage } from '@/components/trial-stage';
import { UnlockSheet } from '@/components/unlock-sheet';
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

/** Holds the screen on while frames develop; a locked phone would pause them. Phones only: browsers manage this themselves. */
function StayAwake() {
  return Platform.OS === 'web' ? null : <KeepAwake />;
}

function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * A roll. Before paying it is one photo, big, developing on stage until a plan unlocks it.
 * After paying it is the contact sheet: every frame developing in place, and what to do with the set.
 */
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
  /** The plans sheet over a locked roll; the frosted photo stays visible above it. */
  const [sheet, setSheet] = useState(false);
  const offered = useRef(false);

  // Coming back from the paywall: the frost lifts off the photo, then the roll shows as usual.
  useFocusEffect(
    useCallback(() => {
      if (!paid) {
        wasLocked.current = true;
        return;
      }
      if (!wasLocked.current) return;
      wasLocked.current = false;
      setRevealing(true);
      const timer = setTimeout(() => setRevealing(false), 2400);
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
  /** Before any purchase a finished photo stays frosted, and nothing can be saved or shared. */
  const locked = !paid && !isSample;
  const blocked = waiting > 0 && developing === 0 && credits === 0 && !(locked && done > 0);
  /** The one-photo try-out, kept on stage a moment longer after paying so the frost can lift. */
  const trial = (locked || revealing) && !isSample && total === 1 && !blocked;
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
      toast.show(finished.length === 1 ? 'Saved to Photos' : `${finished.length} photos saved to Photos`);
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
    const ok = await confirm('Delete this roll?', 'Its photos are removed from Exposure on this phone. Anything saved to Photos stays.', 'Delete');
    if (!ok) return;
    dismiss();
    setTimeout(() => removeRoll(roll.id), 350);
  };

  const status =
    done === total
      ? `${total} ${total === 1 ? 'photo' : 'photos'}`
      : developing > 0
        ? `Developing ${done} of ${total}`
        : `${done} of ${total} developed`;
  const date = roll.createdAt ? new Date(roll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const openPaywall = () => (locked ? setSheet(true) : router.push({ pathname: '/paywall', params: { rollId: roll.id } }));
  /** The plans rise once, on their own, after the photo has frosted over. */
  const offerPlans = () => {
    if (offered.current || !locked) return;
    offered.current = true;
    setSheet(true);
  };

  if (trial) {
    const frame = roll.frames[0];
    return (
      <View style={styles.fill}>
        <Screen edges={['top', 'left', 'right', 'bottom']} glow={look?.tint ?? true} contentStyle={styles.content}>
          {developing > 0 || waiting > 0 ? <StayAwake /> : null}
          <View style={styles.header}>
            <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
            <ThemedText type="label" themeColor="textSecondary">{look?.name ?? ''}</ThemedText>
            <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete" onPress={onDelete} />
          </View>
          {needsConsent ? (
            <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="bodyStrong">One quick permission first.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Your photo develops as soon as you allow processing.</ThemedText>
              <Button title="Review and continue" size="md" style={styles.noticeButton} onPress={() => setAsking(true)} />
            </View>
          ) : null}
          <View style={styles.trial}>
            <TrialStage frame={frame} look={look} locked={locked} onUnlock={openPaywall} onRetry={retryFailed} onFrosted={offerPlans} />
          </View>
        </Screen>
        <UnlockSheet visible={sheet && locked} rollId={roll.id} onClose={() => setSheet(false)} onDone={() => setSheet(false)} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
    <Screen edges={['top', 'left', 'right', 'bottom']} glow={look?.tint ?? true} contentStyle={styles.content}>
      {developing > 0 ? <StayAwake /> : null}
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Back" onPress={() => dismiss()} />
        <ThemedText type="label" themeColor="textSecondary">{isSample ? 'Example' : date}</ThemedText>
        {!isSample ? <IconButton name={{ ios: 'trash', android: 'delete', web: 'delete' }} label="Delete roll" onPress={onDelete} /> : <View style={styles.spacer} />}
      </View>

      <View style={styles.title}>
        <ThemedText type="display" accessibilityRole="header">
          {roll.name}
        </ThemedText>
        <View style={styles.meta} accessibilityLiveRegion="polite">
          <ThemedText type="caption" themeColor="textSecondary">{`${look?.name ?? 'Film'}  ·  `}</ThemedText>
          {developing > 0 ? <StatusDot live /> : null}
          <ThemedText type="caption" themeColor={developing > 0 ? 'accent' : 'textSecondary'}>{status}</ThemedText>
        </View>
        {isSample ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.sampleNote}>
            {`A real roll, developed on ${look?.name}. Open any photo and switch to Before to see the original.`}
          </ThemedText>
        ) : null}
      </View>

      {blocked ? (
        <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="bodyStrong">{done > 0 ? `${waiting} more ${waiting === 1 ? 'photo is' : 'photos are'} waiting.` : 'This roll is ready to develop.'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plan === 'free' ? 'Choose a plan or pack and they develop right here.' : 'They develop here when your new photos arrive at midnight, or add a pack now.'}
          </ThemedText>
          <Button title={plan === 'free' ? 'See plans' : 'Add photos'} size="md" style={styles.noticeButton} onPress={() => (plan === 'free' ? openPaywall() : router.push('/out-of-credits'))} />
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

      <View style={styles.grid}>
        {roll.frames.map((frame, index) => (
          <Pressable
            key={frame.id}
            accessibilityRole="button"
            accessibilityLabel={frame.status === 'done' ? `Open photo ${index + 1}` : frame.status === 'failed' ? `Photo ${index + 1} failed. Try again.` : `Photo ${index + 1}, ${frame.status}`}
            disabled={frame.status === 'developing' || frame.status === 'waiting'}
            onPress={() => openFrame(frame, index)}
            style={({ pressed }) => [styles.photo, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.85 : 1 }]}>
            {frame.status === 'done' && !locked && (liveStrength ?? frame.strength) < 0.995 ? <Image source={frame.sourceUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <Image
              source={frame.status === 'done' && locked ? frame.sourceUri : frame.thumbUri ?? frame.resultUri ?? frame.sourceUri}
              style={[StyleSheet.absoluteFill, frame.status === 'done' && !locked ? { opacity: liveStrength ?? frame.strength } : null]}
              contentFit="cover"
              transition={frame.status === 'done' ? 500 : 0}
            />
            {frame.status !== 'done' ? <View style={[StyleSheet.absoluteFill, styles.veil]} /> : null}
            {frame.status === 'developing' ? <ActivityIndicator color={theme.onPhoto} /> : null}
            {frame.status === 'failed' ? (
              <View style={[styles.retry, { backgroundColor: 'rgba(255,255,255,0.94)' }]}>
                <ThemedText type="tiny" themeColor="mark">Retry</ThemedText>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {failed > 0 ? (
        <View style={[styles.notice, styles.failNote, { backgroundColor: theme.surface }]}>
          <ThemedText type="small" themeColor="mark">
            {roll.frames.find((frame) => frame.status === 'failed')?.error ?? 'A photo did not develop.'} Trying again won’t charge you twice.
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
            <Button title={done === 1 ? 'Save photo' : 'Save all'} variant="secondary" onPress={saveAll} loading={busy === 'save'} disabled={busy !== null} style={styles.grow} />
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
  trial: { paddingTop: 8 },
  meter: { paddingBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  photo: { width: '31.8%', aspectRatio: 4 / 5, borderRadius: Radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  veil: { backgroundColor: 'rgba(43,31,38,0.4)' },
  retry: { paddingHorizontal: 10, height: 24, borderRadius: Radius.pill, justifyContent: 'center' },
  failNote: { boxShadow: Shadow.card, marginTop: 18, marginBottom: 0 },
  actions: { gap: 10, paddingTop: 28 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
