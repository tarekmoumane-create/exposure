/**
 * Float RGB image buffers and the primitive operations the look recipes are built from.
 *
 * Everything here is deterministic pixel math on display-referred sRGB values in 0..1, so a
 * recipe gives the same result every time and cannot add anything that is not in the input.
 * Decoding, encoding and resampling go through sharp; the per-pixel work is plain typed arrays.
 */
import sharp from 'sharp';

export type Img = { width: number; height: number; data: Float32Array };

export const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);
export const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function clone(img: Img): Img {
  return { width: img.width, height: img.height, data: new Float32Array(img.data) };
}

/** Length of the longer edge, used to scale radii so a recipe looks the same at any resolution. */
export const longEdge = (img: Img): number => Math.max(img.width, img.height);

// ---------------------------------------------------------------------------------------------
// Decode / encode

export async function decode(input: Buffer, maxEdge?: number): Promise<Img> {
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  if (maxEdge) pipeline = pipeline.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await pipeline.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height * 3;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = data[i] / 255;
  return { width: info.width, height: info.height, data: out };
}

export function toBytes(img: Img): Buffer {
  const n = img.data.length;
  const bytes = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const v = img.data[i];
    bytes[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  return bytes;
}

export function fromBytes(bytes: Buffer | Uint8Array, width: number, height: number): Img {
  const n = width * height * 3;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = bytes[i] / 255;
  return { width, height, data: out };
}

export async function encodeJpeg(img: Img, quality = 92, chromaSubsampling: '4:4:4' | '4:2:0' = '4:2:0'): Promise<Buffer> {
  return sharp(toBytes(img), { raw: { width: img.width, height: img.height, channels: 3 } })
    .jpeg({ quality, chromaSubsampling, mozjpeg: true })
    .toBuffer();
}

/** Resamples with sharp (Lanczos down, Mitchell up); used for resolution loss and for fitting an AI result. */
export async function resample(img: Img, width: number, height: number): Promise<Img> {
  const { data, info } = await sharp(toBytes(img), { raw: { width: img.width, height: img.height, channels: 3 } })
    .resize(width, height, { fit: 'fill', kernel: width < img.width ? 'lanczos3' : 'mitchell' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return fromBytes(data, info.width, info.height);
}

/** Resize to cover the target and centre-crop, so the result has exactly the target pixel dimensions. */
export async function fitCover(img: Img, width: number, height: number): Promise<Img> {
  const { data, info } = await sharp(toBytes(img), { raw: { width: img.width, height: img.height, channels: 3 } })
    .resize(width, height, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return fromBytes(data, info.width, info.height);
}

/**
 * Pushes the image through a real JPEG encode at a reduced scale and brings it back, which is the
 * honest way to get the block structure and chroma smearing of an old camera's compressor.
 */
export async function jpegRoundTrip(img: Img, { scale = 1, quality = 75 }: { scale?: number; quality?: number }): Promise<Img> {
  const w = Math.max(16, Math.round(img.width * scale));
  const h = Math.max(16, Math.round(img.height * scale));
  const small = scale < 1 ? await resample(img, w, h) : img;
  const encoded = await sharp(toBytes(small), { raw: { width: small.width, height: small.height, channels: 3 } })
    .jpeg({ quality, chromaSubsampling: '4:2:0' })
    .toBuffer();
  const { data, info } = await sharp(encoded)
    .resize(img.width, img.height, { fit: 'fill', kernel: 'cubic' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return fromBytes(data, info.width, info.height);
}

// ---------------------------------------------------------------------------------------------
// Blur (three box passes approximate a Gaussian; separable, in place on a copy)

function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, c: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    for (let ch = 0; ch < c; ch++) {
      let ti = (y * w) * c + ch;
      let li = ti;
      let ri = ti + r * c;
      const fv = src[ti];
      const lv = src[ti + (w - 1) * c];
      let val = (r + 1) * fv;
      for (let j = 0; j < r; j++) val += src[ti + j * c];
      for (let j = 0; j <= r; j++) { val += src[ri] - fv; ri += c; dst[ti] = val * iarr; ti += c; }
      for (let j = r + 1; j < w - r; j++) { val += src[ri] - src[li]; ri += c; li += c; dst[ti] = val * iarr; ti += c; }
      for (let j = w - r; j < w; j++) { val += lv - src[li]; li += c; dst[ti] = val * iarr; ti += c; }
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, c: number, r: number) {
  const iarr = 1 / (r + r + 1);
  const stride = w * c;
  for (let x = 0; x < w; x++) {
    for (let ch = 0; ch < c; ch++) {
      let ti = x * c + ch;
      let li = ti;
      let ri = ti + r * stride;
      const fv = src[ti];
      const lv = src[ti + (h - 1) * stride];
      let val = (r + 1) * fv;
      for (let j = 0; j < r; j++) val += src[ti + j * stride];
      for (let j = 0; j <= r; j++) { val += src[ri] - fv; ri += stride; dst[ti] = val * iarr; ti += stride; }
      for (let j = r + 1; j < h - r; j++) { val += src[ri] - src[li]; ri += stride; li += stride; dst[ti] = val * iarr; ti += stride; }
      for (let j = h - r; j < h; j++) { val += lv - src[li]; li += stride; dst[ti] = val * iarr; ti += stride; }
    }
  }
}

/** Gaussian blur of an interleaved buffer with `c` channels. Returns a new buffer. */
export function blurBuffer(src: Float32Array, w: number, h: number, c: number, sigma: number): Float32Array {
  if (sigma <= 0.3) return new Float32Array(src);
  const boxes = boxesForGauss(sigma, 3);
  let a = new Float32Array(src);
  let b = new Float32Array(src.length);
  for (const size of boxes) {
    const r = Math.min((size - 1) / 2, Math.floor(Math.min(w, h) / 2) - 1);
    if (r < 1) continue;
    boxBlurH(a, b, w, h, c, r);
    boxBlurV(b, a, w, h, c, r);
  }
  return a;
}

export function blur(img: Img, sigma: number): Img {
  return { width: img.width, height: img.height, data: blurBuffer(img.data, img.width, img.height, 3, sigma) };
}

/** Luminance plane of an image. */
export function lumaPlane(img: Img): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 3) out[i] = luma(d[j], d[j + 1], d[j + 2]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Noise (seeded, so a photo renders identically every time)

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zero-mean noise with roughly unit variance, generated on a coarse grid of `cell` pixels and
 * interpolated, which gives the soft clumped structure of film grain rather than per-pixel hiss.
 * cell <= 1 gives independent per-pixel noise (sensor noise).
 */
export function noisePlane(w: number, h: number, cell: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const gauss = () => rnd() + rnd() + rnd() - 1.5; // variance 0.25
  const out = new Float32Array(w * h);
  if (cell <= 1) {
    for (let i = 0; i < out.length; i++) out[i] = gauss() * 2;
    return out;
  }
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = gauss() * 2;
  const inv = 1 / cell;
  for (let y = 0; y < h; y++) {
    const gy = y * inv;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = x * inv;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const i00 = y0 * gw + x0;
      const a = grid[i00] + (grid[i00 + 1] - grid[i00]) * fx;
      const b = grid[i00 + gw] + (grid[i00 + gw + 1] - grid[i00 + gw]) * fx;
      out[y * w + x] = a + (b - a) * fy;
    }
  }
  // Interpolation lowers the variance; bring it back near unit so `amount` means the same at any cell size.
  const gain = 1 + 0.35 * Math.min(cell - 1, 2);
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tone

/** Monotone piecewise-cubic curve through control points, sampled to a LUT of `size` entries. */
export function curveLUT(points: [number, number][], size = 1024): Float32Array {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  const lut = new Float32Array(size);
  let seg = 0;
  for (let i = 0; i < size; i++) {
    const x = i / (size - 1);
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg];
    const t = clamp01((x - xs[seg]) / h);
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[seg] + (t3 - 2 * t2 + t) * h * m[seg] + (-2 * t3 + 3 * t2) * ys[seg + 1] + (t3 - t2) * h * m[seg + 1];
    lut[i] = clamp01(y);
  }
  return lut;
}

export function applyLUT(img: Img, r: Float32Array, g: Float32Array = r, b: Float32Array = r): void {
  const d = img.data;
  const scale = r.length - 1;
  for (let i = 0; i < d.length; i += 3) {
    d[i] = r[Math.round(clamp01(d[i]) * scale)];
    d[i + 1] = g[Math.round(clamp01(d[i + 1]) * scale)];
    d[i + 2] = b[Math.round(clamp01(d[i + 2]) * scale)];
  }
}

export type ToneParams = {
  /** Output value for input black (lifted, milky blacks). */
  black?: number;
  /** Output value for input white (compressed, never-clipping highlights). */
  white?: number;
  /** Slope through the midtones. 1 = unchanged. */
  contrast?: number;
  /** Midtone pivot the contrast rotates around. */
  pivot?: number;
  /** Input level where the highlight shoulder starts (0..1); below 1 compresses highlights smoothly. */
  shoulder?: number;
  /** Input level where the shadow toe ends; above 0 compresses the deepest shadows smoothly. */
  toe?: number;
  /** Exposure in stops applied before the curve. */
  exposure?: number;
};

/** Builds a tone LUT from film-style parameters. */
export function toneLUT({ black = 0, white = 1, contrast = 1, pivot = 0.42, shoulder = 1, toe = 0, exposure = 0 }: ToneParams, size = 1024): Float32Array {
  const lut = new Float32Array(size);
  const gain = Math.pow(2, exposure);
  for (let i = 0; i < size; i++) {
    let x = (i / (size - 1)) * gain;
    // Contrast around the pivot with a soft sigmoid so extremes do not clip harshly.
    x = pivot + (x - pivot) * contrast;
    if (toe > 0 && x < toe) {
      const t = clamp01(x / toe);
      x = toe * t * t * (3 - 2 * t) * 0.5 + x * 0.5; // blend toward a smooth toe
    }
    if (shoulder < 1 && x > shoulder) {
      const span = 1 - shoulder;
      const over = (x - shoulder) / span;
      x = shoulder + span * (1 - Math.exp(-over * 1.6)) / (1 - Math.exp(-1.6));
    }
    x = clamp01(x);
    lut[i] = black + (white - black) * x;
  }
  return lut;
}

export function tone(img: Img, params: ToneParams): void {
  applyLUT(img, toneLUT(params));
}

export function exposure(img: Img, stops: number): void {
  const k = Math.pow(2, stops);
  const d = img.data;
  for (let i = 0; i < d.length; i++) d[i] *= k;
}

export function clip(img: Img): void {
  const d = img.data;
  for (let i = 0; i < d.length; i++) d[i] = clamp01(d[i]);
}

// ---------------------------------------------------------------------------------------------
// Colour

/** Per-channel gains, the simplest white-balance shift. */
export function channelGain(img: Img, r: number, g: number, b: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) { d[i] *= r; d[i + 1] *= g; d[i + 2] *= b; }
}

/** 3x3 colour matrix (rows = output R, G, B). */
export function colorMatrix(img: Img, m: number[]): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b;
    d[i + 1] = m[3] * r + m[4] * g + m[5] * b;
    d[i + 2] = m[6] * r + m[7] * g + m[8] * b;
  }
}

export function saturation(img: Img, s: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = luma(r, g, b);
    d[i] = l + (r - l) * s;
    d[i + 1] = l + (g - l) * s;
    d[i + 2] = l + (b - l) * s;
  }
}

/** Saturates muted colours more than already-saturated ones, and protects skin from going orange. */
export function vibrance(img: Img, v: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    const s = 1 + v * (1 - sat);
    const l = luma(r, g, b);
    d[i] = l + (r - l) * s;
    d[i + 1] = l + (g - l) * s;
    d[i + 2] = l + (b - l) * s;
  }
}

