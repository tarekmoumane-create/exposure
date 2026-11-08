/**
 * The looks. Each maps to a real camera, film or light. The prompts live server-side in
 * server/lib/relight.ts so they can be tuned without an app release. Ids must match the server.
 */

import { type ImageSourcePropType } from 'react-native';

export type LookGroup = 'flash' | 'compact' | 'film' | 'light';

export type Look = {
  id: string;
  name: string;
  group: LookGroup;
  /** What it looks like, in one line. */
  tagline: string;
  /** The camera, film or light it stands for, as a short spec line. Factual, never a brand. */
  spec: string;
  /** The look's colour, like a film box: a soft tint for grounds and a deep shade for type on it. */
  tint: string;
  deep: string;
  /** When to load it. */
  bestFor: string;
  description: string;
  /** Bundled before/after preview pair, produced by the app's own pipeline. */
  before: ImageSourcePropType;
  after: ImageSourcePropType;
};

export const LOOK_GROUPS: { id: LookGroup; label: string }[] = [
  { id: 'flash', label: 'Flash' },
  { id: 'compact', label: 'Compacts' },
  { id: 'film', label: 'Film' },
  { id: 'light', label: 'Light' },
];

export const LOOKS: Look[] = [
  {
    id: 'night-flash',
    name: 'Night Out',
    group: 'flash',
    tagline: 'On-camera flash in a dark room.',
    spec: 'Direct flash · night',
    tint: '#DCD6F0',
    deep: '#3B2F6B',
    bestFor: 'Bars, parties, the walk home',
    description: 'A bright flash-lit subject, a background that falls away to black, crushed shadows and a little noise.',
    before: require('@/assets/images/looks/night-flash-before.jpg'),
    after: require('@/assets/images/looks/night-flash-after.jpg'),
  },
  {
    id: 'day-flash',
    name: 'Noon Flash',
    group: 'flash',
    tagline: 'Daylight with the flash forced on.',
    spec: 'Fill flash · daylight',
    tint: '#F7E7A6',
    deep: '#6E5200',
    bestFor: 'Street, lunch, holiday afternoons',
    description: 'Fill flash on the subject, punchy colour, crisp detail and a background a touch darker than real life.',
    before: require('@/assets/images/looks/day-flash-before.jpg'),
    after: require('@/assets/images/looks/day-flash-after.jpg'),
  },
  {
    id: 'red-flash',
    name: 'Red Room',
    group: 'flash',
    tagline: 'A red gel over the flash.',
    spec: 'Red gel · flash',
    tint: '#F6CFC6',
    deep: '#8A2717',
    bestFor: 'Going-out photos you want to feel loud',
    description: 'Saturated red flash on the subject with cool teal shadows behind.',
    before: require('@/assets/images/looks/red-flash-before.jpg'),
    after: require('@/assets/images/looks/red-flash-after.jpg'),
  },
  {
    id: 'digicam',
    name: 'Pocket Compact',
    group: 'compact',
    tagline: 'A modern 1-inch compact, flash on Auto.',
    spec: '1-inch compact · flash',
    tint: '#F2DCC2',
    deep: '#6B4220',
    bestFor: 'Dinner, friends, anything indoors',
    description: 'Glossy clean skin, rich colour and warm lamps glowing behind.',
    before: require('@/assets/images/looks/digicam-before.jpg'),
    after: require('@/assets/images/looks/digicam-after.jpg'),
  },
  {
    id: 'y2k-digicam',
    name: '2003 Compact',
    group: 'compact',
    tagline: 'Three megapixels and a memory stick.',
    spec: 'CCD compact · 3 MP',
    tint: '#D2E3F1',
    deep: '#1E4868',
    bestFor: 'Friends, nights in, photo dumps',
    description: 'A small CCD sensor: blown flash highlights, sharpening halos, colour speckle and a cool-magenta cast.',
    before: require('@/assets/images/looks/y2k-digicam-before.jpg'),
    after: require('@/assets/images/looks/y2k-digicam-after.jpg'),
  },
  {
    id: 'gold-200',
    name: 'Sunny 200',
    group: 'film',
    tagline: 'Warm consumer negative, lab scanned.',
    spec: 'ISO 200 · colour negative',
    tint: '#F8DD9C',
    deep: '#714800',
    bestFor: 'Weekends, trips, whole days out',
    description: 'Peach skin, olive greens, creamy highlights and soft organic grain.',
    before: require('@/assets/images/looks/gold-200-before.jpg'),
    after: require('@/assets/images/looks/gold-200-after.jpg'),
  },
  {
    id: 'superia-400',
    name: 'Vibrant 400',
    group: 'film',
    tagline: 'The cooler, greener drugstore roll.',
    spec: 'ISO 400 · colour negative',
    tint: '#D3E6CF',
    deep: '#2C5629',
    bestFor: 'Outdoors, parks, overcast days',
    description: 'Vivid greens, deep cyan blues, pink skin, coarser grain and lifted green shadows.',
    before: require('@/assets/images/looks/superia-400-before.jpg'),
    after: require('@/assets/images/looks/superia-400-after.jpg'),
  },
  {
    id: 'film-35',
    name: 'Shoebox 35',
    group: 'film',
    tagline: 'An expired roll, found years later.',
    spec: 'Expired 35 mm film',
    tint: '#EDD6D3',
    deep: '#6A3A36',
    bestFor: 'Sets you want to feel like a memory',
    description: 'Milky lifted blacks, muted warm colour, soft grain and a cheap lens.',
    before: require('@/assets/images/looks/film-35-before.jpg'),
    after: require('@/assets/images/looks/film-35-after.jpg'),
  },
  {
    id: 'golden-hour',
    name: 'Last Light',
    group: 'light',
    tagline: 'Flat daylight becomes the last hour of sun.',
    spec: 'Low sun · warm light',
    tint: '#F9D2B2',
    deep: '#853A10',
    bestFor: 'Beaches, rooftops, anything outside',
    description: 'Low, warm sunset light with long soft shadows and glowing hair edges.',
    before: require('@/assets/images/looks/golden-hour-before.jpg'),
    after: require('@/assets/images/looks/golden-hour-after.jpg'),
  },
  {
    id: 'blue-hour',
    name: 'After Sunset',
    group: 'light',
    tagline: 'The twenty minutes after the sun goes.',
    spec: 'Blue hour · mixed light',
    tint: '#CED6F1',
    deep: '#26346E',
    bestFor: 'City evenings',
    description: 'Cool blue ambient light with warm points of artificial light.',
    before: require('@/assets/images/looks/blue-hour-before.jpg'),
    after: require('@/assets/images/looks/blue-hour-after.jpg'),
  },
];

/**
 * The only looks someone sees before they pay: one compact, one flash, one film. The full
 * catalogue (Looks tab, the home rail, every look in New roll) opens up with a plan or pack.
 */
export const STARTER_LOOKS: Look[] = ['digicam', 'night-flash', 'film-35'].map((id) => LOOKS.find((look) => look.id === id)!);

/** The look's catalogue number, like "No. 06". */
export function lookNumber(look: Look): string {
  return `No. ${String(LOOKS.indexOf(look) + 1).padStart(2, '0')}`;
}

export function getLook(id: string | undefined): Look | undefined {
  return LOOKS.find((look) => look.id === id);
}
