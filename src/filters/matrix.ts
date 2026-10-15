/**
 * 4x5 color matrices (20 numbers, row-major), the format shared by Skia's ColorMatrix,
 * SVG feColorMatrix and CSS. Color channels are 0..1, so the translation column is 0..1 too.
 */

export type ColorMatrix = number[];

export const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Returns a matrix that applies `b` first, then `a`. */
export function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out: ColorMatrix = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 5 + k] * b[k * 5 + col];
      if (col === 4) sum += a[row * 5 + 4];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

export function compose(...matrices: ColorMatrix[]): ColorMatrix {
  return matrices.reduce((acc, m) => multiply(m, acc), IDENTITY);
}

export function lerp(a: ColorMatrix, b: ColorMatrix, t: number): ColorMatrix {
  const k = Math.max(0, Math.min(1, t));
  return a.map((v, i) => v + (b[i] - v) * k);
}

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

export function saturation(s: number): ColorMatrix {
  const sr = (1 - s) * LR;
  const sg = (1 - s) * LG;
  const sb = (1 - s) * LB;
  return [sr + s, sg, sb, 0, 0, sr, sg + s, sb, 0, 0, sr, sg, sb + s, 0, 0, 0, 0, 0, 1, 0];
}

export function contrast(c: number): ColorMatrix {
  const t = 0.5 * (1 - c);
  return [c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0];
}

export function brightness(b: number): ColorMatrix {
  return [1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
}

/** Warm (t > 0) or cool (t < 0). */
export function temperature(t: number): ColorMatrix {
  return [1 + 0.12 * t, 0, 0, 0, 0.03 * t, 0, 1 + 0.02 * t, 0, 0, 0, 0, 0, 1 - 0.14 * t, 0, -0.03 * t, 0, 0, 0, 1, 0];
}

export function tint(r: number, g: number, b: number): ColorMatrix {
  return [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
}

export function channelScale(r: number, g: number, b: number): ColorMatrix {
  return [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

export function sepia(amount: number): ColorMatrix {
  const full: ColorMatrix = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
  return lerp(IDENTITY, full, amount);
}

export const GRAYSCALE: ColorMatrix = saturation(0);

/** Lifts shadows toward a color, like faded film. amount 0..1 */
export function fade(amount: number): ColorMatrix {
  const a = amount * 0.12;
  return [1 - a, 0, 0, 0, a, 0, 1 - a, 0, 0, a, 0, 0, 1 - a, 0, a, 0, 0, 0, 1, 0];
}

export function toSvgValues(m: ColorMatrix): string {
  return m.map((v) => Number(v.toFixed(4))).join(' ');
}
