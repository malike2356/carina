/**
 * Minimal Redis-backed background job queue for long-running AI tasks
 * (research runs, batch generation, large imports) that should not block
 * the request/response cycle or an SSE stream indefinitely.
 *
 * This is intentionally small: a Redis list as the work queue plus a hash
 * per job for status/result, not a full scheduler like BullMQ. The
 * codebase already has several bespoke queues (see
 * workers/automation-run-queue.ts for a Postgres claim-based queue, and
 * agents/command-queue.ts for an in-memory per-session queue); this one is
 * for stateless, short-lived job records that many worker processes can
 * pull from, with status pollable via HTTP or SSE.
 *
 * Falls back to an in-memory queue (single process only) when Redis is not
 * configured, matching the degrade-gracefully pattern used throughout
 * src/security/redis-rate-limit.ts and src/security/auth-hardening.ts.
 */
import { randomUUID } from 'node:crypto';
import { getRedis } from '../memory/redis.js';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobRecord<TPayload = unknown, TResult = unknown> {
  id: string;
  kind: string;
  status: JobStatus;
  payload: TPayload;
  result?: TResult;
  error?: string;
  progress?: number;
  createdAt: number;
  updatedAt: number;
}

const QUEUE_KEY_PREFIX = 'carina:jobs:queue:';
const JOB_KEY_PREFIX = 'carina:jobs:job:';
const JOB_TTL_SECONDS = 24 * 60 * 60;

const memoryQueues = new Map<string, string[]>();
const memoryJobs = new Map<string, JobRecord>();

function queueKey(kind: string): string {
  return `${QUEUE_KEY_PREFIX}${kind}`;
}

function jobKey(id: string): string {
  return `${JOB_KEY_PREFIX}${id}`;
}

function serialize(job: JobRecord): string {
  return JSON.stringify(job);
}

function deserialize(raw: string | null): JobRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobRecord;
  } catch {
    return null;
  }
}

/**
 * Enqueues a job of the given kind and returns its id immediately. A
 * worker started with `runJobWorker(kind, handler)` elsewhere in the
 * process pool will pick it up.
 */
export async function enqueueJob<TPayload = unknown>(kind: string, payload: TPayload): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const job: JobRecord<TPayload> = {
    id,
    kind,
    status: 'queued',
    payload,
    createdAt: now,
    updatedAt: now,
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(jobKey(id), serialize(job), 'EX', JOB_TTL_SECONDS);
    await redis.rpush(queueKey(kind), id);
    return id;
  }

  memoryJobs.set(id, job);
  const list = memoryQueues.get(kind) ?? [];
  list.push(id);
  memoryQueues.set(kind, list);
  return id;
}

export async function getJobStatus(id: string): Promise<JobRecord | null> {
  const redis = getRedis();
  if (redis) {
    return deserialize(await redis.get(jobKey(id)));
  }
  return memoryJobs.get(id) ?? null;
}

async function saveJob(job: JobRecord): Promise<void> {
  job.updatedAt = Date.now();
  const redis = getRedis();
  if (redis) {
    await redis.set(jobKey(job.id), serialize(job), 'EX', JOB_TTL_SECONDS);
    return;
  }
  memoryJobs.set(job.id, job);
}

export async function updateJobProgress(id: string, progress: number): Promise<void> {
  const job = await getJobStatus(id);
  if (!job) return;
  job.progress = Math.max(0, Math.min(100, progress));
  job.status = 'running';
  await saveJob(job);
}

export async function completeJob<TResult = unknown>(id: string, result: TResult): Promise<void> {
  const job = await getJobStatus(id);
  if (!job) return;
  job.status = 'completed';
  job.result = result;
  job.progress = 100;
  await saveJob(job);
}

export async function failJob(id: string, error: unknown): Promise<void> {
  const job = await getJobStatus(id);
  if (!job) return;
  job.status = 'failed';
  job.error = error instanceof Error ? error.message : String(error);
  await saveJob(job);
}

async function claimNextJob(kind: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    return redis.lpop(queueKey(kind));
  }
  const list = memoryQueues.get(kind);
  if (!list || list.length === 0) return null;
  return list.shift() ?? null;
}

export interface JobWorkerOptions {
  /** How often to poll for new jobs when the queue is empty, in ms. Default 1000. */
  pollIntervalMs?: number;
}

/**
 * Starts an in-process worker loop for a given job kind. Call this once per
 * process per kind at startup (for example, from server bootstrap) for
 * kinds that should run in the background rather than inline in a request
 * handler. Returns a stop function.
 *
 * Handlers report progress via updateJobProgress and should return their
 * result value; the loop marks the job completed or failed automatically.
 */
export function runJobWorker<TPayload = unknown, TResult = unknown>(
  kind: string,
  handler: (payload: TPayload, jobId: string) => Promise<TResult>,
  options: JobWorkerOptions = {},
): () => void {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  let stopped = false;

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const jobId = await claimNextJob(kind);
        if (!jobId) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          continue;
        }
        const job = await getJobStatus(jobId);
        if (!job) continue;
        job.status = 'running';
        await saveJob(job);
        try {
          const result = await handler(job.payload as TPayload, jobId);
          await completeJob(jobId, result);
        } catch (err) {
          await failJob(jobId, err);
        }
      } catch (err) {
        console.error(`[job-queue] worker loop error for kind "${kind}":`, err instanceof Error ? err.message : err);
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  };

  void loop();
  return () => {
    stopped = true;
  };
}
