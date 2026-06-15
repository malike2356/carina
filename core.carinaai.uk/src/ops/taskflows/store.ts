import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import { getActiveProfileOrDefault } from '../../profiles/isolation.js';
import type {
  DeliveryQueueItem,
  TaskFlow,
  TaskFlowRun,
  TaskFlowStoreFile,
  TaskRunStatus,
} from './types.js';

const STORE_PATH = path.join(CARINA_HOME, 'taskflows.json');
let cached: TaskFlowStoreFile | null = null;

function emptyStore(): TaskFlowStoreFile {
  return { version: 1, flows: [], runs: [], deliveryQueue: [] };
}

function loadStore(): TaskFlowStoreFile {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = emptyStore();
    return cached;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as TaskFlowStoreFile;
    cached = {
      ...emptyStore(),
      ...raw,
      flows: raw.flows ?? [],
      runs: raw.runs ?? [],
      deliveryQueue: raw.deliveryQueue ?? [],
    };
    return cached;
  } catch {
    cached = emptyStore();
    return cached;
  }
}

function saveStore(store: TaskFlowStoreFile): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  cached = store;
}

export function resetTaskFlowStoreCache(): void {
  cached = null;
}

/** Enabled by default; set CARINA_TASKFLOWS_ENABLED=false to disable. */
export function taskFlowsEnabled(): boolean {
  return process.env.CARINA_TASKFLOWS_ENABLED !== 'false';
}

export function listTaskFlows(profileName?: string): TaskFlow[] {
  const profile = profileName ?? getActiveProfileOrDefault();
  return loadStore().flows.filter((f) =>
    !f.profileName || f.profileName === profile || profileName === undefined);
}

export function getTaskFlow(id: string): TaskFlow | undefined {
  return loadStore().flows.find((f) => f.id === id);
}

export function upsertTaskFlow(
  input: Omit<TaskFlow, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): TaskFlow {
  const store = loadStore();
  const now = new Date().toISOString();
  const profileName = input.profileName ?? getActiveProfileOrDefault();
  if (input.id) {
    const idx = store.flows.findIndex((f) => f.id === input.id);
    if (idx >= 0) {
      store.flows[idx] = { ...store.flows[idx]!, ...input, profileName, updatedAt: now };
      saveStore(store);
      return store.flows[idx]!;
    }
  }
  const flow: TaskFlow = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    label: input.label,
    profileName,
    model: input.model,
    steps: input.steps,
    chainOnSuccess: input.chainOnSuccess ?? [],
    triggers: input.triggers ?? [],
    status: input.status ?? 'active',
    maxRetries: input.maxRetries,
    createdAt: now,
    updatedAt: now,
  };
  store.flows.push(flow);
  saveStore(store);
  return flow;
}

export function enqueueTaskFlowRun(
  flowId: string,
  options?: { idempotencyKey?: string; profileName?: string; fromStep?: number; stepOutputs?: Record<string, string> },
): TaskFlowRun | null {
  const store = loadStore();
  const flow = store.flows.find((f) => f.id === flowId);
  if (!flow || flow.status !== 'active') return null;

  if (options?.idempotencyKey) {
    const existing = store.runs.find(
      (r) =>
        r.flowId === flowId &&
        r.idempotencyKey === options.idempotencyKey &&
        (r.status === 'queued' || r.status === 'running' || r.status === 'succeeded'),
    );
    if (existing) return existing;
  }

  const run: TaskFlowRun = {
    id: crypto.randomUUID(),
    flowId: flow.id,
    flowName: flow.name,
    profileName: options?.profileName ?? flow.profileName ?? getActiveProfileOrDefault(),
    status: 'queued',
    stepIndex: options?.fromStep ?? 0,
    stepOutputs: options?.stepOutputs,
    idempotencyKey: options?.idempotencyKey,
    queuedAt: new Date().toISOString(),
  };
  store.runs.push(run);
  if (store.runs.length > 500) store.runs = store.runs.slice(-500);
  saveStore(store);
  return run;
}

export function updateTaskFlowRun(
  runId: string,
  patch: Partial<TaskFlowRun>,
): TaskFlowRun | null {
  const store = loadStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx < 0) return null;
  store.runs[idx] = { ...store.runs[idx]!, ...patch };
  saveStore(store);
  return store.runs[idx]!;
}

export function getTaskFlowRun(runId: string): TaskFlowRun | undefined {
  return loadStore().runs.find((r) => r.id === runId);
}

