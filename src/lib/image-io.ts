/** Reading and writing image bytes on native. */

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

import { newMediaFile } from '@/lib/files';

export type EncodedImage = { mimeType: string; data: string; width?: number; height?: number };

export type PreparedUpload = EncodedImage & {
  /** The normalised JPEG that was actually sent; keep it as the shot's source. */
  uri: string;
  width: number;
  height: number;
};

export class ImageReadError extends Error {}

function getSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}

/**
 * Downscales to `maxEdge`, bakes in EXIF orientation and re-encodes as JPEG, so uploads stay
 * small and consistent and the editor never has to decode a 48 MP original.
 */
export async function prepareForUpload(uri: string, maxEdge = 1536, quality = 0.88): Promise<PreparedUpload> {
  try {
    const { width, height } = await getSize(uri);
    const context = ImageManipulator.manipulate(uri);
    const longest = Math.max(width, height);
    if (longest > maxEdge) {
      // Only pin the longest edge: the manipulator keeps the ratio and applies EXIF rotation itself.
      context.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    const data = await new File(saved.uri).base64();
    return { mimeType: 'image/jpeg', data, uri: saved.uri, width: saved.width, height: saved.height };
  } catch {
    throw new ImageReadError('This photo could not be read. Try another one.');
  }
}

/** Writes an encoded result to the gallery folder as a JPEG and returns its file uri. */
export async function persistEncoded({ mimeType, data }: EncodedImage, name: string): Promise<string> {
  const isJpeg = mimeType === 'image/jpeg';
  const file = newMediaFile(name, isJpeg ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp');
  if (file.exists) file.delete();
  file.create();
  file.write(data, { encoding: 'base64' });
  if (isJpeg) return file.uri;
  // PNG/WebP results are several times larger; store a JPEG and drop the original.
  try {
    const rendered = await ImageManipulator.manipulate(file.uri).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    const target = newMediaFile(name, 'jpg');
    if (target.exists) target.delete();
    new File(saved.uri).move(target);
    file.delete();
    return target.uri;
  } catch {
    return file.uri;
  }
}

/** Copies any local file into the gallery folder so it survives the session and OS cache sweeps. */
export function persistToGallery(uri: string, name: string): string {
  try {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const target = newMediaFile(name, ext.length <= 4 ? ext : 'jpg');
    if (target.exists) target.delete();
    new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** A small JPEG copy for grids and strips, so thumbnails never decode the full result. */
export async function makeThumbnail(uri: string, name: string, maxEdge = 480): Promise<string> {
  try {
    const { width, height } = await getSize(uri);
    const context = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > maxEdge) context.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    const target = newMediaFile(name, 'jpg');
    if (target.exists) target.delete();
    new File(saved.uri).move(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/**
 * Centre-crops `uri` to the aspect ratio of the original (width/height) when the model returned a
 * slightly different shape. Keeps the saved photo framed exactly like the one the user picked.
 */
export async function matchFraming(uri: string, width: number, height: number, tolerance = 0.012): Promise<string> {
  try {
    const target = width / height;
    const actual = await getSize(uri);
    const ratio = actual.width / actual.height;
    if (Math.abs(ratio - target) / target <= tolerance) return uri;
    const cropWidth = Math.min(actual.width, ratio > target ? Math.round(actual.height * target) : actual.width);
    const cropHeight = Math.min(actual.height, ratio > target ? actual.height : Math.round(actual.width / target));
    const crop = {
      originX: Math.max(0, Math.floor((actual.width - cropWidth) / 2)),
      originY: Math.max(0, Math.floor((actual.height - cropHeight) / 2)),
      width: cropWidth,
      height: cropHeight,
    };
    const rendered = await ImageManipulator.manipulate(uri).crop(crop).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
    const original = new File(uri);
    if (original.exists) original.delete();
    new File(saved.uri).move(original);
    return original.uri;
  } catch {
    return uri;
  }
}
