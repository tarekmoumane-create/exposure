/**
 * Exercises the prints flow with Redis, Stripe and Prodigi stubbed out: pricing guard, signature
 * checks, idempotent lab submission and status mapping. No network, no keys.   npx tsx scripts/prints-test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec_x', PRODIGI_API_KEY: 'pk', KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 't', APP_TOKEN: 'app' });

const kv = new Map<string, string>();
const calls: { url: string; body?: string }[] = [];
let labCost = '6.00';
let labOrders = 0;
let labDown = false;
let refunds = 0;
globalThis.fetch = (async (input: string, init?: RequestInit) => {
  const url = String(input);
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  calls.push({ url, body: init?.body as string });
  if (url.startsWith('https://redis.test')) {
    const [cmd, key, value] = JSON.parse(init!.body as string) as string[];
    if (cmd === 'SET') { kv.set(key, value); return json({ result: 'OK' }); }
    if (cmd === 'GET') return json({ result: kv.get(key) ?? null });
    if (cmd === 'EXISTS') return json({ result: kv.has(key) ? 1 : 0 });
  }
  if (url.includes('/quotes')) return json({ outcome: 'Created', quotes: [{ shipmentMethod: 'Budget', costSummary: { items: { amount: '3.00', currency: 'USD' }, shipping: { amount: '3.00', currency: 'USD' }, totalCost: { amount: labCost, currency: 'USD' } } }] });
  if (url.includes('/checkout/sessions')) return json({ id: 'cs_1', url: 'https://checkout.stripe.test/x' });
  if (url.endsWith('/refunds')) { refunds++; return json({ id: 're_1' }); }
  if (url.endsWith('/orders') && init?.method === 'POST') { if (labDown) return json({ outcome: 'ValidationFailed' }, 400); labOrders++; return json({ outcome: 'Created', order: { id: 'ord_lab1' } }); }
  if (url.includes('/orders/ord_lab1')) return json({ order: { status: { stage: 'InProgress' }, shipments: [{ status: 'Shipped', carrier: { name: 'USPS' }, tracking: { url: 'https://track.test/1' } }] } });
  throw new Error(`unexpected ${url}`);
}) as typeof fetch;

const { default: checkout } = await import('../api/prints/checkout.js');
const { default: webhook } = await import('../api/prints/webhook.js');
const { default: orderStatus } = await import('../api/prints/order.js');
const P = await import('../lib/prints.js');

function mockRes() {
  const out: { status?: number; json?: Record<string, unknown> } = {};
  const res = { status(code: number) { out.status = code; return res; }, json(v: Record<string, unknown>) { out.json = v; return res; }, end() { return res; }, setHeader() {} };
  return { res: res as never, out };
}
const appReq = (body: unknown) => ({ method: 'POST', headers: { 'x-exposure-app': 'app' }, body }) as never;

const tokens: string[] = [];
for (let i = 0; i < 6; i++) tokens.push(await P.storeFile('aGVsbG8='));

// Price guard: refuse when the lab costs more than the customer pays.
labCost = '50.00';
{ const { res, out } = mockRes(); await checkout(appReq({ tokens, roll: 'Test' }), res); assert.equal(out.status, 503); assert.equal(out.json!.error && (out.json!.error as { code: string }).code, 'pricing'); }
labCost = '6.00';

{ const { res, out } = mockRes(); await checkout({ method: 'POST', headers: {}, body: {} } as never, res); assert.equal(out.status, 401); }
{ const { res, out } = mockRes(); await checkout(appReq({ tokens: tokens.slice(0, 2), roll: 'Test' }), res); assert.equal(out.status, 400); }
{ const { res, out } = mockRes(); await checkout(appReq({ tokens: [...tokens.slice(1), 'A'.repeat(32)], roll: 'Test' }), res); assert.equal(out.status, 410); }

const { res, out } = mockRes();
await checkout(appReq({ tokens, roll: 'Test' }), res);
assert.equal(out.status, 200);
const orderId = out.json!.orderId as string;
const secret = out.json!.secret as string;
const stripeBody = calls.find((c) => c.url.includes('checkout/sessions'))!.body!;
assert.match(stripeBody, /mode=payment/);
assert.match(stripeBody, new RegExp(`metadata%5Border%5D=${orderId}`));

const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', metadata: { order: orderId }, customer_details: { email: 'a@b.test' }, collected_information: { shipping_details: { name: 'A B', address: { line1: '1 St', city: 'NYC', state: 'NY', postal_code: '10001', country: 'US' } } } } } });
const signed = (body: string, key = 'whsec_x', t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac('sha256', key).update(`${t}.${body}`).digest('hex')}`;
const hook = (signature: string) => Object.assign(Readable.from([Buffer.from(event)]), { method: 'POST', headers: { 'stripe-signature': signature } }) as never;

{ const { res, out } = mockRes(); await webhook(hook(signed(event, 'wrong')), res); assert.equal(out.status, 400); assert.equal(labOrders, 0); }
{ const { res } = mockRes(); await webhook(hook(signed(event, 'whsec_x', Math.floor(Date.now() / 1000) - 3600)), res); assert.equal(labOrders, 0, 'stale signature must not print'); }
{ const { res, out } = mockRes(); await webhook(hook(signed(event)), res); assert.equal(out.status, 200); assert.equal(labOrders, 1); }
{ const { res, out } = mockRes(); await webhook(hook(signed(event)), res); assert.equal(out.status, 200); assert.equal(labOrders, 1, 'a repeated webhook must not print twice'); }

const labBody = JSON.parse(calls.filter((c) => c.url.endsWith('/orders')).at(-1)!.body!);
assert.equal(labBody.items.length, 6);
assert.equal(labBody.items[0].attributes.finish, 'lustre');
assert.equal(labBody.recipient.address.postalOrZipCode, '10001');
assert.match(labBody.items[0].assets[0].url, /\/api\/prints\/file\?token=/);
assert.equal(labBody.idempotencyKey, orderId);

// A lab that keeps refusing: retried, then refunded and shown as a problem. Never left hanging.
labDown = true;
const { res: res2, out: out2 } = mockRes();
await checkout(appReq({ tokens, roll: 'Refused' }), res2);
const badOrder = out2.json!.orderId as string;
const badSecret = out2.json!.secret as string;
const badEvent = event.replace(orderId, badOrder).replace('"id":"cs_1"', '"id":"cs_2","payment_intent":"pi_2"');
const badHook = () => Object.assign(Readable.from([Buffer.from(badEvent)]), { method: 'POST', headers: { 'stripe-signature': signed(badEvent) } }) as never;
for (let attempt = 1; attempt <= 3; attempt++) { const { res, out } = mockRes(); await webhook(badHook(), res); assert.equal(out.status, 502, `attempt ${attempt} asks Stripe to retry`); }
assert.equal((await P.loadOrder(badOrder))!.status, 'paid', 'shown as paid while retrying');
{ const { res, out } = mockRes(); await webhook(badHook(), res); assert.equal(out.status, 200); }
assert.equal(refunds, 1);
{ const { res, out } = mockRes(); await webhook(badHook(), res); assert.equal(out.status, 200); assert.equal(refunds, 1, 'refund happens once'); }
{ const { res, out } = mockRes(); await orderStatus({ headers: { 'x-exposure-app': 'app' }, query: { id: badOrder, secret: badSecret } } as never, res); assert.equal(out.json!.stage, 'problem'); }
labDown = false;

{ const { res, out } = mockRes(); await orderStatus({ headers: { 'x-exposure-app': 'app' }, query: { id: orderId, secret: 'nope'.repeat(8) } } as never, res); assert.equal(out.status, 404); }
{ const { res, out } = mockRes(); await orderStatus({ headers: { 'x-exposure-app': 'app' }, query: { id: orderId, secret } } as never, res); assert.equal(out.json!.stage, 'shipped'); assert.equal(out.json!.trackingUrl, 'https://track.test/1'); }

// Print files: exact print size, whole photo kept, landscape turned to fit.
const sharp = (await import('sharp')).default;
const { composePrint } = await import('../lib/print-file.js');
const red = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#ff0000' } }).jpeg().toBuffer();
const redShare = async (file: Buffer) => {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] < 60) count++;
  return { width: info.width, height: info.height, share: count / (info.width * info.height) };
};
for (const [w, h, label, expected] of [[1638, 2048, '4:5 portrait', 0.83], [2048, 1638, '4:5 landscape', 0.83], [1365, 2048, '2:3', 1]] as const) {
  const out = await redShare(await composePrint(await red(w, h)));
  assert.deepEqual([out.width, out.height], [P.PRINT_WIDTH, P.PRINT_HEIGHT], label);
  assert.ok(Math.abs(out.share - expected) < 0.03, `${label}: photo covers ${out.share.toFixed(3)}, nothing cropped`);
}

// Test payments must never reach the live lab.
process.env.PRODIGI_ENV = 'live';
assert.equal(P.printsEnabled(), false);
process.env.STRIPE_SECRET_KEY = 'sk_live_x';
assert.equal(P.printsEnabled(), true);

// Real prices from the live catalogue: every order size must clear costs.
for (const [count, lab] of [[4, 804], [6, 854], [12, 1004], [36, 1604]] as const) {
  const total = P.customerTotalCents(count);
  assert.ok(total >= P.breakEvenCents(lab, total), `${count} prints lose money`);
  console.log(`${count} prints: customer ${total}c, margin ${total - P.breakEvenCents(lab, total)}c`);
}

console.log('prints flow: all checks passed');
