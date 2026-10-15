import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  RadialGradient,
  Rect,
  Turbulence,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { type ImageSourcePropType, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { GRAYSCALE } from '@/filters/matrix';
import { type FilterConfig, resolveFilter } from '@/filters/presets';
import { useTheme } from '@/hooks/use-theme';

export type FilteredImageSource = string | ImageSourcePropType;

type Props = {
  source: FilteredImageSource;
  config: FilterConfig;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

function toSkiaSource(source: FilteredImageSource) {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  return source.uri ?? null;
}

/**
 * Renders an image with the filter config applied on the GPU (Skia).
 * Grain is a desaturated turbulence layer blended as overlay, vignette a radial gradient.
 */
export function FilteredImage({ source, config, width, height, style }: Props) {
  const theme = useTheme();
  const image = useImage(toSkiaSource(source));
  const { matrix, grain, vignette } = resolveFilter(config);

  return (
    <View style={[{ width, height, backgroundColor: theme.surfaceRaised }, styles.clip, style]}>
      <Canvas style={{ width, height }}>
        {image ? (
          <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover">
            <ColorMatrix matrix={matrix} />
          </SkiaImage>
        ) : null}
        {grain > 0.01 ? (
          <Rect x={0} y={0} width={width} height={height} opacity={grain * 0.32} blendMode="overlay">
            <Turbulence freqX={1.1} freqY={1.1} octaves={2} seed={4} />
            <ColorMatrix matrix={GRAYSCALE} />
          </Rect>
        ) : null}
        {vignette > 0.01 ? (
          <Rect x={0} y={0} width={width} height={height} opacity={vignette}>
            <RadialGradient
              c={vec(width / 2, height / 2)}
              r={Math.max(width, height) * 0.78}
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
              positions={[0, 0.42, 1]}
            />
          </Rect>
        ) : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
