import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, model: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1', keyed: Boolean(process.env.GEMINI_API_KEY) });
}
