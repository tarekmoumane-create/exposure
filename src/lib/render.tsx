/** Native image output: blending a frame at its chosen strength. */

import { drawAsImage, Group, Image as SkiaImage, ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';

import type { Frame, MediaRef } from '@/store/app-store';

async function fileUri(source: MediaRef): Promise<string> {
  if (typeof source === 'string') return source;
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

function shortName(uri: string): string {
  return uri.split('/').pop()?.split('?')[0] ?? uri;
}

/** Decodes a photo for Skia. Reads the bytes through the file system, which copes with any local uri. */
async function loadImage(source: MediaRef): Promise<SkImage> {
  const uri = await fileUri(source);
  let data;
  try {
    const file = new File(uri);
    if (!file.exists) throw new Error(`${shortName(uri)} is missing`);
    data = Skia.Data.fromBase64(await file.base64());
  } catch (error) {
    // Bundled assets and anything the File API refuses go through Skia's own loader.
    if (error instanceof Error && error.message.endsWith('is missing')) throw error;
    data = await Skia.Data.fromURI(uri);
  }
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`${shortName(uri)} could not be decoded`);
  return image;
}

function writeJpeg(image: SkImage, file: File): string {
  const base64 = image.encodeToBase64(ImageFormat.JPEG, 94);
  if (!base64) throw new Error('the image could not be encoded');
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** The frame as the user set it: the developed result over the original at its strength. */
export async function blendFrame(frame: Frame): Promise<string> {
  const result = frame.resultUri;
  if (!result) throw new Error('Frame is not developed');
  if (frame.strength >= 0.995) return fileUri(result);
  const [top, base] = [await loadImage(result), await loadImage(frame.sourceUri)];
  const width = top.width();
  const height = top.height();
  const out = await drawAsImage(
    <Group>
      <SkiaImage image={base} x={0} y={0} width={width} height={height} fit="cover" />
      <Group opacity={frame.strength}>
        <SkiaImage image={top} x={0} y={0} width={width} height={height} fit="cover" />
      </Group>
    </Group>,
    { width, height }
  );
  if (!out) throw new Error('Render failed');
  return writeJpeg(out, new File(Paths.cache, `exposure-frame-${frame.id}.jpg`));
}
