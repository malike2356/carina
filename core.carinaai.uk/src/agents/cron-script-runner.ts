import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import { expandPath, isSafePath } from '../tools/path-utils.js';
import type { CronScriptConfig } from './cron-job-types.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export async function runCronScript(config: CronScriptConfig): Promise<ScriptRunResult> {
  const start = Date.now();
  const timeout = config.timeoutMs ?? 30_000;

  try {
    const { stdout, stderr } = await execAsync(config.script, {
      cwd: config.cwd,
      env: { ...process.env, ...(config.env ?? {}) },
      timeout,
      maxBuffer: 1024 * 1024,
      shell: '/bin/bash',
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: e.stdout?.trim() ?? '',
      stderr: e.stderr?.trim() ?? e.message ?? 'Unknown error',
      exitCode: typeof e.code === 'number' ? e.code : 1,
      durationMs: Date.now() - start,
    };
  }
}

export async function runCronScriptFile(
  scriptPath: string,
  workdir?: string,
  timeoutMs = 60_000,
): Promise<ScriptRunResult> {
  const start = Date.now();
  const resolved = expandPath(scriptPath);
  if (!isSafePath(resolved)) {
    return {
      stdout: '',
      stderr: 'Script path is not allowed.',
      exitCode: 1,
      durationMs: Date.now() - start,
    };
  }
  const scriptsRoot = path.resolve('data/scripts');
  if (!resolved.startsWith(scriptsRoot)) {
    return {
      stdout: '',
      stderr: 'Scripts must be under data/scripts/.',
      exitCode: 1,
      durationMs: Date.now() - start,
    };
  }

  const ext = path.extname(resolved).toLowerCase();
  const cmd = ext === '.sh' || ext === '.bash' ? 'bash' : 'python3';
  try {
    const result = await execFileAsync(cmd, [resolved], {
      timeout: timeoutMs,
      cwd: workdir,
      maxBuffer: 512 * 1024,
    });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: e.stdout?.trim() ?? '',
      stderr: e.stderr?.trim() ?? e.message ?? 'Unknown error',
      exitCode: typeof e.code === 'number' ? e.code : 1,
      durationMs: Date.now() - start,
    };
  }
}

export function injectScriptOutput(promptTemplate: string, output: string): string {
  if (!promptTemplate.includes('{{script_output}}')) {
    return `${promptTemplate}\n\nScript output:\n${output}`;
  }
  return promptTemplate.replace(/\{\{script_output\}\}/g, output);
}
