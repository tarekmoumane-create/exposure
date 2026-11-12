/** Web preview of lib/render.tsx: the same two outputs, drawn on a canvas. */

import { Image as RNImage } from 'react-native';

import type { Frame, MediaRef } from '@/store/app-store';

const resolve = (source: MediaRef): string => (typeof source === 'string' ? source : (RNImage.resolveAssetSource(source)?.uri ?? ''));

function load(source: MediaRef): Promise<HTMLImageElement> {
  return new Promise((done, fail) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => done(img);
    img.onerror = () => fail(new Error('Could not load image'));
    img.src = resolve(source);
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

export async function blendFrame(frame: Frame): Promise<string> {
  if (!frame.resultUri) throw new Error('Frame is not developed');
  const top = await load(frame.resultUri);
  const canvas = document.createElement('canvas');
  canvas.width = top.naturalWidth;
  canvas.height = top.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  cover(ctx, await load(frame.sourceUri), 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = frame.strength;
  ctx.drawImage(top, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.94);
}
