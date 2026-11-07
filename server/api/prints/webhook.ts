import type { VercelRequest, VercelResponse } from '@vercel/node';

import { type CheckoutSession, loadOrder, type PrintOrder, refundPayment, saveOrder, submitToLab, verifyStripeSignature } from '../../lib/prints.js';

const MAX_LAB_ATTEMPTS = 4;

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
  if (order.prodigiId || order.status === 'failed') return res.status(200).json({ duplicate: true });

  // Recorded first, so the app shows the order as paid while the lab call runs.
  const paid: PrintOrder = { ...order, status: 'paid' };
  await saveOrder(paid);

  try {
    const shipping = session.collected_information?.shipping_details ?? {};
    const prodigiId = await submitToLab(paid, shipping, session.customer_details?.email);
    await saveOrder({ ...paid, status: 'at_lab', prodigiId });
    return res.status(200).json({ ok: true });
  } catch (error) {
    const labAttempts = (order.labAttempts ?? 0) + 1;
    console.error('[prints/webhook] lab rejected', order.id, labAttempts, (error as Error).message.slice(0, 300));
    if (labAttempts < MAX_LAB_ATTEMPTS) {
      // A non-2xx makes Stripe retry, which rides out a lab outage.
      await saveOrder({ ...paid, labAttempts });
      return res.status(502).end();
    }
    // The lab will not take this order: the customer gets their money back and the app says so.
    try {
      if (session.payment_intent) await refundPayment(session.payment_intent, order.id);
      await saveOrder({ ...paid, labAttempts, status: 'failed' });
      return res.status(200).json({ refunded: true });
    } catch (refundError) {
      console.error('[prints/webhook] REFUND FAILED', order.id, (refundError as Error).message.slice(0, 200));
      await saveOrder({ ...paid, labAttempts });
      return res.status(502).end();
    }
  }
}
