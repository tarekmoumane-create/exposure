/**
 * Camera and film rendering recipes, one per look.
 *
 * Each recipe is the measurable part of a look: tone curve, colour science, grain, optics and
 * compression. The numbers come from measuring reference frames (research/look-science.md) and
 * from how the real cameras and stocks behave. A recipe never changes what is in the photo, only
 * how it is rendered, so it is safe on any input: people, landscapes, food, screenshots.
 *
 * Radii are fractions of the long edge so a recipe looks the same at any resolution.
 */
import {
  channelGain,
  chromaticAberration,
  clip,
  glow,
  grain,
  haze,
  hueAdjust,
  type Img,
  jpegRoundTrip,
  longEdge,
  saturation,
  soften,
  splitTone,
  starFlare,
  tone,
  unsharp,
  vibrance,
  vignette,
  centerLight,
} from './pixels.js';

export type Recipe = (img: Img, seed: number) => Promise<Img>;

const px = (img: Img, frac: number) => frac * longEdge(img);

/**
 * 35mm consumer colour negative (Kodak Gold 200 character), scanned.
 * Warm yellow-leaning palette, greens toward olive, lifted milky blacks, creamy highlight shoulder,
 * organic grain strongest in the mids and shadows, red-orange halation on the brightest points.
 */
export const film35: Recipe = async (img, seed) => {
  tone(img, { black: 0.045, white: 0.965, contrast: 1.04, pivot: 0.45, shoulder: 0.72, toe: 0.06 });
  hueAdjust(img, [
    { hue: 110, width: 50, shift: -14, sat: 0.84, value: 0.97 }, // foliage greens go yellow-olive
    { hue: 215, width: 40, shift: -10, sat: 0.9 }, // skies lean cyan, slightly muted
    { hue: 25, width: 26, sat: 1.08 }, // skin to peach
    { hue: 55, width: 20, sat: 1.1, value: 1.03 }, // yellows glow
  ]);
  splitTone(img, [-0.012, 0.008, 0.006], [0.03, 0.012, -0.02]);
  channelGain(img, 1.03, 1.0, 0.955);
  saturation(img, 0.94);
  vibrance(img, 0.12);
  soften(img, px(img, 0.0005), 0.55);
  chromaticAberration(img, 0.0012);
  glow(img, { threshold: 0.82, radius: 0.012, amount: 0.28, color: [1, 0.38, 0.12] }); // halation
  glow(img, { threshold: 0.9, radius: 0.004, amount: 0.1 }); // bloom
  grain(img, { amount: 0.055, size: 1.7, highlightProtect: 0.65, chroma: 0.3, seed });
  vignette(img, { amount: 0.16, radius: 0.6, softness: 0.7 });
  clip(img);
  return img;
};

/**
 * Early-2000s 3-megapixel CCD compact. Real resolution loss and JPEG block structure, heavy
 * in-camera sharpening halos, cool-magenta white balance, punchy saturated colour, highlights that
 * clip to white, luminance noise with colour speckle in the shadows.
 */
export const y2kCompact: Recipe = async (img, seed) => {
  grain(img, { amount: 0.045, size: 1.0, highlightProtect: 0.75, shadowBoost: 1.3, chroma: 0.55, seed });
  channelGain(img, 1.02, 0.985, 1.035);
  tone(img, { black: 0.02, white: 1.0, contrast: 1.14, pivot: 0.45, exposure: 0.05 });
  clip(img);
  saturation(img, 1.15);
  hueAdjust(img, [
    { hue: 215, width: 40, sat: 1.15 },
    { hue: 0, width: 25, sat: 1.1 },
  ]);
  img = await jpegRoundTrip(img, { scale: 0.5, quality: 70 });
  unsharp(img, px(img, 0.0008), 1.15);
  chromaticAberration(img, 0.0025);
  vignette(img, { amount: 0.22, radius: 0.55, softness: 0.7 });
  clip(img);
  return img;
};

/** Modern 1-inch compact (G7X class) JPEG: crisp, saturated, slightly cool, clean shadows. */
export const pointAndShoot: Recipe = async (img, seed) => {
  tone(img, { black: 0.0, white: 1.0, contrast: 1.12, pivot: 0.45 });
  clip(img);
  channelGain(img, 0.995, 1.0, 1.02);
  saturation(img, 1.14);
  hueAdjust(img, [
    { hue: 215, width: 40, sat: 1.15 },
    { hue: 0, width: 25, sat: 1.1 },
  ]);
  unsharp(img, px(img, 0.0006), 0.55);
  grain(img, { amount: 0.018, size: 1.0, highlightProtect: 0.8, shadowBoost: 1.0, chroma: 0.3, seed });
  vignette(img, { amount: 0.12, radius: 0.6, softness: 0.7 });
  clip(img);
  return img;
};

