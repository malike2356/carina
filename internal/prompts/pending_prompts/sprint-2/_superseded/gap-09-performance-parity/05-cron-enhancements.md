# Gap 09 - Prompt 05: Cron Enhancements (Script Injection, Context Chain, No-Agent Mode)

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 4-5 hrs
**Depends on:** Existing cron system in `src/agents/` (cron-scheduler.ts, cron-delivery.ts, etc.)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Carina has a working cron system (`cron-scheduler.ts`, `cron-workdir.ts`, `cron-workflow-engine.ts`,
`cron-delivery.ts`). But it lacks three power features that make Hermes cron jobs far more useful:

1. **Script injection** - A shell script runs; its stdout becomes the LLM prompt. So a cron job
   that checks "is anything on Rightmove changed?" can run a real diff script and feed the output
   to the agent.

2. **context_from chaining** - Cron job B can reference the output of job A. Run a data-fetch
   job, then an analysis job that reads what job A produced. No manual wiring needed.

3. **no_agent mode** - The cron job IS the script. No LLM call. For pure automation (certs,
   backups, health checks) the LLM step is unnecessary overhead. no_agent=true skips it entirely.

---

## Read First

```
core.carinaai.uk/src/agents/cron-scheduler.ts       (cron schedule parsing + execution)
core.carinaai.uk/src/agents/cron-workdir.ts         (working directory setup)
core.carinaai.uk/src/agents/cron-workflow-engine.ts (workflow execution)
core.carinaai.uk/src/agents/cron-workflow-types.ts  (type definitions)
core.carinaai.uk/src/agents/cron-step-runner.ts     (step execution)
```

---

## 1. Updated CronJob Type

```typescript
// src/agents/cron-workflow-types.ts  (additions)

export interface CronScriptConfig {
  /** Shell script to run before the LLM step. Stdout becomes the prompt injection. */
  script: string;

  /** Working directory for the script. Defaults to cron job's workdir. */
  cwd?: string;

  /** Timeout in milliseconds for the script. Default: 30000 (30s). */
  timeoutMs?: number;

  /** Environment variables to inject into the script. */
  env?: Record<string, string>;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression OR "interval:5m" OR "on:event:name"

  /** The LLM prompt to send. May include {{script_output}} placeholder. */
  prompt?: string;

  /** Script to run; stdout injected into prompt via {{script_output}} placeholder. */
  scriptConfig?: CronScriptConfig;

  /**
   * Chain: use the output of another job as context for this one.
   * Format: "job-id" or "job-id:last" (last run) or "job-id:N" (Nth run back)
   */
  contextFrom?: string;

  /**
   * If true: run only the script, skip the LLM call entirely.
   * Ideal for maintenance tasks, backups, health checks.
   */
  noAgent?: boolean;

  /** Max LLM tokens for this job's response. */
  maxTokens?: number;

  /** Model override for this specific job. */
  modelOverride?: string;

  /** Skills to load for this job (overrides session defaults). */
  skills?: string[];

  /** Working directory. If set and contains AGENTS.md, it's loaded into context. */
  workdir?: string;

  /** Channels to deliver output to. */
  deliveryChannels?: string[];

  /** How many consecutive failures before the job is auto-disabled. Default: 3. */
  failureLimit?: number;

  createdAt?: Date;
  lastRunAt?: Date;
  failureCount?: number;
  disabled?: boolean;
}
```

---

## 2. Script Injection Runner

```typescript
// src/agents/cron-script-runner.ts  (new file)

import { exec } from 'child_process';
import { promisify } from 'util';
import type { CronScriptConfig } from './cron-workflow-types.js';

const execAsync = promisify(exec);

export interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

/**
 * Run a cron job script and return its stdout.
 * Stderr is logged but not injected into the prompt.
 */
export async function runCronScript(config: CronScriptConfig): Promise<ScriptRunResult> {
  const start = Date.now();
  const timeout = config.timeoutMs ?? 30_000;

  try {
    const { stdout, stderr } = await execAsync(config.script, {
      cwd: config.cwd,
      env: { ...process.env, ...(config.env ?? {}) },
      timeout,
      maxBuffer: 1024 * 1024,  // 1MB max output
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? err.message ?? 'Unknown error',
      exitCode: err.code ?? 1,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Inject script output into a prompt template.
 * {{script_output}} is replaced with the actual output.
 */
export function injectScriptOutput(promptTemplate: string, output: string): string {
  if (!promptTemplate.includes('{{script_output}}')) {
    // If no placeholder, append the output at the end
    return `${promptTemplate}\n\nScript output:\n${output}`;
  }
  return promptTemplate.replace(/\{\{script_output\}\}/g, output);
}
```

