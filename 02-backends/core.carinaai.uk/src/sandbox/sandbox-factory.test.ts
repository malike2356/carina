import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('sandbox tier selection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('uses worker sandbox when Docker is unavailable', async () => {
    vi.doMock('child_process', () => ({
      exec: (_cmd: string, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('not found'));
      },
    }));

    const { runInSandbox } = await import('./sandbox-factory.js');
    const result = await runInSandbox('console.log(1)', 'javascript', 5000);
    expect(result.sandboxTier).toBe('worker_threads');
    expect(result.stdout.trim()).toBe('1');
    expect(result.stderr).toContain('worker_threads sandbox');
  });

  it('blocks JavaScript when CARINA_REQUIRE_DOCKER_SANDBOX is true and Docker is missing', async () => {
    vi.stubEnv('CARINA_REQUIRE_DOCKER_SANDBOX', 'true');
    vi.doMock('child_process', () => ({
      exec: (_cmd: string, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('not found'));
      },
    }));

    const { runInSandbox } = await import('./sandbox-factory.js');
    const result = await runInSandbox('console.log(1)', 'javascript', 5000);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('CARINA_REQUIRE_DOCKER_SANDBOX');
    vi.unstubAllEnvs();
  });

  it('returns a clear error for Python when Docker is unavailable', async () => {
    vi.doMock('child_process', () => ({
      exec: (_cmd: string, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('not found'));
      },
    }));

    const { runInSandbox } = await import('./sandbox-factory.js');
    const result = await runInSandbox('print("hi")', 'python', 5000);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Python code execution requires Docker');
  });
});
