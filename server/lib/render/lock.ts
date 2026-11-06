/**
 * Structure verification and the detail lock.
 *
 * verify: compares the model's relit image to the original on edge structure. A relight keeps
 * every edge where it was; an image that drifted (new object, moved face, zoom, outpaint) does not.
 *
 * detailLock: takes the large-scale light and colour from the relit image and every fine detail
 * (edges, texture, faces, text) from the original pixels. After this step the model cannot have
 * changed what anything looks like, only how it is lit.
 */
import { blurBuffer, downsamplePlane, type Img, longEdge, lumaPlane, resample, resizePlane } from './pixels.js';

function ncc(a: Float32Array, b: Float32Array): number {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 1e-9 ? num / den : 0;
}

async function analysisPlane(img: Img, edge = 320): Promise<{ l: Float32Array; w: number; h: number }> {
  const scale = edge / longEdge(img);
  const w = Math.max(8, Math.round(img.width * scale)), h = Math.max(8, Math.round(img.height * scale));
  const small = await resample(img, w, h);
  const l = blurBuffer(lumaPlane(small), w, h, 1, 1.0);
  return { l, w, h };
}

export type Verification = {
  /** Plain edge-magnitude correlation; informational, drops on legitimate night conversions. */
  edges: number;
  /** Coarse luminance-layout correlation; informational, inverts under a flash. */
  layout: number;
  /** Mean edge magnitude of the original: near zero means a flat image with nothing to relight. */
  energy: number;
  /**
   * Orientation agreement at the original's strong edges that still exist in the candidate.
   * Near 1 when the frame is aligned (no zoom, shift, rotation or outpaint), random otherwise.
   */
  aligned: number;
  /** Fraction of the candidate's strong edges that have no edge nearby in the original: new content. */
  added: number;
};

function sobelXY(l: Float32Array, w: number, h: number): { mag: Float32Array; gx: Float32Array; gy: Float32Array } {
  const mag = new Float32Array(w * h), gxs = new Float32Array(w * h), gys = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -l[i - w - 1] - 2 * l[i - 1] - l[i + w - 1] + l[i - w + 1] + 2 * l[i + 1] + l[i + w + 1];
      const gy = -l[i - w - 1] - 2 * l[i - w] - l[i - w + 1] + l[i + w - 1] + 2 * l[i + w] + l[i + w + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy); gxs[i] = gx; gys[i] = gy;
    }
  }
  return { mag, gx: gxs, gy: gys };
}

function percentile(values: Float32Array, q: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Max filter with radius r (dilation) of a plane. */
function dilate(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) m = Math.max(m, src[y * w + xx]); }
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) m = Math.max(m, tmp[yy * w + x]); }
    out[y * w + x] = m;
  }
  return out;
}

export async function verify(original: Img, candidate: Img): Promise<Verification> {
  const a = await analysisPlane(original);
  const b = await analysisPlane(candidate);
  if (a.w !== b.w || a.h !== b.h) return { edges: 0, layout: 0, energy: 0, aligned: 0, added: 1 };
  const ea = sobelXY(a.l, a.w, a.h);
  const eb = sobelXY(b.l, b.w, b.h);
  let energy = 0;
  for (let i = 0; i < ea.mag.length; i++) energy += ea.mag[i];
  energy /= ea.mag.length;
  const la = downsamplePlane(a.l, a.w, a.h, 8);
  const lb = downsamplePlane(b.l, b.w, b.h, 8);

  // Strong edges: top 8% of each image's own edge magnitudes, with an absolute floor so a flat
  // image does not promote noise to "edges".
  const ta = Math.max(0.06, percentile(ea.mag, 0.92));
  // The candidate's "strong" threshold is tied to the original's, not to its own distribution:
  // on a near-flat input (a document, a wall) the candidate's top edges would otherwise be texture.
  const tb = Math.max(0.06, ta * 0.8);
  const strongA = new Float32Array(ea.mag.length), strongB = new Float32Array(eb.mag.length);
  for (let i = 0; i < strongA.length; i++) { strongA[i] = ea.mag[i] >= ta ? 1 : 0; strongB[i] = eb.mag[i] >= tb ? 1 : 0; }

  // Alignment: at the original's strong edges where the candidate also has a real edge, compare
  // orientations (doubled angle so an edge and its reverse-contrast twin agree).
  let agree = 0, count = 0;
  for (let i = 0; i < strongA.length; i++) {
    if (!strongA[i] || eb.mag[i] < tb * 0.5) continue;
    const ca = Math.atan2(ea.gy[i], ea.gx[i]), cb = Math.atan2(eb.gy[i], eb.gx[i]);
    agree += Math.cos(2 * (ca - cb));
    count++;
  }
  const aligned = count > 50 ? agree / count : 0;

  // Added content: strong candidate edges with no original edge within ~1% of the long edge.
  const near = dilate(strongA, a.w, a.h, Math.max(1, Math.round(a.w / 100)));
  let newEdges = 0, totalB = 0;
  for (let i = 0; i < strongB.length; i++) {
    if (!strongB[i]) continue;
    totalB++;
    if (!near[i]) newEdges++;
  }
  const added = totalB > 50 ? newEdges / totalB : 0;

  return { edges: ncc(ea.mag, eb.mag), layout: ncc(la.data, lb.data), energy, aligned, added };
}

/** Mean Sobel edge magnitude of an image alone; below ~0.004 the input is a flat colour. */
export async function edgeEnergy(img: Img): Promise<number> {
  const a = await analysisPlane(img);
  const e = sobelXY(a.l, a.w, a.h).mag;
  let s = 0;
  for (let i = 0; i < e.length; i++) s += e[i];
  return s / e.length;
}

