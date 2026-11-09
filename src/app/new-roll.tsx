import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Print } from '@/components/print';
import { Screen } from '@/components/screen';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Gutter, Radius, Shadow, Spacing } from '@/constants/theme';
import { getLook, LOCKED_LOOKS, type Look, LOOKS, TRIAL_LOOKS } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { defaultRollName } from '@/lib/roll';
import { MAX_FRAMES, useAppStore } from '@/store/app-store';

/**
 * Before paying: try a look. Four looks to pick from by name and colour (never by example photo),
 * one photo, and it develops big on the next screen. After paying: a roll of up to 12 photos on a
 * look chosen from its page in Looks.
 */
export default function NewRollScreen() {
  const params = useLocalSearchParams<{ lookId?: string }>();
  const { addRoll, credits, paid, aiConsent, setAiConsent } = useAppStore();
  const [lookId, setLookId] = useState(() => (paid ? (getLook(params.lookId)?.id ?? LOOKS[0].id) : TRIAL_LOOKS[0].id));
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [asking, setAsking] = useState(false);
  const look = getLook(lookId) ?? LOOKS[0];
  const maxPhotos = paid ? MAX_FRAMES : 1;

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: paid,
      selectionLimit: paid ? maxPhotos - photos.length : 1,
      orderedSelection: paid,
      quality: 1,
      // HEIC photos arrive as JPEG, which every later step can read.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    const added = result.assets.map((asset) => persistTemporary(asset.uri));
    // One photo before paying, always: a new pick replaces the old one.
    setPhotos((current) => (paid ? [...current, ...added].slice(0, maxPhotos) : added.slice(0, 1)));
  };

  const started = useRef(false);
  const develop = () => {
    if (started.current) return;
    started.current = true;
    const roll = addRoll({ name: name.trim() || defaultRollName(), lookId: look.id, sourceUris: photos.slice(0, maxPhotos) });
    router.replace({ pathname: '/roll/[id]', params: { id: roll.id } });
    if (paid && credits === 0) setTimeout(() => router.push({ pathname: '/paywall', params: { rollId: roll.id } }), 350);
  };

  const changeLook = () => {
    // The catalogue lives in Looks; each look's page starts a roll on it.
    router.back();
    setTimeout(() => router.navigate('/stocks'), 250);
  };

  const continueToDevelop = () => {
    if (aiConsent) develop();
    else setAsking(true);
  };

  if (asking) {
    return (
      <AiConsent
        uri={photos[0]}
        onAgree={() => {
          setAiConsent(true);
          develop();
        }}
        onDecline={() => setAsking(false)}
      />
    );
  }

  const count = photos.length;
  const covered = Math.min(count, credits);
  const note =
    count === 0
      ? 'Your photos stay on your phone until you say go.'
      : !paid
        ? 'Takes about 30 seconds.'
        : covered === count
          ? `Uses ${count} of your ${credits} ${credits === 1 ? 'photo' : 'photos'} today.`
          : covered > 0
            ? `You have ${covered} ${covered === 1 ? 'photo' : 'photos'} left today. The rest wait until you add more.`
            : 'Choose a plan or pack to develop your photos.';

  // The try-out is one photo. Someone who has had theirs goes to the plans instead of a roll that would wait.
  const usedTrial = !paid && credits === 0;
  const footerTitle = count === 0 ? (paid ? 'Choose photos' : 'Choose a photo') : usedTrial ? 'Unlock to develop' : !paid ? 'Develop my photo' : `Develop ${count} ${count === 1 ? 'photo' : 'photos'}`;
  const footerAction = count === 0 ? addPhotos : usedTrial ? () => router.push('/paywall') : continueToDevelop;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll={false} glow={paid ? true : look.tint} contentStyle={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Cancel" onPress={() => router.back()} />
        <View style={styles.spacer} />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {paid ? (
          <PaidPicker photos={photos} maxPhotos={maxPhotos} look={look} name={name} onName={setName} onAdd={addPhotos} onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))} onChangeLook={changeLook} />
        ) : (
          <TrialPicker photo={photos[0]} lookId={look.id} onLook={setLookId} onAdd={addPhotos} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={footerTitle} onPress={footerAction} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.footerNote}>{note}</ThemedText>
      </View>
    </Screen>
  );
}

