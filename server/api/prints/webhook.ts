import type { VercelRequest, VercelResponse } from '@vercel/node';

import { type CheckoutSession, loadOrder, saveOrder, submitToLab, verifyStripeSignature } from '../../lib/prints.js';

/** Signature checks need the exact bytes Stripe sent. */
export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

/** POST /api/prints/webhook: Stripe calls this when a payment completes; the paid order goes to the lab. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const body = await rawBody(req);
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!secret || !verifyStripeSignature(body, req.headers['stripe-signature'] as string | undefined, secret)) return res.status(400).end();

  const event = JSON.parse(body) as { type: string; data: { object: CheckoutSession } };
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return res.status(200).json({ ignored: true });

  const session = event.data.object;
  if (session.payment_status === 'unpaid') return res.status(200).json({ waiting: true });
  const order = session.metadata?.order ? await loadOrder(session.metadata.order) : null;
  if (!order) {
    console.error('[prints/webhook] unknown order', session.id);
    return res.status(200).json({ unknown: true });
  }
  if (order.prodigiId) return res.status(200).json({ duplicate: true });

  try {
    const shipping = session.collected_information?.shipping_details ?? {};
    const prodigiId = await submitToLab(order, shipping, session.customer_details?.email);
    await saveOrder({ ...order, status: 'at_lab', prodigiId });
    return res.status(200).json({ ok: true });
  } catch (error) {
    // A non-2xx makes Stripe retry for days, which rides out a lab outage. The order stays paid.
    console.error('[prints/webhook] lab rejected', order.id, (error as Error).message.slice(0, 300));
    await saveOrder({ ...order, status: 'paid' });
    return res.status(502).end();
  }
}
