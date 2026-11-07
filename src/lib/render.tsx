/** Native image output: blending a frame at its chosen strength and drawing the contact sheet. */

import { drawAsImage, Group, Image as SkiaImage, ImageFormat, Rect, Skia, Text as SkiaText, type SkFont, type SkImage } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';

import { newMediaFile } from '@/lib/files';
import { makeThumbnail } from '@/lib/image-io';
import { SHEET, sheetSize } from '@/lib/sheet';
import type { Frame, MediaRef } from '@/store/app-store';

const PAPER = '#FFFFFF';
const INK = '#141A6B';

async function fileUri(source: MediaRef): Promise<string> {
  if (typeof source === 'string') return source;
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

async function loadImage(source: MediaRef): Promise<SkImage> {
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(await fileUri(source)));
  if (!image) throw new Error('Could not decode image');
  return image;
}

function writeJpeg(image: SkImage, file: File): string {
  const base64 = image.encodeToBase64(ImageFormat.JPEG, 94);
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

export type SheetOptions = { frames: Frame[]; title: string; subtitle: string; font: SkFont | null };

/** One image of the whole roll, like a contact sheet from the lab. */
export async function renderContactSheet({ frames, title, subtitle, font }: SheetOptions): Promise<string> {
  const { width, height, cellHeight } = sheetSize(frames.length);
  // Decode one at a time: a whole roll at once is a memory spike on older phones.
  const images: { top: SkImage; base: SkImage | null; strength: number }[] = [];
  for (const frame of frames) {
    images.push({
      top: await loadImage(frame.thumbUri ?? frame.resultUri ?? frame.sourceUri),
      // Small copies only: a dozen full-size originals at once would run an older phone out of memory.
      base: frame.strength < 0.995 ? await loadImage(await makeThumbnail(await fileUri(frame.sourceUri), `sheet-base-${frame.id}`, 720)) : null,
      strength: frame.strength,
    });
  }
  const element = (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
      {font ? <SkiaText x={SHEET.margin} y={84} text={title} font={font} color={INK} /> : null}
      {font ? <SkiaText x={SHEET.margin} y={128} text={subtitle} font={font} color={INK} opacity={0.65} /> : null}
      {images.map(({ top, base, strength }, index) => {
        const x = SHEET.margin + (index % SHEET.columns) * (SHEET.cell + SHEET.gap);
        const y = SHEET.header + Math.floor(index / SHEET.columns) * (cellHeight + SHEET.label + SHEET.gap);
        return (
          <Group key={index}>
            {base ? <SkiaImage image={base} x={x} y={y} width={SHEET.cell} height={cellHeight} fit="cover" /> : null}
            <Group opacity={base ? strength : 1}>
              <SkiaImage image={top} x={x} y={y} width={SHEET.cell} height={cellHeight} fit="cover" />
            </Group>
            {font ? <SkiaText x={x} y={y + cellHeight + 42} text={String(index + 1)} font={font} color={INK} /> : null}
          </Group>
        );
      })}
    </Group>
  );
  const out = await drawAsImage(element, { width, height });
  if (!out) throw new Error('Render failed');
  return writeJpeg(out, newMediaFile(`exposure-sheet-${Date.now()}`));
}
