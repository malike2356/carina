import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { OutreachStoreShape } from './types.js';
import { emptyOutreachStore } from './store-shape.js';
import { isOutreachPostgresEnabled } from './pg/config.js';
import {
  listWorkspaceIdsFromPg,
  loadOutreachStoreFromPg,
  saveOutreachStoreToPg,
  saveWorkspaceOutreachToPg,
} from './pg/hydrate.js';

export { emptyOutreachStore } from './store-shape.js';

const caches = new Map<string, unknown>();
const STORE_FILE = 'outreach-program.json';

let pgCache: OutreachStoreShape | null = null;
let pgReady = false;
let flushChain: Promise<void> = Promise.resolve();
let flushTimer: NodeJS.Timeout | null = null;

export function outreachStoreDir(): string {
  return path.join(resolveCarinaHome(), 'outreach');
}

function storeFilePath(fileName: string): string {
  return path.join(outreachStoreDir(), fileName);
}

export function loadOutreachJson<T>(fileName: string, defaultValue: () => T): T {
  if (caches.has(fileName)) return caches.get(fileName) as T;
  const file = storeFilePath(fileName);
  if (!fs.existsSync(file)) {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    caches.set(fileName, raw);
    return raw;
  } catch {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
}

export function saveOutreachJson<T>(fileName: string, value: T): void {
  fs.mkdirSync(outreachStoreDir(), { recursive: true });
  fs.writeFileSync(storeFilePath(fileName), JSON.stringify(value, null, 2));
  caches.set(fileName, value);
}

export function resetOutreachStoreCache(fileName?: string): void {
  if (fileName) caches.delete(fileName);
  else caches.clear();
  pgCache = null;
  pgReady = false;
}

function loadJsonStore(): OutreachStoreShape {
  const raw = loadOutreachJson<OutreachStoreShape>(STORE_FILE, emptyOutreachStore);
  return {
    leads: raw.leads ?? [],
    campaigns: raw.campaigns ?? [],
    sequences: raw.sequences ?? [],
    enrollments: raw.enrollments ?? [],
    deliveries: raw.deliveries ?? [],
    lists: raw.lists ?? [],
    replyReviews: raw.replyReviews ?? [],
    bookings: raw.bookings ?? [],
    reminders: raw.reminders ?? [],
    bookingConfigs: raw.bookingConfigs ?? {},
    boardConfigs: raw.boardConfigs ?? {},
    boardRefs: raw.boardRefs ?? {},
    alertTargets: raw.alertTargets ?? {},
    controls: raw.controls ?? {},
    followUpTasks: raw.followUpTasks ?? [],
    leadSheetConfigs: raw.leadSheetConfigs ?? {},
    ingestJobs: raw.ingestJobs ?? [],
    leadViews: raw.leadViews ?? [],
    suppressions: raw.suppressions ?? [],
  };
}

function cloneStore(store: OutreachStoreShape): OutreachStoreShape {
  return JSON.parse(JSON.stringify(store)) as OutreachStoreShape;
}

function schedulePgFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const snapshot = pgCache ? cloneStore(pgCache) : null;
    if (!snapshot) return;
    flushChain = flushChain
      .then(async () => {
        await saveOutreachStoreToPg(snapshot);
      })
      .catch((err) => {
        console.error('[outreach-pg] flush failed:', err);
      });
  }, 25);
}

/** Prime in-memory cache from PostgreSQL. Call once at process boot when PG mode is on. */
export async function ensureOutreachStoreReady(): Promise<void> {
  if (!isOutreachPostgresEnabled()) {
    pgReady = true;
    return;
  }
  pgCache = await loadOutreachStoreFromPg();
  pgReady = true;
}

export function loadOutreachStore(): OutreachStoreShape {
  if (!isOutreachPostgresEnabled()) return loadJsonStore();
  if (!pgReady || !pgCache) {
    throw new Error(
      'Outreach PostgreSQL cache is not ready. Call await ensureOutreachStoreReady() at process boot.',
    );
  }
  return pgCache;
}

export async function loadOutreachStoreAsync(workspaceId?: string): Promise<OutreachStoreShape> {
  if (!isOutreachPostgresEnabled()) return loadJsonStore();
  if (workspaceId) return loadOutreachStoreFromPg(workspaceId);
  if (!pgReady || !pgCache) await ensureOutreachStoreReady();
  return pgCache!;
}

export function saveOutreachStore(store: OutreachStoreShape): void {
  if (!isOutreachPostgresEnabled()) {
    saveOutreachJson(STORE_FILE, store);
    return;
  }
  pgCache = store;
  pgReady = true;
  schedulePgFlush();
}

export async function saveOutreachStoreAsync(store: OutreachStoreShape): Promise<void> {
  if (!isOutreachPostgresEnabled()) {
    saveOutreachJson(STORE_FILE, store);
    return;
  }
  pgCache = store;
  pgReady = true;
  await saveOutreachStoreToPg(store);
}

export function mutateOutreachStore(mutator: (store: OutreachStoreShape) => void): OutreachStoreShape {
  if (!isOutreachPostgresEnabled()) {
    const store = loadJsonStore();
    mutator(store);
    saveOutreachJson(STORE_FILE, store);
    return store;
  }
  if (!pgReady || !pgCache) {
    throw new Error(
      'Outreach PostgreSQL cache is not ready. Call await ensureOutreachStoreReady() at process boot.',
    );
  }
  mutator(pgCache);
  schedulePgFlush();
  return pgCache;
}

export async function mutateOutreachStoreAsync(
  mutator: (store: OutreachStoreShape) => void | Promise<void>,
): Promise<OutreachStoreShape> {
  if (!isOutreachPostgresEnabled()) {
    const store = loadJsonStore();
    await mutator(store);
    saveOutreachJson(STORE_FILE, store);
    return store;
  }
  if (!pgReady || !pgCache) await ensureOutreachStoreReady();
  await mutator(pgCache!);
  await saveOutreachStoreToPg(pgCache!);
  return pgCache!;
}

export async function mutateWorkspaceOutreachAsync(
  workspaceId: string,
  mutator: (store: OutreachStoreShape) => void | Promise<void>,
): Promise<OutreachStoreShape> {
  if (!isOutreachPostgresEnabled()) {
    const store = loadJsonStore();
    await mutator(store);
    saveOutreachJson(STORE_FILE, store);
    return store;
  }
  const slice = await loadOutreachStoreFromPg(workspaceId);
  await mutator(slice);
  await saveWorkspaceOutreachToPg(workspaceId, slice);
  // Refresh global cache after workspace write
  pgCache = await loadOutreachStoreFromPg();
  pgReady = true;
  return slice;
}

export async function flushOutreachStoreAsync(): Promise<void> {
  if (!isOutreachPostgresEnabled()) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushChain;
  if (pgCache) await saveOutreachStoreToPg(pgCache);
}

export async function listOutreachWorkspaceIdsAsync(): Promise<string[]> {
  if (!isOutreachPostgresEnabled()) {
    const store = loadJsonStore();
    const ids = new Set<string>();
    for (const row of store.enrollments) ids.add(row.workspaceId);
    for (const row of store.reminders) ids.add(row.workspaceId);
    for (const row of store.followUpTasks) ids.add(row.workspaceId);
    for (const row of store.bookings) ids.add(row.workspaceId);
    for (const row of store.deliveries) ids.add(row.workspaceId);
    for (const row of store.leads) ids.add(row.workspaceId);
    return [...ids];
  }
  return listWorkspaceIdsFromPg();
}
