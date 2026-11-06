import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authorized, reject } from '../../lib/http.js';
import { createCheckout, customerTotalCents, hasFile, labCostCents, MAX_PRINTS, MIN_PRINTS, newOrder, printsEnabled, saveOrder, TOKEN_PATTERN } from '../../lib/prints.js';

/** POST /api/prints/checkout { tokens: string[], roll: string } -> { url, orderId, secret } */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return reject(res, 405, 'method', 'POST only');
  if (!authorized(req, res)) return;
  if (!printsEnabled()) return reject(res, 503, 'off', 'Prints are not available right now.');

  const body = req.body as { tokens?: unknown; roll?: unknown } | undefined;
  const tokens = Array.isArray(body?.tokens) ? body.tokens.filter((t): t is string => typeof t === 'string' && TOKEN_PATTERN.test(t)) : [];
  const roll = typeof body?.roll === 'string' ? body.roll.slice(0, 60) : 'your roll';
  if (tokens.length < MIN_PRINTS || tokens.length > MAX_PRINTS) return reject(res, 400, 'count', `Choose ${MIN_PRINTS} to ${MAX_PRINTS} prints.`);

  try {
    const present = await Promise.all(tokens.map(hasFile));
    if (present.includes(false)) return reject(res, 410, 'expired', 'Your photos expired. Start the order again.');

    // Never sell below what the lab charges, whatever the configured prices say.
    const cost = await labCostCents(tokens.length);
    if (customerTotalCents(tokens.length) < cost) {
      console.error('[prints/checkout] price below lab cost', { prints: tokens.length, cost });
      return reject(res, 503, 'pricing', 'Prints are not available right now.');
    }

    const order = newOrder(tokens, roll);
    const session = await createCheckout(order, tokens.length);
    await saveOrder({ ...order, stripeSession: session.id });
    return res.status(200).json({ url: session.url, orderId: order.id, secret: order.secret });
  } catch (error) {
    console.error('[prints/checkout]', (error as Error).message.slice(0, 300));
    return reject(res, 502, 'upstream', 'Checkout could not start. Try again.');
  }
}