export function listTaskFlowRuns(limit = 50, profileName?: string): TaskFlowRun[] {
  const runs = loadStore().runs.slice(-limit * 2).reverse();
  if (!profileName) return runs.slice(0, limit);
  return runs.filter((r) => !r.profileName || r.profileName === profileName).slice(0, limit);
}

export function searchTaskFlowRuns(query: string, limit = 30, profileName?: string): TaskFlowRun[] {
  const q = query.trim().toLowerCase();
  if (!q) return listTaskFlowRuns(limit, profileName);
  return loadStore().runs
    .filter((r) => {
      if (profileName && r.profileName && r.profileName !== profileName) return false;
      return (
        r.flowName.toLowerCase().includes(q)
        || (r.output?.toLowerCase().includes(q) ?? false)
        || (r.error?.toLowerCase().includes(q) ?? false)
        || r.id.toLowerCase().includes(q)
      );
    })
    .slice(-limit)
    .reverse();
}

export function listTaskFlowRunsByStatus(status?: TaskRunStatus, profileName?: string): TaskFlowRun[] {
  const runs = listTaskFlowRuns(200, profileName);
  return status ? runs.filter((r) => r.status === status) : runs;
}

export async function waitForTaskFlowRun(
  runId: string,
  timeoutMs = 120_000,
  pollMs = 300,
): Promise<TaskFlowRun | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = getTaskFlowRun(runId);
    if (run && run.status !== 'queued' && run.status !== 'running') return run;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return getTaskFlowRun(runId) ?? null;
}

export function enqueueDelivery(item: Omit<DeliveryQueueItem, 'id' | 'status' | 'createdAt'>): DeliveryQueueItem {
  const store = loadStore();
  const entry: DeliveryQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  store.deliveryQueue.push(entry);
  if (store.deliveryQueue.length > 200) {
    store.deliveryQueue = store.deliveryQueue.slice(-200);
  }
  saveStore(store);
  return entry;
}

export function listDeliveryQueue(includeDelivered = false): DeliveryQueueItem[] {
  const q = loadStore().deliveryQueue;
  return includeDelivered ? q : q.filter((i) => i.status === 'queued');
}

export function markDelivery(id: string, status: 'delivered' | 'failed', error?: string): boolean {
  const store = loadStore();
  const item = store.deliveryQueue.find((i) => i.id === id);
  if (!item) return false;
  item.status = status;
  item.deliveredAt = new Date().toISOString();
  if (error) item.error = error;
  saveStore(store);
  return true;
}

export function pauseTaskFlow(flowId: string): TaskFlow | null {
  const flow = getTaskFlow(flowId);
  if (!flow) return null;
  return upsertTaskFlow({ ...flow, status: 'paused' });
}

export function resumeTaskFlow(flowId: string): TaskFlow | null {
  const flow = getTaskFlow(flowId);
  if (!flow) return null;
  return upsertTaskFlow({ ...flow, status: 'active' });
}

export function retryTaskFlowRun(
  runId: string,
  options?: { fromStep?: number },
): TaskFlowRun | null {
  const store = loadStore();
  const original = store.runs.find((r) => r.id === runId);
  if (!original) return null;
  if (original.status !== 'failed' && original.status !== 'timed_out' && original.status !== 'cancelled') {
    return null;
  }

  const fromStep = options?.fromStep ?? original.stepIndex ?? 0;
  const preservedOutputs: Record<string, string> = {};
  if (original.stepOutputs) {
    for (const [key, value] of Object.entries(original.stepOutputs)) {
      if (Number(key) < fromStep) preservedOutputs[key] = value;
    }
  }

  const retry: TaskFlowRun = {
    id: crypto.randomUUID(),
    flowId: original.flowId,
    flowName: original.flowName,
    profileName: original.profileName,
    status: 'queued',
    stepIndex: fromStep,
    stepOutputs: Object.keys(preservedOutputs).length ? preservedOutputs : original.stepOutputs,
    retryCount: 0,
    retriedFromRunId: runId,
    queuedAt: new Date().toISOString(),
  };
  store.runs.push(retry);
  if (store.runs.length > 500) store.runs = store.runs.slice(-500);
  saveStore(store);
  return retry;
}

export function purgeDeliveryQueue(): number {
  const store = loadStore();
  const before = store.deliveryQueue.length;
  store.deliveryQueue = store.deliveryQueue.filter((i) => i.status === 'queued');
  const removed = before - store.deliveryQueue.length;
  if (removed > 0) saveStore(store);
  return removed;
}
