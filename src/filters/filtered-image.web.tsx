import { Asset } from 'expo-asset';
import { createElement, useId } from 'react';
import { type ImageSourcePropType, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { toSvgValues } from '@/filters/matrix';
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

export function resolveWebUri(source: FilteredImageSource): string {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return Asset.fromModule(source).uri;
  if (Array.isArray(source)) return source[0]?.uri ?? '';
  return source.uri ?? '';
}

/** Web twin of the Skia component: an SVG color matrix filter plus noise and a radial vignette. */
export function FilteredImage({ source, config, width, height, style }: Props) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { matrix, grain, vignette } = resolveFilter(config);
  const uri = resolveWebUri(source);

  const svg = createElement(
    'svg',
    { width: 0, height: 0, style: { position: 'absolute' }, 'aria-hidden': true },
    createElement(
      'filter',
      { id: `cm-${id}`, colorInterpolationFilters: 'sRGB' },
      createElement('feColorMatrix', { type: 'matrix', values: toSvgValues(matrix) })
    )
  );

  const img = createElement('img', {
    src: uri,
    alt: '',
    draggable: false,
    style: { width, height, objectFit: 'cover', display: 'block', filter: `url(#cm-${id})` },
  });

  const noise =
    grain > 0.01
      ? createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            opacity: grain * 0.45,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: '160px 160px',
            pointerEvents: 'none',
          },
        })
      : null;

  const shade =
    vignette > 0.01
      ? createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            opacity: vignette,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          },
        })
      : null;

  return (
    <View style={[{ width, height, backgroundColor: theme.surfaceRaised }, styles.clip, style]}>
      {svg}
      {img}
      {noise}
      {shade}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