/** Night flash on a compact: crushed blacks, cyan-green shadows, warm highlights, high-ISO noise, strong vignette. */
export const afterDark: Recipe = async (img, seed) => {
  tone(img, { black: 0.0, white: 1.0, contrast: 1.18, pivot: 0.4, toe: 0.12 });
  clip(img);
  splitTone(img, [-0.03, 0.02, 0.025], [0.02, 0.01, -0.03]);
  saturation(img, 1.08);
  unsharp(img, px(img, 0.0006), 0.5);
  grain(img, { amount: 0.04, size: 1.1, highlightProtect: 0.8, shadowBoost: 1.5, chroma: 0.4, seed });
  vignette(img, { amount: 0.38, radius: 0.5, softness: 0.8 });
  clip(img);
  return img;
};

/** Red-gel flash: compressed highlights, teal shadows, red-pushed highlights, grainy and a touch flat. */
export const rouge: Recipe = async (img, seed) => {
  tone(img, { black: 0.035, white: 0.86, contrast: 0.95, pivot: 0.4, shoulder: 0.6 });
  splitTone(img, [-0.03, 0.012, 0.03], [0.05, -0.01, -0.01]);
  hueAdjust(img, [
    { hue: 0, width: 30, sat: 1.15 },
    { hue: 340, width: 20, sat: 1.1 },
  ]);
  saturation(img, 1.1);
  grain(img, { amount: 0.05, size: 1.5, highlightProtect: 0.5, chroma: 0.3, seed });
  vignette(img, { amount: 0.32, radius: 0.5, softness: 0.8 });
  clip(img);
  return img;
};

/** Press flash: very high contrast, crushed blacks, blown whites, cool-neutral, visible grain. */
export const paparazzi: Recipe = async (img, seed) => {
  tone(img, { black: 0.0, white: 1.0, contrast: 1.3, pivot: 0.42, toe: 0.1, exposure: 0.1 });
  clip(img);
  channelGain(img, 0.99, 1.0, 1.02);
  saturation(img, 0.95);
  unsharp(img, px(img, 0.0006), 0.6);
  grain(img, { amount: 0.035, size: 1.0, highlightProtect: 0.8, shadowBoost: 1.2, chroma: 0.25, seed });
  vignette(img, { amount: 0.25, radius: 0.55, softness: 0.75 });
  clip(img);
  return img;
};

/** Low sun: warm shadows and highlights, lifted blacks, greens to gold, sun bloom and faint halation. */
export const goldenHour: Recipe = async (img, seed) => {
  tone(img, { black: 0.04, white: 0.975, contrast: 0.98, pivot: 0.45, shoulder: 0.8 });
  splitTone(img, [0.025, 0.012, -0.02], [0.03, 0.015, -0.015]);
  hueAdjust(img, [
    { hue: 110, width: 45, shift: -12, sat: 1.05, value: 1.02 },
    { hue: 25, width: 25, sat: 1.08 },
  ]);
  saturation(img, 1.08);
  vibrance(img, 0.1);
  glow(img, { threshold: 0.78, radius: 0.03, amount: 0.18, color: [1, 0.78, 0.5] });
  glow(img, { threshold: 0.88, radius: 0.008, amount: 0.12, color: [1, 0.45, 0.2] });
  grain(img, { amount: 0.022, size: 1.5, highlightProtect: 0.7, chroma: 0.2, seed });
  vignette(img, { amount: 0.08, radius: 0.6, softness: 0.7 });
  clip(img);
  return img;
};

/** Evening on a fast lens: a touch under, blue shadows, warm haloed lights, high-ISO grain. */
export const blueHour: Recipe = async (img, seed) => {
  tone(img, { black: 0.03, white: 0.95, contrast: 0.96, pivot: 0.4, exposure: -0.1 });
  splitTone(img, [-0.03, -0.01, 0.045], [0.035, 0.02, -0.02]);
  glow(img, { threshold: 0.8, radius: 0.012, amount: 0.22, color: [1, 0.85, 0.6] });
  grain(img, { amount: 0.045, size: 1.2, highlightProtect: 0.7, shadowBoost: 1.0, chroma: 0.35, seed });
  vignette(img, { amount: 0.2, radius: 0.55, softness: 0.75 });
  clip(img);
  return img;
};

