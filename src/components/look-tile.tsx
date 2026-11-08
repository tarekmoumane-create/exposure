import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { type Look, lookNumber } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** A look in the catalogue, like a film box: its colour, its photo, then its number, name and spec. */
export function LookTile({ look, style, onPress, compact = false }: { look: Look; style?: ViewStyle; onPress?: () => void; compact?: boolean }) {
  const theme = useTheme();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${look.name}. ${look.spec}. ${look.bestFor}.`}
      onPress={onPress ?? (() => router.push({ pathname: '/stock/[id]', params: { id: look.id } }))}
      style={[styles.root, { backgroundColor: look.tint }, style]}>
      <View style={[styles.photo, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
      <View style={styles.text}>
        <ThemedText type="monoSmall" style={[styles.soft, { color: look.deep }]}>
          {lookNumber(look)}
        </ThemedText>
        <ThemedText type="bodyStrong" numberOfLines={1} style={{ color: look.deep }}>
          {look.name}
        </ThemedText>
        {compact ? null : (
          <ThemedText type="monoSmall" numberOfLines={1} style={[styles.soft, { color: look.deep }]}>
            {look.spec}
          </ThemedText>
        )}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: Radius.lg, padding: 7, paddingBottom: 12, gap: 10 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 15, overflow: 'hidden' },
  text: { gap: 2, paddingHorizontal: 7 },
  soft: { opacity: 0.72 },
});
