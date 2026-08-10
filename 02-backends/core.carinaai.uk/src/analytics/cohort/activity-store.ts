/**
 * Workspace-scoped user activity for cohort retention.
 * Shape mirrors a future `user_activity` table: { userId, date, active }.
 */

import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';

export interface UserSignupRecord {
  userId: string;
  workspaceId: string;
  signedUpAt: string;
  /** Opt-out of re-engagement (respect communication preferences) */
  reengagementOptOut?: boolean;
}

export interface UserActivityDay {
  userId: string;
  workspaceId: string;
  /** ISO date YYYY-MM-DD (UTC) */
  date: string;
  active: boolean;
}

export interface ReengagementJob {
  id: string;
  workspaceId: string;
  userId: string;
  createdAt: string;
  status: 'queued' | 'skipped_opt_out' | 'sent_simulated';
  reason: string;
}

export interface CohortActivityStoreShape {
  signups: UserSignupRecord[];
  activity: UserActivityDay[];
  reengagementJobs: ReengagementJob[];
  /** Daily refresh marker for retention snapshots */
  lastComputedAt?: string;
  lastDigestAt?: string;
}

const STORE_FILE = 'cohort-activity.json';
const caches = new Map<string, CohortActivityStoreShape>();

function emptyStore(): CohortActivityStoreShape {
  return { signups: [], activity: [], reengagementJobs: [] };
}

function storeDir(): string {
  return path.join(resolveCarinaHome(), 'analytics');
}

function storePath(): string {
  return path.join(storeDir(), STORE_FILE);
}

export function loadCohortActivityStore(): CohortActivityStoreShape {
  if (caches.has(STORE_FILE)) return caches.get(STORE_FILE)!;
  const file = storePath();
  if (!fs.existsSync(file)) {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CohortActivityStoreShape>;
    const value: CohortActivityStoreShape = {
      signups: raw.signups ?? [],
      activity: raw.activity ?? [],
      reengagementJobs: raw.reengagementJobs ?? [],
      lastComputedAt: raw.lastComputedAt,
      lastDigestAt: raw.lastDigestAt,
    };
    caches.set(STORE_FILE, value);
    return value;
  } catch {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
}

export function saveCohortActivityStore(store: CohortActivityStoreShape): void {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  caches.set(STORE_FILE, store);
}

export function mutateCohortActivityStore(
  mutator: (store: CohortActivityStoreShape) => void,
): CohortActivityStoreShape {
  const store = structuredClone(loadCohortActivityStore());
  mutator(store);
  saveCohortActivityStore(store);
  return store;
}

export function resetCohortActivityStoreCache(): void {
  caches.clear();
}

export function toUtcDateString(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(input)}`);
  return d.toISOString().slice(0, 10);
}

export function upsertSignup(record: UserSignupRecord): UserSignupRecord {
  mutateCohortActivityStore((store) => {
    const idx = store.signups.findIndex(
      (s) => s.workspaceId === record.workspaceId && s.userId === record.userId,
    );
    if (idx >= 0) store.signups[idx] = { ...store.signups[idx], ...record };
    else store.signups.push(record);
  });
  return record;
}

/** First-seen wins for signedUpAt (used by event tracking feed). */
export function ensureSignup(record: UserSignupRecord): UserSignupRecord {
  const existing = loadCohortActivityStore().signups.find(
    (s) => s.workspaceId === record.workspaceId && s.userId === record.userId,
  );
  if (existing) return existing;
  return upsertSignup(record);
}

export function recordActivityDay(row: UserActivityDay): UserActivityDay {
  const date = toUtcDateString(row.date);
  const normalized: UserActivityDay = {
    userId: row.userId,
    workspaceId: row.workspaceId,
    date,
    active: row.active !== false,
  };
  mutateCohortActivityStore((store) => {
    const idx = store.activity.findIndex(
      (a) =>
        a.workspaceId === normalized.workspaceId
        && a.userId === normalized.userId
        && a.date === normalized.date,
    );
    if (idx >= 0) store.activity[idx] = normalized;
    else store.activity.push(normalized);
  });
  return normalized;
}

export function listWorkspaceSignups(workspaceId: string): UserSignupRecord[] {
  return loadCohortActivityStore().signups.filter((s) => s.workspaceId === workspaceId);
}

export function listWorkspaceActivity(workspaceId: string): UserActivityDay[] {
  return loadCohortActivityStore().activity.filter((a) => a.workspaceId === workspaceId);
}

export function markRetentionComputed(at = new Date().toISOString()): void {
  mutateCohortActivityStore((store) => {
    store.lastComputedAt = at;
  });
}

export function appendReengagementJob(job: ReengagementJob): ReengagementJob {
  mutateCohortActivityStore((store) => {
    store.reengagementJobs.push(job);
  });
  return job;
}

export function listReengagementJobs(workspaceId: string): ReengagementJob[] {
  return loadCohortActivityStore().reengagementJobs.filter((j) => j.workspaceId === workspaceId);
}