/** Soft window portrait: low contrast, slightly warm, gentle softness, very fine grain. */
export const windowLight: Recipe = async (img, seed) => {
  tone(img, { black: 0.02, white: 0.985, contrast: 0.96, pivot: 0.5, shoulder: 0.85 });
  channelGain(img, 1.015, 1.0, 0.985);
  saturation(img, 0.98);
  soften(img, px(img, 0.0004), 0.4);
  grain(img, { amount: 0.015, size: 1.3, highlightProtect: 0.7, chroma: 0.15, seed });
  vignette(img, { amount: 0.05, radius: 0.6, softness: 0.7 });
  clip(img);
  return img;
};

/** Backlit warm haze through an old lens: lifted blacks, bloom, four-point flares, halation. */
export const hazeLook: Recipe = async (img, seed) => {
  channelGain(img, 1.04, 1.0, 0.93);
  haze(img, [1.0, 0.9, 0.72], 0.1);
  tone(img, { black: 0.06, white: 0.98, contrast: 0.9, pivot: 0.5, shoulder: 0.8 });
  glow(img, { threshold: 0.78, radius: 0.03, amount: 0.35, color: [1, 0.9, 0.72] });
  starFlare(img, { threshold: 0.9, length: 0.07, amount: 0.7 });
  glow(img, { threshold: 0.85, radius: 0.01, amount: 0.2, color: [1, 0.5, 0.25] });
  saturation(img, 0.95);
  vibrance(img, 0.1);
  grain(img, { amount: 0.035, size: 1.6, highlightProtect: 0.6, chroma: 0.25, seed });
  vignette(img, { amount: 0.1, radius: 0.6, softness: 0.7 });
  clip(img);
  return img;
};

/** 2010 laptop webcam: 640x480 detail, heavy compression, warm washed tones, video noise. */
export const bedroomWebcam: Recipe = async (img, seed) => {
  grain(img, { amount: 0.07, size: 1.0, highlightProtect: 0.7, shadowBoost: 1.5, chroma: 0.6, seed });
  channelGain(img, 1.06, 1.0, 0.94);
  tone(img, { black: 0.05, white: 0.97, contrast: 0.88, pivot: 0.5, exposure: 0.08 });
  splitTone(img, [0.0, 0.015, -0.005], [0.02, -0.01, 0.015]);
  saturation(img, 0.9);
  img = await jpegRoundTrip(img, { scale: 0.42, quality: 62 });
  soften(img, px(img, 0.0008), 0.5);
  vignette(img, { amount: 0.25, radius: 0.5, softness: 0.8 });
  clip(img);
  return img;
};

/** Chemical photobooth print on paper: desaturated warm sepia, grain, soft vignette. */
export const boothStrip: Recipe = async (img, seed) => {
  saturation(img, 0.55);
  channelGain(img, 1.06, 0.97, 0.86);
  tone(img, { black: 0.03, white: 0.96, contrast: 1.06, pivot: 0.45 });
  grain(img, { amount: 0.045, size: 1.8, highlightProtect: 0.6, chroma: 0.15, seed });
  vignette(img, { amount: 0.3, radius: 0.55, softness: 0.8 });
  clip(img);
  return img;
};

// ---------------------------------------------------------------------------------------------
// Fallback relights: used only when the model's relight failed verification, so the user still
// gets a photo in the spirit of the look with nothing invented.

export const fallbackFlash: Recipe = async (img) => {
  centerLight(img, { gain: 0.08, falloff: 0.35 });
  return img;
};

export const fallbackNightFlash: Recipe = async (img) => {
  tone(img, { exposure: -0.8 });
  centerLight(img, { gain: 0.45, falloff: 0.6 });
  return img;
};

export const fallbackRedFlash: Recipe = async (img) => {
  tone(img, { exposure: -0.6 });
  centerLight(img, { gain: 0.35, falloff: 0.55 });
  channelGain(img, 1.25, 0.8, 0.78);
  return img;
};

export const fallbackGolden: Recipe = async (img) => {
  channelGain(img, 1.08, 1.0, 0.86);
  tone(img, { exposure: 0.05, contrast: 1.02 });
  return img;
};

export const fallbackBlue: Recipe = async (img) => {
  tone(img, { exposure: -0.8 });
  channelGain(img, 0.86, 0.94, 1.12);
  return img;
};

export const fallbackWindow: Recipe = async (img) => {
  tone(img, { exposure: 0.1, contrast: 0.95 });
  return img;
};

export const fallbackWebcam: Recipe = async (img) => {
  tone(img, { exposure: -0.3 });
  channelGain(img, 1.1, 1.0, 0.85);
  centerLight(img, { gain: 0.15, falloff: 0.4 });
  return img;
};

export const identity: Recipe = async (img) => img;
