import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BinaryRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runBinary(
  binary: string,
  args: string[],
  timeoutMs = 180_000,
): Promise<BinaryRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number | string };
    return {
      exitCode: typeof e.code === 'number' ? e.code : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? (err instanceof Error ? err.message : String(err)),
    };
  }
}
