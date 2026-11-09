import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import { type ImageSourcePropType, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type MediaRef } from '@/store/app-store';

type Source = MediaRef | ImageSourcePropType | undefined;

type Props = {
  before: Source;
  after: Source;
  /** How much of the look shows over the original, 0 to 1. */
  strength?: number;
  /** Width over height. Ignored when style sets a height or flex. */
  aspectRatio?: number;
  style?: ViewStyle;
  /** Where the photo sits in its box: cover crops to fill, contain shows it whole. */
  fit?: 'cover' | 'contain';
  /** The switch can be hidden when the screen offers its own. */
  showSwitch?: boolean;
  accessibilityLabel?: string;
};

/**
 * A photograph with a Before / After switch on it. Tap the switch, or press and hold the photo,
 * to see the original.
 */
export function ComparePhoto({ before, after, strength = 1, aspectRatio = 4 / 5, style, fit = 'cover', showSwitch = true, accessibilityLabel }: Props) {
  const theme = useTheme();
  const [pinned, setPinned] = useState<'before' | 'after'>('after');
  const [holding, setHolding] = useState(false);
  const showingBefore = holding || pinned === 'before';

  const choose = (side: 'before' | 'after') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setPinned(side);
  };

  return (
    <View style={[styles.root, { aspectRatio, backgroundColor: theme.surfaceRaised }, style]}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel ?? 'Photo. Press and hold to see the original.'}
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        style={StyleSheet.absoluteFill}>
        <Image source={before as ImageSourcePropType} style={StyleSheet.absoluteFill} contentFit={fit} />
        <Image source={after as ImageSourcePropType} style={[StyleSheet.absoluteFill, { opacity: showingBefore ? 0 : strength }]} contentFit={fit} transition={160} />
      </Pressable>
      {showSwitch ? (
        <View style={styles.switchWrap} pointerEvents="box-none">
          <BeforeAfterSwitch showingBefore={showingBefore} onChange={choose} />
        </View>
      ) : null}
    </View>
  );
}

/** The Before / After pill. Sits on a photo, so it carries its own paper ground. */
export function BeforeAfterSwitch({ showingBefore, onChange }: { showingBefore: boolean; onChange: (side: 'before' | 'after') => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.switch, { backgroundColor: 'rgba(255,255,255,0.94)' }]} accessibilityRole="radiogroup">
      {(['before', 'after'] as const).map((side) => {
        const active = side === 'before' ? showingBefore : !showingBefore;
        return (
          <Pressable
            key={side}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={side === 'before' ? 'Show the original' : 'Show the look'}
            hitSlop={6}
            onPress={() => onChange(side)}
            style={[styles.segment, active && { backgroundColor: theme.text }]}>
            <ThemedText type="tiny" style={{ color: active ? theme.onBrand : theme.textSecondary }}>
              {side === 'before' ? 'Before' : 'After'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', borderRadius: Radius.print, overflow: 'hidden' },
  switchWrap: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  switch: { flexDirection: 'row', padding: 3, borderRadius: Radius.pill, gap: 2 },
  segment: { minWidth: 64, height: 28, paddingHorizontal: 12, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
