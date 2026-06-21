import { describe, it, expect } from 'vitest';
import { runInWorker } from './worker-sandbox.js';

describe('runInWorker', () => {
  it('runs simple arithmetic and returns stdout', async () => {
    const result = await runInWorker('console.log(2 + 2)', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('4');
  });

  it('captures console.error in stderr', async () => {
    const result = await runInWorker('console.error("oops")', 5000);
    expect(result.stderr).toContain('oops');
  });

  it('catches thrown errors and returns exitCode 1', async () => {
    const result = await runInWorker('throw new Error("intentional")', 5000);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('intentional');
  });

  it('enforces timeout', async () => {
    const result = await runInWorker('await new Promise(r => setTimeout(r, 10000))', 500);
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain('timed out');
  }, 2000);

  it('handles async code', async () => {
    const result = await runInWorker(
      'const r = await fetch("data:text/plain,hello"); console.log(await r.text())',
      5000,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('returns expression results like the legacy vm fallback', async () => {
    const result = await runInWorker('return 1 + 1', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('2');
  });
});
