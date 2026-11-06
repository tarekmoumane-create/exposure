/**
 * Server-side credit ledger. The app's own counter is for display; this is the one that decides.
 *
 * Identity is the RevenueCat app user id the app sends in `x-exposure-user`. The plan and pack
 * purchases come from RevenueCat (read with the public SDK key, the same call the SDK makes), and the
 * balance lives in Upstash Redis. The rules mirror src/store/app-store.tsx exactly:
 *   - free: one welcome photo per device (x-exposure-device, kept in the iOS keychain so it survives
 *     a reinstall), capped per day across all users by FREE_DAILY_CAP so abuse has a ceiling
 *   - weekly 5/day, yearly 10/day, unused daily photos bank up to 3 days of allowance
 *   - each pack transaction adds its photos once
 * A photo is reserved before the model runs and refunded if it fails, so failures never charge.
 * A roll develops a few frames at once, so the balance lock is held only while it is read and
 * written, never while the model runs; MAX_IN_FLIGHT caps the frames running per user.
 *
 * Until both Redis and REVENUECAT_API_KEY (the public iOS SDK key) are set, the ledger is off and
 * every request is allowed, as before.
 */

type Plan = 'free' | 'weekly' | 'yearly';

const DAILY_ALLOWANCE: Record<Plan, number> = { free: 0, weekly: 5, yearly: 10 };
const ROLLOVER_DAYS = 3;
const ENTITLEMENT_ID = 'pro';
const PLAN_PRODUCTS: Record<string, Plan> = { 'app.exposure.weekly': 'weekly', 'app.exposure.yearly': 'yearly' };
const PACK_CREDITS: Record<string, number> = { 'app.exposure.credits10': 10, 'app.exposure.credits30': 30, 'app.exposure.credits80': 80 };
const LEDGER_TTL_S = 400 * 86_400;
const LOCK_TTL_S = 10;
const LOCK_WAIT_MS = 120;
const LOCK_ATTEMPTS = 25;
const MAX_IN_FLIGHT = 4;
const IN_FLIGHT_TTL_S = 120;
const WELCOME_PHOTOS = 1;
const FREE_DAILY_CAP = Number(process.env.FREE_DAILY_CAP ?? 300);

type Ledger = { day: string; daily: number; pack: number; plan: Plan; granted: string[]; welcomed?: boolean };

export type Balance = { daily: number; pack: number; plan: Plan };

export type Reservation =
  | { ok: true; enforced: false }
  | { ok: true; enforced: true; userId: string; balance: Balance; release: (charged: boolean) => Promise<Balance | null> }
  | { ok: false; status: number; code: string; message: string; balance?: Balance };

// ---------------------------------------------------------------- Redis (Upstash REST)

const REDIS_URL = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/** Both are needed: without RevenueCat every subscriber would look free and be refused. */
export function isLedgerEnabled(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN && process.env.REVENUECAT_API_KEY);
}

export async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  const response = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5_000),
  });
  const json = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || json.error) throw new Error(`redis ${command[0]}: ${json.error ?? response.status}`);
  return json.result as T;
}

// ---------------------------------------------------------------- RevenueCat

type Customer = { plan: Plan; packs: { id: string; credits: number }[] };

type Subscriber = {
  subscriber?: {
    entitlements?: Record<string, { expires_date: string | null; product_identifier: string }>;
    non_subscriptions?: Record<string, { id: string; store_transaction_id?: string }[]>;
  };
};

