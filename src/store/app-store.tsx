/**
 * App state: rolls and their frames (all on this device), print orders, the credit engine, plan and
 * onboarding flag. Persists to AsyncStorage. With a RevenueCat key configured the plan follows the
 * store entitlement and pack credits are granted once per store transaction; without one (web,
 * Expo Go, early dev) purchases are mocked locally so every flow stays testable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { PACK_PRODUCTS, type PackId, type PlanId } from '@/data/products';
import { deleteMedia, fromMediaKey, toMediaKey } from '@/lib/files';
import { fetchPrintConfig, type PrintConfig, type PrintStage, PRINTS_OFF } from '@/lib/prints';
import {
  addCustomerStateListener,
  configurePurchases,
  type CustomerState,
  fetchCustomerState,
  isPurchasesEnabled,
  isPurchasesMockable,
  purchasePack,
  purchasePlan,
  restorePurchases,
} from '@/lib/purchases';

export type Plan = 'free' | 'weekly' | 'yearly';

/** Daily credit allowance per plan. Unused credits bank up to ROLLOVER_DAYS × allowance. */
export const DAILY_ALLOWANCE: Record<Plan, number> = { free: 0, weekly: 5, yearly: 10 };
export const ROLLOVER_DAYS = 3;
/** One real frame is free. The server decides for good, per device; this only sets the first display. */
export const WELCOME_CREDITS = 1;

export const MAX_FRAMES = 12;

/** A stored file uri, or a bundled image (the sample roll). */
export type MediaRef = string | number;

export type FrameStatus = 'waiting' | 'developing' | 'done' | 'failed';

export type Frame = {
  id: string;
  sourceUri: MediaRef;
  resultUri?: MediaRef;
  /** Small copy for grids; falls back to resultUri. */
  thumbUri?: MediaRef;
  status: FrameStatus;
  /** What went wrong, in words for the user. */
  error?: string;
  /** How far the look is applied over the original, 0 to 1. */
  strength: number;
};

export type Roll = {
  id: string;
  name: string;
  lookId: string;
  frames: Frame[];
  createdAt: number;
};

export type PrintOrder = {
  id: string;
  secret: string;
  rollName: string;
  count: number;
  totalCents: number;
  coverUri?: MediaRef;
  stage: PrintStage;
  trackingUrl?: string;
  carrier?: string;
  createdAt: number;
};

type State = {
  hydrated: boolean;
  onboarded: boolean;
  rolls: Roll[];
  orders: PrintOrder[];
  plan: Plan;
  dailyCredits: number;
  packCredits: number;
  /** Local calendar day (YYYY-MM-DD) of the last daily refresh. */
  lastRefreshDay: string;
  /** Store transaction ids whose pack credits have already been added. */
  grantedTransactions: string[];
  /** The user agreed to their photos being sent to Google Gemini for processing. */
  aiConsent: boolean;
  /** Ever bought a plan or a pack. Until then the free frame stays half developed. */
  hasPurchased: boolean;
  /**
   * TestFlight only: the tester's real account, set aside while they view the app as a brand-new
   * user. Null the rest of the time. Restored exactly by `endPreview`.
   */
  stash: Stash | null;
};

type Stash = Pick<State, 'onboarded' | 'rolls' | 'aiConsent' | 'hasPurchased' | 'plan'>;

