import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import type { RenderJob, RenderJobStatus } from './types.js';
import { DEFAULT_RENDER_MAX_ATTEMPTS } from './types.js';
import crypto from 'crypto';

const STORE_FILE = 'render-jobs.json';

function emptyStore(): RenderJob[] {
  return [];
}

export function createRenderJob(input: {
  workspaceId: string;
  channelId: string;
  dayIndex: number;
  title: string;
  scriptText: string;
  thumbnailPrompt: string;
  niche?: string;
  location?: string;
  theme?: string;
}): RenderJob {
  const store = loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore);

  const existing = store.find(
    (j) => j.workspaceId === input.workspaceId && j.channelId === input.channelId && j.dayIndex === input.dayIndex,
  );
  if (existing) {
    // Preserve ready/uploaded jobs; refresh script metadata on queued/failed re-queue.
    if (existing.status === 'ready' || existing.status === 'uploaded' || existing.status === 'rendering') {
      return existing;
    }
    const idx = store.findIndex((j) => j.id === existing.id);
    const refreshed: RenderJob = {
      ...existing,
      title: input.title,
      scriptText: input.scriptText,
      thumbnailPrompt: input.thumbnailPrompt,
      niche: input.niche ?? existing.niche,
      location: input.location ?? existing.location,
      theme: input.theme ?? existing.theme,
      status: 'queued',
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) store[idx] = refreshed;
    saveJsonStore(STORE_FILE, store);
    return refreshed;
  }

  const now = new Date().toISOString();
  const job: RenderJob = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    channelId: input.channelId,
    dayIndex: input.dayIndex,
    title: input.title,
    scriptText: input.scriptText,
    thumbnailPrompt: input.thumbnailPrompt,
    niche: input.niche,
    location: input.location,
    theme: input.theme,
    status: 'queued',
    progress: 0,
    assets: {},
    attempts: 0,
    maxAttempts: DEFAULT_RENDER_MAX_ATTEMPTS,
    createdAt: now,
    updatedAt: now,
  };
  store.push(job);
  saveJsonStore(STORE_FILE, store);
  return job;
}

export function getRenderJob(id: string): RenderJob | undefined {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore).find((j) => j.id === id);
}

export function findRenderJobByDay(
  workspaceId: string,
  channelId: string,
  dayIndex: number,
): RenderJob | undefined {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore).find(
    (j) => j.workspaceId === workspaceId && j.channelId === channelId && j.dayIndex === dayIndex,
  );
}

export function listRenderJobs(workspaceId: string, channelId: string): RenderJob[] {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore)
    .filter((j) => j.workspaceId === workspaceId && j.channelId === channelId)
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export function listAllRenderJobs(): RenderJob[] {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore);
}

export function listRenderJobsByStatus(
  workspaceId: string,
  channelId: string,
  status: RenderJobStatus,
): RenderJob[] {
  return listRenderJobs(workspaceId, channelId).filter((j) => j.status === status);
}

export function listQueuedRenderJobs(): RenderJob[] {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore)
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listStaleRenderingJobs(staleAfterMs: number, now = Date.now()): RenderJob[] {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore).filter((j) => {
    if (j.status !== 'rendering' || !j.renderingStartedAt) return false;
    const started = Date.parse(j.renderingStartedAt);
    return Number.isFinite(started) && now - started >= staleAfterMs;
  });
}

export function countJobsUpdatedOnDate(
  workspaceId: string,
  channelId: string,
  statuses: RenderJobStatus[],
  isoDate: string,
): number {
  return loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore).filter((j) => {
    if (j.workspaceId !== workspaceId || j.channelId !== channelId) return false;
    if (!statuses.includes(j.status)) return false;
    const stamp = j.completedAt ?? j.uploadedAt ?? j.updatedAt;
    return stamp.slice(0, 10) === isoDate;
  }).length;
}

export function updateRenderJob(id: string, patch: Partial<RenderJob>): RenderJob | null {
  const store = loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore);
  const idx = store.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  store[idx] = { ...store[idx]!, ...patch, updatedAt: new Date().toISOString() };
  saveJsonStore(STORE_FILE, store);
  return store[idx]!;
}

export function queueDepth(): { queued: number; rendering: number; ready: number; failed: number; uploaded: number } {
  const store = loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore);
  const counts = { queued: 0, rendering: 0, ready: 0, failed: 0, uploaded: 0 };
  for (const job of store) {
    if (job.status in counts) counts[job.status as keyof typeof counts] += 1;
  }
  return counts;
}

export function lastRenderError(workspaceId?: string, channelId?: string): string | null {
  const jobs = loadJsonStore<RenderJob[]>(STORE_FILE, emptyStore)
    .filter((j) => j.status === 'failed' && j.error)
    .filter((j) => !workspaceId || j.workspaceId === workspaceId)
    .filter((j) => !channelId || j.channelId === channelId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return jobs[0]?.error ?? null;
}
