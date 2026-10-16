/**
 * App state: on-device gallery (AI shots and photobooth strips), the credit engine, plan and
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
} from 'react';
import { AppState } from 'react-native';

import { PACK_PRODUCTS, type PackId, type PlanId } from '@/data/products';
import { DEFAULT_CONFIG, type FilterConfig } from '@/filters/presets';
import { deleteMedia, fromMediaKey, toMediaKey } from '@/lib/files';
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
/** One full-resolution generation on install, so the first session has a result. */
export const WELCOME_CREDITS = 1;

export type Shot = {
  id: string;
  kind: 'look';
  lookId: string;
  sourceUri: string;
  resultUri: string;
  /** Small copy for grids; falls back to resultUri. */
  thumbUri?: string;
  edit: FilterConfig;
  createdAt: number;
};

export type Strip = {
  id: string;
  kind: 'strip';
  frames: string[];
  resultUri: string;
  thumbUri?: string;
  edit: FilterConfig;
  paper: 'white' | 'black';
  /** Whether the date stamp is printed. Defaults to on for older strips. */
  stamp?: boolean;
  createdAt: number;
};

export type GalleryItem = Shot | Strip;

type State = {
  hydrated: boolean;
  onboarded: boolean;
  shots: Shot[];
  strips: Strip[];
  plan: Plan;
  dailyCredits: number;
  packCredits: number;
  /** Local calendar day (YYYY-MM-DD) of the last daily refresh. */
  lastRefreshDay: string;
  /** Store transaction ids whose pack credits have already been added. */
  grantedTransactions: string[];
  /** The user agreed to their photos being sent to Google Gemini for processing. */
  aiConsent: boolean;
};

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'setOnboarded' }
  | { type: 'addShot'; shot: Shot }
  | { type: 'updateShot'; id: string; patch: Partial<Shot> }
  | { type: 'removeShot'; id: string }
  | { type: 'addStrip'; strip: Strip }
  | { type: 'updateStrip'; id: string; patch: Partial<Strip> }
  | { type: 'removeStrip'; id: string }
  | { type: 'spendCredit' }
  | { type: 'syncCredits'; daily: number; pack: number }
  | { type: 'setAiConsent'; value: boolean }
  | { type: 'addPack'; amount: number }
  | { type: 'setPlan'; plan: Plan; today: string }
  | { type: 'applyCustomer'; customer: CustomerState; today: string }
  | { type: 'refresh'; today: string };

const STORAGE_KEY = 'exposure.state.v2';
/** Bumped when the persisted shape changes; older blobs are migrated in `hydrate`. */
const SCHEMA_VERSION = 3;
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
  shots: [],
  strips: [],
  plan: 'free',
  dailyCredits: 0,
  packCredits: WELCOME_CREDITS,
  lastRefreshDay: localDay(),
  grantedTransactions: [],
  aiConsent: false,
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
  return { ...state, plan, dailyCredits, lastRefreshDay: today };
}

