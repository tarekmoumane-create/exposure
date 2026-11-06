/**
 * A finished roll bundled with the app, developed by the real pipeline (server/scripts/roll.ts) on
 * Sunny 200. Anyone can explore it before paying, and no AI call is made to show it.
 */

import { type Roll } from '@/store/app-store';

const PAIRS: [number, number][] = [
  [require('@/assets/images/sample/01-before.jpg'), require('@/assets/images/sample/01-after.jpg')],
  [require('@/assets/images/sample/02-before.jpg'), require('@/assets/images/sample/02-after.jpg')],
  [require('@/assets/images/sample/03-before.jpg'), require('@/assets/images/sample/03-after.jpg')],
  [require('@/assets/images/sample/04-before.jpg'), require('@/assets/images/sample/04-after.jpg')],
  [require('@/assets/images/sample/05-before.jpg'), require('@/assets/images/sample/05-after.jpg')],
  [require('@/assets/images/sample/06-before.jpg'), require('@/assets/images/sample/06-after.jpg')],
  [require('@/assets/images/sample/07-before.jpg'), require('@/assets/images/sample/07-after.jpg')],
  [require('@/assets/images/sample/08-before.jpg'), require('@/assets/images/sample/08-after.jpg')],
  [require('@/assets/images/sample/09-before.jpg'), require('@/assets/images/sample/09-after.jpg')],
];

export const SAMPLE_ROLL_ID = 'sample';

export const SAMPLE_ROLL: Roll = {
  id: SAMPLE_ROLL_ID,
  name: 'Sample roll',
  lookId: 'gold-200',
  createdAt: 0,
  frames: PAIRS.map(([sourceUri, resultUri], index) => ({ id: `sample-${index + 1}`, sourceUri, resultUri, status: 'done', strength: 1 })),
};
