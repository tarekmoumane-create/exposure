import { type ImageSourcePropType } from 'react-native';

import { resolveWebUri } from '@/filters/filtered-image.web';
import { toSvgValues } from '@/filters/matrix';
import { type FilterConfig, resolveFilter } from '@/filters/presets';

export type RenderSource = string | ImageSourcePropType;

export const STRIP_WIDTH = 720;
export const STRIP_TILE_HEIGHT = 820;
export const STRIP_MARGIN = 28;
export const STRIP_GAP = 20;
export const STRIP_FOOTER = 120;

export function stripHeight(count: number): number {
  return STRIP_MARGIN * 2 + count * STRIP_TILE_HEIGHT + (count - 1) * STRIP_GAP + STRIP_FOOTER;
}

function loadImage(source: RenderSource): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = resolveWebUri(source);
  });
}

let filterHost: SVGSVGElement | null = null;
function ensureSvgFilter(id: string, matrixValues: string) {
  if (!filterHost) {
    filterHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filterHost.setAttribute('width', '0');
    filterHost.setAttribute('height', '0');
    filterHost.style.position = 'absolute';
    document.body.appendChild(filterHost);
  }
  let filter = filterHost.querySelector(`#${id}`);
  if (!filter) {
    filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const cm = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    cm.setAttribute('type', 'matrix');
    filter.appendChild(cm);
    filterHost.appendChild(filter);
  }
  filter.querySelector('feColorMatrix')?.setAttribute('values', matrixValues);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawLayer(ctx: CanvasRenderingContext2D, img: HTMLImageElement, config: FilterConfig, x: number, y: number, w: number, h: number) {
  const { matrix, grain, vignette } = resolveFilter(config);
  ensureSvgFilter('exposure-render-cm', toSvgValues(matrix));
  ctx.save();
  ctx.filter = 'url(#exposure-render-cm)';
  drawCover(ctx, img, x, y, w, h);
  ctx.restore();
  if (grain > 0.01) {
    const noise = document.createElement('canvas');
    noise.width = 256;
    noise.height = 256;
    const nctx = noise.getContext('2d')!;
    const data = nctx.createImageData(256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 140;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    nctx.putImageData(data, 0, 0);
    ctx.save();
    ctx.globalAlpha = grain * 0.32;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(noise, 'repeat')!;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if (vignette > 0.01) {
    const r = Math.max(w, h) * 0.78;
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.42, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.85 * vignette})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

export type RenderOptions = { maxSize?: number; base?: RenderSource; blend?: number };

export async function renderFilteredImage(source: RenderSource, config: FilterConfig, options: RenderOptions = {}): Promise<string> {
  const { maxSize = 2048, base, blend = 1 } = options;
  const img = await loadImage(source);
  const baseImg = base && blend < 0.995 ? await loadImage(base) : null;
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  if (baseImg) drawLayer(ctx, baseImg, config, 0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = baseImg ? blend : 1;
  drawLayer(ctx, img, config, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export type StripOptions = {
  frames: RenderSource[];
  config: FilterConfig;
  paper: 'white' | 'black';
  stamp: string | null;
  font: unknown;
};

export async function renderStrip({ frames, config, paper, stamp }: StripOptions): Promise<string> {
  const images = await Promise.all(frames.map(loadImage));
  const canvas = document.createElement('canvas');
  canvas.width = STRIP_WIDTH;
  canvas.height = stripHeight(images.length);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = paper === 'white' ? '#F7F2EA' : '#141214';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((img, index) => {
    drawLayer(ctx, img, config, STRIP_MARGIN, STRIP_MARGIN + index * (STRIP_TILE_HEIGHT + STRIP_GAP), STRIP_WIDTH - STRIP_MARGIN * 2, STRIP_TILE_HEIGHT);
  });
  if (stamp) {
    ctx.fillStyle = paper === 'white' ? '#2B2226' : '#EDE6DC';
    ctx.font = '600 30px Manrope, system-ui, sans-serif';
    ctx.fillText(stamp, STRIP_MARGIN + 4, canvas.height - STRIP_FOOTER / 2 + 10);
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}
