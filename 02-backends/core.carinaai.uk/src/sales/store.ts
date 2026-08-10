/**
 * Workspace-scoped persistence for qualification weights, declines, and RED overrides.
 */

import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import {
  DEFAULT_SCORECARD_WEIGHTS,
  normalizeWeights,
  type ScorecardWeights,
} from './qualification-scorecard.js';
import type { DeclinedDealRecord, FounderOverrideRecord } from './post-decline-review.js';

const STORE_FILE = 'qualification-scorecard.json';

export interface QualificationStoreShape {
  weightsByWorkspace: Record<string, ScorecardWeights>;
  declines: DeclinedDealRecord[];
  overrides: FounderOverrideRecord[];
}

const caches = new Map<string, QualificationStoreShape>();

function emptyStore(): QualificationStoreShape {
  return {
    weightsByWorkspace: {},
    declines: [],
    overrides: [],
  };
}

function storeDir(): string {
  return path.join(resolveCarinaHome(), 'sales');
}

function storePath(): string {
  return path.join(storeDir(), STORE_FILE);
}

export function loadQualificationStore(): QualificationStoreShape {
  if (caches.has(STORE_FILE)) return caches.get(STORE_FILE)!;
  const file = storePath();
  if (!fs.existsSync(file)) {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<QualificationStoreShape>;
    const value: QualificationStoreShape = {
      weightsByWorkspace: raw.weightsByWorkspace ?? {},
      declines: raw.declines ?? [],
      overrides: raw.overrides ?? [],
    };
    caches.set(STORE_FILE, value);
    return value;
  } catch {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
}

export function saveQualificationStore(store: QualificationStoreShape): void {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  caches.set(STORE_FILE, store);
}

export function mutateQualificationStore(
  mutator: (store: QualificationStoreShape) => void,
): QualificationStoreShape {
  const store = structuredClone(loadQualificationStore());
  mutator(store);
  saveQualificationStore(store);
  return store;
}

export function resetQualificationStoreCache(): void {
  caches.clear();
}

export function getWorkspaceWeights(workspaceId: string): ScorecardWeights {
  const store = loadQualificationStore();
  return normalizeWeights(store.weightsByWorkspace[workspaceId] ?? DEFAULT_SCORECARD_WEIGHTS);
}

export function setWorkspaceWeights(
  workspaceId: string,
  partial: Partial<ScorecardWeights>,
): ScorecardWeights {
  const next = normalizeWeights({ ...getWorkspaceWeights(workspaceId), ...partial });
  mutateQualificationStore((store) => {
    store.weightsByWorkspace[workspaceId] = next;
  });
  return next;
}

export function listDeclinedDeals(workspaceId: string): DeclinedDealRecord[] {
  return loadQualificationStore().declines.filter((d) => d.workspaceId === workspaceId);
}

export function appendDeclinedDeal(record: DeclinedDealRecord): DeclinedDealRecord {
  mutateQualificationStore((store) => {
    store.declines.push(record);
  });
  return record;
}

export function listFounderOverrides(workspaceId: string): FounderOverrideRecord[] {
  return loadQualificationStore().overrides.filter((o) => o.workspaceId === workspaceId);
}

export function appendFounderOverride(record: FounderOverrideRecord): FounderOverrideRecord {
  mutateQualificationStore((store) => {
    store.overrides.push(record);
  });
  return record;
}
