import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authorized, reject } from '../../lib/http.js';
import { labStatus, loadOrder, sameSecret } from '../../lib/prints.js';

/** GET /api/prints/order?id=&secret= -> { stage, trackingUrl?, carrier? } */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorized(req, res)) return;
  const id = String(req.query.id ?? '');
  const secret = String(req.query.secret ?? '');
  const order = id ? await loadOrder(id) : null;
  if (!order || !sameSecret(order.secret, secret)) return reject(res, 404, 'order', 'Order not found');
  try {
    return res.status(200).json(await labStatus(order));
  } catch (error) {
    console.error('[prints/order]', (error as Error).message.slice(0, 200));
    return reject(res, 502, 'upstream', 'Status is not available right now.');
  }
}
