import crypto from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/property-channel-store.js';
import {
  isChannelNicheId,
  resolveDomainForNiche,
  type ChannelDomainId,
} from '../../../content/script-generator/niches.js';
import {
  PROPERTY_CHANNEL_STEP_IDS,
  type PropertyChannelInput,
  type PropertyChannelRun,
  type PropertyChannelStepId,
  type PropertyChannelStepState,
} from './types.js';

const STORE_FILE = 'workflow-runs.json';

function emptyStore(): PropertyChannelRun[] {
  return [];
}

function emptySteps(): Record<PropertyChannelStepId, PropertyChannelStepState> {
  const steps = {} as Record<PropertyChannelStepId, PropertyChannelStepState>;
  for (const id of PROPERTY_CHANNEL_STEP_IDS) {
    steps[id] = { id, status: 'pending', attempts: 0 };
  }
  return steps;
}

/** Backfill domain on runs created before domain packs landed. */
export function normalizeChannelRun(run: PropertyChannelRun): PropertyChannelRun {
  if (run.input.domain) return run;
  const niche = run.input.niche;
  const domain: ChannelDomainId =
    isChannelNicheId(niche) ? resolveDomainForNiche(niche) : 'property';
  return {
    ...run,
    input: {
      ...run.input,
      domain,
    },
  };
}

export function createPropertyChannelRun(input: PropertyChannelInput): PropertyChannelRun {
  const store = loadJsonStore<PropertyChannelRun[]>(STORE_FILE, emptyStore);
  const now = new Date().toISOString();
  const run: PropertyChannelRun = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    input,
    status: 'queued',
    currentStepIndex: 0,
    steps: emptySteps(),
    context: {},
    createdAt: now,
    updatedAt: now,
  };
  store.push(run);
  saveJsonStore(STORE_FILE, store);
  return run;
}

export function getPropertyChannelRun(id: string): PropertyChannelRun | undefined {
  const run = loadJsonStore<PropertyChannelRun[]>(STORE_FILE, emptyStore).find((r) => r.id === id);
  return run ? normalizeChannelRun(run) : undefined;
}

export function listPropertyChannelRuns(workspaceId: string): PropertyChannelRun[] {
  return loadJsonStore<PropertyChannelRun[]>(STORE_FILE, emptyStore)
    .filter((r) => r.workspaceId === workspaceId)
    .map(normalizeChannelRun)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAllPropertyChannelRuns(): PropertyChannelRun[] {
  return loadJsonStore<PropertyChannelRun[]>(STORE_FILE, emptyStore)
    .map(normalizeChannelRun)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveRun(run: PropertyChannelRun): PropertyChannelRun {
  const store = loadJsonStore<PropertyChannelRun[]>(STORE_FILE, emptyStore);
  const idx = store.findIndex((r) => r.id === run.id);
  const updated: PropertyChannelRun = { ...run, updatedAt: new Date().toISOString() };
  if (idx >= 0) store[idx] = updated;
  else store.push(updated);
  saveJsonStore(STORE_FILE, store);
  return updated;
}

export function pausePropertyChannelRun(id: string): PropertyChannelRun | null {
  const run = getPropertyChannelRun(id);
  if (!run) return null;
  if (run.status !== 'queued' && run.status !== 'running') return run;
  return saveRun({ ...run, status: 'paused' });
}

export function resumePropertyChannelRun(id: string): PropertyChannelRun | null {
  const run = getPropertyChannelRun(id);
  if (!run) return null;
  if (run.status !== 'paused') return run;
  return saveRun({ ...run, status: 'queued' });
}

export function cancelPropertyChannelRun(id: string): PropertyChannelRun | null {
  const run = getPropertyChannelRun(id);
  if (!run) return null;
  if (run.status === 'succeeded' || run.status === 'cancelled') return run;
  return saveRun({ ...run, status: 'cancelled' });
}

/**
 * Runs `fn` for `stepId` on `run` exactly once. If the step already
 * succeeded, its stored output is returned unchanged and `fn` is never
 * called again, which is what makes every workflow step idempotent:
 * re-running a completed run never repeats already-finished work (no
 * duplicate YouTube channel, no duplicate upload, no duplicate scripts).
 */
export async function runStepOnce<T extends Record<string, unknown>>(
  run: PropertyChannelRun,
  stepId: PropertyChannelStepId,
  fn: () => Promise<T>,
): Promise<{ run: PropertyChannelRun; output: T; skipped: boolean }> {
  const existing = run.steps[stepId];
  if (existing.status === 'succeeded' && existing.output) {
    return { run, output: existing.output as T, skipped: true };
  }

  const runningStep: PropertyChannelStepState = {
    ...existing,
    status: 'running',
    attempts: existing.attempts + 1,
    startedAt: existing.startedAt ?? new Date().toISOString(),
  };
  let next: PropertyChannelRun = saveRun({
    ...run,
    status: 'running',
    steps: { ...run.steps, [stepId]: runningStep },
  });

  try {
    const output = await fn();
    const succeededStep: PropertyChannelStepState = {
      ...runningStep,
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      output,
    };
    next = saveRun({
      ...next,
      steps: { ...next.steps, [stepId]: succeededStep },
      context: { ...next.context, [stepId]: output },
    });
    return { run: next, output, skipped: false };
  } catch (err) {
    const failedStep: PropertyChannelStepState = {
      ...runningStep,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
    saveRun({ ...next, status: 'failed', steps: { ...next.steps, [stepId]: failedStep } });
    throw err;
  }
}

/**
 * Runs `fn` for `stepId` every time it is called (unlike runStepOnce), for
 * steps that are naturally recurring (media rendering, uploads, comment
 * polling, analytics). Each invocation must still be internally idempotent
 * (no duplicate render jobs, uploads, or leads); this helper only tracks
 * status and the most recent output rather than gating on prior success.
 */
export async function runRecurringStep<T extends Record<string, unknown>>(
  run: PropertyChannelRun,
  stepId: PropertyChannelStepId,
  fn: () => Promise<T>,
): Promise<{ run: PropertyChannelRun; output: T }> {
  const existing = run.steps[stepId];
  const runningStep: PropertyChannelStepState = {
    ...existing,
    status: 'running',
    attempts: existing.attempts + 1,
    startedAt: existing.startedAt ?? new Date().toISOString(),
  };
  let next: PropertyChannelRun = saveRun({
    ...run,
    steps: { ...run.steps, [stepId]: runningStep },
  });

  try {
    const output = await fn();
    const succeededStep: PropertyChannelStepState = {
      ...runningStep,
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      output,
    };
    next = saveRun({
      ...next,
      steps: { ...next.steps, [stepId]: succeededStep },
      context: { ...next.context, [stepId]: output },
    });
    return { run: next, output };
  } catch (err) {
    const failedStep: PropertyChannelStepState = {
      ...runningStep,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
    saveRun({ ...next, steps: { ...next.steps, [stepId]: failedStep } });
    throw err;
  }
}