---

## 3. context_from Chain Resolver

```typescript
// src/agents/cron-context-chain.ts  (new file)

import type { CronJob } from './cron-workflow-types.js';
import { getCronJobOutput } from './cron-workflow-store.js';

/**
 * Resolve context_from reference to actual output text.
 * Format: "job-id" (last run) or "job-id:N" (Nth most recent)
 */
export async function resolveContextFrom(contextFrom: string): Promise<string | null> {
  const parts = contextFrom.split(':');
  const jobId = parts[0];
  const runIndex = parts[1] === 'last' || !parts[1] ? 0 : parseInt(parts[1], 10);

  try {
    const output = await getCronJobOutput(jobId, runIndex);
    if (!output) return null;
    return `Context from "${jobId}" (run ${runIndex === 0 ? 'last' : runIndex}):\n${output}`;
  } catch {
    return null;
  }
}

/**
 * Build the full prompt for a cron job, resolving script injection and context_from.
 */
export async function buildCronPrompt(job: CronJob): Promise<string> {
  let prompt = job.prompt ?? '';

  // 1. Script injection
  if (job.scriptConfig) {
    const { runCronScript, injectScriptOutput } = await import('./cron-script-runner.js');
    const result = await runCronScript({
      ...job.scriptConfig,
      cwd: job.scriptConfig.cwd ?? job.workdir,
    });

    if (result.exitCode !== 0) {
      prompt = injectScriptOutput(prompt, `[Script error (exit ${result.exitCode})]\n${result.stderr}`);
    } else if (result.stdout) {
      prompt = injectScriptOutput(prompt, result.stdout);
    }
  }

  // 2. context_from chaining
  if (job.contextFrom) {
    const context = await resolveContextFrom(job.contextFrom);
    if (context) {
      prompt = `${context}\n\n---\n\n${prompt}`;
    }
  }

  // 3. AGENTS.md loading from workdir
  if (job.workdir) {
    const agentsContext = await loadAgentsMd(job.workdir);
    if (agentsContext) {
      prompt = `${agentsContext}\n\n---\n\n${prompt}`;
    }
  }

  return prompt.trim();
}

async function loadAgentsMd(workdir: string): Promise<string | null> {
  const fs = await import('fs');
  const path = await import('path');
  const agentsPath = path.join(workdir, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) return null;
  try {
    return `AGENTS.md from ${workdir}:\n${fs.readFileSync(agentsPath, 'utf-8').slice(0, 5000)}`;
  } catch {
    return null;
  }
}
```

---

## 4. Updated Job Execution in Scheduler

```typescript
// src/agents/cron-scheduler.ts  (modify the job execution handler)

import { buildCronPrompt } from './cron-context-chain.js';
import { incrementFailureCount, resetFailureCount } from './cron-workflow-store.js';

async function executeCronJob(job: CronJob): Promise<void> {
  // Check failure limit
  if (job.failureCount != null && job.failureCount >= (job.failureLimit ?? 3)) {
    console.warn(`[cron] Job "${job.name}" disabled after ${job.failureCount} failures`);
    await disableCronJob(job.id);
    return;
  }

  try {
    if (job.noAgent) {
      // NO_AGENT MODE: just run the script, no LLM
      if (job.scriptConfig) {
        const { runCronScript } = await import('./cron-script-runner.js');
        const result = await runCronScript({
          ...job.scriptConfig,
          cwd: job.scriptConfig.cwd ?? job.workdir,
        });
        await saveCronJobOutput(job.id, result.stdout || result.stderr);
        if (result.exitCode !== 0) throw new Error(`Script exited with code ${result.exitCode}`);
      }
    } else {
      // AGENT MODE: build prompt, call LLM, deliver output
      const prompt = await buildCronPrompt(job);
      const response = await callAgentWithCronJob(job, prompt);
      await saveCronJobOutput(job.id, response);
      await deliverCronOutput(job, response);
    }

    await resetFailureCount(job.id);
    await updateLastRunAt(job.id);
  } catch (err) {
    await incrementFailureCount(job.id);
    console.error(`[cron] Job "${job.name}" failed:`, err);
    // Notify if failure delivery channel configured
    if (job.deliveryChannels?.length) {
      await deliverCronOutput(job, `[ERROR] Cron job "${job.name}" failed: ${String(err)}`);
    }
  }
}
```