/**
 * Tints shadows and highlights separately (split toning). Offsets are RGB deltas applied at full
 * weight; the weight follows luminance so midtones stay close to neutral.
 */
export function splitTone(img: Img, shadows: [number, number, number], highlights: [number, number, number], balance = 0.5): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    const l = luma(d[i], d[i + 1], d[i + 2]);
    const wh = smoothstep(balance - 0.35, balance + 0.45, l);
    const ws = 1 - smoothstep(balance - 0.45, balance + 0.35, l);
    d[i] += shadows[0] * ws + highlights[0] * wh;
    d[i + 1] += shadows[1] * ws + highlights[1] * wh;
    d[i + 2] += shadows[2] * ws + highlights[2] * wh;
  }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const dlt = mx - mn;
  let h = 0;
  if (dlt > 1e-6) {
    if (mx === r) h = ((g - b) / dlt) % 6;
    else if (mx === g) h = (b - r) / dlt + 2;
    else h = (r - g) / dlt + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx > 0 ? dlt / mx : 0, mx];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [r + m, g + m, b + m];
}

export type HueRange = { hue: number; width: number; shift?: number; sat?: number; value?: number };

/**
 * Per-hue adjustments (hue rotation in degrees, saturation and value multipliers) with a smooth
 * falloff of `width` degrees either side of the target hue. This is how a film stock's colour
 * science is expressed: Kodak Gold pulls greens toward yellow, Portra pushes skin toward peach.
 */
