import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * The mark: a frame with the sun rising behind it. Drawn rather than bitmapped so it stays crisp
 * at every size. The sun shows above the frame and is cut out of it below.
 */
export function LogoMark({ size = 20, color, sun }: { size?: number; color?: string; sun?: string }) {
  const theme = useTheme();
  const ink = color ?? theme.text;
  const red = sun ?? theme.accent;
  const frameTop = size * 0.3;
  const sunSize = size * 0.56;
  const sunLeft = size * 0.38;
  const sunTop = size * 0.04;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.abs, { top: sunTop, left: sunLeft, width: sunSize, height: sunSize, borderRadius: sunSize / 2, backgroundColor: red }]} />
      <View style={[styles.abs, styles.clip, { top: frameTop, left: 0, width: size, height: size * 0.66, borderRadius: size * 0.08, backgroundColor: ink }]}>
        <View style={[styles.abs, { top: sunTop - frameTop, left: sunLeft, width: sunSize, height: sunSize, borderRadius: sunSize / 2, backgroundColor: theme.background }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
});