---

## 5. YAML Cron Job Examples

Operators define jobs in `~/.carina/crons.yaml`:

```yaml
# Script injection example: scrape rightmove, inject diff into LLM
- id: rightmove-watch
  name: Rightmove Watcher
  schedule: "0 9 * * *"
  scriptConfig:
    script: |
      diff ~/.carina/cache/rightmove-prev.html <(curl -s https://www.rightmove.co.uk/...) | head -50
    timeoutMs: 15000
  prompt: |
    Here is the diff of the Rightmove listing since yesterday:
    {{script_output}}
    Summarize any price changes or new listings.
  deliveryChannels: ["whatsapp:+447xxx"]

# context_from chaining: analysis job reads data-fetch output
- id: market-fetch
  name: Market Data Fetch
  schedule: "0 7 * * 1-5"
  noAgent: true
  scriptConfig:
    script: |
      python3 scripts/fetch-market-data.py > /tmp/market-data.json
      cat /tmp/market-data.json

- id: market-analysis
  name: Market Analysis
  schedule: "0 8 * * 1-5"
  contextFrom: "market-fetch"
  prompt: "Analyse the following market data and give a 3-bullet summary for my morning brief:"
  deliveryChannels: ["email:user@example.com"]

# No-agent mode: pure shell job
- id: daily-backup
  name: Daily Backup
  schedule: "0 2 * * *"
  noAgent: true
  scriptConfig:
    script: |
      tar -czf /backups/carina-$(date +%Y%m%d).tar.gz ~/.carina/data/
      find /backups -name "*.tar.gz" -mtime +30 -delete
    timeoutMs: 120000
```

---

## Files to Create

```
core.carinaai.uk/src/agents/cron-script-runner.ts
core.carinaai.uk/src/agents/cron-context-chain.ts
```

## Files to Modify

```
core.carinaai.uk/src/agents/cron-workflow-types.ts   add scriptConfig, contextFrom, noAgent, failureLimit
core.carinaai.uk/src/agents/cron-scheduler.ts        use buildCronPrompt, implement noAgent branch
core.carinaai.uk/src/agents/cron-workflow-store.ts   add getCronJobOutput, saveCronJobOutput, incrementFailureCount
```

---

## Done When

- [ ] A cron job with `scriptConfig.script` runs the shell command and injects stdout into the prompt
- [ ] `{{script_output}}` placeholder in prompt is replaced with script stdout
- [ ] If no placeholder, script output is appended at end of prompt
- [ ] `contextFrom: "other-job"` loads the last output of "other-job" and prepends it
- [ ] `contextFrom: "other-job:2"` loads the 2nd most recent output
- [ ] `noAgent: true` skips LLM call entirely, runs only the script
- [ ] `noAgent: true` + `scriptConfig` saves script output to the job output store
- [ ] Job with 3 consecutive failures (failureLimit default) is auto-disabled
- [ ] Script timeout of 30s is enforced (configurable via `scriptConfig.timeoutMs`)
- [ ] workdir/AGENTS.md is loaded and prepended when workdir is set
- [ ] YAML cron config loads correctly with all new fields
- [ ] Unit test: injectScriptOutput replaces placeholder correctly
- [ ] Unit test: noAgent job does not call the LLM