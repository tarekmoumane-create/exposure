import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaywallPanel } from '@/components/paywall-panel';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  rollId?: string;
  onClose: () => void;
  onDone: () => void;
};

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;

/**
 * The plans as a sheet that rises over a locked roll, so the blurred frame stays in view above it.
 * Swipe it down, tap above it, or choose Not now to close.
 */
export function UnlockSheet({ visible, rollId, onClose, onDone }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Stays mounted for the closing animation after `visible` turns false, then unmounts.
  const [lingering, setLingering] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setLingering(true);
  }
  const mounted = visible || lingering;
  const offset = useSharedValue(height);
  const shade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      offset.set(withSpring(0, { damping: 22, stiffness: 190, mass: 0.9 }));
      shade.set(withTiming(1, { duration: 260 }));
      return;
    }
    offset.set(withTiming(height, { duration: 240, easing: Easing.in(Easing.cubic) }));
    shade.set(withTiming(0, { duration: 240 }));
    const timer = setTimeout(() => setLingering(false), 260);
    return () => clearTimeout(timer);
  }, [visible, height, offset, shade]);

  const drag = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(8)
    .onUpdate((event) => {
      offset.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) onClose();
      else offset.set(withSpring(0, { damping: 22, stiffness: 220 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.get() }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close plans" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <GestureDetector gesture={drag}>
        <Animated.View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 8 }, sheetStyle]}>
          <View style={[styles.handle, { backgroundColor: theme.line }]} />
          <PaywallPanel rollId={rollId} compact onDone={onDone} onClose={onClose} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { backgroundColor: 'rgba(43,31,38,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto',
    paddingHorizontal: Gutter,
    paddingTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    boxShadow: '0px -10px 40px rgba(120,60,90,0.18)',
  },
  handle: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 16 },
});
