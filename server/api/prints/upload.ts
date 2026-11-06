import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

import { authorized, reject } from '../../lib/http.js';
import { printsEnabled, storeFile } from '../../lib/prints.js';

const MAX_BASE64_CHARS = 4_000_000;
/** Below this a 4x6 print looks soft (about 200 dpi on the long side). */
const MIN_LONG_EDGE = 1200;

/** POST /api/prints/upload { data: base64 JPEG } -> { token }. One frame per request (Vercel caps bodies at 4.5 MB). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return reject(res, 405, 'method', 'POST only');
  if (!authorized(req, res)) return;
  if (!printsEnabled()) return reject(res, 503, 'off', 'Prints are not available right now.');
  const data = (req.body as { data?: string } | undefined)?.data;
  if (!data || data.length > MAX_BASE64_CHARS) return reject(res, 413, 'image', 'Photo missing or too large');
  try {
    const meta = await sharp(Buffer.from(data, 'base64')).metadata();
    if (meta.format !== 'jpeg') return reject(res, 400, 'image', 'JPEG only');
    if (Math.max(meta.width ?? 0, meta.height ?? 0) < MIN_LONG_EDGE) return reject(res, 422, 'small', 'This photo is too small to print sharply.');
    return res.status(200).json({ token: await storeFile(data) });
  } catch (error) {
    console.error('[prints/upload]', (error as Error).message.slice(0, 200));
    return reject(res, 400, 'image', 'This photo could not be read.');
  }
}
