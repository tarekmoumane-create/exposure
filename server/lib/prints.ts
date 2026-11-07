/**
 * Mail-order prints. The app uploads each frame, Stripe takes payment and the address on its hosted
 * page, and a paid order goes to the Prodigi print lab, which prints and ships it.
 *
 * Physical goods must not use in-app purchase (App Review guideline 3.1.3(e)).
 *
 * Print files sit in Redis under an unguessable token because Prodigi fetches assets by public URL.
 * They expire by themselves after FILE_TTL_S. Stripe holds the card and address; the order record
 * here keeps only what is needed to show status, and the address goes straight to the lab.
 */
import crypto from 'node:crypto';

import { isRedisConfigured, redis } from './ledger.js';

const PRODIGI_BASE = process.env.PRODIGI_ENV === 'live' ? 'https://api.prodigi.com/v4.0' : 'https://api.sandbox.prodigi.com/v4.0';
const STRIPE_BASE = 'https://api.stripe.com/v1';

export const FILE_TTL_S = 21 * 86_400;
const ORDER_TTL_S = 200 * 86_400;
const WEBHOOK_TOLERANCE_S = 300;

export const MIN_PRINTS = 4;
export const MAX_PRINTS = 36;
/** C-Type silver halide photo paper, confirmed in the live catalogue on 7 Nov 2026 at $0.25 a print. */
export const PRINT_SKU = process.env.PRODIGI_SKU ?? 'GLOBAL-PHO-4X6';
/** Required by this SKU: gloss or lustre. */
const PRINT_ATTRIBUTES = { finish: process.env.PRODIGI_FINISH ?? 'lustre' };
/** The SKU's print area in pixels, portrait. */
export const PRINT_WIDTH = 1223;
export const PRINT_HEIGHT = 1783;
export const PRICE_PER_PRINT_CENTS = Number(process.env.PRINT_PRICE_CENTS ?? 149);
export const SHIPPING_CENTS = Number(process.env.PRINT_SHIPPING_CENTS ?? 699);
export const COUNTRY = process.env.PRINT_COUNTRY ?? 'US';
const CURRENCY = 'usd';

/** A test payment must never reach the live lab: it would print and bill a real order. */
function testPaymentsOnLiveLab(): boolean {
  return process.env.PRODIGI_ENV === 'live' && Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test'));
}

export function printsEnabled(): boolean {
  if (testPaymentsOnLiveLab()) return false;
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.PRODIGI_API_KEY && isRedisConfigured());
}

export function publicBase(): string {
  return (process.env.PUBLIC_API_URL ?? 'https://exposure-api.vercel.app').replace(/\/$/, '');
}

export type PrintOrder = {
  id: string;
  /** Only the app that placed the order holds this; it is required to read the order back. */
  secret: string;
  tokens: string[];
  roll: string;
  status: 'awaiting_payment' | 'paid' | 'at_lab' | 'failed';
  /** How many times the lab has refused this paid order. */
  labAttempts?: number;
  stripeSession?: string;
  prodigiId?: string;
  createdAt: number;
};

const token = () => crypto.randomBytes(24).toString('base64url');

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// ---------------------------------------------------------------- Files

export async function storeFile(base64: string): Promise<string> {
  const id = token();
  await redis('SET', `printfile:${id}`, base64, 'EX', FILE_TTL_S);
  return id;
}

export async function readFile(id: string): Promise<Buffer | null> {
  const base64 = await redis<string | null>('GET', `printfile:${id}`);
  return base64 ? Buffer.from(base64, 'base64') : null;
}

export async function hasFile(id: string): Promise<boolean> {
  return (await redis<number>('EXISTS', `printfile:${id}`)) === 1;
}

// ---------------------------------------------------------------- Orders

export async function saveOrder(order: PrintOrder): Promise<void> {
  await redis('SET', `printorder:${order.id}`, JSON.stringify(order), 'EX', ORDER_TTL_S);
}

export async function loadOrder(id: string): Promise<PrintOrder | null> {
  const raw = await redis<string | null>('GET', `printorder:${id}`);
  return raw ? (JSON.parse(raw) as PrintOrder) : null;
}

export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function newOrder(tokens: string[], roll: string): PrintOrder {
  return { id: `ord_${token().slice(0, 20)}`, secret: token(), tokens, roll, status: 'awaiting_payment', createdAt: Date.now() };
}

// ---------------------------------------------------------------- Prodigi

