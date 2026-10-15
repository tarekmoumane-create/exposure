/**
 * The look library. Names, groups and copy are Exposure's own; each look maps to a real camera,
 * film stock or light. The prompts live server-side in server/lib/relight.ts so they can be
 * tuned without an app release. Ids must match the server registry.
 */

import { type ImageSourcePropType } from 'react-native';

export type LookGroup = 'flash' | 'digicam' | 'film' | 'light' | 'booth';

export type Look = {
  id: string;
  name: string;
  group: LookGroup;
  tagline: string;
  description: string;
  /** Placeholder gradient, used only if the preview image fails to load. */
  colors: [string, string];
  /** Bundled before/after preview pair, produced by the app's own pipeline. */
  before: ImageSourcePropType;
  after: ImageSourcePropType;
  /** 'free' looks change the format (the photobooth strip); everything else keeps the photo's framing. */
  framing?: 'locked' | 'free';
};

export const LOOK_GROUPS: { id: LookGroup; label: string }[] = [
  { id: 'flash', label: 'Flash' },
  { id: 'digicam', label: 'Digicam' },
  { id: 'film', label: 'Film' },
  { id: 'light', label: 'Light' },
  { id: 'booth', label: 'Booth' },
];

export const LOOKS: Look[] = [
  {
    id: 'night-flash',
    name: 'Night Flash',
    group: 'flash',
    tagline: 'Compact camera, flash on, lights off.',
    description: 'The nightlife digicam photo: bright flash-lit subject, black background, crushed shadows, a little noise.',
    colors: ['#2B3340', '#05070A'],
    before: require('@/assets/images/looks/night-flash-before.jpg'),
    after: require('@/assets/images/looks/night-flash-after.jpg'),
  },
  {
    id: 'day-flash',
    name: 'Day Flash',
    group: 'flash',
    tagline: 'Daylight with the flash forced on.',
    description: 'The G7X daytime look: fill flash on the subject, punchy colour, crisp detail, background a touch darker.',
    colors: ['#F7D9A8', '#8A5A2B'],
    before: require('@/assets/images/looks/day-flash-before.jpg'),
    after: require('@/assets/images/looks/day-flash-after.jpg'),
  },
  {
    id: 'red-flash',
    name: 'Red Flash',
    group: 'flash',
    tagline: 'Red gel over the flash. Teal everywhere else.',
    description: 'A saturated red flash on the subject with cool teal shadows behind. Built for going-out photos.',
    colors: ['#FF3B3B', '#2A0A0F'],
    before: require('@/assets/images/looks/red-flash-before.jpg'),
    after: require('@/assets/images/looks/red-flash-after.jpg'),
  },
  {
    id: 'paparazzi',
    name: 'Paparazzi',
    group: 'flash',
    tagline: 'Caught leaving. Blown-out flash, deep blacks.',
    description: 'Overexposed press-camera flash with crushed shadows. Looks like someone shouted your name.',
    colors: ['#FFFFFF', '#111111'],
    before: require('@/assets/images/looks/paparazzi-before.jpg'),
    after: require('@/assets/images/looks/paparazzi-after.jpg'),
  },
  {
    id: 'digicam',
    name: 'Digicam',
    group: 'digicam',
    tagline: 'The restaurant photo everyone asks about.',
    description: 'A modern 1-inch compact with its flash in Auto: glossy clean skin, rich colour, warm lamps behind.',
    colors: ['#E8C9A0', '#5A3A24'],
    before: require('@/assets/images/looks/digicam-before.jpg'),
    after: require('@/assets/images/looks/digicam-after.jpg'),
  },
  {
    id: 'y2k-digicam',
    name: 'Y2K Digicam',
    group: 'digicam',
    tagline: '2003 memory stick. Flash on.',
    description: 'Three-megapixel CCD compact: blown flash highlights, sharpening halos, colour speckle, cool-magenta cast.',
    colors: ['#F5A3C7', '#4A2140'],
    before: require('@/assets/images/looks/y2k-digicam-before.jpg'),
    after: require('@/assets/images/looks/y2k-digicam-after.jpg'),
  },
  {
    id: 'gold-200',
    name: 'Gold 200',
    group: 'film',
    tagline: 'Warm consumer negative, lab scanned.',
    description: 'The warm yellow-leaning 35mm stock: peach skin, olive greens, creamy highlights, soft organic grain.',
    colors: ['#E8B65A', '#5A3A14'],
    before: require('@/assets/images/looks/gold-200-before.jpg'),
    after: require('@/assets/images/looks/gold-200-after.jpg'),
  },
  {
    id: 'superia-400',
    name: 'Superia 400',
    group: 'film',
    tagline: 'Cooler, greener, punchier 35mm.',
    description: 'The drugstore 400 roll: vivid greens, deep cyan blues, pink skin, coarser grain, lifted green shadows.',
    colors: ['#6FAE7A', '#1F3A2A'],
    before: require('@/assets/images/looks/superia-400-before.jpg'),
    after: require('@/assets/images/looks/superia-400-after.jpg'),
  },
  {
    id: 'film-35',
    name: '35mm',
    group: 'film',
    tagline: 'Expired roll, shoebox print.',
    description: 'Faded vintage film: milky lifted blacks, muted warm colour, soft grain, a cheap lens.',
    colors: ['#D9A066', '#3B2A1A'],
    before: require('@/assets/images/looks/film-35-before.jpg'),
    after: require('@/assets/images/looks/film-35-after.jpg'),
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    group: 'light',
    tagline: 'Flat daylight becomes the last hour of sun.',
    description: 'Relights the scene with low, warm sunset light. Long soft shadows, glowing hair edges, warm sky.',
    colors: ['#FFC46B', '#B5541C'],
    before: require('@/assets/images/looks/golden-hour-before.jpg'),
    after: require('@/assets/images/looks/golden-hour-after.jpg'),
  },
  {
    id: 'blue-hour',
    name: 'Blue Hour',
    group: 'light',
    tagline: 'Dusk tones, city glow, soft contrast.',
    description: 'The twenty minutes after sunset. Cool blue ambient light with warm points of artificial light.',
    colors: ['#5C7CFA', '#0E1230'],
    before: require('@/assets/images/looks/blue-hour-before.jpg'),
    after: require('@/assets/images/looks/blue-hour-after.jpg'),
  },
  {
    id: 'window-light',
    name: 'Window Light',
    group: 'light',
    tagline: 'Soft, directional, editorial.',
    description: 'Large soft window light from one side. Clean skin, gentle falloff, the look of a studio apartment shoot.',
    colors: ['#EDE6DA', '#6B6459'],
    before: require('@/assets/images/looks/window-light-before.jpg'),
    after: require('@/assets/images/looks/window-light-after.jpg'),
  },
  {
    id: 'glow',
    name: 'Glow',
    group: 'light',
    tagline: 'Warm haze and star sparkles.',
    description: 'A golden haze over the frame with soft bloom and tiny star sparkles on every highlight. Dreamy, still sharp.',
    colors: ['#FFE3A3', '#C98A3A'],
    before: require('@/assets/images/looks/glow-before.jpg'),
    after: require('@/assets/images/looks/glow-after.jpg'),
  },
  {
    id: 'booth-strip',
    name: 'Photobooth',
    group: 'booth',
    tagline: 'Four frames, one curtain, sepia.',
    description: 'A vintage photobooth strip. Four poses generated from your one photo, curtain backdrop, paper texture.',
    colors: ['#C8B59A', '#2E2419'],
    before: require('@/assets/images/looks/booth-strip-before.jpg'),
    after: require('@/assets/images/looks/booth-strip-after.jpg'),
    framing: 'free',
  },
  {
    id: 'webcam',
    name: 'Webcam',
    group: 'booth',
    tagline: '2010 laptop camera, lamp light, low-res.',
    description: 'The Photo Booth look: warm lamp light, 640 by 480 detail, video noise, cosy bedroom tones.',
    colors: ['#F2B8A0', '#3A1E1A'],
    before: require('@/assets/images/looks/webcam-before.jpg'),
    after: require('@/assets/images/looks/webcam-after.jpg'),
  },
];

export function getLook(id: string | undefined): Look | undefined {
  return LOOKS.find((look) => look.id === id);
}
