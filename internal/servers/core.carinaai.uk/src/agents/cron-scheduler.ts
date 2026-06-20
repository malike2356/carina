import { Cron } from 'croner';
import { pool } from '../memory/db.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { runCronStep } from './cron-step-runner.js';
import { activeCronProfile } from '../profiles/isolation.js';
import type { CronScriptConfig } from './cron-job-types.js';
import { parseScriptConfig } from './cron-job-types.js';
import { buildCronPrompt, runJobScript } from './cron-context-chain.js';
import {
  incrementFailureCount,
  resetFailureCount,
} from './cron-job-store.js';

export type JobStatus = 'active' | 'paused' | 'completed' | 'removed';

export interface ScheduledJob {
  id: string;
  name: string | null;
  schedule: string;
  prompt: string | null;
  scriptPath: string | null;
  scriptConfig: CronScriptConfig | null;
  noAgent: boolean;
  deliver: string;
  repeatCount: number | null;
  runsRemaining: number | null;
  status: JobStatus;
  lastRun: Date | null;
  nextRun: Date | null;
  contextFrom: string[];
  chainAfter: string[];
  enabledToolsets: string[];
  workdir: string | null;
  originSessionId: string | null;
  originChannel: ChannelName | null;
  originConversationId: string | null;
  originThreadId: string | null;
  deliverChannels: string[];
  profileName: string;
  modelProvider: string | null;
  modelName: string | null;
  failureLimit: number | null;
  failureCount: number;
  createdAt: Date;
}

export interface ExecuteJobOptions {
  chainedFrom?: { jobId: string; name: string | null; output: string };
}

interface JobRuntime {
  job: ScheduledJob;
  cron: Cron | null;
}

const runtimes = new Map<string, JobRuntime>();
let deliverCallback: ((job: ScheduledJob, output: string) => Promise<void>) | null = null;

export function setJobDeliverCallback(
  fn: (job: ScheduledJob, output: string) => Promise<void>,
): void {
  deliverCallback = fn;
}

export function parseSchedule(input: string): { cronExpr: string; oneShot?: Date } {
  const trimmed = input.trim();

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso) && trimmed.includes('T')) {
    return { cronExpr: '', oneShot: new Date(iso) };
  }

  const everyMin = trimmed.match(/^(\d+)m$/i);
  if (everyMin) {
    const mins = parseInt(everyMin[1], 10);
    return { cronExpr: `*/${mins} * * * *` };
  }

  const everyHour = trimmed.match(/^every\s+(\d+)h$/i);
  if (everyHour) {
    const hours = parseInt(everyHour[1], 10);
    return { cronExpr: `0 */${hours} * * *` };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 5) {
    return { cronExpr: trimmed };
  }

  throw new Error(`Unrecognized schedule format: ${input}`);
}

function rowToJob(row: Record<string, unknown>): ScheduledJob {
  return {
    id: String(row.id),
    name: row.name ? String(row.name) : null,
    schedule: String(row.schedule),
    prompt: row.prompt ? String(row.prompt) : null,
    scriptPath: row.script_path ? String(row.script_path) : null,
    scriptConfig: parseScriptConfig(row.script_config),
    noAgent: Boolean(row.no_agent),
    deliver: String(row.deliver ?? 'origin'),
    repeatCount: row.repeat_count != null ? Number(row.repeat_count) : null,
    runsRemaining: row.runs_remaining != null ? Number(row.runs_remaining) : null,
    status: String(row.status ?? 'active') as JobStatus,
    lastRun: row.last_run ? new Date(String(row.last_run)) : null,
    nextRun: row.next_run ? new Date(String(row.next_run)) : null,
    contextFrom: (row.context_from as string[]) ?? [],
    chainAfter: (row.chain_after as string[]) ?? [],
    enabledToolsets: (row.enabled_toolsets as string[]) ?? [],
    workdir: row.workdir ? String(row.workdir) : null,
    originSessionId: row.origin_session_id ? String(row.origin_session_id) : null,
    originChannel: row.origin_channel ? String(row.origin_channel) as ChannelName : null,
    originConversationId: row.origin_conversation_id ? String(row.origin_conversation_id) : null,
    originThreadId: row.origin_thread_id ? String(row.origin_thread_id) : null,
    deliverChannels: (row.deliver_channels as string[]) ?? [],
    profileName: row.profile_name ? String(row.profile_name) : 'default',
    modelProvider: row.model_provider ? String(row.model_provider) : null,
    modelName: row.model_name ? String(row.model_name) : null,
    failureLimit: row.failure_limit != null ? Number(row.failure_limit) : null,
    failureCount: Number(row.failure_count ?? 0),
    createdAt: new Date(String(row.created_at)),
  };
}

