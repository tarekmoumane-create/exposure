/**
 * Store product identifiers. These must match App Store Connect / Play Console and the
 * RevenueCat product list exactly. Prices here are display fallbacks until the store returns
 * localized ones.
 */

import { type Plan } from '@/store/app-store';

export const ENTITLEMENT_ID = 'pro';

export type PlanId = Exclude<Plan, 'free'>;
export type PackId = 'credits10' | 'credits30' | 'credits80';

export const PLAN_PRODUCTS: Record<PlanId, string> = {
  weekly: 'app.exposure.weekly',
  yearly: 'app.exposure.yearly',
};

export const PACK_PRODUCTS: Record<PackId, { productId: string; credits: number }> = {
  credits10: { productId: 'app.exposure.credits10', credits: 10 },
  credits30: { productId: 'app.exposure.credits30', credits: 30 },
  credits80: { productId: 'app.exposure.credits80', credits: 80 },
};

export const FALLBACK_PRICES: Record<string, string> = {
  'app.exposure.weekly': '$5.99',
  'app.exposure.yearly': '$59.99',
  'app.exposure.credits10': '$2.99',
  'app.exposure.credits30': '$6.99',
  'app.exposure.credits80': '$12.99',
};

export function planForProduct(productId: string | undefined): PlanId | null {
  if (!productId) return null;
  const entry = (Object.entries(PLAN_PRODUCTS) as [PlanId, string][]).find(([, id]) => productId.startsWith(id));
  return entry ? entry[0] : null;
}

export function packForProduct(productId: string | undefined): PackId | null {
  if (!productId) return null;
  const entry = (Object.entries(PACK_PRODUCTS) as [PackId, { productId: string }][]).find(([, pack]) => productId === pack.productId);
  return entry ? entry[0] : null;
}

/** Public legal pages. These must be live before App Store review and match the App Store Connect URLs. */
export const LEGAL_URLS = {
  terms: 'https://exposure.app/terms',
  privacy: 'https://exposure.app/privacy',
  support: 'mailto:hello@exposure.app',
} as const;
