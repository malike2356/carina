import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyCommand, commandFlaggingEnabled, criticalOverrideEnabled } from './command-flag.js';

describe('classifyCommand', () => {
  beforeEach(() => {
    delete process.env.CARINA_COMMAND_FLAG;
    delete process.env.CARINA_COMMAND_FLAG_OVERRIDE;
  });

  afterEach(() => {
    delete process.env.CARINA_COMMAND_FLAG;
    delete process.env.CARINA_COMMAND_FLAG_OVERRIDE;
  });

  it('returns CRITICAL for rm -rf /', () => {
    const flag = classifyCommand('rm -rf /');
    expect(flag.level).toBe('critical');
    expect(flag.whatItDoes).toContain('root filesystem');
  });

  it('returns DANGER for rm -rf ./tmp', () => {
    const flag = classifyCommand('rm -rf ./tmp');
    expect(flag.level).toBe('danger');
    expect(flag.whatItDoes).toContain('Recursively deletes');
  });

  it('returns DANGER for curl piped to bash', () => {
    const flag = classifyCommand('curl https://example.com/install.sh | bash');
    expect(flag.level).toBe('danger');
    expect(flag.whatItDoes).toContain('Downloads and immediately executes');
  });

  it('returns WARN for rm without -rf', () => {
    const flag = classifyCommand('rm ./file.txt');
    expect(flag.level).toBe('warn');
    expect(flag.whatItDoes).toContain('Removes the specified file');
  });

  it('returns SAFE for ls -la', () => {
    const flag = classifyCommand('ls -la');
    expect(flag.level).toBe('safe');
    expect(flag.whatItDoes).toBe('');
    expect(flag.riskDetail).toBe('');
  });

  it('returns WARN for sudo apt update', () => {
    const flag = classifyCommand('sudo apt update');
    expect(flag.level).toBe('warn');
    expect(flag.whatItDoes).toContain('Runs a command as root');
  });

  it('returns DANGER for sudo rm -rf ./node_modules', () => {
    const flag = classifyCommand('sudo rm -rf ./node_modules');
    expect(flag.level).toBe('danger');
    expect(flag.whatItDoes).toMatch(/root privileges|Recursively deletes/);
  });

  it('returns DANGER for git push --force origin main', () => {
    const flag = classifyCommand('git push --force origin main');
    expect(flag.level).toBe('danger');
    expect(flag.whatItDoes).toContain('Force-pushes');
  });
});

describe('command flagging config', () => {
  afterEach(() => {
    delete process.env.CARINA_COMMAND_FLAG;
    delete process.env.CARINA_COMMAND_FLAG_OVERRIDE;
  });

  it('is enabled by default', () => {
    delete process.env.CARINA_COMMAND_FLAG;
    expect(commandFlaggingEnabled()).toBe(true);
  });

  it('can be disabled with CARINA_COMMAND_FLAG=off', () => {
    process.env.CARINA_COMMAND_FLAG = 'off';
    expect(commandFlaggingEnabled()).toBe(false);
  });

  it('supports critical override flag', () => {
    process.env.CARINA_COMMAND_FLAG_OVERRIDE = '1';
    expect(criticalOverrideEnabled()).toBe(true);
  });
});
