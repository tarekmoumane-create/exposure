/** Web has no store. Everything resolves to mock mode. */

import { FALLBACK_PRICES, type PackId, type PlanId } from '@/data/products';

export type CustomerState = { plan: PlanId | 'free'; packTransactions: { id: string; packId: PackId }[] };
export type PurchaseOutcome = { ok: true; state: CustomerState } | { ok: false; cancelled: boolean; message: string };

export function isPurchasesEnabled(): boolean {
  return false;
}
export async function configurePurchases(): Promise<void> {}
export async function fetchCustomerState(): Promise<CustomerState | null> {
  return null;
}
export function addCustomerStateListener(): () => void {
  return () => {};
}
export async function fetchPrices(): Promise<Record<string, string>> {
  return FALLBACK_PRICES;
}
export async function purchasePlan(): Promise<PurchaseOutcome> {
  return { ok: false, cancelled: false, message: 'Purchases are not available on web.' };
}
export async function purchasePack(): Promise<PurchaseOutcome> {
  return { ok: false, cancelled: false, message: 'Purchases are not available on web.' };
}
export async function restorePurchases(): Promise<PurchaseOutcome> {
  return { ok: false, cancelled: false, message: 'Purchases are not available on web.' };
}

export function isPurchasesMockable(): boolean {
  return true;
}