/** Before paying: one photo, and four looks to try by name. The rest are shown locked, by name only. */
function TrialPicker({ photo, lookId, onLook, onAdd }: { photo: string | undefined; lookId: string; onLook: (id: string) => void; onAdd: () => void }) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.intro}>
        <ThemedText type="display" accessibilityRole="header">Try a look</ThemedText>
        <ThemedText themeColor="textSecondary">Pick a camera, add one photo, and watch it develop.</ThemedText>
      </View>

      {photo ? (
        <View style={styles.photoRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={onAdd} style={({ pressed }) => [styles.photoCard, { opacity: pressed ? 0.85 : 1 }]}>
            <Print rotate={-2} border={6} source={photo} />
          </Pressable>
          <View style={styles.photoSide}>
            <ThemedText type="subtitle">Your photo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Tap it to pick a different one.</ThemedText>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a photo from your library" onPress={onAdd} style={({ pressed }) => [styles.upload, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          <View style={[styles.plusCircle, { backgroundColor: theme.accent }]}>
            <ThemedText type="title" style={{ color: theme.onBrand }}>+</ThemedText>
          </View>
          <View style={styles.uploadText}>
            <ThemedText type="bodyStrong">Choose a photo</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">From your library. One is all it takes.</ThemedText>
          </View>
        </Pressable>
      )}

      <View style={styles.section}>
        <ThemedText type="subtitle">Pick a look</ThemedText>
        <View style={styles.cards} accessibilityRole="radiogroup">
          {TRIAL_LOOKS.map((look) => {
            const selected = look.id === lookId;
            return (
              <Tappable
                key={look.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${look.name}. ${look.tagline}`}
                onPress={() => onLook(look.id)}
                scaleTo={0.97}
                style={[styles.card, { backgroundColor: look.tint, borderColor: selected ? look.deep : 'transparent' }]}>
                <View style={[styles.swatch, { backgroundColor: look.deep }]}>
                  {selected ? <ThemedText type="label" style={{ color: look.tint }}>✓</ThemedText> : null}
                </View>
                <ThemedText type="bodyStrong" numberOfLines={1} style={{ color: look.deep }}>{look.name}</ThemedText>
                <ThemedText type="caption" numberOfLines={2} style={[styles.cardLine, { color: look.deep }]}>{look.tagline}</ThemedText>
              </Tappable>
            );
          })}
        </View>
        <View style={styles.lockedRow}>
          <ThemedText type="caption" themeColor="textTertiary">{`${LOCKED_LOOKS.length} more with Exposure`}</ThemedText>
          <View style={styles.lockedPills}>
            {LOCKED_LOOKS.map((look) => (
              <View key={look.id} style={[styles.lockedPill, { backgroundColor: theme.surfaceRaised }]} accessibilityLabel={`${look.name}, locked`}>
                <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={10} tintColor={theme.textTertiary} />
                <ThemedText type="tiny" themeColor="textTertiary">{look.name}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

/** After paying: up to 12 photos as a grid, the chosen look, and a name for the roll. */
function PaidPicker({ photos, maxPhotos, look, name, onName, onAdd, onRemove, onChangeLook }: { photos: string[]; maxPhotos: number; look: Look; name: string; onName: (value: string) => void; onAdd: () => void; onRemove: (index: number) => void; onChangeLook: () => void }) {
  const theme = useTheme();
  const count = photos.length;
  return (
    <>
      <View style={styles.intro}>
        <ThemedText type="display" accessibilityRole="header">New roll</ThemedText>
        <ThemedText themeColor="textSecondary">{`Choose up to ${maxPhotos} photos. They develop together as one set.`}</ThemedText>
      </View>
      {count === 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Choose photos from your library" onPress={onAdd} style={({ pressed }) => [styles.upload, styles.uploadTall, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          <View style={[styles.plusCircle, { backgroundColor: theme.accent }]}>
            <ThemedText type="title" style={{ color: theme.onBrand }}>+</ThemedText>
          </View>
          <View style={styles.uploadText}>
            <ThemedText type="bodyStrong">Choose from your library</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">{`Up to ${maxPhotos} photos`}</ThemedText>
          </View>
        </Pressable>
      ) : (
        <View style={styles.section}>
          <View style={styles.photoHeader}>
            <ThemedText type="label">{`${count} of ${maxPhotos} photos`}</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">Tap to remove</ThemedText>
          </View>
          <View style={styles.grid}>
            {photos.map((uri, index) => (
              <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => onRemove(index)} style={styles.cell}>
                <View style={[styles.cellPhoto, { backgroundColor: theme.surfaceRaised }]}>
                  <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={[styles.remove, { backgroundColor: 'rgba(255,255,255,0.94)' }]}><ThemedText type="label">×</ThemedText></View>
                </View>
              </Pressable>
            ))}
            {count < maxPhotos ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add more photos" onPress={onAdd} style={styles.cell}>
                <View style={[styles.cellPhoto, styles.add, { borderColor: theme.line }]}>
                  <ThemedText type="title" themeColor="textSecondary">+</ThemedText>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={`Change look. Currently ${look.name}`} onPress={onChangeLook} style={({ pressed }) => [styles.lookSummary, { backgroundColor: look.tint, opacity: pressed ? 0.75 : 1 }]}>
        <View style={[styles.summarySwatch, { backgroundColor: look.deep }]} />
        <View style={styles.summaryText}>
          <ThemedText type="caption" style={{ color: look.deep, opacity: 0.78 }}>Look</ThemedText>
          <ThemedText type="subtitle" style={{ color: look.deep }}>{look.name}</ThemedText>
        </View>
        <ThemedText type="label" style={{ color: look.deep }}>Change</ThemedText>
      </Pressable>
      <View style={styles.section}>
        <ThemedText type="label" themeColor="textSecondary">Roll name <ThemedText type="label" themeColor="textTertiary">(optional)</ThemedText></ThemedText>
        <TextInput value={name} onChangeText={onName} placeholder={defaultRollName()} placeholderTextColor={theme.textTertiary} maxLength={40} returnKeyType="done" accessibilityLabel="Roll name" style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: Gutter, paddingBottom: 8 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -6 },
  spacer: { width: 44 },
  // The list takes the space left between the header and the footer and scrolls, so the button stays on screen.
  list: { flex: 1 },
  scroll: { gap: 22, paddingTop: 6, paddingBottom: Spacing.four },
  intro: { gap: 6 },
  section: { gap: 12 },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  uploadTall: { flexDirection: 'column', minHeight: 240, justifyContent: 'center', gap: 10 },
  uploadText: { flex: 1, gap: 2 },
  plusCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 6 },
  photoCard: { width: 128 },
  photoSide: { flex: 1, gap: 4 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', flexGrow: 1, padding: 14, paddingTop: 12, borderRadius: Radius.lg, borderWidth: 2, gap: 3, minHeight: 124 },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLine: { opacity: 0.82 },
  lockedRow: { gap: 8, paddingTop: 4 },
  lockedPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lockedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: Radius.pill },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  cell: { width: '31.5%' },
  cellPhoto: { aspectRatio: 4 / 5, borderRadius: Radius.sm, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lookSummary: { flexDirection: 'row', gap: 12, padding: 10, paddingRight: 16, borderRadius: Radius.lg, alignItems: 'center' },
  summarySwatch: { width: 44, height: 44, borderRadius: 14 },
  summaryText: { flex: 1, gap: 1 },
  input: { fontFamily: Fonts.sans, fontSize: 16, minHeight: 50, paddingHorizontal: 16, borderRadius: Radius.md, boxShadow: Shadow.card },
  footer: { gap: 8, paddingTop: 10 },
  footerNote: { textAlign: 'center' },
});