export function hueAdjust(img: Img, ranges: HueRange[]): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    const r = clamp01(d[i]), g = clamp01(d[i + 1]), b = clamp01(d[i + 2]);
    let [h, s, v] = rgbToHsv(r, g, b);
    if (s < 0.03) continue;
    let touched = false;
    for (const range of ranges) {
      let dist = Math.abs(h - range.hue) % 360;
      if (dist > 180) dist = 360 - dist;
      if (dist >= range.width) continue;
      const w = 1 - smoothstep(0, range.width, dist);
      const strength = w * Math.min(1, s * 3);
      if (range.shift) h += range.shift * strength;
      if (range.sat !== undefined) s *= 1 + (range.sat - 1) * strength;
      if (range.value !== undefined) v *= 1 + (range.value - 1) * strength;
      touched = true;
    }
    if (!touched) continue;
    const [nr, ng, nb] = hsvToRgb(h, clamp01(s), clamp01(v));
    d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
  }
}

// ---------------------------------------------------------------------------------------------
// Optics and sensor

export type VignetteParams = { amount: number; radius?: number; softness?: number; color?: [number, number, number] };

/** Darkens the corners (amount > 0) or lifts them (amount < 0). Radius and softness are in units of the half-diagonal. */
export function vignette(img: Img, { amount, radius = 0.55, softness = 0.75, color }: VignetteParams): void {
  const { width: w, height: h, data: d } = img;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const inv = 1 / Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) * inv;
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) * inv;
      const r = Math.sqrt(dx * dx + dy * dy);
      const f = 1 - amount * smoothstep(radius, radius + softness, r);
      const i = (y * w + x) * 3;
      if (color) {
        const t = 1 - f;
        d[i] = d[i] * f + color[0] * t; d[i + 1] = d[i + 1] * f + color[1] * t; d[i + 2] = d[i + 2] * f + color[2] * t;
      } else {
        d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
      }
    }
  }
}

