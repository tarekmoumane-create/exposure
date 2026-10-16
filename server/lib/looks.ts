/**
 * The look registry. Every look is rendered in full by the model from its prompt, verified
 * against the input, and anchored to the original's edges. The deterministic recipe is only the
 * fallback when the model's result fails verification or the model is unavailable.
 */
import * as R from './render/recipes.js';
import type { Recipe } from './render/recipes.js';
import { LOOK_PROMPTS } from './relight.js';

export type LookSpec = {
  name: string;
  /** Identity anchor: radius as a fraction of the long edge; amount at strong edges and in flat areas. */
  anchor: { radius: number; edgeAmount: number; flatAmount: number };
  /** Acceptance thresholds: frame alignment at least `aligned`, new structure at most `added`. */
  verify: { aligned: number; added: number };
  fallback: Recipe;
  /** Texture the model will not add in edit mode (film grain, CCD noise, webcam compression), applied after the anchor. */
  finish?: Recipe;
  /** File in lib/refs sent as image 2 so the model matches a real rendering of the look. */
  reference?: string;
  /** 'free' looks change the format (the booth strip). */
  framing?: 'locked' | 'free';
};

/** Faces and edges follow the original; flat areas keep the model's texture (grain, flash gloss). */
const ANCHOR = { radius: 0.008, edgeAmount: 0.85, flatAmount: 0.2 };
/** Film and webcam looks change texture everywhere; anchor edges a little less so grain survives. */
const ANCHOR_TEXTURE = { radius: 0.008, edgeAmount: 0.75, flatAmount: 0.1 };
const VERIFY = { aligned: 0.6, added: 0.4 };

export const LOOKS: Record<string, LookSpec> = {
  'day-flash': { name: 'Day Flash', anchor: ANCHOR, verify: VERIFY, fallback: R.dayFlashFallback },
  'night-flash': { name: 'Night Flash', anchor: ANCHOR, verify: VERIFY, fallback: R.nightFlashFallback },
  'red-flash': { name: 'Red Flash', anchor: ANCHOR, verify: VERIFY, fallback: R.redFlashFallback },
  paparazzi: { name: 'Paparazzi', anchor: ANCHOR, verify: VERIFY, fallback: R.paparazziFallback },
  digicam: { name: 'Digicam', anchor: ANCHOR, verify: VERIFY, fallback: R.digicamFallback },
  'y2k-digicam': { name: 'Y2K Digicam', anchor: ANCHOR_TEXTURE, verify: VERIFY, fallback: R.y2kFallback, finish: R.y2kFinish },
  'gold-200': { name: 'Sunny 200', anchor: ANCHOR_TEXTURE, verify: VERIFY, fallback: R.goldFallback, finish: R.filmFinish200, reference: 'gold-200.jpg' },
  'superia-400': { name: 'Vibrant 400', anchor: ANCHOR_TEXTURE, verify: VERIFY, fallback: R.superiaFallback, finish: R.filmFinish400, reference: 'superia-400.jpg' },
  'film-35': { name: '35mm', anchor: ANCHOR_TEXTURE, verify: VERIFY, fallback: R.film35Fallback, finish: R.filmFinishExpired },
  'golden-hour': { name: 'Golden Hour', anchor: ANCHOR, verify: VERIFY, fallback: R.goldenFallback },
  'blue-hour': { name: 'Blue Hour', anchor: ANCHOR, verify: VERIFY, fallback: R.blueFallback },
  'window-light': { name: 'Window Light', anchor: ANCHOR, verify: VERIFY, fallback: R.windowFallback },
  glow: { name: 'Glow', anchor: ANCHOR, verify: VERIFY, fallback: R.glowFallback },
  webcam: { name: 'Webcam', anchor: ANCHOR_TEXTURE, verify: VERIFY, fallback: R.webcamFallback, finish: R.webcamFinish, reference: 'webcam.jpg' },
  'booth-strip': { name: 'Photobooth', anchor: ANCHOR, verify: VERIFY, fallback: R.boothFallback, framing: 'free' },
};

for (const id of Object.keys(LOOKS)) {
  if (!LOOK_PROMPTS[id]) throw new Error(`look ${id} has no prompt`);
}
