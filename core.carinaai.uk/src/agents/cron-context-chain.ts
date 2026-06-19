import fs from 'fs';
import path from 'path';
import type { CronScriptConfig } from './cron-job-types.js';
import { parseScriptConfig } from './cron-job-types.js';
import type { ScheduledJob } from './cron-scheduler.js';
import { resolveCronWorkdir } from './cron-workdir.js';
import { getCronJobOutput, resolveJobId } from './cron-job-store.js';
import {
  injectScriptOutput,
  runCronScript,
  runCronScriptFile,
  type ScriptRunResult,
} from './cron-script-runner.js';

export async function resolveContextFrom(contextFrom: string): Promise<string | null> {
  const parts = contextFrom.split(':');
  const jobRef = parts[0]!.trim();
  if (!jobRef) return null;

  let runIndex = 0;
  if (parts[1] && parts[1] !== 'last') {
    const parsed = parseInt(parts[1], 10);
    if (!Number.isNaN(parsed)) runIndex = parsed;
  }

  try {
    const jobId = await resolveJobId(jobRef);
    if (!jobId) return null;
    const output = await getCronJobOutput(jobId, runIndex);
    if (!output) return null;
    const label = runIndex === 0 ? 'last' : String(runIndex);
    return `Context from "${jobRef}" (run ${label}):\n${output}`;
  } catch {
    return null;
  }
}

async function loadAgentsMd(workdir: string): Promise<string | null> {
  const agentsPath = path.join(workdir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) return null;
  try {
    return `AGENTS.md from ${workdir}:\n${fs.readFileSync(agentsPath, 'utf-8').slice(0, 5000)}`;
  } catch {
    return null;
  }
}

export async function runJobScript(job: ScheduledJob): Promise<ScriptRunResult> {
  let workdir: string | undefined;
  try {
    workdir = resolveCronWorkdir(job.workdir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: '', stderr: msg, exitCode: 1, durationMs: 0 };
  }

  if (job.scriptConfig) {
    return runCronScript({
      ...job.scriptConfig,
      cwd: job.scriptConfig.cwd ?? workdir,
    });
  }

  if (job.scriptPath) {
    return runCronScriptFile(job.scriptPath, workdir);
  }

  return { stdout: '', stderr: 'No script configured.', exitCode: 1, durationMs: 0 };
}

async function applyScriptInjection(
  job: ScheduledJob,
  prompt: string,
): Promise<string> {
  if (!job.scriptConfig && !job.scriptPath) return prompt;

  const result = await runJobScript(job);
  if (result.exitCode !== 0) {
    return injectScriptOutput(
      prompt,
      `[Script error (exit ${result.exitCode})]\n${result.stderr}`,
    );
  }
  if (result.stdout) {
    return injectScriptOutput(prompt, result.stdout);
  }
  return prompt;
}

export async function buildCronPrompt(job: ScheduledJob): Promise<string> {
  let prompt = job.prompt ?? '';

  prompt = await applyScriptInjection(job, prompt);

  for (const ref of job.contextFrom) {
    const context = await resolveContextFrom(ref);
    if (context) {
      prompt = `${context}\n\n---\n\n${prompt}`;
    }
  }

  if (job.workdir) {
    try {
      const resolved = resolveCronWorkdir(job.workdir);
      if (resolved) {
        const agentsContext = await loadAgentsMd(resolved);
        if (agentsContext) {
          prompt = `${agentsContext}\n\n---\n\n${prompt}`;
        }
      }
    } catch {
      // skip invalid workdir
    }
  }

  return prompt.trim();
}
