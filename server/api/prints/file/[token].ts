import type { VercelRequest, VercelResponse } from '@vercel/node';

import { readFile, TOKEN_PATTERN } from '../../../lib/prints.js';

/** GET /api/prints/file/:token: the print lab downloads a frame from here. The token is the only key. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.token ?? '');
  if (!TOKEN_PATTERN.test(token)) return res.status(404).end();
  const file = await readFile(token);
  if (!file) return res.status(404).end();
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(200).send(file);
}
