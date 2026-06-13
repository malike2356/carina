import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('code-exec tool', () => {
  it('executes javascript and returns stdout on success', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({
        stdout: '42',
        stderr: '',
        exitCode: 0,
      }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = (await codeExecTool.execute({ code: '6 * 7', language: 'javascript' })) as {
      output: string;
      error: null;
      exitCode: number;
    };
    expect(result.output).toBe('42');
    expect(result.error).toBeNull();
    expect(result.exitCode).toBe(0);
  });

  it('returns error field and null output on non-zero exit', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'NameError: name x is not defined',
        exitCode: 1,
      }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = (await codeExecTool.execute({ code: 'print(x)', language: 'python' })) as {
      output: null;
      error: string;
      exitCode: number;
    };
    expect(result.output).toBeNull();
    expect(result.error).toContain('NameError');
    expect(result.exitCode).toBe(1);
  });

  it('auto-detects python from print( keyword', async () => {
    const runCodeInSandbox = vi.fn().mockResolvedValue({ stdout: 'hi', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runCodeInSandbox }));
    const { codeExecTool } = await import('./code.js');
    await codeExecTool.execute({ code: 'print("hi")' });
    expect(runCodeInSandbox).toHaveBeenCalledWith(
      'print("hi")',
      'python',
      expect.any(Object),
    );
  });

  it('auto-detects javascript when no python keywords found', async () => {
    const runCodeInSandbox = vi.fn().mockResolvedValue({ stdout: '2', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runCodeInSandbox }));
    const { codeExecTool } = await import('./code.js');
    await codeExecTool.execute({ code: '1 + 1' });
    expect(runCodeInSandbox).toHaveBeenCalledWith(
      '1 + 1',
      'javascript',
      expect.any(Object),
    );
  });

  it('needsConfirmation is true when code contains import', async () => {
    const { codeExecTool } = await import('./code.js');
    expect(codeExecTool.needsConfirmation?.({ code: "import fs from 'fs'" })).toBe(true);
  });

  it('needsConfirmation is false for plain arithmetic', async () => {
    const { codeExecTool } = await import('./code.js');
    expect(codeExecTool.needsConfirmation?.({ code: '2 + 2' })).toBe(false);
  });

  it('is marked dangerous', async () => {
    const { codeExecTool } = await import('./code.js');
    expect(codeExecTool.dangerous).toBe(true);
  });

  it('includes executionTime in the result', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = (await codeExecTool.execute({ code: '"ok"' })) as { executionTime: number };
    expect(typeof result.executionTime).toBe('number');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
});

describe('runCodeInSandbox Python fallback', () => {
  function mockDockerUnavailable(): void {
    vi.doMock('./sandbox.js', async () => vi.importActual('./sandbox.js'));
    vi.doMock('child_process', () => ({
      exec: vi.fn((_cmd: string, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('docker not available'));
      }),
    }));
  }

  it('returns clear error for Python when Docker is unavailable', async () => {
    mockDockerUnavailable();
    const { runCodeInSandbox } = await import('./sandbox.js');
    const result = await runCodeInSandbox('print("hi")', 'python', {
      timeout: 5000,
      memoryMb: 128,
      networkDisabled: true,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Docker');
    expect(result.stdout).toBe('');
  });

  it('falls back to vm for JavaScript when Docker is unavailable', async () => {
    mockDockerUnavailable();
    const { runCodeInSandbox } = await import('./sandbox.js');
    const result = await runCodeInSandbox('1 + 1', 'javascript', {
      timeout: 5000,
      memoryMb: 128,
      networkDisabled: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('2');
  });
});