/** Lateral chromatic aberration: red and blue planes scaled slightly apart around the centre. */
export function chromaticAberration(img: Img, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = img;
  const src = new Float32Array(img.data);
  const d = img.data;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const sample = (x: number, y: number, ch: number): number => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    const xa = Math.max(0, Math.min(w - 1, x0)), ya = Math.max(0, Math.min(h - 1, y0));
    const a = src[(ya * w + xa) * 3 + ch], b = src[(ya * w + x1) * 3 + ch];
    const c = src[(y1 * w + xa) * 3 + ch], e = src[(y1 * w + x1) * 3 + ch];
    return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
  };
  const kr = 1 + amount, kb = 1 - amount;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const dx = x - cx, dy = y - cy;
      d[i] = sample(cx + dx / kr, cy + dy / kr, 0);
      d[i + 2] = sample(cx + dx / kb, cy + dy / kb, 2);
    }
  }
}

/** Lens softness: blend toward a blurred copy. */
export function soften(img: Img, sigma: number, amount = 1): void {
  if (sigma <= 0 || amount <= 0) return;
  const b = blurBuffer(img.data, img.width, img.height, 3, sigma);
  const d = img.data;
  for (let i = 0; i < d.length; i++) d[i] += (b[i] - d[i]) * amount;
}

