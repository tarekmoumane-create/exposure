import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { type Look } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** A look in the catalogue: its photo on its colour, with its name and a line about the vibe. */
export function LookTile({ look, style, onPress, compact = false }: { look: Look; style?: ViewStyle; onPress?: () => void; compact?: boolean }) {
  const theme = useTheme();
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${look.name}. ${look.tagline} ${look.bestFor}.`}
      onPress={onPress ?? (() => router.push({ pathname: '/stock/[id]', params: { id: look.id } }))}
      style={[styles.root, { backgroundColor: look.tint }, style]}>
      <View style={[styles.photo, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
      <View style={styles.text}>
        <ThemedText type="bodyStrong" numberOfLines={1} style={{ color: look.deep }}>
          {look.name}
        </ThemedText>
        {compact ? null : (
          <ThemedText type="caption" numberOfLines={1} style={[styles.soft, { color: look.deep }]}>
            {look.bestFor}
          </ThemedText>
        )}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: Radius.lg, padding: 7, paddingBottom: 13, gap: 10 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.lg - 7, overflow: 'hidden' },
  text: { gap: 2, paddingHorizontal: 8 },
  soft: { opacity: 0.78 },
});
