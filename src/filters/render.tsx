import {
  ColorMatrix,
  drawAsImage,
  Group,
  Image as SkiaImage,
  ImageFormat,
  RadialGradient,
  Rect,
  Skia,
  Text as SkiaText,
  Turbulence,
  vec,
  type SkFont,
  type SkImage,
} from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { type ImageSourcePropType } from 'react-native';

import { GRAYSCALE } from '@/filters/matrix';
import { newMediaFile } from '@/lib/files';
import { type FilterConfig, resolveFilter } from '@/filters/presets';

export type RenderSource = string | ImageSourcePropType;

async function loadImage(source: RenderSource): Promise<SkImage> {
  let uri: string;
  if (typeof source === 'string') uri = source;
  else if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    uri = asset.localUri ?? asset.uri;
  } else if (Array.isArray(source)) uri = source[0]?.uri ?? '';
  else uri = source.uri ?? '';
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not decode image');
  return image;
}

function writeJpeg(image: SkImage, file: File): string {
  const base64 = image.encodeToBase64(ImageFormat.JPEG, 92);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

function Layer({ image, config, x, y, width, height }: { image: SkImage; config: FilterConfig; x: number; y: number; width: number; height: number }) {
  const { matrix, grain, vignette } = resolveFilter(config);
  return (
    <Group>
      <SkiaImage image={image} x={x} y={y} width={width} height={height} fit="cover">
        <ColorMatrix matrix={matrix} />
      </SkiaImage>
      {grain > 0.01 ? (
        <Rect x={x} y={y} width={width} height={height} opacity={grain * 0.32} blendMode="overlay">
          <Turbulence freqX={0.6} freqY={0.6} octaves={2} seed={4} />
          <ColorMatrix matrix={GRAYSCALE} />
        </Rect>
      ) : null}
      {vignette > 0.01 ? (
        <Rect x={x} y={y} width={width} height={height} opacity={vignette}>
          <RadialGradient
            c={vec(x + width / 2, y + height / 2)}
            r={Math.max(width, height) * 0.78}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            positions={[0, 0.42, 1]}
          />
        </Rect>
      ) : null}
    </Group>
  );
}

export type RenderOptions = {
  maxSize?: number;
  /** When set, `source` is drawn over this image at `blend` opacity (the look strength slider). */
  base?: RenderSource;
  blend?: number;
};

/** Renders a filtered photo to a JPEG in the cache directory and returns its file uri. */
export async function renderFilteredImage(source: RenderSource, config: FilterConfig, options: RenderOptions = {}): Promise<string> {
  const { maxSize = 2048, base, blend = 1 } = options;
  const image = await loadImage(source);
  const baseImage = base && blend < 0.995 ? await loadImage(base) : null;
  const scale = Math.min(1, maxSize / Math.max(image.width(), image.height()));
  const width = Math.round(image.width() * scale);
  const height = Math.round(image.height() * scale);
  const element = (
    <Group>
      {baseImage ? <Layer image={baseImage} config={config} x={0} y={0} width={width} height={height} /> : null}
      <Group opacity={baseImage ? blend : 1}>
        <Layer image={image} config={config} x={0} y={0} width={width} height={height} />
      </Group>
    </Group>
  );
  const out = await drawAsImage(element, { width, height });
  if (!out) throw new Error('Render failed');
  // Exports are transient (save/share reads them right away), so one cache file is reused.
  return writeJpeg(out, new File(Paths.cache, 'exposure-export.jpg'));
}

export type StripOptions = {
  frames: RenderSource[];
  config: FilterConfig;
  paper: 'white' | 'black';
  stamp: string | null;
  font: SkFont | null;
};

export const STRIP_WIDTH = 720;
export const STRIP_TILE_HEIGHT = 820;
export const STRIP_MARGIN = 28;
export const STRIP_GAP = 20;
export const STRIP_FOOTER = 120;

export function stripHeight(count: number): number {
  return STRIP_MARGIN * 2 + count * STRIP_TILE_HEIGHT + (count - 1) * STRIP_GAP + STRIP_FOOTER;
}

/** Composes a vertical photobooth strip and returns its file uri. */
export async function renderStrip({ frames, config, paper, stamp, font }: StripOptions): Promise<string> {
  // Decode one at a time: four full-size camera frames at once is a memory spike on older phones.
  const images: SkImage[] = [];
  for (const frame of frames) images.push(await loadImage(frame));
  const width = STRIP_WIDTH;
  const height = stripHeight(images.length);
  const tileWidth = width - STRIP_MARGIN * 2;
  const paperColor = paper === 'white' ? '#F7F2EA' : '#141214';
  const inkColor = paper === 'white' ? '#2B2226' : '#EDE6DC';
  const element = (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color={paperColor} />
      {images.map((image, index) => (
        <Layer
          key={index}
          image={image}
          config={config}
          x={STRIP_MARGIN}
          y={STRIP_MARGIN + index * (STRIP_TILE_HEIGHT + STRIP_GAP)}
          width={tileWidth}
          height={STRIP_TILE_HEIGHT}
        />
      ))}
      {stamp && font ? (
        <SkiaText x={STRIP_MARGIN + 4} y={height - STRIP_FOOTER / 2 + 10} text={stamp} font={font} color={inkColor} />
      ) : null}
    </Group>
  );
  const out = await drawAsImage(element, { width, height });
  if (!out) throw new Error('Render failed');
  return writeJpeg(out, newMediaFile(`exposure-strip-${Date.now()}`));
}
