import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('shell-exec tool', () => {
  it('refuses to run as root (uid 0)', async () => {
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

  it('rejects unsafe workdir', async () => {
    const runInSandbox = vi.fn();
    vi.doMock('./sandbox.js', () => ({
      runInSandbox,
    }));
    const { shellExecTool } = await import('./shell.js');
    const result = await shellExecTool.execute({ command: 'ls', workdir: '/etc/passwd' });
    expect(result).toEqual({ error: 'workdir is outside allowed paths.' });
    expect(runInSandbox).not.toHaveBeenCalled();
  });

  it('clamps timeout to the 600 second maximum', async () => {
    const runInSandbox = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runInSandbox }));
    const { shellExecTool } = await import('./shell.js');
    await shellExecTool.execute({ command: 'echo ok', timeout: 9999 });
    expect(runInSandbox).toHaveBeenCalledWith(
      'echo ok',
      'alpine:latest',
      expect.objectContaining({ timeout: 600_000 }),
    );
  });

  it('truncates oversized output with a marker', async () => {
    const { truncateShellOutput } = await import('./shell.js');
    const huge = 'x'.repeat(60 * 1024);
    const truncated = truncateShellOutput(huge);
    expect(truncated).toContain('[truncated: output exceeded');
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(50 * 1024 + 128);
  });

  it('uses runDirectShell when CARINA_DIRECT_SHELL is true', async () => {
    process.env.CARINA_DIRECT_SHELL = 'true';
    const runDirectShell = vi.fn().mockResolvedValue({ stdout: 'hello', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runDirectShell, runInSandbox: vi.fn(), isDockerAvailable: vi.fn() }));
    vi.doMock('../infrastructure/sandbox-session.js', () => ({
      execInSessionSandbox: vi.fn(),
      sessionSandboxEnabled: vi.fn().mockReturnValue(false),
    }));
    const { shellExecTool } = await import('./shell.js');
    const result = await shellExecTool.execute({ command: 'echo hello' }) as { stdout: string; shell: string };
    expect(runDirectShell).toHaveBeenCalledWith('echo hello', expect.objectContaining({ timeout: 30_000 }));
    expect(result.stdout).toBe('hello');
    expect(result.shell).toBe('bash');
    delete process.env.CARINA_DIRECT_SHELL;
  });

  it('forms correct Docker -v flag with closing quote', async () => {
    const runInSandbox = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({
      runInSandbox,
      checkDocker: vi.fn().mockResolvedValue(true),
      isDockerAvailable: vi.fn().mockReturnValue(true),
    }));
    const { shellExecTool } = await import('./shell.js');
    await shellExecTool.execute({ command: 'ls', workdir: '/tmp' });
    expect(runInSandbox).toHaveBeenCalledWith(
      'ls',
      'alpine:latest',
      expect.objectContaining({ workdir: '/tmp' }),
    );
  });

  it('direct shell returns non-zero exitCode on failure', async () => {
    process.env.CARINA_DIRECT_SHELL = 'true';
    const runDirectShell = vi.fn().mockResolvedValue({ stdout: '', stderr: 'not found', exitCode: 127 });
    vi.doMock('./sandbox.js', () => ({ runDirectShell, runInSandbox: vi.fn(), isDockerAvailable: vi.fn() }));
    vi.doMock('../infrastructure/sandbox-session.js', () => ({
      execInSessionSandbox: vi.fn(),
      sessionSandboxEnabled: vi.fn().mockReturnValue(false),
    }));
    const { shellExecTool } = await import('./shell.js');
    const result = await shellExecTool.execute({ command: 'bogus-command' }) as { exitCode: number };
    expect(result.exitCode).toBe(127);
    delete process.env.CARINA_DIRECT_SHELL;
  });

  it('starts background processes via the process registry', async () => {
    vi.doMock('./process-registry.js', () => ({
      spawnBackgroundProcess: vi.fn().mockResolvedValue({
        sessionId: 'sess-1',
        pid: 55,
        status: 'running',
        command: 'sleep 5',
      }),
      startProcessCleanup: vi.fn(),
    }));
    vi.doMock('./sandbox.js', () => ({
      runInSandbox: vi.fn(),
    }));

    const { shellExecTool } = await import('./shell.js');
    const result = await shellExecTool.execute({ command: 'sleep 5', background: true }) as {
      session_id: string;
      background: boolean;
    };
    expect(result.session_id).toBe('sess-1');
    expect(result.background).toBe(true);
  });
});