/** Set only in TestFlight builds (eas.json "testflight" profile). The App Store build never has it. */
export const TESTER_TOOLS = process.env.EXPO_PUBLIC_TESTER_TOOLS === '1';

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'setOnboarded' }
  | { type: 'addRoll'; roll: Roll }
  | { type: 'removeRoll'; id: string }
  | { type: 'updateFrame'; rollId: string; frameId: string; patch: Partial<Frame> }
  | { type: 'removeFrames'; rollId: string; frameIds: string[] }
  | { type: 'addOrder'; order: PrintOrder }
  | { type: 'updateOrder'; id: string; patch: Partial<PrintOrder> }
  | { type: 'removeOrder'; id: string }
  | { type: 'spendCredit' }
  | { type: 'syncCredits'; daily: number; pack: number }
  | { type: 'setAiConsent'; value: boolean }
  | { type: 'addPack'; amount: number }
  | { type: 'setPlan'; plan: Plan; today: string }
  /** `explicit` marks a purchase or restore the user just made; background syncs are not explicit. */
  | { type: 'applyCustomer'; customer: CustomerState; today: string; explicit?: boolean }
  | { type: 'startPreview' }
  | { type: 'endPreview' }
  | { type: 'refresh'; today: string };

const STORAGE_KEY = 'exposure.state.v2';
/** Bumped when the persisted shape changes; older blobs are migrated in `hydrate`. */
const SCHEMA_VERSION = 4;
/** If storage never answers, start fresh rather than sit on the splash forever. */
const HYDRATE_TIMEOUT_MS = 4000;

export function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextMidnight(): Date {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next;
}

