import { Cron } from 'croner';
import { pool } from '../memory/db.js';
import { CarinaAgent } from './carina.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import fs from 'fs/promises';
import { isSafePath, expandPath } from '../tools/path-utils.js';
import { v4 as uuidv4 } from 'uuid';
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { resolveJobWorkdir } from './cron-workdir.js';

const execFileAsync = promisify(execFile);

export type JobStatus = 'active' | 'paused' | 'completed' | 'removed';

export interface ScheduledJob {
  id: string;
  name: string | null;
  schedule: string;
  prompt: string | null;
  scriptPath: string | null;
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
    createdAt: new Date(String(row.created_at)),
  };
}

export async function createJob(
  input: Omit<ScheduledJob, 'id' | 'lastRun' | 'nextRun' | 'createdAt' | 'status'> & {
    status?: JobStatus;
  },
): Promise<ScheduledJob> {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO scheduled_tasks
       (id, name, schedule, prompt, script_path, no_agent, deliver,
        repeat_count, runs_remaining, status, context_from, chain_after, enabled_toolsets,
        workdir, origin_session_id, origin_channel, origin_conversation_id, origin_thread_id,
        deliver_channels)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      id,
      input.name,
      input.schedule,
      input.prompt,
      input.scriptPath,
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
    ],
  );
  const job = rowToJob(result.rows[0]);
  registerJob(job);
  return job;
}

export async function listJobs(): Promise<ScheduledJob[]> {
  const result = await pool.query('SELECT * FROM scheduled_tasks WHERE status != $1 ORDER BY created_at DESC', ['removed']);
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

async function runScript(
  scriptPath: string,
  workdir?: string,
): Promise<{ stdout: string; exitCode: number }> {
  const resolved = expandPath(scriptPath);
  if (!isSafePath(resolved)) {
    throw new Error('Script path is not allowed.');
  }
  const scriptsRoot = path.resolve('data/scripts');
  if (!resolved.startsWith(scriptsRoot)) {
    throw new Error('Scripts must be under data/scripts/.');
  }

  const ext = path.extname(resolved).toLowerCase();
  const cmd = ext === '.sh' || ext === '.bash' ? 'bash' : 'python3';
  try {
    const result = await execFileAsync(cmd, [resolved], {
      timeout: 60_000,
      cwd: workdir,
      maxBuffer: 512 * 1024,
    });
    return { stdout: result.stdout, exitCode: 0 };
  } catch (err) {
    const execErr = err as { code?: number | string; stdout?: string; stderr?: string };
    const code = execErr.code ?? 'unknown';
    const stderr = String(execErr.stderr ?? '').trim();
    const stdout = String(execErr.stdout ?? '').trim();
    const detail = stderr || stdout || String(err);
    throw new Error(`Script exited with code ${code}: ${detail}`);
  }
}

async function buildJobContext(
  job: ScheduledJob,
  chainedFrom?: ExecuteJobOptions['chainedFrom'],
): Promise<string> {
  const parts: string[] = [];

  if (chainedFrom?.output) {
    const label = chainedFrom.name ?? chainedFrom.jobId;
    parts.push(`[Chained from ${label}]\n${chainedFrom.output}`);
  }

  for (const depId of job.contextFrom) {
    const depJob = await getJob(depId);
    const depResult = await pool.query(
      `SELECT output FROM scheduled_task_runs WHERE job_id = $1 ORDER BY completed_at DESC LIMIT 1`,
      [depId],
    );
    const output = depResult.rows[0]?.output;
    if (output) {
      const label = depJob?.name ?? depId;
      parts.push(`[Job ${label} output]\n${output}`);
    }
  }
  return parts.join('\n\n');
}

export async function executeJob(jobId: string, opts: ExecuteJobOptions = {}): Promise<string> {
  const job = await getJob(jobId);
  if (!job || job.status === 'removed') {
    throw new Error(`Job ${jobId} not found.`);
  }

  let jobWorkdir: string | undefined;
  try {
    jobWorkdir = resolveJobWorkdir(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Job failed] ${job.name ?? jobId}: ${msg}`);
  }

  let scriptOutput = '';
  if (job.scriptPath) {
    try {
      const result = await runScript(job.scriptPath, jobWorkdir);
      scriptOutput = result.stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const alert = `[Job failed] ${job.name ?? jobId}: ${msg}`;
      if (deliverCallback) await deliverCallback(job, alert);
      await pool.query(
        `INSERT INTO scheduled_task_runs (job_id, output, success) VALUES ($1, $2, false)`,
        [jobId, alert],
      );
      return alert;
    }
  }

  let output = scriptOutput;

  if (!job.noAgent && job.prompt) {
    const context = await buildJobContext(job, opts.chainedFrom);
    const sessionId = `cron:${jobId}:${Date.now()}`;
    const workdirNote = jobWorkdir ? `\nWorking directory (isolated): ${jobWorkdir}` : '';
    const previousWorkdir = process.env.CARINA_JOB_WORKDIR;
    if (jobWorkdir) process.env.CARINA_JOB_WORKDIR = jobWorkdir;
    try {
      const agent = new CarinaAgent(sessionId, false, undefined, {
        platform: 'cron',
        allowedTools: job.enabledToolsets.length > 0 ? job.enabledToolsets : undefined,
        persistMemory: false,
        maxTurns: 10,
        systemPromptSuffix: workdirNote,
      });
      const prompt = context
        ? `${context}\n\n---\n\n${job.prompt}${scriptOutput ? `\n\nScript output:\n${scriptOutput}` : ''}`
        : `${job.prompt}${scriptOutput ? `\n\nScript output:\n${scriptOutput}` : ''}`;
      const result = await agent.runTurn(prompt);
      output = result.text;
    } finally {
      if (previousWorkdir === undefined) delete process.env.CARINA_JOB_WORKDIR;
      else process.env.CARINA_JOB_WORKDIR = previousWorkdir;
    }
  } else if (job.noAgent) {
    output = scriptOutput.trim() ? scriptOutput : '';
  }

  await pool.query(
    `INSERT INTO scheduled_task_runs (job_id, output, success) VALUES ($1, $2, true)`,
    [jobId, output],
  );
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

  if (process.env.CARINA_TASKFLOWS_ENABLED === 'true') {
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
