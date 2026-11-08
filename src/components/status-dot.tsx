import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** The safelight: a small red dot that breathes while something is developing. */
export function StatusDot({ live = false, size = 6 }: { live?: boolean; size?: number }) {
  const theme = useTheme();
  const glow = useSharedValue(1);

  useEffect(() => {
    if (live) glow.value = withRepeat(withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    else {
      cancelAnimation(glow);
      glow.value = 1;
    }
  }, [live, glow]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: theme.accent }, style]} />
    </View>
  );
}
