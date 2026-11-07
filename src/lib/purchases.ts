/**
 * RevenueCat wrapper. Real purchases run only on iOS/Android with a public key configured
 * (EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY). Without a key the app
 * falls back to mock mode, where plans and packs are granted locally so the flows stay testable.
 */

import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, LOG_LEVEL, type PurchasesStoreProduct } from 'react-native-purchases';

import { getDeviceId } from '@/lib/device';
import { ENTITLEMENT_ID, FALLBACK_PRICES, PACK_PRODUCTS, type PackId, PLAN_PRODUCTS, type PlanId, packForProduct, planForProduct } from '@/data/products';

export type CustomerState = {
  plan: PlanId | 'free';
  /** Consumable purchases seen on the account, by store transaction id. */
  packTransactions: { id: string; packId: PackId }[];
};

export type PurchaseOutcome =
  | { ok: true; state: CustomerState }
  | { ok: false; cancelled: boolean; message: string };

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

function apiKey(): string | undefined {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return undefined;
}

export function isPurchasesEnabled(): boolean {
  return Boolean(apiKey());
}

/**
 * Mock purchases only make sense while developing. A release build without a store key must not
 * hand out plans for free, so the app hides buying instead.
 */
export function isPurchasesMockable(): boolean {
  return __DEV__ || Platform.OS === 'web';
}

let configured = false;

export async function configurePurchases(): Promise<void> {
  const key = apiKey();
  if (!key || configured) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  // The keychain id usually survives a reinstall, so plans and unused packs stay with the phone.
  const appUserID = (await getDeviceId()) ?? undefined;
  Purchases.configure({ apiKey: key, appUserID });
  configured = true;
}

/** The RevenueCat app user id; the API keys the server-side photo balance on it. */
export async function getUserId(): Promise<string | null> {
  if (!configured) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

export function toCustomerState(info: CustomerInfo): CustomerState {
  const active = info.entitlements.active[ENTITLEMENT_ID];
  const plan = planForProduct(active?.productIdentifier) ?? 'free';
  const packTransactions = info.nonSubscriptionTransactions
    .map((transaction) => ({ id: transaction.transactionIdentifier, packId: packForProduct(transaction.productIdentifier) }))
    .filter((entry): entry is { id: string; packId: PackId } => entry.packId !== null);
  return { plan, packTransactions };
}

export async function fetchCustomerState(): Promise<CustomerState | null> {
  if (!configured) return null;
  try {
    return toCustomerState(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

export function addCustomerStateListener(listener: (state: CustomerState) => void): () => void {
  if (!configured) return () => {};
  const handler = (info: CustomerInfo) => listener(toCustomerState(info));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(handler);
  };
}

let productCache: Map<string, PurchasesStoreProduct> | null = null;

async function loadProducts(): Promise<Map<string, PurchasesStoreProduct>> {
  if (productCache) return productCache;
  const ids = [...Object.values(PLAN_PRODUCTS), ...Object.values(PACK_PRODUCTS).map((pack) => pack.productId)];
  const products = await Purchases.getProducts(ids);
  const map = new Map(products.map((product) => [product.identifier, product]));
  // Only remember a useful answer; an empty list (store hiccup, products not yet live) is retried next time.
  if (map.size > 0) productCache = map;
  return map;
}

/** Localized price strings keyed by product id, falling back to the USD list prices. */
export async function fetchPrices(): Promise<Record<string, string>> {
  if (!configured) return FALLBACK_PRICES;
  try {
    const products = await loadProducts();
    const prices: Record<string, string> = { ...FALLBACK_PRICES };
    products.forEach((product, id) => {
      prices[id] = product.priceString;
    });
    return prices;
  } catch {
    return FALLBACK_PRICES;
  }
}

async function purchaseProduct(productId: string): Promise<PurchaseOutcome> {
  try {
    const products = await loadProducts();
    const product = products.get(productId);
    if (!product) return { ok: false, cancelled: false, message: 'This option is not available right now.' };
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    return { ok: true, state: toCustomerState(customerInfo) };
  } catch (error) {
    const cancelled = Boolean((error as { userCancelled?: boolean }).userCancelled);
    return { ok: false, cancelled, message: cancelled ? '' : 'The purchase did not go through.' };
  }
}

export function purchasePlan(plan: PlanId): Promise<PurchaseOutcome> {
  return purchaseProduct(PLAN_PRODUCTS[plan]);
}

export function purchasePack(pack: PackId): Promise<PurchaseOutcome> {
  return purchaseProduct(PACK_PRODUCTS[pack].productId);
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, state: toCustomerState(info) };
  } catch {
    return { ok: false, cancelled: false, message: 'Couldn’t reach the store. Try again in a moment.' };
  }
}
