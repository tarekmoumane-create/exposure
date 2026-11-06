/** Checks the photo balance under parallel frames, with Redis and RevenueCat stubbed. npx tsx scripts/ledger-test.ts */
import assert from 'node:assert/strict';

Object.assign(process.env, { KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 't', REVENUECAT_API_KEY: 'rc', FREE_DAILY_CAP: '2' });

const kv = new Map<string, string>();
let plan: string | null = null;
globalThis.fetch = (async (input: string, init?: RequestInit) => {
  const json = (value: unknown) => new Response(JSON.stringify(value));
  if (String(input).includes('revenuecat')) {
    const entitlements = plan ? { pro: { expires_date: null, product_identifier: plan } } : {};
    return json({ subscriber: { entitlements, non_subscriptions: {} } });
  }
  await new Promise((r) => setTimeout(r, Math.random() * 4));
  const [cmd, key, value, a, b] = JSON.parse(init!.body as string) as string[];
  if (cmd === 'SET') {
    if ([a, b].includes('NX') && kv.has(key)) return json({ result: null });
    kv.set(key, value);
    return json({ result: 'OK' });
  }
  if (cmd === 'GET') return json({ result: kv.get(key) ?? null });
  if (cmd === 'DEL') { kv.delete(key); return json({ result: 1 }); }
  if (cmd === 'EXPIRE') return json({ result: 1 });
  if (cmd === 'INCR' || cmd === 'DECR') {
    const next = Number(kv.get(key) ?? 0) + (cmd === 'INCR' ? 1 : -1);
    kv.set(key, String(next));
    return json({ result: next });
  }
  throw new Error(cmd);
}) as typeof fetch;

const { reserve } = await import('../lib/ledger.js');
const day = new Date().toISOString().slice(0, 10);
const device = (n: number) => `device-000000000000000${n}`;
const balance = (user: string) => JSON.parse(kv.get(`ledger:${user}`)!) as { daily: number; pack: number };

// One free photo per device, even with a fresh user id after a reinstall.
const first = await reserve('user-aaaaaaaa', day, device(1));
assert.ok(first.ok && first.enforced);
await first.release(true);
assert.equal(balance('user-aaaaaaaa').pack, 0);
const second = await reserve('user-aaaaaaaa', day, device(1));
assert.ok(!second.ok && second.code === 'credits');
const reinstall = await reserve('user-bbbbbbbb', day, device(1));
assert.ok(!reinstall.ok && reinstall.code === 'credits', 'reinstall must not get a second free photo');
const noDevice = await reserve('user-cccccccc', day);
assert.ok(!noDevice.ok, 'no device id, no free photo');

// A failed free frame gives the photo back.
const failed = await reserve('user-dddddddd', day, device(2));
assert.ok(failed.ok && failed.enforced);
await failed.release(false);
assert.equal(balance('user-dddddddd').pack, 1);

// The daily cap stops free photos across all users.
const capped = await reserve('user-eeeeeeee', day, device(3));
assert.ok(!capped.ok && capped.code === 'credits', 'over the cap');

// Parallel frames on a plan: every charge lands, and only the failed ones come back.
plan = 'app.exposure.weekly';
const results = await Promise.all([1, 2, 3, 4].map(() => reserve('user-ffffffff', day, device(4))));
assert.ok(results.every((r) => r.ok && r.enforced));
assert.equal(balance('user-ffffffff').daily, 1, '5 a day minus 4 in flight');
const overflow = await reserve('user-ffffffff', day, device(4));
assert.ok(!overflow.ok && overflow.code === 'inflight', 'a fifth at once waits');
await Promise.all(results.map((r, i) => (r.ok && r.enforced ? r.release(i !== 0) : null)));
assert.equal(balance('user-ffffffff').daily, 2, 'one refund, three kept');
assert.equal(kv.get('inflight:user-ffffffff'), '0');
console.log('ledger: all checks passed');
