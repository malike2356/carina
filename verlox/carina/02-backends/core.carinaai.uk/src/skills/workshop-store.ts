import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { curateFromWorkflow } from './curator.js';
import { saveSkill } from './store.js';

export type WorkshopDraftSource = 'auto-writer' | 'session-learner' | 'manual';

export type WorkshopDraft = {
  id: string;
  source: WorkshopDraftSource;
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
};

type WorkshopStoreFile = {
  version: number;
  drafts: WorkshopDraft[];
};

const STORE_PATH = path.join(CARINA_HOME, 'workshop-queue.json');
const MAX_DRAFTS = 200;
let cached: WorkshopStoreFile | null = null;

export function workshopReviewEnabled(): boolean {
  return process.env.CARINA_SKILL_WORKSHOP === 'true';
}

function loadStore(): WorkshopStoreFile {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = { version: 1, drafts: [] };
    return cached;
  }
  try {
    cached = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as WorkshopStoreFile;
    cached.drafts = cached.drafts ?? [];
    return cached;
  } catch {
    cached = { version: 1, drafts: [] };
    return cached;
  }
}

function saveStore(store: WorkshopStoreFile): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  cached = store;
}

export function resetWorkshopStoreCache(): void {
  cached = null;
}

export function enqueueWorkshopDraft(input: Omit<WorkshopDraft, 'id' | 'status' | 'createdAt'>): WorkshopDraft {
  const store = loadStore();
  const draft: WorkshopDraft = {
    ...input,
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store.drafts.unshift(draft);
  if (store.drafts.length > MAX_DRAFTS) {
    store.drafts = store.drafts.slice(0, MAX_DRAFTS);
  }
  saveStore(store);
  return draft;
}

export function listWorkshopDrafts(status?: WorkshopDraft['status']): WorkshopDraft[] {
  const drafts = loadStore().drafts;
  return status ? drafts.filter((d) => d.status === status) : drafts;
}

export function getWorkshopDraft(id: string): WorkshopDraft | undefined {
  return loadStore().drafts.find((d) => d.id === id || d.id.startsWith(id));
}

function patchDraft(id: string, patch: Partial<WorkshopDraft>): WorkshopDraft | null {
  const store = loadStore();
  const idx = store.drafts.findIndex((d) => d.id === id || d.id.startsWith(id));
  if (idx < 0) return null;
  store.drafts[idx] = { ...store.drafts[idx]!, ...patch };
  saveStore(store);
  return store.drafts[idx]!;
}

export async function approveWorkshopDraft(id: string): Promise<{ draft: WorkshopDraft; action: string }> {
  const draft = getWorkshopDraft(id);
  if (!draft) throw new Error(`Workshop draft not found: ${id}`);
  if (draft.status !== 'pending') throw new Error(`Draft is already ${draft.status}`);

  const result = await curateFromWorkflow({
    name: draft.name,
    description: draft.description,
    trigger: draft.trigger,
    steps: draft.steps,
    toolsUsed: draft.toolsUsed,
  });

  patchDraft(draft.id, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  });

  return { draft: { ...draft, status: 'approved' }, action: result.action };
}

export async function rejectWorkshopDraft(id: string): Promise<WorkshopDraft> {
  const draft = getWorkshopDraft(id);
  if (!draft) throw new Error(`Workshop draft not found: ${id}`);
  const updated = patchDraft(draft.id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error(`Workshop draft not found: ${id}`);
  return updated;
}

export function purgeWorkshopDrafts(status?: WorkshopDraft['status']): number {
  const store = loadStore();
  const before = store.drafts.length;
  store.drafts = status
    ? store.drafts.filter((d) => d.status !== status)
    : [];
  saveStore(store);
  return before - store.drafts.length;
}

export async function publishWorkshopDraftDirectly(input: {
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
}): Promise<void> {
  await saveSkill({
    name: input.name,
    description: input.description,
    trigger: input.trigger,
    steps: input.steps,
    toolsUsed: input.toolsUsed,
  });
}
