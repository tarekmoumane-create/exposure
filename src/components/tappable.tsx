import * as Haptics from 'expo-haptics';
import { type PropsWithChildren } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PropsWithChildren<Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number }>;

/** A pressable that gives under the finger with a spring, like a native card. */
export function Tappable({ children, style, haptic = true, scaleTo = 0.96, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, { damping: 18, stiffness: 420 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
