import { unlinkSync, writeFileSync } from 'fs';
import { Worker } from 'worker_threads';
import { ensurePlatformDirs, tempFile } from '../lib/platform-paths.js';

const WORKER_SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
const { code } = workerData;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

let stdout = '';
let stderr = '';

console.log = (...args) => { stdout += args.join(' ') + '\\n'; };
console.error = (...args) => { stderr += args.join(' ') + '\\n'; };
console.warn = (...args) => { stderr += '[warn] ' + args.join(' ') + '\\n'; };

try {
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction(code);
  fn().then((result) => {
    if (result !== undefined && result !== null) {
      stdout += String(result) + '\\n';
    }
    parentPort.postMessage({ stdout, stderr, exitCode: 0 });
  }).catch((err) => {
    parentPort.postMessage({ stdout, stderr: stderr + err.message + '\\n' + (err.stack ?? ''), exitCode: 1 });
  });
} catch (err) {
  parentPort.postMessage({ stdout, stderr: err.message + '\\n' + (err.stack ?? ''), exitCode: 1 });
}
`;

export type WorkerResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runInWorker(code: string, timeoutMs: number): Promise<WorkerResult> {
  return new Promise((resolve) => {
    ensurePlatformDirs();
    const workerFile = tempFile(`worker-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);
    let settled = false;

    const finish = (result: WorkerResult): void => {
      if (settled) return;
      settled = true;
      try {
        unlinkSync(workerFile);
      } catch {
        /* ignore cleanup failure */
      }
      resolve(result);
    };

    try {
      writeFileSync(workerFile, WORKER_SCRIPT);
    } catch {
      finish({ stdout: '', stderr: 'Failed to create worker script file', exitCode: 1 });
      return;
    }

    const worker = new Worker(workerFile, {
      workerData: { code },
      env: {
        NODE_ENV: 'sandbox',
      },
    });

    const timer = setTimeout(() => {
      void worker.terminate().catch(() => undefined);
      finish({
        stdout: '',
        stderr: `Code execution timed out after ${timeoutMs}ms`,
        exitCode: 124,
      });
    }, timeoutMs);

    worker.on('message', (result: WorkerResult) => {
      clearTimeout(timer);
      finish(result);
    });

    worker.on('error', (err) => {
      clearTimeout(timer);
      finish({ stdout: '', stderr: err instanceof Error ? err.message : String(err), exitCode: 1 });
    });

    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (!settled && code !== 0) {
        finish({ stdout: '', stderr: `Worker exited with code ${code}`, exitCode: code ?? 1 });
      }
    });
  });
}
