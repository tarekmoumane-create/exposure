import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AiConsent } from '@/components/ai-consent';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { getLook, LOOKS } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { defaultRollName } from '@/lib/roll';
import { MAX_FRAMES, useAppStore } from '@/store/app-store';

/** Load a roll: one look, up to 12 photos, a name. */
export default function NewRollScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ lookId?: string }>();
  const { addRoll, credits, paid, aiConsent, setAiConsent } = useAppStore();
  const [lookId, setLookId] = useState(getLook(params.lookId)?.id ?? 'gold-200');
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [asking, setAsking] = useState(false);
  const look = getLook(lookId);

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FRAMES - photos.length,
      orderedSelection: true,
      quality: 1,
      // HEIC photos arrive as JPEG, which every later step can read.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    const added = result.assets.map((asset) => persistTemporary(asset.uri));
    setPhotos((current) => [...current, ...added].slice(0, MAX_FRAMES));
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
    !paid && count > 0
      ? 'Your first frame develops halfway for free. Choose a plan to finish it and develop the rest.'
      : count === 0
        ? `Add up to ${MAX_FRAMES} photos. People, places, anything.`
        : covered === count
          ? `Uses ${count} of your ${credits} ${credits === 1 ? 'frame' : 'frames'}. Only frames that come back count.`
        : covered > 0
          ? `You have ${covered} ${covered === 1 ? 'frame' : 'frames'} left, so ${count - covered} ${count - covered === 1 ? 'frame' : 'frames'} will wait until you add more.`
          : 'Your frames will wait until you choose a plan or pack.';

  return (
    <Screen edges={['left', 'right', 'bottom']} scroll={false} contentStyle={styles.root}>
      <Stack.Screen options={{ headerRight: () => <Button title="Cancel" variant="ghost" size="md" onPress={() => router.back()} /> }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={styles.section}>
          <ThemedText type="subtitle">1. Choose your look</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stocks} style={styles.bleed}>
            {LOOKS.map((item) => {
              const selected = item.id === lookId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.name}
                  onPress={() => setLookId(item.id)}
                  style={styles.stock}>
                  <Image source={item.after} style={[styles.stockPhoto, { borderColor: selected ? theme.brand : 'transparent' }]} contentFit="cover" />
                  <ThemedText type="caption" numberOfLines={1} themeColor={selected ? 'brand' : 'textSecondary'}>
                    {item.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
          {look ? (
            <ThemedText type="small" themeColor="textSecondary">
              {look.tagline} Best for {look.bestFor.toLowerCase()}.
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">{count === 0 ? '2. Add your photos' : `2. Your photos (${count} of ${MAX_FRAMES})`}</ThemedText>
          <View style={styles.grid}>
            {photos.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                style={styles.cell}>
                <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={[styles.remove, { backgroundColor: theme.scrim }]}>
                  <ThemedText type="caption" themeColor="onPhoto">
                    ×
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            {count < MAX_FRAMES ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={addPhotos} style={[styles.cell, styles.add, { borderColor: theme.brand }]}>
                <ThemedText type="title" themeColor="brand">
                  +
                </ThemedText>
                <ThemedText type="caption" themeColor="brand">
                  Add photos
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Name your roll (optional)</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={defaultRollName()}
            placeholderTextColor={theme.textTertiary}
            maxLength={40}
            returnKeyType="done"
            accessibilityLabel="Roll name"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
        <Button
          title={count === 0 ? 'Add photos to continue' : !paid ? 'Start developing' : `Develop ${count} ${count === 1 ? 'photo' : 'photos'}`}
          disabled={count === 0}
          onPress={continueToDevelop}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: Spacing.two },
  scroll: { gap: Spacing.four, paddingVertical: Spacing.three },
  section: { gap: Spacing.two },
  bleed: { marginHorizontal: -Spacing.three },
  stocks: { gap: 10, paddingHorizontal: Spacing.three },
  stock: { width: 84, gap: 4 },
  stockPhoto: { width: 84, height: 105, borderRadius: Radius.print, borderWidth: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { width: '31.8%', aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  input: { fontFamily: Fonts.sans, fontSize: 16, minHeight: 48, paddingHorizontal: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  footer: { gap: Spacing.two, paddingTop: Spacing.two },
});
