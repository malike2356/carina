/**
 * Dunning (payment recovery) state for Aiva subscriptions.
 */

import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';

export const DUNNING_RETRY_DAYS = [1, 3, 5, 7, 14] as const;
export const DUNNING_EMAIL_DAYS = [1, 5, 12] as const;
export type DunningEmailStage = 1 | 2 | 3;

export type DunningStatus =
  | 'active'
  | 'recovered'
  | 'cancelled'
  | 'exhausted';

export interface DunningRetryPlan {
  dayOffset: number;
  scheduledAt: string;
  attemptedAt?: string;
  result?: 'pending' | 'succeeded' | 'failed' | 'skipped';
}

export interface DunningEmailLog {
  stage: DunningEmailStage;
  dayOffset: number;
  scheduledAt: string;
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
  portalUrl?: string;
}

export interface DunningCase {
  id: string;
  workspaceId: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  stripeCustomerId?: string;
  amountDueMinor?: number;
  currency?: string;
  failedAt: string;
  graceEndsAt: string;
  status: DunningStatus;
  retries: DunningRetryPlan[];
  emails: DunningEmailLog[];
  recoveredAt?: string;
  cancelledAt?: string;
  mrrMinor?: number;
}

export interface DunningStoreShape {
  cases: DunningCase[];
}

const STORE_FILE = 'dunning-cases.json';
const caches = new Map<string, DunningStoreShape>();

function emptyStore(): DunningStoreShape {
  return { cases: [] };
}

function storeDir(): string {
  return path.join(resolveCarinaHome(), 'billing');
}

function storePath(): string {
  return path.join(storeDir(), STORE_FILE);
}

export function loadDunningStore(): DunningStoreShape {
  if (caches.has(STORE_FILE)) return caches.get(STORE_FILE)!;
  const file = storePath();
  if (!fs.existsSync(file)) {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<DunningStoreShape>;
    const value: DunningStoreShape = { cases: raw.cases ?? [] };
    caches.set(STORE_FILE, value);
    return value;
  } catch {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
}

export function saveDunningStore(store: DunningStoreShape): void {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  caches.set(STORE_FILE, store);
}

export function mutateDunningStore(mutator: (store: DunningStoreShape) => void): DunningStoreShape {
  const store = structuredClone(loadDunningStore());
  mutator(store);
  saveDunningStore(store);
  return store;
}

export function resetDunningStoreCache(): void {
  caches.clear();
}

export function listActiveDunningCases(workspaceId?: string): DunningCase[] {
  return loadDunningStore().cases.filter(
    (c) => c.status === 'active' && (!workspaceId || c.workspaceId === workspaceId),
  );
}

export function getActiveDunningCase(workspaceId: string): DunningCase | null {
  return (
    listActiveDunningCases(workspaceId).sort((a, b) => b.failedAt.localeCompare(a.failedAt))[0]
    ?? null
  );
}

export function upsertDunningCase(next: DunningCase): DunningCase {
  mutateDunningStore((store) => {
    const idx = store.cases.findIndex((c) => c.id === next.id);
    if (idx >= 0) store.cases[idx] = next;
    else store.cases.push(next);
  });
  return next;
}

export function dunningGraceDays(): number {
  const raw = process.env.AIVA_DUNNING_GRACE_DAYS ?? process.env.AIVA_GRACE_PERIOD_DAYS;
  const parsed = raw ? Number(raw) : 14;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}