export type LockParams = {
  /** Blur sigma as a fraction of the long edge that separates "light" from "detail". */
  radius: number;
  /** 0..1, how completely the original's detail replaces the model's. */
  amount: number;
};

/**
 * Transfers the original's fine detail onto the relit image as a ratio, the way texture modulates
 * light: out = low(relit) × (original / low(original)). Where the relight made an area dark, its
 * texture is correspondingly faint; where it is bright, the full texture shows. `amount` blends
 * between the model's own detail (0) and the original's (1).
 */
export function detailLock(relit: Img, original: Img, { radius, amount }: LockParams): Img {
  if (relit.width !== original.width || relit.height !== original.height) throw new Error('detailLock: size mismatch');
  const sigma = radius * longEdge(original);
  const lowO = blurBuffer(original.data, original.width, original.height, 3, sigma);
  const lowR = blurBuffer(relit.data, relit.width, relit.height, 3, sigma);
  const out = new Float32Array(relit.data.length);
  const o = original.data, r = relit.data;
  const eps = 0.02;
  for (let i = 0; i < out.length; i++) {
    const ratio = Math.min(4, (o[i] + eps) / (lowO[i] + eps));
    const locked = (lowR[i] + eps) * ratio - eps;
    out[i] = r[i] + amount * (locked - r[i]);
  }
  return { width: relit.width, height: relit.height, data: out };
}

/** Upscales a low-res plane to image size; exported for callers that build masks at reduced scale. */
export const upscalePlane = resizePlane;

export type AnchorParams = {
  /** Blur sigma as a fraction of the long edge that separates structure from texture. */
  radius: number;
  /** How completely the original's fine structure replaces the model's at strong edges (faces, outlines, text). */
  edgeAmount: number;
  /** The same in flat areas (skin, sky, walls), where the model's grain and gloss should survive. */
  flatAmount: number;
};

/**
 * Identity anchor: the ratio detail transfer of `detailLock`, weighted by an edge mask of the
 * original. Faces, outlines and lettering follow the original pixel for pixel; flat areas keep
 * the model's rendering (grain, flash gloss, bloom), so the result still looks like the camera.
 */
export function anchor(relit: Img, original: Img, { radius, edgeAmount, flatAmount }: AnchorParams): Img {
  if (relit.width !== original.width || relit.height !== original.height) throw new Error('anchor: size mismatch');
  const { width: w, height: h } = original;
  const sigma = radius * longEdge(original);
  const lowO = blurBuffer(original.data, w, h, 3, sigma);
  const lowR = blurBuffer(relit.data, w, h, 3, sigma);
  // Edge mask from the original: Sobel on a lightly blurred luma, normalised to its 95th percentile,
  // then spread so the whole width of a feature is covered.
  const l = blurBuffer(lumaPlane(original), w, h, 1, 1.0);
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -l[i - w - 1] - 2 * l[i - 1] - l[i + w - 1] + l[i - w + 1] + 2 * l[i + 1] + l[i + w + 1];
      const gy = -l[i - w - 1] - 2 * l[i - w] - l[i - w + 1] + l[i + w - 1] + 2 * l[i + w] + l[i + w + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  const sorted = Float32Array.from(mag).sort();
  const ref = Math.max(0.05, sorted[Math.floor(0.95 * (sorted.length - 1))]);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.min(1, mag[i] / ref);
  const mask = blurBuffer(mag, w, h, 1, Math.max(1, sigma * 0.75));
  const out = new Float32Array(relit.data.length);
  const o = original.data, r = relit.data;
  const eps = 0.02;
  for (let p = 0, i = 0; p < mask.length; p++, i += 3) {
    const amount = flatAmount + (edgeAmount - flatAmount) * Math.min(1, mask[p] * 1.5);
    for (let c = 0; c < 3; c++) {
      const ratio = Math.min(4, (o[i + c] + eps) / (lowO[i + c] + eps));
      const locked = (lowR[i + c] + eps) * ratio - eps;
      out[i + c] = r[i + c] + amount * (locked - r[i + c]);
    }
  }
  return { width: w, height: h, data: out };
}


/**
 * True when the model framed the photo with a border the original does not have: a flat, pale band
 * along at least two edges, like a print on paper. The edge scores in `verify` tolerate it, and in a
 * roll it would spread from the match frame to every other frame.
 */
export function addedBorder(original: Img, candidate: Img): boolean {
  const band = Math.max(2, Math.round(Math.min(candidate.width, candidate.height) * 0.012));
  const pale = (img: Img, side: 'top' | 'bottom' | 'left' | 'right') => {
    const horizontal = side === 'top' || side === 'bottom';
    const across = horizontal ? img.width : img.height;
    const along = Math.max(2, Math.round(band * (img.width / candidate.width)));
    let flat = 0;
    let count = 0;
    for (let i = 0; i < across; i += 3) {
      for (let j = 0; j < along; j++) {
        const x = horizontal ? i : side === 'left' ? j : img.width - 1 - j;
        const y = horizontal ? (side === 'top' ? j : img.height - 1 - j) : i;
        const o = (y * img.width + x) * 3;
        const [r, g, b] = [img.data[o], img.data[o + 1], img.data[o + 2]];
        if (Math.min(r, g, b) > 0.8 && Math.max(r, g, b) - Math.min(r, g, b) < 0.12) flat++;
        count++;
      }
    }
    return flat / count;
  };
  const sides = ['top', 'bottom', 'left', 'right'] as const;
  return sides.filter((side) => pale(candidate, side) > 0.7 && pale(original, side) < 0.35).length >= 2;
}