async function fetchCustomer(userId: string): Promise<Customer | null> {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${key}`, 'X-Platform': 'ios' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const subscriber = ((await response.json()) as Subscriber).subscriber ?? {};
    const entitlement = subscriber.entitlements?.[ENTITLEMENT_ID];
    const active = entitlement && (entitlement.expires_date === null || Date.parse(entitlement.expires_date) > Date.now());
    const plan = (active && PLAN_PRODUCTS[entitlement.product_identifier]) || 'free';
    const packs = Object.entries(subscriber.non_subscriptions ?? {}).flatMap(([productId, transactions]) =>
      PACK_CREDITS[productId] ? transactions.map((t) => ({ id: t.store_transaction_id ?? t.id, credits: PACK_CREDITS[productId] })) : []
    );
    return { plan, packs };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Rules (mirror the app)

function utcDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** The app's local calendar day, trusted only within a day of UTC so the clock cannot be wound. */
export function resolveDay(clientDay: unknown): string {
  if (typeof clientDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientDay)) {
    if (clientDay >= utcDay(-1) && clientDay <= utcDay(1)) return clientDay;
  }
  return utcDay();
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function applyRefresh(ledger: Ledger, today: string): Ledger {
  if (today <= ledger.day) return ledger;
  const allowance = DAILY_ALLOWANCE[ledger.plan];
  if (allowance === 0) return { ...ledger, day: today };
  const days = Math.min(ROLLOVER_DAYS, Math.max(1, daysBetween(ledger.day, today)));
  return { ...ledger, day: today, daily: Math.min(allowance * ROLLOVER_DAYS, ledger.daily + allowance * days) };
}

function applyPlan(ledger: Ledger, plan: Plan, today: string): Ledger {
  if (plan === ledger.plan) return ledger;
  const allowance = DAILY_ALLOWANCE[plan];
  const daily = plan === 'free' ? ledger.daily : Math.min(allowance * ROLLOVER_DAYS, Math.max(ledger.daily, allowance));
  return { ...ledger, plan, daily, day: today > ledger.day ? today : ledger.day };
}

function applyPacks(ledger: Ledger, packs: Customer['packs']): Ledger {
  const fresh = packs.filter((pack) => !ledger.granted.includes(pack.id));
  if (fresh.length === 0) return ledger;
  return {
    ...ledger,
    pack: ledger.pack + fresh.reduce((sum, pack) => sum + pack.credits, 0),
    granted: [...ledger.granted, ...fresh.map((pack) => pack.id)],
  };
}

const balanceOf = (ledger: Ledger): Balance => ({ daily: ledger.daily, pack: ledger.pack, plan: ledger.plan });

// ---------------------------------------------------------------- Reserve / release

const USER_ID = /^[A-Za-z0-9$:._-]{8,128}$/;
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `work` while holding the user's balance lock. Waits briefly when another frame holds it. */
async function withLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const key = `lock:${userId}`;
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
    if ((await redis<string | null>('SET', key, '1', 'NX', 'EX', LOCK_TTL_S)) === 'OK') {
      try {
        return await work();
      } finally {
        await redis('DEL', key).catch(() => {});
      }
    }
    await sleep(LOCK_WAIT_MS);
  }
  throw new Error('balance lock busy');
}

/** Grants the one free photo if this device has never had it and today's cap is not used up. */
async function grantWelcome(ledger: Ledger, deviceId: unknown): Promise<Ledger> {
  if (ledger.welcomed || typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) return ledger;
  // Check the device first: a repeat visitor must not use up today's cap for new people.
  const key = `welcome:${deviceId}`;
  if (await redis<string | null>('GET', key)) return { ...ledger, welcomed: true };
  const capKey = `freecap:${utcDay()}`;
  const spentToday = await redis<number>('INCR', capKey);
  if (spentToday === 1) await redis('EXPIRE', capKey, 2 * 86_400);
  if (spentToday > FREE_DAILY_CAP) return ledger;
  if ((await redis<string | null>('SET', key, '1', 'NX', 'EX', LEDGER_TTL_S * 2)) !== 'OK') return { ...ledger, welcomed: true };
  return { ...ledger, welcomed: true, pack: ledger.pack + WELCOME_PHOTOS };
}

/**
 * Takes one photo from the user's balance. `release(true)` keeps the charge, `release(false)`
 * refunds it. Infrastructure errors fail open so an outage of Redis or RevenueCat never blocks
 * paying users.
 */
export async function reserve(userId: unknown, clientDay: unknown, deviceId?: unknown): Promise<Reservation> {
  if (!isLedgerEnabled()) return { ok: true, enforced: false };
  if (typeof userId !== 'string' || !USER_ID.test(userId)) {
    return { ok: false, status: 426, code: 'update', message: 'Update Exposure to keep making photos.' };
  }

  const today = resolveDay(clientDay);
  const ledgerKey = `ledger:${userId}`;
  const flightKey = `inflight:${userId}`;

  try {
    const running = await redis<number>('INCR', flightKey);
    await redis('EXPIRE', flightKey, IN_FLIGHT_TTL_S);
    if (running > MAX_IN_FLIGHT) {
      await redis('DECR', flightKey);
      return { ok: false, status: 409, code: 'inflight', message: 'A few frames are still developing. Give it a moment.' };
    }
  } catch (error) {
    console.error('[ledger] in-flight count failed, allowing', (error as Error).message);
    return { ok: true, enforced: false };
  }
  const land = () => redis('DECR', flightKey).catch(() => {});

  try {
    const customer = await fetchCustomer(userId);
    const outcome = await withLock(userId, async () => {
      const raw = await redis<string | null>('GET', ledgerKey);
      let ledger: Ledger = raw ? (JSON.parse(raw) as Ledger) : { day: today, daily: 0, pack: 0, plan: 'free', granted: [] };
      // RevenueCat unreachable: keep the last known plan rather than downgrading a paying user.
      if (customer) ledger = applyPacks(applyPlan(ledger, customer.plan, today), customer.packs);
      ledger = applyRefresh(ledger, today);
      ledger = await grantWelcome(ledger, deviceId);
      if (ledger.daily + ledger.pack <= 0) {
        await redis('SET', ledgerKey, JSON.stringify(ledger), 'EX', LEDGER_TTL_S);
        return { charged: null, ledger };
      }
      const bucket: 'daily' | 'pack' = ledger.daily > 0 ? 'daily' : 'pack';
      const charged: Ledger = { ...ledger, [bucket]: ledger[bucket] - 1 };
      await redis('SET', ledgerKey, JSON.stringify(charged), 'EX', LEDGER_TTL_S);
      return { charged, ledger: charged, bucket };
    });

    if (!outcome.charged) {
      await land();
      return { ok: false, status: 402, code: 'credits', message: 'You are out of photos for now.', balance: balanceOf(outcome.ledger) };
    }

    let released = false;
    const release = async (keep: boolean): Promise<Balance | null> => {
      if (released) return null;
      released = true;
      try {
        return await withLock(userId, async () => {
          const raw = await redis<string | null>('GET', ledgerKey);
          const current = raw ? (JSON.parse(raw) as Ledger) : outcome.ledger;
          if (keep) return balanceOf(current);
          // Other frames may have changed the balance since, so only this frame's unit goes back.
          const refunded: Ledger = { ...current, [outcome.bucket!]: current[outcome.bucket!] + 1 };
          await redis('SET', ledgerKey, JSON.stringify(refunded), 'EX', LEDGER_TTL_S);
          return balanceOf(refunded);
        });
      } catch (error) {
        console.error('[ledger] release failed', (error as Error).message);
        return null;
      } finally {
        await land();
      }
    };
    return { ok: true, enforced: true, userId, balance: balanceOf(outcome.charged), release };
  } catch (error) {
    await land();
    console.error('[ledger] reserve failed, allowing', (error as Error).message);
    return { ok: true, enforced: false };
  }
}
