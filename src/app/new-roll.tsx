import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { ComparePhoto } from '@/components/compare-photo';
import { IconButton } from '@/components/icon-button';
import { LookCaption } from '@/components/look-caption';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Gutter, Radius, Spacing } from '@/constants/theme';
import { getLook, LOOKS, lookNumber } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { defaultRollName } from '@/lib/roll';
import { MAX_FRAMES, useAppStore } from '@/store/app-store';

/** Load a roll: one look, up to 12 photos, a name. Before any purchase it is one look and one photo, which develops behind a blur until a plan unlocks it. */
export default function NewRollScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ lookId?: string }>();
  const { addRoll, credits, paid, aiConsent, setAiConsent } = useAppStore();
  const [lookId, setLookId] = useState(getLook(params.lookId)?.id ?? 'digicam');
  const [step, setStep] = useState<0 | 1>(0);
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
        ? 'It develops for free. A plan unlocks it to save and share, and opens rolls of up to 12.'
        : covered === count
          ? `Uses ${count} of your ${credits} ${credits === 1 ? 'frame' : 'frames'}.`
          : covered > 0
            ? `You have ${covered} ${covered === 1 ? 'frame' : 'frames'} left. The rest wait until you add more.`
            : 'Choose a plan or pack to develop your photos.';

  const footerTitle = step === 0 ? `Use ${look?.name ?? 'this look'}` : count === 0 ? (paid ? 'Choose photos' : 'Choose a photo') : !paid ? 'Start developing' : `Develop ${count} ${count === 1 ? 'photo' : 'photos'}`;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll={false} contentStyle={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton
          name={step === 1 ? { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } : { ios: 'xmark', android: 'close', web: 'close' }}
          label={step === 1 ? 'Back to choosing a look' : 'Cancel new roll'}
          onPress={() => (step === 1 ? setStep(0) : router.back())}
        />
        <View style={styles.steps} accessibilityLabel={`Step ${step + 1} of 2: ${step === 0 ? 'Look' : 'Photos'}`}>
          {(['Look', 'Photos'] as const).map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepBar, { backgroundColor: index <= step ? theme.text : theme.line }]} />
              <ThemedText type="monoSmall" themeColor={index === step ? 'text' : 'textTertiary'}>{`0${index + 1} ${label}`}</ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {step === 0 ? (
          <>
            <View style={styles.intro}>
              <ThemedText type="title" accessibilityRole="header">Choose a look</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">One look develops the whole roll. You can soften it afterwards.</ThemedText>
            </View>
            {look ? (
              <View style={styles.figure}>
                <ComparePhoto key={look.id} before={look.before} after={look.after} aspectRatio={1.08} accessibilityLabel={`${look.name} example. Press and hold to see the original.`} />
                <LookCaption look={look} />
                <ThemedText type="small" themeColor="textSecondary">{`${look.tagline} Best for ${look.bestFor.toLowerCase()}.`}</ThemedText>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.bleed} accessibilityRole="radiogroup">
              {LOOKS.map((item) => {
                const selected = item.id === lookId;
                return (
                  <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={item.name} onPress={() => setLookId(item.id)} style={styles.railItem}>
                    <View style={[styles.railRing, { borderColor: selected ? theme.text : 'transparent' }]}>
                      <View style={[styles.railPhoto, { backgroundColor: theme.surfaceRaised }]}>
                        <Image source={item.after} style={StyleSheet.absoluteFill} contentFit="cover" />
                      </View>
                    </View>
                    <View style={styles.railLabel}>
                      <View style={[styles.railDot, { backgroundColor: selected ? theme.accent : 'transparent' }]} />
                      <ThemedText type="caption" numberOfLines={2} themeColor={selected ? 'text' : 'textSecondary'} style={styles.railName}>{item.name}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.intro}>
              <ThemedText type="title" accessibilityRole="header">{paid ? 'Add your photos' : 'Add your photo'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{maxPhotos === 1 ? 'Choose one favourite to see it through a different camera.' : `Choose up to ${maxPhotos}. They develop together as one set.`}</ThemedText>
            </View>
            {count === 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={paid ? 'Choose photos from your library' : 'Choose a photo from your library'} onPress={addPhotos} style={({ pressed }) => [styles.upload, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
                <View style={[styles.plusCircle, { backgroundColor: theme.text }]}>
                  <ThemedText type="title" style={{ color: theme.onBrand }}>+</ThemedText>
                </View>
                <ThemedText type="bodyStrong">Choose from your library</ThemedText>
                <ThemedText type="mono" themeColor="textTertiary">{maxPhotos === 1 ? '1 photo to start' : `Up to ${maxPhotos} photos`}</ThemedText>
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
            {look ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Change look. Currently ${look.name}`} onPress={() => setStep(0)} style={({ pressed }) => [styles.lookSummary, { backgroundColor: theme.surface, borderColor: theme.line, opacity: pressed ? 0.75 : 1 }]}>
                <Image source={look.after} style={styles.summaryPhoto} contentFit="cover" />
                <View style={styles.summaryText}>
                  <ThemedText type="monoSmall" themeColor="textTertiary">{`Look  ${lookNumber(look)}`}</ThemedText>
                  <ThemedText type="bodyStrong">{look.name}</ThemedText>
                </View>
                <ThemedText type="label" themeColor="textSecondary">Change</ThemedText>
              </Pressable>
            ) : null}
            {paid ? (
              <View style={styles.section}>
                <ThemedText type="mono" themeColor="textSecondary">Roll name  <ThemedText type="mono" themeColor="textTertiary">(optional)</ThemedText></ThemedText>
                <TextInput value={name} onChangeText={setName} placeholder={defaultRollName()} placeholderTextColor={theme.textTertiary} maxLength={40} returnKeyType="done" accessibilityLabel="Roll name" style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} />
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
  scroll: { gap: 18, paddingTop: 10, paddingBottom: Spacing.four },
  intro: { gap: 6 },
  figure: { gap: 10 },
  section: { gap: 10 },
  bleed: { marginHorizontal: -Gutter, flexGrow: 0 },
  rail: { gap: 10, paddingHorizontal: Gutter },
  railItem: { width: 76, gap: 7 },
  railRing: { padding: 2, borderRadius: Radius.sm, borderWidth: 1.5 },
  railPhoto: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  railLabel: { alignItems: 'center', gap: 4 },
  railName: { textAlign: 'center', fontSize: 12, lineHeight: 15 },
  railDot: { width: 5, height: 5, borderRadius: 3 },
  upload: { minHeight: 260, padding: 20, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  plusCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  cell: { width: '31.5%', gap: 5 },
  single: { width: '62%' },
  cellPhoto: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lookSummary: { flexDirection: 'row', gap: 12, padding: 8, paddingRight: 16, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center' },
  summaryPhoto: { width: 44, height: 55, borderRadius: Radius.print },
  summaryText: { flex: 1, gap: 2 },
  input: { fontFamily: Fonts.sans, fontSize: 16, minHeight: 50, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  footer: { gap: 8, paddingTop: 10 },
  footerNote: { textAlign: 'center' },
});
