import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyData, useStore, type Store } from '../store/store';
import type { DataState, Settings } from '../store/types';
import { DEFAULT_SETTINGS } from '../store/validate';
import { clearUserCache, loadUserCache, parseRaw, readJSON, saveUserCacheMeta, v2Key, v2Prefix, validSlice, writeJSON } from '../store/persist';
import { validSettings } from '../store/validate';
import { ALL_TABLES, FROM_ROW, SLICES, SLICE_OF, TABLES, settingsFromRow, settingsToRow, toRow, type DataTable, type Row, type SliceKey, type Table } from './rows';

// ---------------------------------------------------------------------------------------------
// Public status (drives the sync indicator and the app's loading gate)
// ---------------------------------------------------------------------------------------------
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type DataPhase = 'idle' | 'loading' | 'ready' | 'failed';

interface SyncState {
  phase: DataPhase;
  status: SyncStatus;
  pending: number;
  error: string | null;
  userId: string | null;
  /** True once data came from the server at least once this session. */
  fromServer: boolean;
}

export const useSync = create<SyncState>()(() => ({ phase: 'idle', status: 'synced', pending: 0, error: null, userId: null, fromServer: false }));

// ---------------------------------------------------------------------------------------------
// Pending queue: one op per (table, id), persisted in localStorage so it survives reloads and is
// shared by all tabs of the same user. localStorage is the source of truth: every change does a
// read-modify-write, and a flushed op is only removed if it is still the same op (same opId).
// ---------------------------------------------------------------------------------------------
type OpKind = 'upsert' | 'insert' | 'delete';
export interface Op {
  opId: string;
  table: Table;
  id: string;
  kind: OpKind;
  row?: Row;
  ts: number;
}
type Queue = Record<string, Op>;

let client: SupabaseClient | null = null;
let uid: string | null = null;
let applyingRemote = false;
/** Set while adopting another tab's cache write: that tab already wrote the same values. */
let skipCacheWrite = false;
let unsubscribeStore: (() => void) | null = null;
let retryTimer: number | undefined;
let flushTimer: number | undefined;
let retryDelay = 2000;
let lastPull = 0;
let bc: BroadcastChannel | null = null;

const opKey = (table: Table, id: string) => table + '|' + id;
const newOpId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function readQueue(): Queue {
  if (!uid) return {};
  const q = readJSON(v2Key(uid, 'queue'));
  return q && typeof q === 'object' && !Array.isArray(q) ? (q as Queue) : {};
}
function writeQueue(q: Queue): void {
  if (!uid) return;
  writeJSON(v2Key(uid, 'queue'), q);
  updatePending(q);
}
function updatePending(q: Queue = readQueue()) {
  const pending = Object.keys(q).length;
  if (useSync.getState().pending !== pending) useSync.setState({ pending });
}

function enqueue(ops: Omit<Op, 'opId' | 'ts'>[]): void {
  if (!uid || ops.length === 0) return;
  const q = readQueue();
  const ts = Date.now();
  for (const op of ops) {
    const key = opKey(op.table, op.id);
    // An insert-if-absent that is later edited becomes a real upsert; anything else: newest wins.
    q[key] = { ...op, opId: newOpId(), ts };
  }
  writeQueue(q);
}

export function pendingCount(): number {
  return Object.keys(readQueue()).length;
}

// ---------------------------------------------------------------------------------------------
// Diffing store changes into ops (keeps the store API unchanged for the UI)
// ---------------------------------------------------------------------------------------------
function diffSlice(slice: SliceKey, prev: { id: string }[], next: { id: string }[]): Omit<Op, 'opId' | 'ts'>[] {
  const table = TABLES[slice];
  const before = new Map(prev.map((x) => [x.id, x]));
  const ops: Omit<Op, 'opId' | 'ts'>[] = [];
  const seen = new Set<string>();
  for (const item of next) {
    seen.add(item.id);
    const old = before.get(item.id);
    if (old === item) continue;
    // Auto-posted recurring occurrences have deterministic ids: insert them only if no device posted them yet.
    const kind: OpKind = !old && slice === 'transactions' && item.id.startsWith('rec:') ? 'insert' : 'upsert';
    ops.push({ table, id: item.id, kind, row: toRow(slice, item as never) });
  }
  for (const id of before.keys()) if (!seen.has(id)) ops.push({ table, id, kind: 'delete' });
  return ops;
}

