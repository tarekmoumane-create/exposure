import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Colors, Glow as GlowColors } from '@/constants/theme';

/**
 * Warm light falling onto the page from the top. Pass a look's tint to colour it by camera.
 * Sits behind content; it never takes touches.
 */
export function Glow({ tint, height = 460, style }: { tint?: string; height?: number; style?: ViewStyle }) {
  const colors = tint ? ([tint, `${tint}99`, Colors.light.background] as const) : GlowColors;
  return <LinearGradient pointerEvents="none" colors={colors} locations={[0, 0.45, 1]} style={[styles.glow, { height }, style]} />;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
});
