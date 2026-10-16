import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Radius, Spacing } from '@/constants/theme';
import { getLook, LOOK_GROUPS } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { useAppStore } from '@/store/app-store';

export default function LookScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const look = getLook(id);
  const { credits, unlocked } = useAppStore();
  const [showBefore, setShowBefore] = useState(false);

  if (!look) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Look not found" message="That look is no longer in the library." />
      </Screen>
    );
  }

  const groupLabel = LOOK_GROUPS.find((group) => group.id === look.group)?.label ?? '';

  const startWith = (uri: string) => {
    // Unpaid users go straight to the preview (nothing is generated before the paywall).
          if (unlocked && credits <= 0) {
      router.push('/out-of-credits');
      return;
    }
    router.push({ pathname: '/process', params: { lookId: look.id, uri } });
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) startWith(persistTemporary(uri));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.show('Camera is off. Pick from your library instead.');
      return pickFromLibrary();
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, cameraType: ImagePicker.CameraType.front });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) startWith(persistTemporary(uri));
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: look.name }} />

      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Hold to see the original"
        onPressIn={() => setShowBefore(true)}
        onPressOut={() => setShowBefore(false)}
        style={[styles.hero, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <Image source={look.before} style={[StyleSheet.absoluteFill, { opacity: showBefore ? 1 : 0 }]} contentFit="cover" transition={120} />
        <View style={[styles.hintPill, { backgroundColor: 'rgba(30,20,25,0.55)' }]} pointerEvents="none">
          <ThemedText type="label" style={{ color: theme.surface }}>
            {showBefore ? 'Before' : 'Hold to see before'}
          </ThemedText>
        </View>
      </Pressable>

      <View style={styles.body}>
        <ThemedText type="label" style={{ color: theme.accent }}>
          {groupLabel}
        </ThemedText>
        <ThemedText type="title">{look.name}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {look.tagline}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          {look.description}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button title="Take a photo" onPress={takePhoto} />
        <Button title="Choose from camera roll" variant="secondary" onPress={pickFromLibrary} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.footnote}>
          {credits > 0 ? `1 photo · about 30 seconds · ${credits} left` : 'No photos left today'}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 4 / 5, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.two, justifyContent: 'flex-end' },
  hintPill: { margin: Spacing.three, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.pill },
  body: { gap: Spacing.one, paddingTop: Spacing.four },
  description: { paddingTop: Spacing.two },
  actions: { gap: Spacing.two, paddingTop: Spacing.four },
  footnote: { textAlign: 'center' },
});