function onStoreChange(s: Store, prev: Store) {
  if (!uid) return;
  const changedSlices = SLICES.filter((k) => s[k] !== prev[k]);
  const settingsChanged = s.settings !== prev.settings;
  if (!changedSlices.length && !settingsChanged) return;
  if (!skipCacheWrite) writeCache(s, changedSlices, settingsChanged);
  if (applyingRemote) return;
  const ops = changedSlices.flatMap((k) => diffSlice(k, prev[k], s[k]));
  if (settingsChanged && JSON.stringify(settingsToRow(s.settings)) !== JSON.stringify(settingsToRow(prev.settings))) {
    ops.push({ table: 'settings', id: 'settings', kind: 'upsert', row: settingsToRow(s.settings) });
  }
  if (ops.length) {
    enqueue(ops);
    scheduleFlush(0);
  }
  if (settingsChanged) rememberDeviceTheme(s.settings.theme);
}

let cacheFailToast = 0;
function writeCache(s: Pick<Store, SliceKey | 'settings'>, slices: SliceKey[], settings: boolean) {
  if (!uid) return;
  let ok = true;
  for (const k of slices) ok = writeJSON(v2Key(uid, k), s[k]) && ok;
  if (settings) ok = writeJSON(v2Key(uid, 'settings'), s.settings) && ok;
  ok = saveUserCacheMeta(uid) && ok;
  if (!ok && Date.now() - cacheFailToast > 15000) {
    cacheFailToast = Date.now();
    void import('../store/ui').then(({ useUI }) =>
      useUI.getState().toast({ message: "This device's storage is full — changes still sync to the cloud while you're online.", tone: 'danger', duration: 8000 }),
    );
  }
}

function rememberDeviceTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem('kosh:theme', theme);
  } catch {
    /* ignore */
  }
}

/** Replace store state without generating ops (data that is already in the cloud or in another tab). */
function applyRemote(patch: Partial<Store>, opts: { fromOtherTab?: boolean } = {}) {
  applyingRemote = true;
  skipCacheWrite = !!opts.fromOtherTab;
  try {
    useStore.setState(patch);
  } finally {
    applyingRemote = false;
    skipCacheWrite = false;
  }
}

// ---------------------------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------------------------
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

function isNetworkError(e: unknown): boolean {
  if (!online()) return true;
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|ERR_INTERNET|timeout/i.test(msg);
}
function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** Serialises pulls, flushes and wipes inside this tab. */
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
/** Serialises flushing across tabs of the same user when the Web Locks API exists. */
function crossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks || !uid) return fn();
  return locks.request('kosh-sync-' + uid, () => fn()) as Promise<T>;
}

function setStatus(status: SyncStatus, error: string | null = null) {
  const s = useSync.getState();
  if (s.status !== status || s.error !== error) useSync.setState({ status, error });
}

function settle() {
  if (!online()) return setStatus('offline');
  if (useSync.getState().status === 'error') return;
  setStatus(pendingCount() > 0 ? 'syncing' : 'synced');
}

function scheduleFlush(delay: number) {
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), delay);
}

function scheduleRetry() {
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void flush(), retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60_000);
}

const CHUNK = 400;
function chunks<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

async function sendOps(ops: Op[]): Promise<void> {
  if (!client || !uid) return;
  const userId = uid;
  const byGroup = new Map<string, Op[]>();
  for (const op of ops) {
    const k = op.table + '|' + op.kind;
    const g = byGroup.get(k);
    if (g) g.push(op);
    else byGroup.set(k, [op]);
  }
  for (const [k, group] of byGroup) {
    const [table, kind] = k.split('|') as [Table, OpKind];
    for (const part of chunks(group, kind === 'delete' ? 100 : CHUNK)) {
      let error: unknown = null;
      if (kind === 'delete') {
        if (table === 'settings') ({ error } = await client.from('settings').delete().eq('user_id', userId));
        else ({ error } = await client.from(table).delete().eq('user_id', userId).in('id', part.map((o) => o.id)));
      } else {
        const rows = part.map((o) => ({ ...o.row, user_id: userId }));
        const onConflict = table === 'settings' ? 'user_id' : 'user_id,id';
        ({ error } = await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: kind === 'insert' }));
      }
      if (error) throw error;
      // Drop exactly the ops we sent; a newer edit of the same row (new opId) stays queued.
      const q = readQueue();
      for (const o of part) if (q[opKey(o.table, o.id)]?.opId === o.opId) delete q[opKey(o.table, o.id)];
      writeQueue(q);
    }
  }
}