/** Unsharp mask. Large amounts with a 1-2 px sigma give the bright edge halos of compact-camera JPEGs. */
export function unsharp(img: Img, sigma: number, amount: number, threshold = 0): void {
  if (amount <= 0) return;
  const b = blurBuffer(img.data, img.width, img.height, 3, sigma);
  const d = img.data;
  for (let i = 0; i < d.length; i++) {
    const hp = d[i] - b[i];
    if (Math.abs(hp) < threshold) continue;
    d[i] += hp * amount;
  }
}

/** Downscale then upscale: the real way low-megapixel detail loss looks. */
export async function resolutionLoss(img: Img, scale: number): Promise<Img> {
  if (scale >= 1) return img;
  const w = Math.max(16, Math.round(img.width * scale));
  const h = Math.max(16, Math.round(img.height * scale));
  const small = await resample(img, w, h);
  return resample(small, img.width, img.height);
}

export type GrainParams = {
  /** Standard deviation of the luminance noise at mid-grey, in 0..1 units. 0.03 is visible, 0.08 is heavy. */
  amount: number;
  /** Grain cell size in pixels at a 1536 px long edge; scaled with the image. */
  size?: number;
  /** How much the amount drops toward white (film: grain lives in shadows and mids). 0 = even. */
  highlightProtect?: number;
  /** Extra weight in the deepest shadows (sensor noise). */
  shadowBoost?: number;
  /** 0..1 fraction of the noise that is colour speckle rather than luminance. */
  chroma?: number;
  seed?: number;
};

export function grain(img: Img, { amount, size = 1.6, highlightProtect = 0.6, shadowBoost = 0, chroma = 0.2, seed = 7 }: GrainParams): void {
  if (amount <= 0) return;
  const { width: w, height: h, data: d } = img;
  const cell = size * (longEdge(img) / 1536);
  const n = noisePlane(w, h, cell, seed);
  const cr = chroma > 0 ? noisePlane(w, h, Math.max(1, cell * 1.3), seed + 101) : null;
  const cb = chroma > 0 ? noisePlane(w, h, Math.max(1, cell * 1.3), seed + 202) : null;
  for (let p = 0, i = 0; p < n.length; p++, i += 3) {
    const l = luma(d[i], d[i + 1], d[i + 2]);
    const weight = (1 - highlightProtect * l) * (1 + shadowBoost * (1 - l) * (1 - l));
    const g = n[p] * amount * weight;
    d[i] += g; d[i + 1] += g; d[i + 2] += g;
    if (cr && cb) {
      const c = amount * weight * chroma;
      d[i] += cr[p] * c;
      d[i + 2] += cb[p] * c;
      d[i + 1] -= (cr[p] + cb[p]) * c * 0.5;
    }
  }
}

export type GlowParams = {
  /** Luminance above which light bleeds. */
  threshold: number;
  /** Blur sigma as a fraction of the long edge. */
  radius: number;
  /** Strength of the added light. */
  amount: number;
  /** Colour of the bleed: red-orange for film halation, white for lens bloom. */
  color?: [number, number, number];
};

/** Light bleeding from highlights into their surroundings, added (not screened) like real exposure. */
export function glow(img: Img, { threshold, radius, amount, color = [1, 1, 1] }: GlowParams): void {
  if (amount <= 0) return;
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const mask = new Float32Array(n);
  const inv = 1 / Math.max(1e-3, 1 - threshold);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const l = luma(d[i], d[i + 1], d[i + 2]);
    const m = (l - threshold) * inv;
    mask[p] = m > 0 ? m * m : 0;
  }
  const bleed = blurBuffer(mask, w, h, 1, radius * longEdge(img));
  // Screen blend: light bleeds into darker neighbours but cannot push an already-bright area further.
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const m = Math.min(1, bleed[p] * amount);
    d[i] = 1 - (1 - d[i]) * (1 - m * color[0]);
    d[i + 1] = 1 - (1 - d[i + 1]) * (1 - m * color[1]);
    d[i + 2] = 1 - (1 - d[i + 2]) * (1 - m * color[2]);
  }
}

