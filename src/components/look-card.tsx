import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { type Look } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  look: Look;
  onPress: (look: Look) => void;
};

const BEFORE = 0.36;

/** Photo card with a thin vertical split: the original on the left, the look on the right. */
export function LookCard({ look, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${look.name}, ${look.tagline}`}
      onPress={() => onPress(look)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.9 : 1 }]}>
      <LinearGradient colors={look.colors} style={StyleSheet.absoluteFill} />
      <Image source={look.after} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[styles.beforeClip, { width: `${BEFORE * 100}%` }]} pointerEvents="none">
        <Image source={look.before} style={[styles.beforeImage, { width: `${(1 / BEFORE) * 100}%` }]} contentFit="cover" />
      </View>
      <View style={[styles.split, { left: `${BEFORE * 100}%`, backgroundColor: theme.onPhoto }]} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} style={styles.fade} pointerEvents="none" />
      <View style={styles.meta}>
        <ThemedText type="photoLabel" themeColor="onPhoto">
          {look.name}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, aspectRatio: 4 / 5, borderRadius: Radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  beforeClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  beforeImage: { height: '100%' },
  split: { position: 'absolute', top: 0, bottom: 0, width: 1.5, opacity: 0.9 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  meta: { padding: Spacing.three, paddingBottom: 14 },
});