/** Push the pending queue to Supabase. Safe to call any time. */
export function flush(): Promise<void> {
  window.clearTimeout(flushTimer);
  return exclusive(async () => {
    if (!uid || !client) return;
    if (!online()) return setStatus('offline');
    const startUid = uid;
    try {
      await crossTabLock(async () => {
        for (let round = 0; round < 20 && uid === startUid; round++) {
          const ops = Object.values(readQueue());
          if (ops.length === 0) break;
          setStatus('syncing');
          await sendOps(ops);
        }
      });
      retryDelay = 2000;
      if (uid === startUid) setStatus(online() ? (pendingCount() ? 'syncing' : 'synced') : 'offline');
    } catch (e) {
      if (uid !== startUid) return;
      if (isNetworkError(e)) setStatus(online() ? 'syncing' : 'offline');
      else setStatus('error', friendlySyncError(e));
      scheduleRetry();
    }
  });
}

function friendlySyncError(e: unknown): string {
  const m = errMessage(e);
  if (/jwt|token|401|not authenticated/i.test(m)) return 'Your session expired. Sign in again to sync.';
  if (/row-level security|permission/i.test(m)) return "The server refused a change (permission).";
  return m.length > 140 ? m.slice(0, 140) + '…' : m;
}

// ---------------------------------------------------------------------------------------------
// Pull: load every table for the user, overlay changes still waiting in the queue, auto-post due
// recurring occurrences, then push.
// ---------------------------------------------------------------------------------------------
const PAGE = 1000;
async function fetchAll(table: Table): Promise<Row[]> {
  if (!client || !uid) return [];
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const q = client.from(table).select('*').eq('user_id', uid);
    const { data, error } = await (table === 'settings' ? q : q.order('id')).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function overlayQueue(data: DataState, settings: Settings, q: Queue): { data: DataState; settings: Settings } {
  const out = { ...data } as DataState;
  let s = settings;
  const bySlice = new Map<SliceKey, Op[]>();
  for (const op of Object.values(q)) {
    if (op.table === 'settings') {
      if (op.kind !== 'delete' && op.row) s = settingsFromRow(op.row);
      continue;
    }
    const slice = SLICE_OF[op.table as DataTable];
    if (!slice) continue;
    const l = bySlice.get(slice);
    if (l) l.push(op);
    else bySlice.set(slice, [op]);
  }
  for (const [slice, ops] of bySlice) {
    const map = new Map((out[slice] as { id: string }[]).map((x) => [x.id, x]));
    for (const op of ops) {
      if (op.kind === 'delete') map.delete(op.id);
      else if (op.kind === 'insert' && map.has(op.id)) continue;
      else if (op.row) {
        const item = FROM_ROW[slice](op.row);
        if (item) map.set(op.id, item);
      }
    }
    (out as Record<SliceKey, unknown>)[slice] = [...map.values()];
  }
  return { data: out, settings: s };
}

export function pull(): Promise<boolean> {
  return exclusive(async () => {
    if (!uid || !client) return false;
    if (!online()) {
      setStatus('offline');
      return false;
    }
    const startUid = uid;
    setStatus('syncing');
    try {
      const results = await Promise.all(ALL_TABLES.map((t) => fetchAll(t)));
      if (uid !== startUid) return false;
      const data = emptyData();
      let settingsRow: Row | null = null;
      ALL_TABLES.forEach((t, i) => {
        if (t === 'settings') settingsRow = results[i][0] ?? null;
        else {
          const slice = SLICE_OF[t as DataTable];
          (data as Record<SliceKey, unknown>)[slice] = results[i].map((r) => FROM_ROW[slice](r)).filter(Boolean);
        }
      });
      const remoteSettings = settingsRow ? settingsFromRow(settingsRow) : { ...DEFAULT_SETTINGS, theme: deviceTheme() };
      const merged = overlayQueue(data, remoteSettings, readQueue());
      applyRemote({ ...merged.data, settings: merged.settings });
      lastPull = Date.now();
      useSync.setState({ phase: 'ready', fromServer: true });
      return true;
    } catch (e) {
      if (uid !== startUid) return false;
      if (isNetworkError(e)) setStatus('offline');
      else setStatus('error', friendlySyncError(e));
      return false;
    }
  }).then((ok) => {
    if (ok) {
      useStore.getState().runDue();
      void flush();
    }
    return ok;
  });
}

function deviceTheme(): Settings['theme'] {
  try {
    const t = localStorage.getItem('kosh:theme');
    if (t === 'dark' || t === 'light' || t === 'system') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Retry button / manual refresh. */
export async function syncNow(): Promise<void> {
  retryDelay = 2000;
  if (useSync.getState().status === 'error') setStatus(online() ? 'syncing' : 'offline');
  await flush();
  await pull();
}

// ---------------------------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------------------------
function onOnline() {
  retryDelay = 2000;
  setStatus('syncing');
  void flush().then(() => pull());
}
function onOffline() {
  setStatus('offline');
}
function onVisible() {
  if (document.visibilityState === 'visible' && Date.now() - lastPull > 30_000) void pull();
}

/** Another tab of the same user changed the cache: adopt it without re-uploading. */
function onStorage(e: StorageEvent) {
  if (!uid || e.storageArea !== window.localStorage || !e.key || !e.key.startsWith(v2Prefix(uid))) return;
  const name = e.key.slice(v2Prefix(uid).length);
  if (name === 'queue') {
    updatePending();
    settle();
    return;
  }
  const v = parseRaw(e.newValue);
  if (v === undefined) return;
  if (name === 'settings') return applyRemote({ settings: validSettings(v) }, { fromOtherTab: true });
  if ((SLICES as string[]).includes(name)) {
    const list = validSlice(name as SliceKey, v);
    if (list) applyRemote({ [name]: list } as Partial<Store>, { fromOtherTab: true });
  }
}

function onBroadcast(e: MessageEvent) {
  const msg = e.data as { type?: string; userId?: string } | null;
  if (!msg || msg.userId !== uid) return;
  if (msg.type === 'wiped' || msg.type === 'pulled') {
    const cached = uid ? loadUserCache(uid) : null;
    if (cached) applyRemote({ ...cached.data, settings: cached.settings }, { fromOtherTab: true });
  }
}

export function startSync(supa: SupabaseClient, userId: string): void {
  if (uid === userId && unsubscribeStore) return;
  stopSync({ clearCache: false });
  client = supa;
  uid = userId;
  const cached = loadUserCache(userId);
  if (cached) {
    applyRemote({ ...cached.data, settings: cached.settings });
    useSync.setState({ phase: 'ready', userId, fromServer: false, status: online() ? 'syncing' : 'offline', error: null });
  } else {
    applyRemote({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, theme: deviceTheme() } });
    useSync.setState({ phase: 'loading', userId, fromServer: false, status: online() ? 'syncing' : 'offline', error: null });
  }
  updatePending();
  unsubscribeStore = useStore.subscribe(onStoreChange);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('kosh-sync');
    bc.onmessage = onBroadcast;
  }
  void pull().then((ok) => {
    if (ok || uid !== userId) return;
    if (useSync.getState().phase === 'loading') useSync.setState({ phase: 'failed' });
    else {
      // Offline with a cache: still post what fell due so the app behaves the same.
      useStore.getState().runDue();
      if (!online()) setStatus('offline');
    }
  });
}

/** Retry the very first load (no cache yet). */
export function retryInitialLoad(): void {
  if (!uid) return;
  useSync.setState({ phase: 'loading' });
  void pull().then((ok) => {
    if (!ok && useSync.getState().phase === 'loading') useSync.setState({ phase: 'failed' });
  });
}

export function stopSync({ clearCache }: { clearCache: boolean }): void {
  const old = uid;
  unsubscribeStore?.();
  unsubscribeStore = null;
  window.clearTimeout(retryTimer);
  window.clearTimeout(flushTimer);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  window.removeEventListener('storage', onStorage);
  document.removeEventListener('visibilitychange', onVisible);
  bc?.close();
  bc = null;
  uid = null;
  client = null;
  if (clearCache && old) clearUserCache(old);
  applyRemote({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, theme: deviceTheme() } });
  useSync.setState({ phase: 'idle', status: 'synced', pending: 0, error: null, userId: null, fromServer: false });
}

/** Settings → Clear all data: delete the user's rows in every table (RLS-scoped), then start over. */
export function wipeAllData(): Promise<void> {
  return exclusive(async () => {
    if (!client || !uid) throw new Error('Not signed in');
    if (!online()) throw new Error("You're offline. Connect to the internet to clear your cloud data.");
    const userId = uid;
    for (const t of ALL_TABLES) {
      const { error } = await client.from(t).delete().eq('user_id', userId);
      if (error) throw error;
    }
    writeQueue({});
    const theme = useStore.getState().settings.theme;
    const name = useStore.getState().settings.name;
    applyRemote({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, theme, name } });
    bc?.postMessage({ type: 'wiped', userId });
    setStatus('synced');
  });
}
