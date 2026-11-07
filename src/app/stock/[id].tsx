import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SliderRow } from '@/components/slider-row';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getLook } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

export default function StockScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const look = getLook(id);
  const [showBefore, setShowBefore] = useState(false);
  const [strength, setStrength] = useState(1);

  if (!look) {
    return (
      <Screen scroll={false}>
        <EmptyState title="Look not found" message="This look is no longer available. Choose another from the Looks tab." />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: look.name }} />
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Hold to see the original"
        onPressIn={() => setShowBefore(true)}
        onPressOut={() => setShowBefore(false)}
        style={[styles.hero, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={look.before} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Image source={look.after} style={[StyleSheet.absoluteFill, { opacity: showBefore ? 0 : strength }]} contentFit="cover" />
        <View style={[styles.hint, { backgroundColor: theme.scrim }]} pointerEvents="none">
          <ThemedText type="caption" themeColor="onPhoto">
            {showBefore ? 'Original' : 'Hold to see the original'}
          </ThemedText>
        </View>
      </Pressable>

      <View style={styles.meter}>
        <SliderRow label="Strength" value={strength} onChange={setStrength} />
        <ThemedText type="small" themeColor="textSecondary">
          Slide to see the range. You can set this for your whole roll, or for one frame, after it develops.
        </ThemedText>
      </View>

      <View style={styles.body}>
        <ThemedText type="title">{look.name}</ThemedText>
        <ThemedText type="bodyStrong">{look.tagline}</ThemedText>
        <ThemedText themeColor="textSecondary">{look.description}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {look.bestFor}
        </ThemedText>
      </View>

      <Button title="Start a roll in this look" onPress={() => router.push({ pathname: '/new-roll', params: { lookId: look.id } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden', marginTop: Spacing.two, justifyContent: 'flex-end' },
  hint: { margin: Spacing.three, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: Radius.sm },
  meter: { gap: Spacing.one, paddingTop: Spacing.three },
  body: { gap: Spacing.one, paddingVertical: Spacing.four },
});
