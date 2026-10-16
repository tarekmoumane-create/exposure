import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

import type { ImageSize, ThinkingLevel } from '../lib/gemini.js';
import { reserve } from '../lib/ledger.js';
import { getLook, runLook } from '../lib/pipeline.js';

/**
 * POST /api/generate
 * Body: { lookId, image: { mimeType, data (base64), width?, height? }, strength?: number, deviceId?: string }
 * Headers: x-exposure-user (RevenueCat app user id), x-exposure-day (the app's local YYYY-MM-DD)
 * Returns: { image: { mimeType, data }, model, ms, meta: { relit, fallback, attempts }, credits?: { daily, pack, plan } }
 * Out of photos: 402 { error: { code: 'credits' }, credits }
 *
 * Photos are never written to disk or logged. The function holds the bytes in memory for the
 * duration of one run and returns the result.
 */

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1';
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.1-flash-image').split(',').map((m) => m.trim()).filter(Boolean);
const IMAGE_SIZE = (process.env.GEMINI_IMAGE_SIZE ?? '2K') as ImageSize;
const THINKING_LEVEL = (process.env.GEMINI_THINKING_LEVEL ?? 'medium') as ThinkingLevel;
// Vercel rejects request bodies over 4.5 MB before the handler runs, so stay well under it. The app
// uploads a 1536px JPEG (~0.5–1.2 MB base64).
const MAX_BASE64_CHARS = 4_000_000;
// Responses are buffered too; keep the returned image under this so a render always arrives.
const MAX_RESPONSE_BASE64_CHARS = 3_600_000;
/** The function budget (vercel.json maxDuration) minus headroom for rendering, encoding and transfer. */
const DEADLINE_MS = 50_000;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

type Body = {
  lookId?: string;
  image?: { mimeType?: string; data?: string; width?: number; height?: number };
  strength?: number;
  deviceId?: string;
};

function reject(res: VercelResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-exposure-app, x-exposure-user, x-exposure-day');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return reject(res, 405, 'method', 'POST only');

  const expectedToken = process.env.APP_TOKEN;
  if (expectedToken && req.headers['x-exposure-app'] !== expectedToken) {
    return reject(res, 401, 'unauthorized', 'Missing or invalid app token');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reject(res, 500, 'config', 'GEMINI_API_KEY is not set');

  let body: Body | undefined;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body | undefined;
  } catch {
    return reject(res, 400, 'body', 'Malformed request');
  }
  const lookId = body?.lookId ?? '';
  if (!getLook(lookId)) return reject(res, 400, 'look', `Unknown look "${lookId}"`);

  const mimeType = body?.image?.mimeType ?? '';
  const data = body?.image?.data ?? '';
  if (!ALLOWED_TYPES.has(mimeType)) return reject(res, 400, 'image', 'Unsupported image type');
  if (!data || data.length > MAX_BASE64_CHARS) return reject(res, 413, 'image', 'Image missing or too large');

  const strength = typeof body?.strength === 'number' ? Math.min(1, Math.max(0, body.strength)) : undefined;

  const reservation = await reserve(req.headers['x-exposure-user'], req.headers['x-exposure-day']);
  if (!reservation.ok) {
    return res.status(reservation.status).json({ error: { code: reservation.code, message: reservation.message }, credits: reservation.balance });
  }
  const release = reservation.enforced ? reservation.release : async () => null;

  const started = Date.now();
  try {
    const result = await runLook(lookId, { mimeType, data: Buffer.from(data, 'base64') }, {
      apiKey,
      model: MODEL,
      fallbackModels: FALLBACK_MODELS,
      imageSize: IMAGE_SIZE,
      thinkingLevel: THINKING_LEVEL,
      deadline: started + DEADLINE_MS,
      strength,
    });
    const image = await fitResponse(result.jpeg);
    // The app's Cancel promises no charge: if it already hung up, refund.
    const credits = (await release(!req.socket?.destroyed)) ?? undefined;
    console.log('[generate]', lookId, result.model, `${result.ms}ms`, `${Math.round(image.data.length / 1024)}kB`, result.stages.join(' | '));
    return res.status(200).json({
      image,
      model: result.model,
      ms: Date.now() - started,
      meta: { relit: result.relit, fallback: result.fallback, attempts: result.attempts, width: result.width, height: result.height },
      credits,
    });
  } catch (error) {
    await release(false);
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[generate]', lookId, status ?? '-', message.slice(0, 200));
    if (status === 429 || status === 503) return reject(res, 429, 'busy', 'The studio is busy. Try again in a moment.');
    if (status === 504) return reject(res, 504, 'timeout', 'That took too long. Try again, nothing was charged.');
    if (status === 422 || status === 400) return reject(res, 422, 'unusable', 'This photo could not be processed. Try another one.');
    return reject(res, 502, 'upstream', 'The look could not be made right now.');
  }
}

/** Steps the JPEG quality down until the buffered response fits. Pixel dimensions are kept. */
async function fitResponse(jpeg: Buffer): Promise<{ mimeType: string; data: string }> {
  let data = jpeg.toString('base64');
  if (data.length <= MAX_RESPONSE_BASE64_CHARS) return { mimeType: 'image/jpeg', data };
  for (const quality of [86, 80, 74, 68]) {
    const out = await sharp(jpeg).jpeg({ quality, mozjpeg: true }).toBuffer();
    data = out.toString('base64');
    if (data.length <= MAX_RESPONSE_BASE64_CHARS || quality === 68) return { mimeType: 'image/jpeg', data };
  }
  return { mimeType: 'image/jpeg', data };
}
