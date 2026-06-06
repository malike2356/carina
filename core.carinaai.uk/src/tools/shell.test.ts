import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('shell-exec tool', () => {
  it('refuses to run as root (uid 0)', async () => {
    // Stub process.getuid to return 0 (root)
    const original = process.getuid;
    process.getuid = () => 0;
    vi.doMock('./sandbox.js', () => ({
      runInSandbox: vi.fn(),
      isDockerAvailable: vi.fn().mockReturnValue(false),
    }));
    const { shellExecTool } = await import('./shell.js');
    try {
      await expect(shellExecTool.execute({ command: 'ls' })).rejects.toThrow('root');
    } finally {
      process.getuid = original;
    }
  });

  it('is marked dangerous', async () => {
    const { shellExecTool } = await import('./shell.js');
    expect(shellExecTool.dangerous).toBe(true);
  });

  it('requires confirmation', async () => {
    const { shellExecTool } = await import('./shell.js');
    expect(shellExecTool.requiresConfirmation).toBe(true);
  });
});
