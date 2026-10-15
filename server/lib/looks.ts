/**
 * The look registry. Each look is a relighting change (done by the model, verified, then
 * detail-locked to the original pixels) and a camera rendering (done in code). Pure rendering
 * looks never call the model.
 */
import * as R from './render/recipes.js';
import type { Recipe } from './render/recipes.js';
import { RELIGHT_PROMPTS } from './relight.js';

export type LookSpec = {
  name: string;
  /** Present when the look changes the light source; the key into RELIGHT_PROMPTS. */
  relight?: string;
  render: Recipe;
  /** Detail lock after relighting: radius as a fraction of the long edge, amount 0..1. */
  lock: { radius: number; amount: number };
  /** Acceptance thresholds for a relit image: frame alignment at least `aligned`, new structure at most `added`. */
  verify: { aligned: number; added: number };
  /** Relight approximation used when the model's result fails verification. */
  fallback: Recipe;
  /** 'free' looks change the format (the booth strip). */
  framing?: 'locked' | 'free';
};

const FLASH_LOCK = { radius: 0.012, amount: 0.9 };
const SOFT_LOCK = { radius: 0.012, amount: 0.85 };
const VERIFY = { aligned: 0.6, added: 0.4 };

export const LOOKS: Record<string, LookSpec> = {
  'point-and-shoot': { name: 'Point & Shoot', relight: 'point-and-shoot', render: R.pointAndShoot, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackFlash },
  'after-dark': { name: 'After Dark', relight: 'after-dark', render: R.afterDark, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackNightFlash },
  rouge: { name: 'Rouge', relight: 'rouge', render: R.rouge, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackRedFlash },
  paparazzi: { name: 'Paparazzi', relight: 'paparazzi', render: R.paparazzi, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackNightFlash },
  'golden-hour': { name: 'Golden Hour', relight: 'golden-hour', render: R.goldenHour, lock: SOFT_LOCK, verify: VERIFY, fallback: R.fallbackGolden },
  'blue-hour': { name: 'Blue Hour', relight: 'blue-hour', render: R.blueHour, lock: SOFT_LOCK, verify: VERIFY, fallback: R.fallbackBlue },
  'window-light': { name: 'Window Light', relight: 'window-light', render: R.windowLight, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackWindow },
  haze: { name: 'Haze', render: R.hazeLook, lock: SOFT_LOCK, verify: VERIFY, fallback: R.identity },
  'y2k-compact': { name: 'Y2K Compact', relight: 'y2k-compact', render: R.y2kCompact, lock: FLASH_LOCK, verify: VERIFY, fallback: R.fallbackFlash },
  'film-35': { name: '35mm Film', render: R.film35, lock: SOFT_LOCK, verify: VERIFY, fallback: R.identity },
  'bedroom-webcam': { name: 'Bedroom Webcam', relight: 'bedroom-webcam', render: R.bedroomWebcam, lock: { radius: 0.015, amount: 0.8 }, verify: VERIFY, fallback: R.fallbackWebcam },
  'booth-strip': { name: 'Booth Strip', render: R.boothStrip, lock: SOFT_LOCK, verify: VERIFY, fallback: R.identity, framing: 'free' },
};

for (const [id, look] of Object.entries(LOOKS)) {
  if (look.relight && !RELIGHT_PROMPTS[look.relight]) throw new Error(`look ${id} references a missing relight prompt`);
}
