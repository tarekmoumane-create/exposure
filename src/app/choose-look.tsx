import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LookGrid } from '@/components/look-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/** After the booth: pick which look to apply to the captured photo. */
export default function ChooseLookScreen() {
  const theme = useTheme();
  const { uri, first } = useLocalSearchParams<{ uri: string; first?: string }>();
  const { credits } = useAppStore();

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerRight: () => <Button title="Cancel" variant="ghost" size="md" onPress={() => router.back()} /> }} />
      <View style={styles.preview}>
        <Image source={{ uri }} style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]} contentFit="cover" />
        <View style={styles.previewText}>
          <ThemedText type="subtitle">Your photo</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            Now pick the look it becomes.
          </ThemedText>
        </View>
      </View>
      <LookGrid
        onPressLook={(look) => {
          if (credits <= 0) {
            router.push('/out-of-credits');
            return;
          }
          router.replace({ pathname: '/process', params: { lookId: look.id, uri, ...(first ? { first } : {}) } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 56, height: 70, borderRadius: Radius.sm },
  previewText: { gap: 2, flex: 1 },
});
