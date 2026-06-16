import { CarinaAgent } from './carina.js';
import { config } from '../config/index.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import { isSafePath, expandPath } from '../tools/path-utils.js';
import { resolveCronWorkdir } from './cron-workdir.js';
import type { ExecuteJobOptions } from './cron-scheduler.js';

const execFileAsync = promisify(execFile);

export interface CronStepInput {
  jobId: string;
  prompt: string | null;
  scriptPath: string | null;
  noAgent: boolean;
  enabledToolsets: string[];
  workdir: string | null;
  contextPrefix?: string;
  chainedFrom?: ExecuteJobOptions['chainedFrom'];
  maxTurns?: number;
  modelProvider?: string | null;
  modelName?: string | null;
}

export interface CronStepResult {
  output: string;
  success: boolean;
  error?: string;
}

async function runScript(
  scriptPath: string,
  workdir?: string,
): Promise<{ stdout: string }> {
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
  const result = await execFileAsync(cmd, [resolved], {
    timeout: 60_000,
    cwd: workdir,
    maxBuffer: 512 * 1024,
  });
  return { stdout: result.stdout };
}

export async function runCronStep(input: CronStepInput): Promise<CronStepResult> {
  let jobWorkdir: string | undefined;
  try {
    jobWorkdir = resolveCronWorkdir(input.workdir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: '', success: false, error: msg };
  }

  let scriptOutput = '';
  if (input.scriptPath) {
    try {
      const result = await runScript(input.scriptPath, jobWorkdir);
      scriptOutput = result.stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { output: '', success: false, error: msg };
    }
  }

  if (input.noAgent) {
    return { output: scriptOutput.trim(), success: true };
  }

  if (!input.prompt?.trim()) {
    return { output: scriptOutput.trim(), success: true };
  }

  const contextParts: string[] = [];
  if (input.chainedFrom?.output) {
    const label = input.chainedFrom.name ?? input.chainedFrom.jobId;
    contextParts.push(`[Chained from ${label}]\n${input.chainedFrom.output}`);
  }
  if (input.contextPrefix) contextParts.push(input.contextPrefix);

  const sessionId = `cron:${input.jobId}:${Date.now()}`;
  const workdirNote = jobWorkdir ? `\nWorking directory (isolated): ${jobWorkdir}` : '';
  const previousWorkdir = process.env.CARINA_JOB_WORKDIR;
  if (jobWorkdir) process.env.CARINA_JOB_WORKDIR = jobWorkdir;

  try {
    const agent = new CarinaAgent(sessionId, false, undefined, {
      platform: 'cron',
      allowedTools: input.enabledToolsets.length > 0 ? input.enabledToolsets : undefined,
      persistMemory: false,
      maxTurns: input.maxTurns ?? config.carina.subagentMaxTurns,
      systemPromptSuffix: workdirNote,
    });
    if (input.modelProvider) {
      agent.setProviderOverride({ name: input.modelProvider, model: input.modelName ?? undefined });
    }
    const context = contextParts.join('\n\n');
    const prompt = context
      ? `${context}\n\n---\n\n${input.prompt}${scriptOutput ? `\n\nScript output:\n${scriptOutput}` : ''}`
      : `${input.prompt}${scriptOutput ? `\n\nScript output:\n${scriptOutput}` : ''}`;
    const result = await agent.runTurn(prompt);
    return { output: result.text, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: '', success: false, error: msg };
  } finally {
    if (previousWorkdir === undefined) delete process.env.CARINA_JOB_WORKDIR;
    else process.env.CARINA_JOB_WORKDIR = previousWorkdir;
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
