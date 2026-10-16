/**
 * Server-side credit ledger. The app's own counter is for display; this is the one that decides.
 *
 * Identity is the RevenueCat app user id the app sends in `x-exposure-user`. The plan and pack
 * purchases come from RevenueCat (read with the public SDK key, the same call the SDK makes), and the
 * balance lives in Upstash Redis. The rules mirror src/store/app-store.tsx exactly:
 *   - free: 1 preview per new user, shown locked in the app until they pay (hard paywall); capped
 *     per IP per day so reinstalling is not a free tap
 *   - weekly 5/day, yearly 10/day, unused daily photos bank up to 3 days of allowance
 *   - each pack transaction adds its photos once
 * A photo is reserved before the model runs and refunded if it fails, so failures never charge.
 *
 * Until both Redis and REVENUECAT_API_KEY (the public iOS SDK key) are set, the ledger is off and
 * every request is allowed, as before.
 */

type Plan = 'free' | 'weekly' | 'yearly';

const DAILY_ALLOWANCE: Record<Plan, number> = { free: 0, weekly: 5, yearly: 10 };
const ROLLOVER_DAYS = 3;
const WELCOME_CREDITS = 1;
/** New users per IP per day that get the welcome photo. Covers a household, not a reinstall loop. */
const WELCOME_PER_IP_PER_DAY = 3;
const ENTITLEMENT_ID = 'pro';
const PLAN_PRODUCTS: Record<string, Plan> = { 'app.exposure.weekly': 'weekly', 'app.exposure.yearly': 'yearly' };
const PACK_CREDITS: Record<string, number> = { 'app.exposure.credits10': 10, 'app.exposure.credits30': 30, 'app.exposure.credits80': 80 };
const LEDGER_TTL_S = 400 * 86_400;
const LOCK_TTL_S = 120;

type Ledger = { day: string; daily: number; pack: number; plan: Plan; granted: string[] };

export type Balance = { daily: number; pack: number; plan: Plan };

export type Reservation =
  | { ok: true; enforced: false }
  | { ok: true; enforced: true; userId: string; balance: Balance; release: (charged: boolean) => Promise<Balance | null> }
  | { ok: false; status: number; code: string; message: string; balance?: Balance };

// ---------------------------------------------------------------- Redis (Upstash REST)

const REDIS_URL = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

/** Both are needed: without RevenueCat every subscriber would look free and be refused. */
export function isLedgerEnabled(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN && process.env.REVENUECAT_API_KEY);
}

async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
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

/**
 * Takes one photo from the user's balance and holds a per-user lock while the model runs.
 * `release(true)` keeps the charge, `release(false)` refunds it. Infrastructure errors fail open so
 * an outage of Redis or RevenueCat never blocks paying users.
 */
export async function reserve(userId: unknown, clientDay: unknown, ip: string): Promise<Reservation> {
  if (!isLedgerEnabled()) return { ok: true, enforced: false };
  if (typeof userId !== 'string' || !USER_ID.test(userId)) {
    return { ok: false, status: 426, code: 'update', message: 'Update Exposure to keep making photos.' };
  }

  const today = resolveDay(clientDay);
  const ledgerKey = `ledger:${userId}`;
  const lockKey = `lock:${userId}`;

  try {
    const locked = await redis<string | null>('SET', lockKey, '1', 'NX', 'EX', LOCK_TTL_S);
    if (locked !== 'OK') return { ok: false, status: 409, code: 'inflight', message: 'One photo at a time. Your last one is still being made.' };
  } catch (error) {
    console.error('[ledger] lock failed, allowing', (error as Error).message);
    return { ok: true, enforced: false };
  }
  const unlock = () => redis('DEL', lockKey).catch(() => {});

  try {
    const [raw, customer] = await Promise.all([redis<string | null>('GET', ledgerKey), fetchCustomer(userId)]);
    let ledger: Ledger;
    if (raw) {
      ledger = JSON.parse(raw) as Ledger;
    } else {
      const ipKey = `welcome:${ip}:${utcDay()}`;
      const seen = await redis<number>('INCR', ipKey);
      if (seen === 1) await redis('EXPIRE', ipKey, 2 * 86_400);
      ledger = { day: today, daily: 0, pack: seen <= WELCOME_PER_IP_PER_DAY ? WELCOME_CREDITS : 0, plan: 'free', granted: [] };
    }
    // RevenueCat unreachable: keep the last known plan rather than downgrading a paying user.
    if (customer) ledger = applyPacks(applyPlan(ledger, customer.plan, today), customer.packs);
    ledger = applyRefresh(ledger, today);

    if (ledger.daily + ledger.pack <= 0) {
      await redis('SET', ledgerKey, JSON.stringify(ledger), 'EX', LEDGER_TTL_S);
      await unlock();
      return { ok: false, status: 402, code: 'credits', message: 'You are out of photos for now.', balance: balanceOf(ledger) };
    }

    const before = ledger;
    const charged: Ledger = ledger.daily > 0 ? { ...ledger, daily: ledger.daily - 1 } : { ...ledger, pack: ledger.pack - 1 };
    await redis('SET', ledgerKey, JSON.stringify(charged), 'EX', LEDGER_TTL_S);

    let released = false;
    const release = async (keep: boolean): Promise<Balance | null> => {
      if (released) return null;
      released = true;
      try {
        if (!keep) {
          // Refund the exact unit taken. Nothing else can have changed it: the lock is still held.
          await redis('SET', ledgerKey, JSON.stringify(before), 'EX', LEDGER_TTL_S);
          return balanceOf(before);
        }
        return balanceOf(charged);
      } catch (error) {
        console.error('[ledger] release failed', (error as Error).message);
        return null;
      } finally {
        await unlock();
      }
    };
    return { ok: true, enforced: true, userId, balance: balanceOf(charged), release };
  } catch (error) {
    await unlock();
    console.error('[ledger] reserve failed, allowing', (error as Error).message);
    return { ok: true, enforced: false };
  }
}
