import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { type Look, lookNumber } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** A look in the catalogue: its photo, then its number, name and spec underneath, never on the photo. */
export function LookTile({ look, style, onPress }: { look: Look; style?: ViewStyle; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${look.name}. ${look.spec}. ${look.bestFor}.`}
      onPress={onPress ?? (() => router.push({ pathname: '/stock/[id]', params: { id: look.id } }))}
      style={({ pressed }) => [styles.root, style, { opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.photo, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
      <View style={styles.text}>
        <ThemedText type="monoSmall" themeColor="textTertiary">
          {lookNumber(look)}
        </ThemedText>
        <ThemedText type="label" numberOfLines={1}>
          {look.name}
        </ThemedText>
        <ThemedText type="monoSmall" themeColor="textSecondary" numberOfLines={1}>
          {look.spec}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.print, overflow: 'hidden' },
  text: { gap: 3 },
});
