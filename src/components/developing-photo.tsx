import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { type MediaRef } from '@/store/app-store';

type Props = {
  source: MediaRef | undefined;
  /** How much of the photo has come through, top down, from 0 to 1. Changes animate. */
  amount: number;
};

/** A print still developing: the photo drops down from the top, and what hasn't arrived stays fogged. */
export function DevelopingPhoto({ source, amount }: Props) {
  const theme = useTheme();
  const [height, setHeight] = useState(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(amount, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [amount, shown]);

  const clip = useAnimatedStyle(() => ({ height: shown.value * height }));

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}>
      <Image source={source} style={styles.fog} contentFit="cover" blurRadius={40} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />
      {height > 0 ? (
        <Animated.View style={[styles.clip, { borderBottomColor: theme.onPhoto }, clip]}>
          <Image source={source} style={{ position: 'absolute', top: 0, left: 0, right: 0, height }} contentFit="cover" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fog: { width: '100%', height: '100%', transform: [{ scale: 1.2 }] },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
});
