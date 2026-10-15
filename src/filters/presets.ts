import {
  brightness,
  channelScale,
  compose,
  contrast,
  fade,
  GRAYSCALE,
  IDENTITY,
  lerp,
  multiply,
  saturation,
  sepia,
  temperature,
  tint,
  type ColorMatrix,
} from '@/filters/matrix';

export type PresetGroup = 'film' | 'flash' | 'light' | 'mono';

export type Preset = {
  id: string;
  name: string;
  group: PresetGroup;
  matrix: ColorMatrix;
  /** Extra vignette 0..1 */
  vignette: number;
  /** Extra grain 0..1 */
  grain: number;
};

export const PRESETS: Preset[] = [
  { id: 'original', name: 'Original', group: 'film', matrix: IDENTITY, vignette: 0, grain: 0 },
  { id: 'gold', name: 'Gold', group: 'film', matrix: compose(temperature(0.55), saturation(1.18), contrast(1.06), tint(0.02, 0.01, -0.02)), vignette: 0.15, grain: 0.18 },
  { id: 'fuji', name: 'Fuji', group: 'film', matrix: compose(temperature(-0.25), tint(-0.01, 0.025, 0.02), saturation(1.08), contrast(1.04)), vignette: 0.1, grain: 0.18 },
  { id: 'film35', name: '35mm', group: 'film', matrix: compose(temperature(0.3), saturation(0.92), contrast(0.96), fade(0.9)), vignette: 0.25, grain: 0.5 },
  { id: 'portra', name: 'Portra', group: 'film', matrix: compose(temperature(0.25), saturation(0.95), contrast(0.98), tint(0.03, 0.015, 0.0), fade(0.4)), vignette: 0.08, grain: 0.25 },
  { id: 'flash', name: 'Flash', group: 'flash', matrix: compose(contrast(1.25), brightness(0.07), saturation(1.22)), vignette: 0.28, grain: 0.12 },
  { id: 'nightflash', name: 'Night', group: 'flash', matrix: compose(contrast(1.32), brightness(0.06), temperature(-0.15), tint(-0.01, 0.01, 0.02)), vignette: 0.62, grain: 0.35 },
  { id: 'rouge', name: 'Rouge', group: 'flash', matrix: compose(contrast(1.12), channelScale(1.18, 0.82, 0.86), tint(0.14, -0.02, 0.0)), vignette: 0.4, grain: 0.2 },
  { id: 'y2k', name: 'Y2K', group: 'flash', matrix: compose(contrast(1.18), saturation(1.25), tint(0.04, 0.0, 0.03), brightness(0.04)), vignette: 0.35, grain: 0.3 },
  { id: 'golden', name: 'Golden', group: 'light', matrix: compose(temperature(0.75), brightness(0.05), saturation(1.1), tint(0.04, 0.0, -0.04)), vignette: 0.1, grain: 0.1 },
  { id: 'glow', name: 'Glow', group: 'light', matrix: compose(contrast(0.86), brightness(0.1), saturation(0.95), fade(0.6)), vignette: 0, grain: 0.05 },
  { id: 'blush', name: 'Blush', group: 'light', matrix: compose(tint(0.06, 0.0, 0.035), saturation(1.05), brightness(0.03), contrast(0.98)), vignette: 0.05, grain: 0.05 },
  { id: 'bluehour', name: 'Dusk', group: 'light', matrix: compose(temperature(-0.6), brightness(-0.03), tint(0.0, 0.0, 0.08), contrast(0.96), saturation(0.95)), vignette: 0.2, grain: 0.15 },
  { id: 'webcam', name: 'Webcam', group: 'light', matrix: compose(temperature(0.6), contrast(0.9), brightness(0.08), saturation(0.9)), vignette: 0.3, grain: 0.55 },
  { id: 'booth', name: 'Booth', group: 'mono', matrix: compose(sepia(0.85), contrast(1.06), brightness(0.02)), vignette: 0.35, grain: 0.3 },
  { id: 'mono', name: 'Mono', group: 'mono', matrix: compose(GRAYSCALE, contrast(1.15)), vignette: 0.2, grain: 0.3 },
  { id: 'noir', name: 'Noir', group: 'mono', matrix: compose(GRAYSCALE, contrast(1.4), brightness(-0.04)), vignette: 0.55, grain: 0.35 },
];

export const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  { id: 'film', label: 'Film' },
  { id: 'flash', label: 'Flash' },
  { id: 'light', label: 'Light' },
  { id: 'mono', label: 'Mono' },
];

export function getPreset(id: string | undefined): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Which preset approximates each AI look, so the editor's strength slider has an effect before the backend exists. */
export const LOOK_PRESET: Record<string, string> = {
  'point-and-shoot': 'flash',
  'after-dark': 'nightflash',
  rouge: 'rouge',
  paparazzi: 'flash',
  'golden-hour': 'golden',
  'blue-hour': 'bluehour',
  'window-light': 'glow',
  haze: 'glow',
  'y2k-compact': 'y2k',
  'film-35': 'film35',
  'booth-strip': 'booth',
  'bedroom-webcam': 'webcam',
};

export type FilterConfig = {
  preset: string;
  /** Strength of the preset, 0..1 */
  intensity: number;
  /** AI shots only: opacity of the generated result over the original, 0–1. */
  strength?: number;
  warmth: number; // -1..1
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  grain: number; // 0..1
  vignette: number; // 0..1
};

export const DEFAULT_CONFIG: FilterConfig = {
  preset: 'original',
  intensity: 1,
  warmth: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grain: 0,
  vignette: 0,
};

export type ResolvedFilter = { matrix: ColorMatrix; grain: number; vignette: number };

/** Collapses a config into one matrix plus grain and vignette amounts. */
export function resolveFilter(config: FilterConfig): ResolvedFilter {
  const preset = getPreset(config.preset);
  const base = lerp(IDENTITY, preset.matrix, config.intensity);
  const adjust = compose(
    temperature(config.warmth * 0.9),
    brightness(config.brightness * 0.25),
    contrast(1 + config.contrast * 0.5),
    saturation(1 + config.saturation * 0.6)
  );
  return {
    matrix: multiply(adjust, base),
    grain: Math.min(1, preset.grain * config.intensity + config.grain),
    vignette: Math.min(1, preset.vignette * config.intensity + config.vignette),
  };
}

export function isDefaultConfig(config: FilterConfig): boolean {
  return (
    config.preset === 'original' &&
    config.warmth === 0 &&
    config.brightness === 0 &&
    config.contrast === 0 &&
    config.saturation === 0 &&
    config.grain === 0 &&
    config.vignette === 0
  );
}
