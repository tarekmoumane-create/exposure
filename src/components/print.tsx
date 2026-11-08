import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { type ImageSourcePropType, StyleSheet, View, type ViewStyle } from 'react-native';

import { PrintWhite, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type MediaRef } from '@/store/app-store';

type Props = {
  source?: MediaRef | ImageSourcePropType;
  /** Degrees. A little tilt makes a stack feel handled. */
  rotate?: number;
  aspectRatio?: number;
  /** Paper border width. */
  border?: number;
  style?: ViewStyle;
  /** Replaces the image, e.g. a blurred or comparing photo. */
  children?: ReactNode;
};

/** A photograph as a physical print: paper border, soft shadow, an optional tilt. */
export function Print({ source, rotate = 0, aspectRatio = 4 / 5, border = 6, style, children }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.paper, { padding: border, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[styles.photo, { aspectRatio, backgroundColor: theme.surfaceRaised }]}>
        {children ?? <Image source={source as ImageSourcePropType} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
      </View>
    </View>
  );
}

/** Three prints fanned out, the middle one on top. */
export function PrintFan({ sources, width, style }: { sources: (MediaRef | ImageSourcePropType | undefined)[]; width: number; style?: ViewStyle }) {
  const [left, middle, right] = sources;
  const w = width * 0.44;
  return (
    <View style={[{ width, height: w * 1.32 }, styles.fan, style]}>
      <Print source={left} rotate={-9} border={4} style={{ ...styles.fanItem, width: w, left: width * 0.04, top: w * 0.1 }} />
      <Print source={right} rotate={8} border={4} style={{ ...styles.fanItem, width: w, right: width * 0.04, top: w * 0.1 }} />
      <Print source={middle} rotate={-1} border={5} style={{ ...styles.fanItem, width: w * 1.04, left: (width - w * 1.04) / 2, top: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: PrintWhite, borderRadius: Radius.print + 1, boxShadow: Shadow.print },
  photo: { width: '100%', borderRadius: 1, overflow: 'hidden' },
  fan: { position: 'relative' },
  fanItem: { position: 'absolute' },
});
