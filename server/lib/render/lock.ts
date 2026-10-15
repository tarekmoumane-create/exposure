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
