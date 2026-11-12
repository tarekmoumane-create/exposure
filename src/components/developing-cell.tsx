import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { StatusDot } from '@/components/status-dot';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MediaRef } from '@/store/app-store';

type Props = {
  source: MediaRef;
  status: 'waiting' | 'developing';
  /** The look's soft colour, for the band of light. */
  tint?: string;
};

/**
 * A photo that is not ready yet: the original, blurred and dimmed. While it develops a band of
 * light sweeps over it; while it waits its turn it just sits grey.
 */
export function DevelopingCell({ source, status, tint }: Props) {
  const theme = useTheme();
  const sweep = useSharedValue(0);
  const developing = status === 'developing';

  useEffect(() => {
    if (developing) {
      sweep.value = 0;
      sweep.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(sweep);
    }
    return () => cancelAnimation(sweep);
  }, [developing, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -80 + sweep.value * 260 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={developing ? 6 : 12} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: developing ? 'rgba(255,246,242,0.28)' : 'rgba(255,246,242,0.55)' }]} />
      {developing ? (
        <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
          <LinearGradient colors={['transparent', `${tint ?? '#FFFFFF'}B3`, 'transparent']} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <View style={styles.foot}>
        <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
          {developing ? <StatusDot live /> : null}
          <ThemedText type="tiny" style={{ color: developing ? theme.accent : theme.textSecondary }}>
            {developing ? 'Developing' : 'Up next'}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sweep: { position: 'absolute', left: -20, right: -20, top: 0, height: 90 },
  foot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 9, borderRadius: 999 },
});