/** Four-point star streaks on the brightest points (cross-screen / dirty-lens flare). */
export function starFlare(img: Img, { threshold, length, amount, color = [1, 0.95, 0.85] }: { threshold: number; length: number; amount: number; color?: [number, number, number] }): void {
  if (amount <= 0) return;
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  const mask = new Float32Array(n);
  const inv = 1 / Math.max(1e-3, 1 - threshold);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const l = luma(d[i], d[i + 1], d[i + 2]);
    const m = (l - threshold) * inv;
    mask[p] = m > 0 ? m * m : 0;
  }
  // Only small bright points flare (lamps, sun glints); a white wall or sky must not. Subtracting a
  // wide blur of the mask leaves just the point-like highlights.
  const wide = blurBuffer(mask, w, h, 1, 0.02 * longEdge(img));
  for (let p = 0; p < n; p++) mask[p] = Math.max(0, mask[p] - wide[p] * 1.5);
  // Streaks are drawn at quarter resolution: they are soft by nature and this keeps the cost flat.
  const factor = 4;
  const small = downsamplePlane(mask, w, h, factor);
  const sw = small.width, sh = small.height;
  const len = Math.max(2, Math.round((length * longEdge(img)) / factor));
  const streak = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const m = small.data[y * sw + x];
      if (m < 0.03) continue;
      for (let k = -len; k <= len; k++) {
        const f = m * Math.exp(-Math.abs(k) / (len * 0.35)) * (1 - Math.abs(k) / (len + 1));
        const xx = x + k; if (xx >= 0 && xx < sw) streak[y * sw + xx] += f;
        const yy = y + k; if (yy >= 0 && yy < sh) streak[yy * sw + x] += f;
      }
    }
  }
  const soft = blurBuffer(streak, sw, sh, 1, 0.8);
  const full = resizePlane(soft, sw, sh, w, h);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const m = Math.min(1, full[p] * amount);
    d[i] = 1 - (1 - d[i]) * (1 - m * color[0]);
    d[i + 1] = 1 - (1 - d[i + 1]) * (1 - m * color[1]);
    d[i + 2] = 1 - (1 - d[i + 2]) * (1 - m * color[2]);
  }
}

/** Uniform atmospheric haze: mixes toward a colour, lifting blacks and lowering contrast. */
export function haze(img: Img, color: [number, number, number], amount: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 3) {
    d[i] += (color[0] - d[i]) * amount;
    d[i + 1] += (color[1] - d[i + 1]) * amount;
    d[i + 2] += (color[2] - d[i + 2]) * amount;
  }
}

/**
 * Approximates a flash from the camera position without any scene understanding: brightens toward
 * the centre and lets the edges fall away. Only used when the relighting model cannot be trusted.
 */
export function centerLight(img: Img, { gain, falloff }: { gain: number; falloff: number }): void {
  const { width: w, height: h, data: d } = img;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const inv = 1 / Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) * inv;
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) * inv;
      const r = Math.sqrt(dx * dx + dy * dy);
      const f = 1 + gain * (1 - smoothstep(0.1, 0.9, r)) - falloff * smoothstep(0.35, 1.0, r);
      const i = (y * w + x) * 3;
      d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
    }
  }
}

/** Bilinear resize of a single-channel plane (used to run expensive masks at reduced scale). */
export function resizePlane(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const a = src[y0 * sw + x0], b = src[y0 * sw + x1], c = src[y1 * sw + x0], d = src[y1 * sw + x1];
      out[y * dw + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

/** Box-average downscale of a plane by an integer factor. */
export function downsamplePlane(src: Float32Array, w: number, h: number, factor: number): { data: Float32Array; width: number; height: number } {
  const dw = Math.max(1, Math.floor(w / factor)), dh = Math.max(1, Math.floor(h / factor));
  const out = new Float32Array(dw * dh);
  const inv = 1 / (factor * factor);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let s = 0;
      for (let j = 0; j < factor; j++) for (let i = 0; i < factor; i++) s += src[(y * factor + j) * w + x * factor + i];
      out[y * dw + x] = s * inv;
    }
  }
  return { data: out, width: dw, height: dh };
}