async function prodigi<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(`${PRODIGI_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'X-API-Key': process.env.PRODIGI_API_KEY!, 'Content-Type': 'application/json' },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`prodigi ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

type Money = { amount: string; currency: string };
type Quote = { outcome: string; quotes?: { shipmentMethod: string; costSummary: { items: Money; shipping: Money; totalCost?: Money; totalTax?: Money } }[] };

/** What the lab charges for this order, in cents of the store currency. */
export async function labCostCents(count: number): Promise<number> {
  const quote = await prodigi<Quote>('/quotes', {
    method: 'POST',
    body: {
      shippingMethod: 'budget',
      destinationCountryCode: COUNTRY,
      currencyCode: CURRENCY.toUpperCase(),
      items: [{ sku: PRINT_SKU, copies: count, attributes: PRINT_ATTRIBUTES, assets: [{ printArea: 'default' }] }],
    },
  });
  const cost = quote.quotes?.[0]?.costSummary;
  if (!cost) throw new Error(`prodigi quote: ${quote.outcome}`);
  const total = cost.totalCost ?? { amount: String(Number(cost.items.amount) + Number(cost.shipping.amount)), currency: cost.items.currency };
  if (total.currency.toLowerCase() !== CURRENCY) throw new Error(`prodigi quote in ${total.currency}`);
  return Math.ceil(Number(total.amount) * 100);
}

export const customerTotalCents = (count: number) => count * PRICE_PER_PRINT_CENTS + SHIPPING_CENTS;

/**
 * What an order must bring in to not lose money: the lab's price, 10% for the US sales tax its quotes
 * leave out, and Stripe's 2.9% + 30c.
 */
export function breakEvenCents(labCents: number, customerCents: number): number {
  return Math.ceil(labCents * 1.1 + customerCents * 0.029 + 30);
}

type ShippingDetails = { name?: string; address?: { line1?: string; line2?: string | null; city?: string; state?: string | null; postal_code?: string; country?: string } };

/** Sends a paid order to the lab. A repeated idempotencyKey returns the existing order, so a retry cannot print twice. */
export async function submitToLab(order: PrintOrder, shipping: ShippingDetails, email: string | undefined): Promise<string> {
  const address = shipping.address ?? {};
  const created = await prodigi<{ outcome: string; order?: { id: string } }>('/orders', {
    method: 'POST',
    body: {
      merchantReference: order.id,
      idempotencyKey: order.id,
      shippingMethod: 'Budget',
      recipient: {
        name: shipping.name ?? 'Exposure customer',
        email,
        address: {
          line1: address.line1,
          line2: address.line2 ?? undefined,
          townOrCity: address.city,
          stateOrCounty: address.state ?? undefined,
          postalOrZipCode: address.postal_code,
          countryCode: address.country,
        },
      },
      items: order.tokens.map((file, index) => ({
        merchantReference: `${order.id}-${index + 1}`,
        sku: PRINT_SKU,
        copies: 1,
        attributes: PRINT_ATTRIBUTES,
        sizing: 'fillPrintArea',
        assets: [{ printArea: 'default', url: `${publicBase()}/api/prints/file?token=${file}` }],
      })),
    },
  });
  if (!created.order?.id) throw new Error(`prodigi order: ${created.outcome}`);
  return created.order.id;
}

type LabOrder = {
  order?: {
    status?: { stage?: string; details?: Record<string, string> };
    shipments?: { status?: string; carrier?: { name?: string }; tracking?: { url?: string; number?: string } }[];
  };
};

export type OrderStatus = { stage: 'payment' | 'printing' | 'shipped' | 'cancelled' | 'problem'; trackingUrl?: string; carrier?: string };

export async function labStatus(order: PrintOrder): Promise<OrderStatus> {
  if (order.status === 'failed') return { stage: 'problem' };
  if (!order.prodigiId) return { stage: order.status === 'paid' ? 'printing' : 'payment' };
  const lab = await prodigi<LabOrder>(`/orders/${order.prodigiId}`);
  const stage = lab.order?.status?.stage;
  const shipped = lab.order?.shipments?.find((shipment) => shipment.status === 'Shipped');
  if (stage === 'Cancelled') return { stage: 'cancelled' };
  if (shipped) return { stage: 'shipped', trackingUrl: shipped.tracking?.url, carrier: shipped.carrier?.name };
  return { stage: 'printing' };
}

// ---------------------------------------------------------------- Stripe

function form(params: Record<string, string | number | boolean>): string {
  return Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
}

export async function createCheckout(order: PrintOrder, count: number): Promise<{ id: string; url: string }> {
  const response = await fetch(`${STRIPE_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      mode: 'payment',
      success_url: `${publicBase()}/api/prints/return?order=${order.id}&result=paid`,
      cancel_url: `${publicBase()}/api/prints/return?order=${order.id}&result=cancelled`,
      'line_items[0][quantity]': count,
      'line_items[0][price_data][currency]': CURRENCY,
      'line_items[0][price_data][unit_amount]': PRICE_PER_PRINT_CENTS,
      'line_items[0][price_data][product_data][name]': `4x6 print from ${order.roll}`.slice(0, 120),
      'shipping_address_collection[allowed_countries][0]': COUNTRY,
      'shipping_options[0][shipping_rate_data][display_name]': 'Standard shipping',
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': SHIPPING_CENTS,
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': CURRENCY,
      'metadata[order]': order.id,
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'on' ? { 'automatic_tax[enabled]': true } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.url || !json.id) throw new Error(`stripe: ${json.error?.message ?? response.status}`);
  return { id: json.id, url: json.url };
}

/** Checks a Stripe-Signature header against the raw body, in constant time. */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_S) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((signature) => sameSecret(signature, expected));
}

/** Gives the customer their money back, for an order the lab would not take. */
export async function refundPayment(paymentIntent: string, order: string): Promise<void> {
  const response = await fetch(`${STRIPE_BASE}/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `refund-${order}` },
    body: form({ payment_intent: paymentIntent, 'metadata[order]': order }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`stripe refund ${response.status}`);
}

export type CheckoutSession = {
  id: string;
  payment_intent?: string;
  payment_status?: string;
  metadata?: { order?: string };
  customer_details?: { email?: string };
  collected_information?: { shipping_details?: ShippingDetails };
};
