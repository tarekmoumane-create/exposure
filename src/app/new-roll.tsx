import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { LookPreview } from '@/components/look-preview';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { getLook, LOOKS } from '@/data/looks';
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

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} scroll={false} contentStyle={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={step === 1 ? 'Back to choosing a look' : 'Cancel new roll'} onPress={() => step === 1 ? setStep(0) : router.back()} style={styles.headerButton}>
          <ThemedText style={styles.arrow}>←</ThemedText>
        </Pressable>
        <View style={styles.steps} accessibilityLabel={`Step ${step + 1} of 2: ${step === 0 ? 'Look' : 'Photos'}`}>
          <ThemedText type="caption" themeColor={step === 0 ? 'text' : 'textTertiary'}>01  Look</ThemedText>
          <View style={[styles.stepLine, { backgroundColor: theme.line }]} />
          <ThemedText type="caption" themeColor={step === 1 ? 'text' : 'textTertiary'}>02  Photos</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel new roll" onPress={() => router.back()} style={styles.headerButton}>
          <ThemedText style={styles.close}>×</ThemedText>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {step === 0 ? (
          <>
            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" style={styles.heading}>Choose a look</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>One look for your whole roll. You can adjust the strength after it develops.</ThemedText>
            </View>
            {look ? <LookPreview key={look.id} look={look} compact /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stocks} style={styles.bleed}>
              {LOOKS.map((item) => {
                const selected = item.id === lookId;
                return (
                  <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={item.name} onPress={() => setLookId(item.id)} style={styles.stock}>
                    <View style={[styles.stockBorder, { borderColor: selected ? theme.brand : 'transparent' }]}>
                      <Image source={item.after} style={styles.stockPhoto} contentFit="cover" />
                      {selected ? <View style={[styles.selected, { backgroundColor: theme.brand }]}><ThemedText type="caption" themeColor="onPhoto">✓</ThemedText></View> : null}
                    </View>
                    <ThemedText type="caption" numberOfLines={2} themeColor={selected ? 'text' : 'textSecondary'} style={styles.stockName}>{item.name}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {look ? <View style={[styles.lookNote, { borderTopColor: theme.line }]}><ThemedText type="bodyStrong">{look.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{look.bestFor}</ThemedText></View> : null}
          </>
        ) : (
          <>
            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" style={styles.heading}>{paid ? 'Add your photos' : 'Add your photo'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>{maxPhotos === 1 ? 'Choose a photo to see it through a different camera.' : `Choose up to ${maxPhotos} photos for this roll.`}</ThemedText>
            </View>
            {count === 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={paid ? 'Choose photos from your camera roll' : 'Choose a photo from your camera roll'} onPress={addPhotos} style={({ pressed }) => [styles.upload, { backgroundColor: 'transparent', borderColor: theme.line, opacity: pressed ? 0.75 : 1 }]}>
                <ThemedText style={[styles.plus, { color: theme.textSecondary }]}>+</ThemedText>
                <ThemedText type="bodyStrong">Choose from your camera roll</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{maxPhotos === 1 ? 'One photo to start' : `Up to ${maxPhotos} photos`}</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.section}>
                <View style={styles.photoHeader}><ThemedText type="bodyStrong">{paid ? 'Your photos' : 'Your photo'}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{paid ? `${count} of ${maxPhotos}. Tap × to remove` : 'Tap × to choose another'}</ThemedText></View>
                <View style={styles.grid}>
                  {photos.map((uri, index) => (
                    <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))} style={styles.cell}>
                      <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <View style={[styles.remove, { backgroundColor: theme.scrim }]}><ThemedText type="caption" themeColor="onPhoto">×</ThemedText></View>
                    </Pressable>
                  ))}
                  {count < maxPhotos ? <Pressable accessibilityRole="button" accessibilityLabel="Add more photos" onPress={addPhotos} style={[styles.cell, styles.add, { backgroundColor: 'transparent', borderColor: theme.line }]}><ThemedText type="title" themeColor="brand">+</ThemedText><ThemedText type="caption" themeColor="brand">Add more</ThemedText></Pressable> : null}
                </View>
              </View>
            )}
            {look ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Change look. Currently ${look.name}`} onPress={() => setStep(0)} style={[styles.lookSummary, { borderColor: theme.line }]}>
                <Image source={look.after} style={styles.summaryPhoto} contentFit="cover" />
                <View style={styles.summaryText}><ThemedText type="caption" themeColor="textSecondary">YOUR LOOK</ThemedText><ThemedText type="bodyStrong">{look.name}</ThemedText></View>
                <ThemedText type="small" themeColor="brand">Change</ThemedText>
              </Pressable>
            ) : null}
            {paid ? <View style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary">Give it a name <ThemedText type="caption" themeColor="textTertiary">(optional)</ThemedText></ThemedText>
              <TextInput value={name} onChangeText={setName} placeholder={defaultRollName()} placeholderTextColor={theme.textTertiary} maxLength={40} returnKeyType="done" accessibilityLabel="Roll name" style={[styles.input, { backgroundColor: 'transparent', borderColor: theme.line, color: theme.text }]} />
            </View> : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.line }]}>
        <Button title={step === 0 ? `Use ${look?.name ?? 'this look'}` : count === 0 ? (paid ? 'Choose photos' : 'Choose a photo') : !paid ? 'Start developing' : `Develop ${count} ${count === 1 ? 'photo' : 'photos'}`} onPress={step === 0 ? () => setStep(1) : count === 0 ? addPhotos : continueToDevelop} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.footerNote}>{step === 0 ? (paid ? 'Next, choose your photos.' : 'Next, choose a photo to try it on.') : note}</ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24, paddingBottom: 12 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -8 },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 25, lineHeight: 30 },
  close: { fontSize: 27, lineHeight: 30 },
  steps: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stepLine: { width: 26, height: 1 },
  scroll: { gap: 20, paddingTop: 12, paddingBottom: 24 },
  intro: { gap: 10 },
  heading: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  description: { fontSize: 14, lineHeight: 21, maxWidth: 330 },
  section: { gap: 10 },
  bleed: { marginHorizontal: -24 },
  stocks: { gap: 10, paddingHorizontal: 24 },
  stock: { width: 78, gap: 6 },
  stockBorder: { padding: 3, borderRadius: 3, borderWidth: 1.5 },
  stockPhoto: { width: '100%', aspectRatio: 0.9, borderRadius: 2 },
  stockName: { textAlign: 'center', fontSize: 11, lineHeight: 15 },
  selected: { position: 'absolute', bottom: 6, right: 6, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  lookNote: { gap: 3, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  upload: { minHeight: 248, padding: 20, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 8 },
  plus: { fontSize: 32, lineHeight: 38, fontFamily: Fonts.sans },
  photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  remove: { position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lookSummary: { flexDirection: 'row', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: 'center' },
  summaryPhoto: { width: 42, height: 48, borderRadius: 2 },
  summaryText: { flex: 1, gap: 2 },
  input: { fontFamily: Fonts.sans, fontSize: 15, minHeight: 48, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1 },
  footer: { gap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerNote: { textAlign: 'center', fontSize: 11, lineHeight: 16 },
});
