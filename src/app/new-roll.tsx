import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Gutter, Radius, Shadow, Spacing } from '@/constants/theme';
import { FREE_LOOK_ID, getLook, LOOKS, lookNumber } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { defaultRollName } from '@/lib/roll';
import { MAX_FRAMES, useAppStore } from '@/store/app-store';

/**
 * Load a roll: one look, up to 12 photos, a name. Looks are chosen by name and colour only, never by
 * example photo or before/after, so the first time anyone sees a look is on their own photo. Before
 * any purchase it is one of three looks and one photo, which develops behind a blur until a plan unlocks it.
 */
export default function NewRollScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ lookId?: string }>();
  const { addRoll, credits, paid, aiConsent, setAiConsent } = useAppStore();
  // Before paying there is no look to choose: the free frame develops in one look, straight from a photo.
  const [lookId, setLookId] = useState(paid ? (getLook(params.lookId)?.id ?? LOOKS[0].id) : FREE_LOOK_ID);
  const [step, setStep] = useState<0 | 1>(paid ? 0 : 1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [asking, setAsking] = useState(false);
  const look = getLook(lookId);
  const maxPhotos = paid ? MAX_FRAMES : 1;

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: paid,
      selectionLimit: maxPhotos - photos.length,
      orderedSelection: paid,
      quality: 1,
      // HEIC photos arrive as JPEG, which every later step can read.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    const added = result.assets.map((asset) => persistTemporary(asset.uri));
    setPhotos((current) => [...current, ...added].slice(0, maxPhotos));
  };

  const started = useRef(false);
  const develop = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const roll = addRoll({ name: name.trim() || defaultRollName(), lookId, sourceUris: photos });
    router.replace({ pathname: '/roll/[id]', params: { id: roll.id } });
    if (credits === 0) setTimeout(() => router.push({ pathname: '/paywall', params: { rollId: roll.id } }), 350);
  }, [addRoll, name, lookId, photos, credits]);

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
      ? 'Your photos stay on your phone until you agree to processing.'
      : !paid
        ? 'It develops right here in about 30 seconds.'
        : covered === count
          ? `Uses ${count} of your ${credits} ${credits === 1 ? 'frame' : 'frames'}.`
          : covered > 0
            ? `You have ${covered} ${covered === 1 ? 'frame' : 'frames'} left. The rest wait until you add more.`
            : 'Choose a plan or pack to develop your photos.';

  const footerTitle = step === 0 ? 'Continue' : count === 0 ? (paid ? 'Choose photos' : 'Choose a photo') : !paid ? 'Start developing' : `Develop ${count} ${count === 1 ? 'photo' : 'photos'}`;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll={false} glow={step === 0 ? look?.tint : true} contentStyle={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton
          name={paid && step === 1 ? { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } : { ios: 'xmark', android: 'close', web: 'close' }}
          label={paid && step === 1 ? 'Back to choosing a look' : 'Cancel new roll'}
          onPress={() => (paid && step === 1 ? setStep(0) : router.back())}
        />
        {paid ? <View style={styles.steps} accessibilityLabel={`Step ${step + 1} of 2: ${step === 0 ? 'Look' : 'Photos'}`}>
          {(['Look', 'Photos'] as const).map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepBar, { backgroundColor: index <= step ? theme.text : theme.line }]} />
              <ThemedText type="monoSmall" themeColor={index === step ? 'text' : 'textTertiary'}>{`0${index + 1} ${label}`}</ThemedText>
            </View>
          ))}
        </View> : null}
        <View style={styles.spacer} />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {step === 0 ? (
          <>
            <View style={styles.intro}>
              <ThemedText type="title" accessibilityRole="header">Choose a look</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">One look develops the whole roll. You’ll see it on your own photos.</ThemedText>
            </View>
            <View style={styles.cards} accessibilityRole="radiogroup">
              {LOOKS.map((item) => {
                const selected = item.id === lookId;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.name}. ${item.tagline}`}
                    onPress={() => setLookId(item.id)}
                    style={({ pressed }) => [styles.card, { backgroundColor: item.tint, borderColor: selected ? item.deep : 'transparent', transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
                    <View style={styles.cardTop}>
                      <ThemedText type="monoSmall" style={{ color: item.deep, opacity: 0.7 }}>{lookNumber(item)}</ThemedText>
                      <View style={[styles.radio, { borderColor: item.deep }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: item.deep }]} /> : null}</View>
                    </View>
                    <ThemedText type="subtitle" style={{ color: item.deep }}>{item.name}</ThemedText>
                    <ThemedText type="small" style={{ color: item.deep, opacity: 0.85 }}>{item.tagline}</ThemedText>
                    <ThemedText type="monoSmall" style={{ color: item.deep, opacity: 0.7 }}>{`Best for ${item.bestFor.toLowerCase()}`}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={styles.intro}>
              <ThemedText type="title" accessibilityRole="header">{paid ? 'Add your photos' : 'Add your photo'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{maxPhotos === 1 ? 'Choose one favourite to see it through a different camera.' : `Choose up to ${maxPhotos}. They develop together as one set.`}</ThemedText>
            </View>
            {count === 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={paid ? 'Choose photos from your library' : 'Choose a photo from your library'} onPress={addPhotos} style={({ pressed }) => [styles.upload, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
                <View style={[styles.plusCircle, { backgroundColor: theme.text }]}>
                  <ThemedText type="title" style={{ color: theme.onBrand }}>+</ThemedText>
                </View>
                <ThemedText type="bodyStrong">Choose from your library</ThemedText>
                <ThemedText type="mono" themeColor="textTertiary">{maxPhotos === 1 ? 'Pick your favourite' : `Up to ${maxPhotos} photos`}</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.section}>
                <View style={styles.photoHeader}>
                  <ThemedText type="mono">{paid ? `${String(count).padStart(2, '0')} / ${maxPhotos} frames` : '01 frame'}</ThemedText>
                  <ThemedText type="mono" themeColor="textTertiary">Tap to remove</ThemedText>
                </View>
                <View style={styles.grid}>
                  {photos.map((uri, index) => (
                    <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))} style={[styles.cell, maxPhotos === 1 && styles.single]}>
                      <View style={[styles.cellPhoto, { backgroundColor: theme.surfaceRaised }]}>
                        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                        <View style={[styles.remove, { backgroundColor: 'rgba(251,248,243,0.94)' }]}><ThemedText type="label">×</ThemedText></View>
                      </View>
                      <ThemedText type="monoSmall" themeColor="textTertiary">{String(index + 1).padStart(2, '0')}</ThemedText>
                    </Pressable>
                  ))}
                  {count < maxPhotos ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Add more photos" onPress={addPhotos} style={styles.cell}>
                      <View style={[styles.cellPhoto, styles.add, { borderColor: theme.line }]}>
                        <ThemedText type="title" themeColor="textSecondary">+</ThemedText>
                      </View>
                      <ThemedText type="monoSmall" themeColor="textTertiary">Add</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}
            {paid && look ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Change look. Currently ${look.name}`} onPress={() => setStep(0)} style={({ pressed }) => [styles.lookSummary, { backgroundColor: look.tint, opacity: pressed ? 0.75 : 1 }]}>
                <View style={[styles.summaryPhoto, { backgroundColor: look.deep }]} />
                <View style={styles.summaryText}>
                  <ThemedText type="monoSmall" style={{ color: look.deep, opacity: 0.72 }}>{`Look  ${lookNumber(look)}`}</ThemedText>
                  <ThemedText type="bodyStrong" style={{ color: look.deep }}>{look.name}</ThemedText>
                </View>
                <ThemedText type="label" style={{ color: look.deep }}>Change</ThemedText>
              </Pressable>
            ) : null}
            {paid ? (
              <View style={styles.section}>
                <ThemedText type="mono" themeColor="textSecondary">Roll name  <ThemedText type="mono" themeColor="textTertiary">(optional)</ThemedText></ThemedText>
                <TextInput value={name} onChangeText={setName} placeholder={defaultRollName()} placeholderTextColor={theme.textTertiary} maxLength={40} returnKeyType="done" accessibilityLabel="Roll name" style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={footerTitle} onPress={step === 0 ? () => setStep(1) : count === 0 ? addPhotos : continueToDevelop} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.footerNote}>{step === 0 ? (paid ? 'Next, choose your photos.' : 'Next, choose a photo to try it on.') : note}</ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: Gutter, paddingBottom: 8 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -6 },
  spacer: { width: 44 },
  steps: { flexDirection: 'row', gap: 10 },
  stepItem: { width: 78, gap: 6 },
  stepBar: { height: 2, borderRadius: 1 },
  // The list takes the space left between the header and the footer and scrolls, so the button stays on screen.
  list: { flex: 1 },
  scroll: { gap: 18, paddingTop: 10, paddingBottom: Spacing.four },
  intro: { gap: 6 },
  section: { gap: 10 },
  upload: { minHeight: 260, padding: 20, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  plusCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  cell: { width: '31.5%', gap: 5 },
  single: { width: '62%' },
  cellPhoto: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lookSummary: { flexDirection: 'row', gap: 12, padding: 8, paddingRight: 16, borderRadius: Radius.lg, alignItems: 'center' },
  summaryPhoto: { width: 44, height: 55, borderRadius: 12 },
  summaryText: { flex: 1, gap: 2 },
  input: { fontFamily: Fonts.sans, fontSize: 16, minHeight: 50, paddingHorizontal: 16, borderRadius: Radius.md, boxShadow: Shadow.card },
  cards: { gap: 10 },
  card: { padding: 16, paddingTop: 14, borderRadius: Radius.lg, borderWidth: 2, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  footer: { gap: 8, paddingTop: 10 },
  footerNote: { textAlign: 'center' },
});
