/**
 * The launch look library.
 * Names, groups and copy are Exposure's own. The generation prompts live server-side in
 * server/lib/looks.ts so they can be tuned without an app release.
 */

import { type ImageSourcePropType } from 'react-native';

export type LookGroup = 'flash' | 'light' | 'era';

export type Look = {
  id: string;
  name: string;
  group: LookGroup;
  tagline: string;
  description: string;
  /** Placeholder gradient, used only if the preview image fails to load. */
  colors: [string, string];
  /** Bundled before/after preview pair. Placeholder portraits for now; swap for licensed pairs before launch. */
  before: ImageSourcePropType;
  after: ImageSourcePropType;
  /** 'free' looks change the format (the booth strip); everything else keeps the photo's framing. */
  framing?: 'locked' | 'free';
};

export const LOOK_GROUPS: { id: LookGroup; label: string }[] = [
  { id: 'flash', label: 'Flash' },
  { id: 'light', label: 'Light' },
  { id: 'era', label: 'Era' },
];

export const LOOKS: Look[] = [
  {
    id: 'point-and-shoot',
    name: 'Point & Shoot',
    group: 'flash',
    tagline: 'Daylight fill flash, compact-camera punch.',
    description:
      'The look of a pocket digital camera with the flash forced on in daylight. Crisp edges, saturated color, a little extra pop on skin.',
    colors: ['#F7D9A8', '#8A5A2B'],
    before: require('@/assets/images/looks/point-and-shoot-before.jpg'),
    after: require('@/assets/images/looks/point-and-shoot-after.jpg'),
  },
  {
    id: 'after-dark',
    name: 'After Dark',
    group: 'flash',
    tagline: 'Hard night flash, everything else falls away.',
    description:
      'Direct on-camera flash at night. The subject glows, the background drops into shadow, with a faint cool cast and grain.',
    colors: ['#2B3340', '#05070A'],
    before: require('@/assets/images/looks/after-dark-before.jpg'),
    after: require('@/assets/images/looks/after-dark-after.jpg'),
  },
  {
    id: 'rouge',
    name: 'Rouge',
    group: 'flash',
    tagline: 'Red gel flash. Night-out energy.',
    description:
      'A saturated red flash on the subject with cool teal shadows behind. Built for going-out photos.',
    colors: ['#FF3B3B', '#2A0A0F'],
    before: require('@/assets/images/looks/rouge-before.jpg'),
    after: require('@/assets/images/looks/rouge-after.jpg'),
  },
  {
    id: 'paparazzi',
    name: 'Paparazzi',
    group: 'flash',
    tagline: 'Caught leaving. Blown-out flash, deep blacks.',
    description:
      'Overexposed press-camera flash with crushed shadows. Looks like someone shouted your name.',
    colors: ['#FFFFFF', '#111111'],
    before: require('@/assets/images/looks/paparazzi-before.jpg'),
    after: require('@/assets/images/looks/paparazzi-after.jpg'),
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    group: 'light',
    tagline: 'Flat daylight becomes the last hour of sun.',
    description:
      'Relights the scene with low, warm sunset light. Long soft shadows, glowing hair edges, warm sky.',
    colors: ['#FFC46B', '#B5541C'],
    before: require('@/assets/images/looks/golden-hour-before.jpg'),
    after: require('@/assets/images/looks/golden-hour-after.jpg'),
  },
  {
    id: 'blue-hour',
    name: 'Blue Hour',
    group: 'light',
    tagline: 'Dusk tones, city glow, soft contrast.',
    description:
      'The twenty minutes after sunset. Cool blue ambient light with warm points of artificial light.',
    colors: ['#5C7CFA', '#0E1230'],
    before: require('@/assets/images/looks/blue-hour-before.jpg'),
    after: require('@/assets/images/looks/blue-hour-after.jpg'),
  },
  {
    id: 'window-light',
    name: 'Window Light',
    group: 'light',
    tagline: 'Soft, directional, editorial.',
    description:
      'Large soft window light from one side. Clean skin, gentle falloff, the look of a studio apartment shoot.',
    colors: ['#EDE6DA', '#6B6459'],
    before: require('@/assets/images/looks/window-light-before.jpg'),
    after: require('@/assets/images/looks/window-light-after.jpg'),
  },
  {
    id: 'haze',
    name: 'Haze',
    group: 'light',
    tagline: 'Warm bloom and star flares.',
    description:
      'A golden haze over the whole frame with soft starburst flares on highlights. Dreamy without going blurry.',
    colors: ['#FFE3A3', '#C98A3A'],
    before: require('@/assets/images/looks/haze-before.jpg'),
    after: require('@/assets/images/looks/haze-after.jpg'),
  },
  {
    id: 'y2k-compact',
    name: 'Y2K Compact',
    group: 'era',
    tagline: '2003 digicam. Date stamp optional.',
    description:
      'Low-megapixel compact camera look: slightly soft, over-sharpened edges, flash hotspots, warm cast.',
    colors: ['#F5A3C7', '#4A2140'],
    before: require('@/assets/images/looks/y2k-compact-before.jpg'),
    after: require('@/assets/images/looks/y2k-compact-after.jpg'),
  },
  {
    id: 'film-35',
    name: '35mm Film',
    group: 'era',
    tagline: 'Consumer color negative. Grain and halation.',
    description:
      'Warm consumer film stock with natural grain, soft highlight roll-off and a touch of halation around lights.',
    colors: ['#D9A066', '#3B2A1A'],
    before: require('@/assets/images/looks/film-35-before.jpg'),
    after: require('@/assets/images/looks/film-35-after.jpg'),
  },
  {
    id: 'booth-strip',
    name: 'Booth Strip',
    group: 'era',
    tagline: 'Four frames, one curtain, sepia.',
    description:
      'A vintage photobooth strip. Four poses generated from your one photo, curtain backdrop, paper texture.',
    colors: ['#C8B59A', '#2E2419'],
    before: require('@/assets/images/looks/booth-strip-before.jpg'),
    after: require('@/assets/images/looks/booth-strip-after.jpg'),
    framing: 'free',
  },
  {
    id: 'bedroom-webcam',
    name: 'Bedroom Webcam',
    group: 'era',
    tagline: '2010 laptop camera, lamp light, low-res.',
    description:
      'The laptop photo-booth look: warm lamp light, low resolution, slight noise, cozy bedroom tones.',
    colors: ['#F2B8A0', '#3A1E1A'],
    before: require('@/assets/images/looks/bedroom-webcam-before.jpg'),
    after: require('@/assets/images/looks/bedroom-webcam-after.jpg'),
  },
];

export function getLook(id: string | undefined): Look | undefined {
  return LOOKS.find((look) => look.id === id);
}
