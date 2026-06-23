import { describe, expect, it } from 'vitest';
import { isOpsShellInput, normalizeOpsShellCommand, runOpsShellCommand } from './ops-shell.js';

describe('ops-shell', () => {
  it('detects common shell commands', () => {
    expect(isOpsShellInput('ls')).toBe(true);
    expect(isOpsShellInput('ls -la')).toBe(true);
    expect(isOpsShellInput('! pwd')).toBe(true);
    expect(isOpsShellInput('/help')).toBe(false);
    expect(isOpsShellInput('what files are here')).toBe(false);
  });

  it('strips leading punctuation and fixes common typos', () => {
    expect(isOpsShellInput(']whomai')).toBe(true);
    expect(normalizeOpsShellCommand(']whomai')).toBe('whoami');
    expect(normalizeOpsShellCommand('  !  ls -la')).toBe('ls -la');
  });

  it('strips bang prefix', () => {
    expect(normalizeOpsShellCommand('! ls -la')).toBe('ls -la');
    expect(normalizeOpsShellCommand('ls')).toBe('ls');
  });

  it('treats clear as a shell command', () => {
    expect(isOpsShellInput('clear')).toBe(true);
    expect(isOpsShellInput('cls')).toBe(true);
    expect(normalizeOpsShellCommand('clear')).toBe('clear');
  });

  it('runs shell commands', () => {
    const out = runOpsShellCommand('echo ops-shell-ok', process.cwd());
    expect(out.trim()).toBe('ops-shell-ok');
  });
});