export async function createJob(
  input: Omit<ScheduledJob, 'id' | 'lastRun' | 'nextRun' | 'createdAt' | 'status'> & {
    status?: JobStatus;
  },
): Promise<ScheduledJob> {
  const id = uuidv4();
  const profileName = input.profileName ?? activeCronProfile();
  const result = await pool.query(
    `INSERT INTO scheduled_tasks
       (id, name, schedule, prompt, script_path, script_config, no_agent, deliver,
        repeat_count, runs_remaining, status, context_from, chain_after, enabled_toolsets,
        workdir, origin_session_id, origin_channel, origin_conversation_id, origin_thread_id,
        deliver_channels, profile_name, model_provider, model_name, failure_limit, failure_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     RETURNING *`,
    [
      id,
      input.name,
      input.schedule,
      input.prompt,
      input.scriptPath,
      input.scriptConfig ? JSON.stringify(input.scriptConfig) : null,
      input.noAgent,
      input.deliver,
      input.repeatCount,
      input.runsRemaining ?? input.repeatCount,
      input.status ?? 'active',
      input.contextFrom,
      input.chainAfter ?? [],
      input.enabledToolsets,
      input.workdir,
      input.originSessionId,
      input.originChannel ?? null,
      input.originConversationId ?? null,
      input.originThreadId ?? null,
      input.deliverChannels ?? [],
      profileName,
      input.modelProvider ?? null,
      input.modelName ?? null,
      input.failureLimit ?? 3,
      0,
    ],
  );
  const job = rowToJob(result.rows[0]);
  registerJob(job);
  return job;
}

export async function listJobs(profileName?: string): Promise<ScheduledJob[]> {
  const profile = profileName ?? activeCronProfile();
  const result = await pool.query(
    `SELECT * FROM scheduled_tasks
     WHERE status != $1 AND COALESCE(profile_name, 'default') = $2
     ORDER BY created_at DESC`,
    ['removed', profile],
  );
  return result.rows.map(rowToJob);
}

