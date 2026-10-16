import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';
import { persistTemporary } from '@/lib/media';
import { useAppStore } from '@/store/app-store';

const SLIDES = [
  { lookId: 'golden-hour', title: 'One photo.\nEvery light.', line: 'Pick a look and the light changes. Not you.' },
  { lookId: 'night-flash', title: 'The flash you\nwish you had.', line: 'Digicam, night flash, red flash. In seconds.' },
  { lookId: 'booth-strip', title: 'Same face.\nSame outfit.', line: 'Every look keeps your photo exactly as it is. Only the light and the camera change.' },
  { lookId: 'gold-200', title: 'Try it on\nyour photo.', line: 'Pick any photo and see it shot on a real camera.' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  const { setOnboarded } = useAppStore();
  const slide = SLIDES[page];
  const look = getLook(slide.lookId);
  const photoHeight = Math.max(240, stageHeight - 150);

  const last = page === SLIDES.length - 1;

  const advance = () => {
    if (!last) setPage(page + 1);
  };

  /** First photo: straight into picking a look. The paywall shows right before the reveal. */
  const startWith = (uri: string) => {
    setOnboarded();
    router.replace('/');
    setTimeout(() => router.push({ pathname: '/choose-look', params: { uri, first: '1' } }), 250);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) startWith(persistTemporary(uri));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return pickFromLibrary();
    const result = await ImagePicker.launchCameraAsync({ quality: 1, cameraType: ImagePicker.CameraType.front });
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) startWith(persistTemporary(uri));
  };

  const skip = () => {
    setOnboarded();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Wordmark />
      </View>

      <View style={styles.stage} onLayout={(event) => setStageHeight(Math.round(event.nativeEvent.layout.height))}>
        {stageHeight > 0 ? (
          <Animated.View key={slide.lookId} entering={FadeIn.duration(320)} exiting={FadeOut.duration(200)} style={styles.slide}>
            <View style={[styles.photo, { backgroundColor: theme.surfaceRaised, height: photoHeight }]}>
              {look ? <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {look ? (
                <View style={styles.beforeClip} pointerEvents="none">
                  <Image source={look.before} style={styles.beforeImage} contentFit="cover" />
                </View>
              ) : null}
              <View style={[styles.split, { backgroundColor: theme.onPhoto }]} pointerEvents="none" />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={styles.fade} pointerEvents="none" />
              <View style={styles.labels} pointerEvents="none">
                <ThemedText type="photoLabel" themeColor="onPhoto">Before</ThemedText>
                <ThemedText type="photoLabel" themeColor="onPhoto">After</ThemedText>
              </View>
            </View>
            <View style={styles.copy}>
              <ThemedText type="title" style={styles.center}>
                {slide.title}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
                {slide.line}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((item, index) => (
            <Pressable
              key={item.lookId}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${index + 1}`}
              hitSlop={8}
              onPress={() => setPage(index)}
              style={[styles.dot, { backgroundColor: index === page ? theme.text : theme.line, width: index === page ? 18 : 6 }]}
            />
          ))}
        </View>
        {last ? (
          <View style={styles.ctaStack}>
            <Button title="Choose a photo" onPress={pickFromLibrary} />
            <Button title="Take a photo" variant="secondary" onPress={takePhoto} />
            <Button title="Not now" variant="ghost" size="md" onPress={skip} />
          </View>
        ) : (
          <Button title="Continue" onPress={advance} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: Spacing.three },
  stage: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  slide: { position: 'absolute', left: Spacing.four, right: Spacing.four, top: 0, bottom: 0, gap: Spacing.four },
  photo: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden' },
  beforeClip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', overflow: 'hidden' },
  beforeImage: { width: '200%', height: '100%' },
  split: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, opacity: 0.9 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%' },
  labels: { position: 'absolute', left: 0, right: 0, bottom: 14, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  copy: { gap: Spacing.two, alignItems: 'center' },
  center: { textAlign: 'center' },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.four },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  ctaStack: { gap: Spacing.two },
  dot: { height: 6, borderRadius: 3 },
});
