import { CarinaAgent } from './carina.js';
import { config } from '../config/index.js';
import { resolveCronWorkdir } from './cron-workdir.js';
import { runCronScriptFile } from './cron-script-runner.js';
import { injectScriptOutput } from './cron-script-runner.js';
import type { ExecuteJobOptions } from './cron-scheduler.js';

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
  skipScript?: boolean;
}

export interface CronStepResult {
  output: string;
  success: boolean;
  error?: string;
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
  if (!input.skipScript && input.scriptPath) {
    const result = await runCronScriptFile(input.scriptPath, jobWorkdir);
    if (result.exitCode !== 0) {
      return { output: '', success: false, error: result.stderr || `exit ${result.exitCode}` };
    }
    scriptOutput = result.stdout;
  }

  if (input.noAgent) {
    return { output: scriptOutput.trim(), success: true };
  }

  let prompt = input.prompt ?? '';
  if (scriptOutput) {
    prompt = injectScriptOutput(prompt, scriptOutput);
  }

  if (!prompt.trim()) {
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
    const finalPrompt = context ? `${context}\n\n---\n\n${prompt}` : prompt;
    const result = await agent.runTurn(finalPrompt);
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