export async function getJob(id: string): Promise<ScheduledJob | null> {
  const result = await pool.query('SELECT * FROM scheduled_tasks WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return rowToJob(result.rows[0]);
}

export async function updateJob(id: string, patch: Partial<ScheduledJob>): Promise<ScheduledJob | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const map: Record<string, unknown> = {
    name: patch.name,
    schedule: patch.schedule,
    prompt: patch.prompt,
    script_path: patch.scriptPath,
    script_config: patch.scriptConfig ? JSON.stringify(patch.scriptConfig) : patch.scriptConfig,
    no_agent: patch.noAgent,
    deliver: patch.deliver,
    repeat_count: patch.repeatCount,
    runs_remaining: patch.runsRemaining,
    status: patch.status,
    context_from: patch.contextFrom,
    chain_after: patch.chainAfter,
    enabled_toolsets: patch.enabledToolsets,
    workdir: patch.workdir,
    deliver_channels: patch.deliverChannels,
    origin_channel: patch.originChannel,
    origin_conversation_id: patch.originConversationId,
    origin_thread_id: patch.originThreadId,
    failure_limit: patch.failureLimit,
    failure_count: patch.failureCount,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getJob(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE scheduled_tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) return null;
  const job = rowToJob(result.rows[0]);
  unregisterJob(id);
  if (job.status === 'active') registerJob(job);
  return job;
}

export async function removeJob(id: string): Promise<boolean> {
  unregisterJob(id);
  const result = await pool.query(
    `UPDATE scheduled_tasks SET status = 'removed' WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export function registerJob(job: ScheduledJob): void {
  if (job.status !== 'active') return;
  unregisterJob(job.id);

  const parsed = parseSchedule(job.schedule);
  const runFn = () => void executeJob(job.id);

  let cron: Cron | null = null;
  if (parsed.oneShot) {
    const delay = parsed.oneShot.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(runFn, delay).unref();
    }
  } else {
    cron = new Cron(parsed.cronExpr, runFn);
  }

  runtimes.set(job.id, { job, cron });
}

export function unregisterJob(id: string): void {
  const runtime = runtimes.get(id);
  if (runtime?.cron) runtime.cron.stop();
  runtimes.delete(id);
}

export async function loadAndRegisterAllJobs(): Promise<number> {
  const jobs = await listJobs();
  for (const job of jobs) {
    if (job.status === 'active') registerJob(job);
  }
  return jobs.length;
}

async function buildJobContext(
  chainedFrom?: ExecuteJobOptions['chainedFrom'],
): Promise<string> {
  if (!chainedFrom?.output) return '';
  const label = chainedFrom.name ?? chainedFrom.jobId;
  return `[Chained from ${label}]\n${chainedFrom.output}`;
}

async function recordJobRun(jobId: string, output: string, success: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO scheduled_task_runs (job_id, output, success) VALUES ($1, $2, $3)`,
    [jobId, output, success],
  );
}

export async function executeJob(jobId: string, opts: ExecuteJobOptions = {}): Promise<string> {
  const job = await getJob(jobId);
  if (!job || job.status === 'removed') {
    throw new Error(`Job ${jobId} not found.`);
  }

  const failureLimit = job.failureLimit ?? 3;
  if (job.failureCount >= failureLimit) {
    const alert = `[Job disabled] ${job.name ?? jobId} paused after ${job.failureCount} consecutive failures.`;
    if (job.status === 'active') {
      await updateJob(jobId, { status: 'paused' });
    }
    console.warn(`[cron] ${alert}`);
    return alert;
  }

  let output = '';
  let success = false;

  try {
    if (job.noAgent) {
      if (!job.scriptConfig && !job.scriptPath) {
        throw new Error('no_agent jobs require scriptConfig or script_path.');
      }
      const scriptResult = await runJobScript(job);
      output = scriptResult.stdout || scriptResult.stderr;
      if (scriptResult.exitCode !== 0) {
        throw new Error(`Script exited with code ${scriptResult.exitCode}: ${scriptResult.stderr}`);
      }
      success = true;
    } else {
      const contextPrefix = await buildJobContext(opts.chainedFrom);
      const prompt = await buildCronPrompt(job);
      const mergedPrompt = contextPrefix
        ? `${contextPrefix}\n\n---\n\n${prompt}`
        : prompt;

      if (!mergedPrompt.trim() && !job.scriptConfig && !job.scriptPath) {
        throw new Error('Agent cron jobs require a prompt or script.');
      }

      const step = await runCronStep({
        jobId,
        prompt: mergedPrompt || job.prompt,
        scriptPath: null,
        noAgent: false,
        enabledToolsets: job.enabledToolsets,
        workdir: job.workdir,
        skipScript: true,
        modelProvider: job.modelProvider,
        modelName: job.modelName,
      });

      if (!step.success) {
        throw new Error(step.error ?? 'unknown error');
      }
      output = step.output;
      success = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const alert = `[Job failed] ${job.name ?? jobId}: ${msg}`;
    const failures = await incrementFailureCount(jobId);
    if (failures >= failureLimit) {
      await updateJob(jobId, { status: 'paused' });
      console.warn(`[cron] Job "${job.name ?? jobId}" paused after ${failures} failures`);
    }
    if (deliverCallback) {
      await deliverCallback(job, alert);
    }
    await recordJobRun(jobId, alert, false);
    return alert;
  }

  await recordJobRun(jobId, output, success);
  await resetFailureCount(jobId);
  await pool.query(
    `UPDATE scheduled_tasks SET last_run = NOW() WHERE id = $1`,
    [jobId],
  );

  if (job.runsRemaining != null) {
    const remaining = job.runsRemaining - 1;
    if (remaining <= 0) {
      await updateJob(jobId, { status: 'completed', runsRemaining: 0 });
    } else {
      await updateJob(jobId, { runsRemaining: remaining });
    }
  }

  if (output && deliverCallback) {
    await deliverCallback(job, output);
  }

  void dispatchWebhook('cron.complete', {
    job_id: jobId,
    name: job.name,
    schedule: job.schedule,
    output: output.slice(0, 2000),
    success: true,
  });

  if (process.env.CARINA_TASKFLOWS_ENABLED !== 'false') {
    void import('../ops/taskflows/hooks.js').then(({ onCronJobComplete }) => {
      onCronJobComplete(jobId, {
        job_id: jobId,
        name: job.name,
        schedule: job.schedule,
        output: output.slice(0, 2000),
        success: true,
      });
    });
  }

  for (const nextId of job.chainAfter) {
    try {
      await executeJob(nextId, {
        chainedFrom: { jobId, name: job.name, output },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cron] chain job ${nextId} failed after ${jobId}: ${msg}`);
    }
  }

  return output;
}

export async function ensureScriptsDir(): Promise<void> {
  await fs.mkdir(path.join('data', 'scripts'), { recursive: true });
}
