import { platform } from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEffectivePlatform,
  getPlatformShell,
  getShellDisplayName,
  normaliseLf,
} from './platform.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getEffectivePlatform', () => {
  it('defaults to the host platform', () => {
    expect(getEffectivePlatform()).toBe(platform());
  });

  it('honours FORCE_PLATFORM for cross-platform CI checks', () => {
    vi.stubEnv('FORCE_PLATFORM', 'win32');
    expect(getEffectivePlatform()).toBe('win32');
  });
});

describe('getPlatformShell', () => {
  it('returns a shell descriptor with a string command', () => {
    const shell = getPlatformShell();
    expect(typeof shell.command).toBe('string');
    expect(shell.command.length).toBeGreaterThan(0);
  });

  it('returns args as an array for a sample command', () => {
    const shell = getPlatformShell();
    const args = shell.args('echo hello');
    expect(Array.isArray(args)).toBe(true);
    expect(args.at(-1)).toContain('echo hello');
  });
});

describe.runIf(getEffectivePlatform() !== 'win32')('Unix-specific shell selection', () => {
  it('getPlatformShell returns /bin/bash', () => {
    expect(getPlatformShell().command).toBe('/bin/bash');
    expect(getShellDisplayName()).toBe('bash');
  });
});

describe.runIf(getEffectivePlatform() === 'win32')('Windows-specific shell selection', () => {
  it('getPlatformShell returns pwsh.exe or powershell.exe', () => {
    expect(['pwsh.exe', 'powershell.exe']).toContain(getPlatformShell().command);
    expect(getShellDisplayName()).toBe('powershell');
  });
});

describe('FORCE_PLATFORM shell override', () => {
  it('selects PowerShell when FORCE_PLATFORM=win32 on non-Windows hosts', () => {
    vi.stubEnv('FORCE_PLATFORM', 'win32');
    expect(getPlatformShell().command).toBe('pwsh.exe');
    expect(getPlatformShell().lineSeparator).toBe('\r\n');
  });

  it('selects bash when FORCE_PLATFORM=linux', () => {
    vi.stubEnv('FORCE_PLATFORM', 'linux');
    expect(getPlatformShell().command).toBe('/bin/bash');
    expect(getShellDisplayName()).toBe('bash');
  });
});

describe('normaliseLf', () => {
  it('replaces CRLF with LF', () => {
    expect(normaliseLf('hello\r\nworld\r\n')).toBe('hello\nworld\n');
  });

  it('leaves LF-only input unchanged', () => {
    expect(normaliseLf('hello\nworld\n')).toBe('hello\nworld\n');
  });
});

describe.runIf(process.env.RUN_SHELL_INTEGRATION === 'true')('shell-exec integration', () => {
  it('executes a simple command', async () => {
    const { executeShellCommand } = await import('./platform.js');
    const result = await executeShellCommand('echo hello', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });
});