const initialState: State = {
  hydrated: false,
  onboarded: false,
  rolls: [],
  orders: [],
  plan: 'free',
  dailyCredits: 0,
  packCredits: WELCOME_CREDITS,
  lastRefreshDay: localDay(),
  grantedTransactions: [],
  aiConsent: false,
  hasPurchased: false,
  stash: null,
};

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.UTC(Number(fromDay.slice(0, 4)), Number(fromDay.slice(5, 7)) - 1, Number(fromDay.slice(8, 10)));
  const to = Date.UTC(Number(toDay.slice(0, 4)), Number(toDay.slice(5, 7)) - 1, Number(toDay.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

/**
 * Grants the daily allowance for every day since the last refresh (so a few days away bank up,
 * as promised), capped at ROLLOVER_DAYS of allowance. A clock set backwards grants nothing and
 * moves the marker, so winding it forward again cannot double-pay.
 */
function applyRefresh(state: State, today: string): State {
  if (state.lastRefreshDay === today) return state;
  if (today < state.lastRefreshDay) return { ...state, lastRefreshDay: today };
  const allowance = DAILY_ALLOWANCE[state.plan];
  // A lapsed plan keeps what it banked; it just stops receiving.
  if (allowance === 0) return { ...state, lastRefreshDay: today };
  const days = Math.min(ROLLOVER_DAYS, Math.max(1, daysBetween(state.lastRefreshDay, today)));
  const cap = allowance * ROLLOVER_DAYS;
  return { ...state, lastRefreshDay: today, dailyCredits: Math.min(cap, state.dailyCredits + allowance * days) };
}

function applyPlan(state: State, plan: Plan, today: string): State {
  const allowance = DAILY_ALLOWANCE[plan];
  // A new or upgraded plan tops today up to its allowance; a downgrade clamps to the new cap;
  // a lapsed plan keeps what it banked.
  const dailyCredits =
    plan === 'free' ? state.dailyCredits : Math.min(allowance * ROLLOVER_DAYS, Math.max(state.dailyCredits, allowance));
  // Once paid, always paid for what they made: a lapsed plan must not take finished frames back.
  return { ...state, plan, dailyCredits, lastRefreshDay: today, hasPurchased: state.hasPurchased || plan !== 'free' };
}

type SavedShot = { id: string; lookId: string; sourceUri: string; resultUri: string; thumbUri?: string; createdAt: number; pending?: boolean };

/** Builds before rolls kept single photos; each one becomes a one-frame roll. */
function rollFromShot(shot: SavedShot): Roll {
  return {
    id: shot.id,
    name: 'Single photo',
    lookId: shot.lookId,
    createdAt: shot.createdAt,
    frames: [{ id: shot.id, sourceUri: shot.sourceUri, resultUri: shot.pending ? undefined : shot.resultUri, thumbUri: shot.thumbUri, status: shot.pending ? 'waiting' : 'done', strength: 1 }],
  };
}

/** Drops anything in a persisted blob that does not look like ours. A frame cut off mid-develop goes back in the queue. */
function sanitize(saved: Partial<State> & { version?: number; shots?: SavedShot[] }): Partial<State> {
  const rolls = Array.isArray(saved.rolls) ? saved.rolls.filter((roll) => roll && typeof roll.id === 'string' && Array.isArray(roll.frames)) : [];
  const migrated = Array.isArray(saved.shots) ? saved.shots.filter((shot) => shot && typeof shot.id === 'string' && typeof shot.resultUri === 'string').map(rollFromShot) : [];
  const { version: _version, shots: _shots, ...rest } = saved;
  return {
    ...rest,
    rolls: [...rolls, ...migrated].map((roll) => ({
      ...roll,
      frames: roll.frames.map((frame) => (frame.status === 'developing' ? { ...frame, status: 'waiting' as const } : frame)),
    })),
    orders: Array.isArray(saved.orders) ? saved.orders : [],
    aiConsent: saved.aiConsent === true,
    hasPurchased: saved.hasPurchased === true,
    stash: TESTER_TOOLS && saved.stash && Array.isArray(saved.stash.rolls) ? saved.stash : null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return applyRefresh({ ...state, ...action.state, hydrated: true }, localDay());
    case 'setOnboarded':
      return { ...state, onboarded: true };
    case 'addRoll':
      return { ...state, rolls: [action.roll, ...state.rolls] };
    case 'removeRoll':
      return { ...state, rolls: state.rolls.filter((roll) => roll.id !== action.id) };
    case 'updateFrame':
      return {
        ...state,
        rolls: state.rolls.map((roll) =>
          roll.id !== action.rollId ? roll : { ...roll, frames: roll.frames.map((frame) => (frame.id === action.frameId ? { ...frame, ...action.patch } : frame)) }
        ),
      };
    case 'removeFrames':
      return { ...state, rolls: state.rolls.map((roll) => (roll.id !== action.rollId ? roll : { ...roll, frames: roll.frames.filter((frame) => !action.frameIds.includes(frame.id)) })) };
    case 'addOrder':
      return { ...state, orders: [action.order, ...state.orders] };
    case 'updateOrder':
      return { ...state, orders: state.orders.map((order) => (order.id === action.id ? { ...order, ...action.patch } : order)) };
    case 'removeOrder':
      return { ...state, orders: state.orders.filter((order) => order.id !== action.id) };
    case 'spendCredit':
      if (state.dailyCredits > 0) return { ...state, dailyCredits: state.dailyCredits - 1 };
      return { ...state, packCredits: Math.max(0, state.packCredits - 1) };
    case 'syncCredits':
      // The server's balance is the one that counts; adopt it after every request that reports one.
      return { ...state, dailyCredits: Math.max(0, action.daily), packCredits: Math.max(0, action.pack) };
    case 'setAiConsent':
      return { ...state, aiConsent: action.value };
    case 'addPack':
      return { ...state, packCredits: state.packCredits + action.amount, hasPurchased: true };
    case 'setPlan':
      return applyPlan(state, action.plan, action.today);
    case 'applyCustomer': {
      // Viewing as a new user: the store keeps reporting the tester's real purchases on launch;
      // only a purchase made inside the preview should unlock it.
      if (state.stash && !action.explicit) return state;
      let next = state.plan === action.customer.plan ? state : applyPlan(state, action.customer.plan, action.today);
      const fresh = action.customer.packTransactions.filter((transaction) => !next.grantedTransactions.includes(transaction.id));
      if (action.customer.packTransactions.length > 0 && !next.hasPurchased) next = { ...next, hasPurchased: true };
      if (fresh.length === 0) return next;
      const credits = fresh.reduce((sum, transaction) => sum + PACK_PRODUCTS[transaction.packId].credits, 0);
      next = { ...next, packCredits: next.packCredits + credits, grantedTransactions: [...next.grantedTransactions, ...fresh.map((t) => t.id)] };
      return next;
    }
    case 'startPreview': {
      if (state.stash) return state;
      const { onboarded, rolls, aiConsent, hasPurchased, plan } = state;
      return { ...state, stash: { onboarded, rolls, aiConsent, hasPurchased, plan }, onboarded: false, rolls: [], aiConsent: false, hasPurchased: false, plan: 'free' };
    }
    case 'endPreview':
      if (!state.stash) return state;
      return { ...state, ...state.stash, stash: null };
    case 'refresh':
      return applyRefresh(state, action.today);
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PurchaseFeedback = { ok: boolean; message: string };

type AppStore = State & {
  credits: number;
  /** Has bought a plan or a pack, now or in the past. */
  paid: boolean;
  /** True when a store (RevenueCat) is configured and purchases are real. */
  purchasesLive: boolean;
  /** False in a release build with no store configured: buying is hidden rather than mocked. */
  canBuy: boolean;
  /** Whether prints can be ordered right now, and their prices. */
  printConfig: PrintConfig;
  setOnboarded: () => void;
  addRoll: (roll: { name: string; lookId: string; sourceUris: string[] }) => Roll;
  removeRoll: (id: string) => void;
  updateFrame: (rollId: string, frameId: string, patch: Partial<Frame>) => void;
  removeFrames: (rollId: string, frameIds: string[]) => void;
  addOrder: (order: Omit<PrintOrder, 'createdAt'>) => void;
  updateOrder: (id: string, patch: Partial<PrintOrder>) => void;
  removeOrder: (id: string) => void;
  spendCredit: () => void;
  syncCredits: (credits: { daily: number; pack: number }) => void;
  setAiConsent: (value: boolean) => void;
  addPack: (amount: number) => void;
  setPlan: (plan: Plan) => void;
  /** Buys a plan through the store, or grants it locally in mock mode. */
  buyPlan: (plan: PlanId) => Promise<PurchaseFeedback>;
  /** Buys a credit pack through the store, or grants it locally in mock mode. */
  buyPack: (pack: PackId) => Promise<PurchaseFeedback>;
  restore: () => Promise<PurchaseFeedback>;
  /** TestFlight only: set the real account aside and start over as a brand-new user. */
  startPreview: () => void;
  /** Leave the new-user view and bring the real account back. */
  endPreview: () => void;
  /** True while viewing the app as a new user. */
  previewing: boolean;
};

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [printConfig, setPrintConfig] = useState<PrintConfig>(PRINTS_OFF);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let done = false;
    const finish = (saved: Partial<State>) => {
      if (done) return;
      done = true;
      dispatch({ type: 'hydrate', state: saved });
    };
    const timer = setTimeout(() => finish({}), HYDRATE_TIMEOUT_MS);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => finish(raw ? sanitize(JSON.parse(raw) as Partial<State>) : {}))
      .catch(() => finish({}));
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { rolls, orders, plan, dailyCredits, packCredits, lastRefreshDay, onboarded, grantedTransactions, aiConsent, hasPurchased, stash } = state;
    // File uris are stored as relative keys: iOS moves the app container on every update.
    const portable = (uri: MediaRef | undefined) => (typeof uri === 'string' ? toMediaKey(uri) : uri);
    const portableRollsOf = (list: Roll[]) =>
      list.map((roll) => ({
        ...roll,
        frames: roll.frames.map((frame) => ({ ...frame, sourceUri: portable(frame.sourceUri), resultUri: portable(frame.resultUri), thumbUri: portable(frame.thumbUri) })),
      }));
    const portableRolls = portableRollsOf(rolls);
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        rolls: portableRolls,
        orders: orders.map((order) => ({ ...order, coverUri: portable(order.coverUri) })),
        plan,
        dailyCredits,
        packCredits,
        lastRefreshDay,
        onboarded,
        grantedTransactions,
        aiConsent,
        hasPurchased,
        stash: stash ? { ...stash, rolls: portableRollsOf(stash.rolls) } : null,
      })
    ).catch(() => {});
  }, [state]);

  useEffect(() => {
    fetchPrintConfig().then(setPrintConfig);
  }, []);

  // Store sync: configure RevenueCat once, pull the current entitlement, and follow updates.
  useEffect(() => {
    if (!state.hydrated || !isPurchasesEnabled()) return;
    let unsubscribe = () => {};
    let cancelled = false;
    configurePurchases()
      .then(async () => {
        const customer = await fetchCustomerState();
        if (cancelled) return;
        if (customer) dispatch({ type: 'applyCustomer', customer, today: localDay() });
        unsubscribe = addCustomerStateListener((next) => dispatch({ type: 'applyCustomer', customer: next, today: localDay() }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [state.hydrated]);

  // Daily refresh when the app comes back to the foreground on a new day.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      dispatch({ type: 'refresh', today: localDay() });
      // One failed check must not hide prints until the next launch.
      fetchPrintConfig().then(setPrintConfig);
    });
    return () => subscription.remove();
  }, []);

  const setOnboarded = useCallback(() => dispatch({ type: 'setOnboarded' }), []);
  const addRoll = useCallback<AppStore['addRoll']>(({ name, lookId, sourceUris }) => {
    const roll: Roll = {
      id: newId(),
      name,
      lookId,
      createdAt: Date.now(),
      frames: sourceUris.map((sourceUri) => ({ id: newId(), sourceUri, status: 'waiting', strength: 1 })),
    };
    dispatch({ type: 'addRoll', roll });
    return roll;
  }, []);
  const removeRoll = useCallback((id: string) => {
    const roll = stateRef.current.rolls.find((item) => item.id === id);
    dispatch({ type: 'removeRoll', id });
    roll?.frames.forEach((frame) => [frame.sourceUri, frame.resultUri, frame.thumbUri].forEach((uri) => typeof uri === 'string' && deleteMedia(uri)));
  }, []);
  const updateFrame = useCallback((rollId: string, frameId: string, patch: Partial<Frame>) => dispatch({ type: 'updateFrame', rollId, frameId, patch }), []);
  const removeFrames = useCallback((rollId: string, frameIds: string[]) => dispatch({ type: 'removeFrames', rollId, frameIds }), []);
  const addOrder = useCallback((order: Omit<PrintOrder, 'createdAt'>) => dispatch({ type: 'addOrder', order: { ...order, createdAt: Date.now() } }), []);
  const updateOrder = useCallback((id: string, patch: Partial<PrintOrder>) => dispatch({ type: 'updateOrder', id, patch }), []);
  const removeOrder = useCallback((id: string) => {
    const order = stateRef.current.orders.find((item) => item.id === id);
    dispatch({ type: 'removeOrder', id });
    if (typeof order?.coverUri === 'string') deleteMedia(order.coverUri);
  }, []);
  const spendCredit = useCallback(() => dispatch({ type: 'spendCredit' }), []);
  const syncCredits = useCallback((credits: { daily: number; pack: number }) => dispatch({ type: 'syncCredits', ...credits }), []);
  const setAiConsent = useCallback((value: boolean) => dispatch({ type: 'setAiConsent', value }), []);
  const addPack = useCallback((amount: number) => dispatch({ type: 'addPack', amount }), []);
  const setPlan = useCallback((plan: Plan) => dispatch({ type: 'setPlan', plan, today: localDay() }), []);
  const startPreview = useCallback(() => {
    if (TESTER_TOOLS) dispatch({ type: 'startPreview' });
  }, []);
  const endPreview = useCallback(() => {
    // Rolls made while previewing are thrown away with their files; the real ones come back untouched.
    stateRef.current.rolls.forEach((roll) => roll.frames.forEach((frame) => [frame.sourceUri, frame.resultUri, frame.thumbUri].forEach((uri) => typeof uri === 'string' && deleteMedia(uri))));
    dispatch({ type: 'endPreview' });
  }, []);

  const purchasesLive = isPurchasesEnabled();
  const canBuy = purchasesLive || isPurchasesMockable();

  const buyPlan = useCallback<AppStore['buyPlan']>(
    async (plan) => {
      if (!purchasesLive) {
        dispatch({ type: 'setPlan', plan, today: localDay() });
        return { ok: true, message: 'Plan started' };
      }
      const outcome = await purchasePlan(plan);
      if (!outcome.ok) return { ok: false, message: outcome.cancelled ? '' : outcome.message };
      dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay(), explicit: true });
      return { ok: outcome.state.plan !== 'free', message: outcome.state.plan !== 'free' ? 'Welcome in' : 'The plan did not activate' };
    },
    [purchasesLive]
  );

  const buyPack = useCallback<AppStore['buyPack']>(
    async (pack) => {
      const credits = PACK_PRODUCTS[pack].credits;
      if (!purchasesLive) {
        dispatch({ type: 'addPack', amount: credits });
        return { ok: true, message: `${credits} frames added` };
      }
      const outcome = await purchasePack(pack);
      if (!outcome.ok) return { ok: false, message: outcome.cancelled ? '' : outcome.message };
      dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay(), explicit: true });
      return { ok: true, message: `${credits} frames added` };
    },
    [purchasesLive]
  );

  const restore = useCallback<AppStore['restore']>(async () => {
    if (!purchasesLive) return { ok: false, message: 'Nothing to restore here' };
    const outcome = await restorePurchases();
    if (!outcome.ok) return { ok: false, message: outcome.message };
    const freshPacks = outcome.state.packTransactions.some((t) => !stateRef.current.grantedTransactions.includes(t.id));
    dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay(), explicit: true });
    const found = outcome.state.plan !== 'free' || freshPacks;
    return { ok: found, message: found ? 'Purchases restored' : 'No purchases found for this account' };
  }, [purchasesLive]);

  // Stored keys are relative; hand components absolute uris they can load.
  const rolls = useMemo(() => {
    const absolute = (uri: MediaRef | undefined) => (typeof uri === 'string' ? fromMediaKey(uri) : uri);
    return state.rolls.map((roll) => ({
      ...roll,
      frames: roll.frames.map((frame) => ({ ...frame, sourceUri: absolute(frame.sourceUri)!, resultUri: absolute(frame.resultUri), thumbUri: absolute(frame.thumbUri) })),
    }));
  }, [state.rolls]);
  const orders = useMemo(
    () => state.orders.map((order) => ({ ...order, coverUri: typeof order.coverUri === 'string' ? fromMediaKey(order.coverUri) : order.coverUri })),
    [state.orders]
  );

  const value = useMemo<AppStore>(
    () => ({
      ...state,
      rolls,
      orders,
      credits: state.dailyCredits + state.packCredits,
      paid: state.hasPurchased || state.plan !== 'free',
      purchasesLive,
      canBuy,
      printConfig,
      setOnboarded,
      addRoll,
      removeRoll,
      updateFrame,
      removeFrames,
      addOrder,
      updateOrder,
      removeOrder,
      spendCredit,
      syncCredits,
      setAiConsent,
      addPack,
      setPlan,
      buyPlan,
      buyPack,
      restore,
      startPreview,
      endPreview,
      previewing: state.stash !== null,
    }),
    [state, rolls, orders, purchasesLive, canBuy, printConfig, setOnboarded, addRoll, removeRoll, updateFrame, removeFrames, addOrder, updateOrder, removeOrder, spendCredit, syncCredits, setAiConsent, addPack, setPlan, buyPlan, buyPack, restore, startPreview, endPreview]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider');
  return store;
}
