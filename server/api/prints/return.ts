import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Stripe returns here over https; this hands the browser sheet back to the app. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const result = req.query.result === 'paid' ? 'paid' : 'cancelled';
  res.setHeader('Location', `exposure://prints?result=${result}`);
  return res.status(302).end();
}