/** Drops anything in a persisted blob that does not look like ours. */
function sanitize(saved: Partial<State> & { version?: number }): Partial<State> {
  const shots = Array.isArray(saved.shots)
    ? saved.shots.filter((shot) => shot && typeof shot.id === 'string' && typeof shot.resultUri === 'string' && typeof shot.lookId === 'string')
    : [];
  const strips = Array.isArray(saved.strips)
    ? saved.strips.filter((strip) => strip && typeof strip.id === 'string' && typeof strip.resultUri === 'string' && Array.isArray(strip.frames))
    : [];
  const { version: _version, ...rest } = saved;
  return { ...rest, shots, strips, aiConsent: saved.aiConsent === true };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return applyRefresh({ ...state, ...action.state, hydrated: true }, localDay());
    case 'setOnboarded':
      return { ...state, onboarded: true };
    case 'addShot':
      return { ...state, shots: [action.shot, ...state.shots] };
    case 'updateShot':
      return { ...state, shots: state.shots.map((shot) => (shot.id === action.id ? { ...shot, ...action.patch } : shot)) };
    case 'removeShot':
      return { ...state, shots: state.shots.filter((shot) => shot.id !== action.id) };
    case 'addStrip':
      return { ...state, strips: [action.strip, ...state.strips] };
    case 'updateStrip':
      return { ...state, strips: state.strips.map((strip) => (strip.id === action.id ? { ...strip, ...action.patch } : strip)) };
    case 'removeStrip':
      return { ...state, strips: state.strips.filter((strip) => strip.id !== action.id) };
    case 'spendCredit':
      if (state.dailyCredits > 0) return { ...state, dailyCredits: state.dailyCredits - 1 };
      return { ...state, packCredits: Math.max(0, state.packCredits - 1) };
    case 'syncCredits':
      // The server's balance is the one that counts; adopt it after every request that reports one.
      return { ...state, dailyCredits: Math.max(0, action.daily), packCredits: Math.max(0, action.pack) };
    case 'setAiConsent':
      return { ...state, aiConsent: action.value };
    case 'addPack':
      return { ...state, packCredits: state.packCredits + action.amount };
    case 'setPlan':
      return applyPlan(state, action.plan, action.today);
    case 'applyCustomer': {
      let next = state.plan === action.customer.plan ? state : applyPlan(state, action.customer.plan, action.today);
      const fresh = action.customer.packTransactions.filter((transaction) => !next.grantedTransactions.includes(transaction.id));
      if (fresh.length === 0) return next;
      const credits = fresh.reduce((sum, transaction) => sum + PACK_PRODUCTS[transaction.packId].credits, 0);
      next = { ...next, packCredits: next.packCredits + credits, grantedTransactions: [...next.grantedTransactions, ...fresh.map((t) => t.id)] };
      return next;
    }
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
  /** True when a store (RevenueCat) is configured and purchases are real. */
  purchasesLive: boolean;
  /** False in a release build with no store configured: buying is hidden rather than mocked. */
  canBuy: boolean;
  setOnboarded: () => void;
  addShot: (shot: Pick<Shot, 'lookId' | 'sourceUri' | 'resultUri'> & { edit?: FilterConfig; thumbUri?: string }) => Shot;
  updateShot: (id: string, patch: Partial<Shot>) => void;
  removeShot: (id: string) => void;
  addStrip: (strip: Omit<Strip, 'id' | 'kind' | 'createdAt'>) => Strip;
  updateStrip: (id: string, patch: Partial<Strip>) => void;
  removeStrip: (id: string) => void;
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
};

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
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
    const { shots, strips, plan, dailyCredits, packCredits, lastRefreshDay, onboarded, grantedTransactions, aiConsent } = state;
    // File uris are stored as relative keys: iOS moves the app container on every update.
    const portableShots = shots.map((shot) => ({
      ...shot,
      sourceUri: toMediaKey(shot.sourceUri),
      resultUri: toMediaKey(shot.resultUri),
      thumbUri: shot.thumbUri ? toMediaKey(shot.thumbUri) : undefined,
    }));
    const portableStrips = strips.map((strip) => ({
      ...strip,
      frames: strip.frames.map(toMediaKey),
      resultUri: toMediaKey(strip.resultUri),
      thumbUri: strip.thumbUri ? toMediaKey(strip.thumbUri) : undefined,
    }));
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        shots: portableShots,
        strips: portableStrips,
        plan,
        dailyCredits,
        packCredits,
        lastRefreshDay,
        onboarded,
        grantedTransactions,
        aiConsent,
      })
    ).catch(() => {});
  }, [state]);

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
      if (status === 'active') dispatch({ type: 'refresh', today: localDay() });
    });
    return () => subscription.remove();
  }, []);

  const setOnboarded = useCallback(() => dispatch({ type: 'setOnboarded' }), []);
  const addShot = useCallback<AppStore['addShot']>((partial) => {
    const shot: Shot = { kind: 'look', edit: DEFAULT_CONFIG, ...partial, id: newId(), createdAt: Date.now() };
    dispatch({ type: 'addShot', shot });
    return shot;
  }, []);
  const updateShot = useCallback((id: string, patch: Partial<Shot>) => dispatch({ type: 'updateShot', id, patch }), []);
  const removeShot = useCallback(
    (id: string) => {
      const shot = stateRef.current.shots.find((item) => item.id === id);
      dispatch({ type: 'removeShot', id });
      if (shot) [shot.resultUri, shot.sourceUri, shot.thumbUri].forEach((uri) => uri && deleteMedia(uri));
    },
    []
  );
  const addStrip = useCallback<AppStore['addStrip']>((partial) => {
    const strip: Strip = { ...partial, kind: 'strip', id: newId(), createdAt: Date.now() };
    dispatch({ type: 'addStrip', strip });
    return strip;
  }, []);
  const updateStrip = useCallback((id: string, patch: Partial<Strip>) => dispatch({ type: 'updateStrip', id, patch }), []);
  const removeStrip = useCallback(
    (id: string) => {
      const strip = stateRef.current.strips.find((item) => item.id === id);
      dispatch({ type: 'removeStrip', id });
      if (strip) [strip.resultUri, strip.thumbUri, ...strip.frames].forEach((uri) => uri && deleteMedia(uri));
    },
    []
  );
  const spendCredit = useCallback(() => dispatch({ type: 'spendCredit' }), []);
  const syncCredits = useCallback((credits: { daily: number; pack: number }) => dispatch({ type: 'syncCredits', ...credits }), []);
  const setAiConsent = useCallback((value: boolean) => dispatch({ type: 'setAiConsent', value }), []);
  const addPack = useCallback((amount: number) => dispatch({ type: 'addPack', amount }), []);
  const setPlan = useCallback((plan: Plan) => dispatch({ type: 'setPlan', plan, today: localDay() }), []);

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
      dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay() });
      return { ok: outcome.state.plan !== 'free', message: outcome.state.plan !== 'free' ? 'Welcome in' : 'The plan did not activate' };
    },
    [purchasesLive]
  );

  const buyPack = useCallback<AppStore['buyPack']>(
    async (pack) => {
      const credits = PACK_PRODUCTS[pack].credits;
      if (!purchasesLive) {
        dispatch({ type: 'addPack', amount: credits });
        return { ok: true, message: `${credits} photos added` };
      }
      const outcome = await purchasePack(pack);
      if (!outcome.ok) return { ok: false, message: outcome.cancelled ? '' : outcome.message };
      dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay() });
      return { ok: true, message: `${credits} photos added` };
    },
    [purchasesLive]
  );

  const restore = useCallback<AppStore['restore']>(async () => {
    if (!purchasesLive) return { ok: false, message: 'Nothing to restore here' };
    const outcome = await restorePurchases();
    if (!outcome.ok) return { ok: false, message: outcome.message };
    const freshPacks = outcome.state.packTransactions.some((t) => !stateRef.current.grantedTransactions.includes(t.id));
    dispatch({ type: 'applyCustomer', customer: outcome.state, today: localDay() });
    const found = outcome.state.plan !== 'free' || freshPacks;
    return { ok: found, message: found ? 'Purchases restored' : 'No purchases found for this account' };
  }, [purchasesLive]);

  // Stored keys are relative; hand components absolute uris they can load.
  const shots = useMemo(
    () =>
      state.shots.map((shot) => ({
        ...shot,
        sourceUri: fromMediaKey(shot.sourceUri),
        resultUri: fromMediaKey(shot.resultUri),
        thumbUri: shot.thumbUri ? fromMediaKey(shot.thumbUri) : undefined,
      })),
    [state.shots]
  );
  const strips = useMemo(
    () =>
      state.strips.map((strip) => ({
        ...strip,
        frames: strip.frames.map(fromMediaKey),
        resultUri: fromMediaKey(strip.resultUri),
        thumbUri: strip.thumbUri ? fromMediaKey(strip.thumbUri) : undefined,
      })),
    [state.strips]
  );

  const value = useMemo<AppStore>(
    () => ({
      ...state,
      shots,
      strips,
      credits: state.dailyCredits + state.packCredits,
      purchasesLive,
      canBuy,
      setOnboarded,
      addShot,
      updateShot,
      removeShot,
      addStrip,
      updateStrip,
      removeStrip,
      spendCredit,
      syncCredits,
      setAiConsent,
      addPack,
      setPlan,
      buyPlan,
      buyPack,
      restore,
    }),
    [state, shots, strips, purchasesLive, canBuy, setOnboarded, addShot, updateShot, removeShot, addStrip, updateStrip, removeStrip, spendCredit, syncCredits, setAiConsent, addPack, setPlan, buyPlan, buyPack, restore]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider');
  return store;
}
