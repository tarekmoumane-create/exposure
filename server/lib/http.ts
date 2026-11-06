import type { VercelRequest, VercelResponse } from '@vercel/node';

export function reject(res: VercelResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

/** Same app token check as /api/generate. Returns false after answering when it fails. */
export function authorized(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.APP_TOKEN;
  if (expected && req.headers['x-exposure-app'] !== expected) {
    reject(res, 401, 'unauthorized', 'Missing or invalid app token');
    return false;
  }
  return true;
}
