/**
 * Mail-order prints. Frames upload to the Exposure API, payment and the address are taken on
 * Stripe's hosted page (physical goods cannot use in-app purchase), and the lab prints and ships.
 */

import * as WebBrowser from 'expo-web-browser';

import { blendFrame } from '@/lib/render';
import { prepareForUpload } from '@/lib/image-io';
import type { Frame } from '@/store/app-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;
const PRINT_EDGE = 2048;
const UPLOADS_AT_ONCE = 3;

export type PrintConfig = { enabled: boolean; pricePerPrintCents: number; shippingCents: number; country: string; minPrints: number; maxPrints: number };
export type PrintStage = 'payment' | 'printing' | 'shipped' | 'cancelled' | 'problem';
export type PrintStatus = { stage: PrintStage; trackingUrl?: string; carrier?: string };

export const PRINTS_OFF: PrintConfig = { enabled: false, pricePerPrintCents: 0, shippingCents: 0, country: 'US', minPrints: 4, maxPrints: 36 };
/** With no API (web preview) the flow runs on these so it can still be seen. */
const PREVIEW: PrintConfig = { enabled: true, pricePerPrintCents: 149, shippingCents: 699, country: 'US', minPrints: 4, maxPrints: 36 };

const headers = { 'Content-Type': 'application/json', ...(APP_TOKEN ? { 'x-exposure-app': APP_TOKEN } : {}) };

export class PrintError extends Error {}

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function fetchPrintConfig(): Promise<PrintConfig> {
  if (!API_URL) return __DEV__ ? PREVIEW : PRINTS_OFF;
  try {
    const response = await fetch(`${API_URL}/api/prints/config`, { signal: AbortSignal.timeout(6_000) });
    return response.ok ? ((await response.json()) as PrintConfig) : PRINTS_OFF;
  } catch {
    return PRINTS_OFF;
  }
}

async function failure(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    message = ((await response.json()) as { error?: { message?: string } }).error?.message ?? fallback;
  } catch {}
  throw new PrintError(message);
}

async function uploadFrame(frame: Frame): Promise<string> {
  const flattened = await blendFrame(frame);
  const { data } = await prepareForUpload(flattened, PRINT_EDGE, 0.92);
  const response = await fetch(`${API_URL}/api/prints/upload`, { method: 'POST', headers, body: JSON.stringify({ data }) });
  if (!response.ok) await failure(response, 'A photo did not upload. Try again.');
  return ((await response.json()) as { token: string }).token;
}

export type CheckoutResult = { paid: false } | { paid: true; orderId: string; secret: string };

/** Uploads the chosen frames, then opens payment. Resolves once the payment sheet has closed. */
export async function orderPrints(frames: Frame[], roll: string, onProgress: (done: number) => void): Promise<CheckoutResult> {
  if (!API_URL) {
    onProgress(frames.length);
    return { paid: true, orderId: `preview-${Date.now()}`, secret: 'preview' };
  }

  const tokens: string[] = new Array(frames.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < frames.length) {
      const index = next++;
      tokens[index] = await uploadFrame(frames[index]);
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: UPLOADS_AT_ONCE }, worker));

  const response = await fetch(`${API_URL}/api/prints/checkout`, { method: 'POST', headers, body: JSON.stringify({ tokens, roll }) });
  if (!response.ok) await failure(response, 'Checkout could not start. Try again.');
  const { url, orderId, secret } = (await response.json()) as { url: string; orderId: string; secret: string };

  const result = await WebBrowser.openAuthSessionAsync(url, 'exposure://prints');
  const paid = result.type === 'success' && result.url.includes('result=paid');
  return paid ? { paid: true, orderId, secret } : { paid: false };
}

export async function fetchPrintStatus(orderId: string, secret: string): Promise<PrintStatus | null> {
  if (!API_URL) return { stage: 'printing' };
  try {
    const query = `id=${encodeURIComponent(orderId)}&secret=${encodeURIComponent(secret)}`;
    const response = await fetch(`${API_URL}/api/prints/order?${query}`, { headers, signal: AbortSignal.timeout(8_000) });
    return response.ok ? ((await response.json()) as PrintStatus) : null;
  } catch {
    return null;
  }
}
