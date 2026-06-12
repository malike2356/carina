import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
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

export function taskFlowsEnabled(): boolean {
  return process.env.CARINA_TASKFLOWS_ENABLED === 'true';
}

export function listTaskFlows(): TaskFlow[] {
  return [...loadStore().flows];
}

export function getTaskFlow(id: string): TaskFlow | undefined {
  return loadStore().flows.find((f) => f.id === id);
}

export function upsertTaskFlow(input: Omit<TaskFlow, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TaskFlow {
  const store = loadStore();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = store.flows.findIndex((f) => f.id === input.id);
    if (idx >= 0) {
      store.flows[idx] = { ...store.flows[idx]!, ...input, updatedAt: now };
      saveStore(store);
      return store.flows[idx]!;
    }
  }
  const flow: TaskFlow = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    label: input.label,
    steps: input.steps,
    chainOnSuccess: input.chainOnSuccess ?? [],
    triggers: input.triggers ?? [],
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
  store.flows.push(flow);
  saveStore(store);
  return flow;
}

export function enqueueTaskFlowRun(
  flowId: string,
  options?: { idempotencyKey?: string },
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
    status: 'queued',
    stepIndex: 0,
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

export function listTaskFlowRuns(limit = 50): TaskFlowRun[] {
  return loadStore().runs.slice(-limit).reverse();
}

export function listTaskFlowRunsByStatus(status?: TaskRunStatus): TaskFlowRun[] {
  const runs = listTaskFlowRuns(200);
  return status ? runs.filter((r) => r.status === status) : runs;
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

export function retryTaskFlowRun(runId: string): TaskFlowRun | null {
  const store = loadStore();
  const original = store.runs.find((r) => r.id === runId);
  if (!original) return null;
  if (original.status !== 'failed' && original.status !== 'timed_out') return null;
  const retry: TaskFlowRun = {
    id: crypto.randomUUID(),
    flowId: original.flowId,
    flowName: original.flowName,
    status: 'queued',
    stepIndex: 0,
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
