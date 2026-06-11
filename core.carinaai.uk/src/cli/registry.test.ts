import { describe, expect, it } from 'vitest';
import { buildCommandList, resolveCommand } from './registry.js';

describe('CLI registry', () => {
  it('registers 30+ top-level commands', () => {
    const names = buildCommandList().map((c) => c.name);
    expect(names.length).toBeGreaterThanOrEqual(30);
  });

  it('resolves core commands', () => {
    expect(resolveCommand('model')?.name).toBe('model');
    expect(resolveCommand('checkpoint')?.name).toBe('checkpoint');
    expect(resolveCommand('migrate')?.name).toBe('migrate');
    expect(resolveCommand('help')?.name).toBe('help');
    expect(resolveCommand('--version')?.name).toBe('version');
  });

  it('includes Hermes/OpenClaw parity commands', () => {
    const names = new Set(buildCommandList().map((c) => c.name));
    for (const required of [
      'setup', 'config', 'model', 'tools', 'gateway', 'channels', 'cron',
      'doctor', 'skills', 'memory', 'sessions', 'checkpoint', 'plugins',
      'hooks', 'migrate', 'update', 'backup', 'pairing', 'commitments', 'host', 'completion',
      'scout', 'security', 'providers', 'personality', 'agents', 'rag', 'secrets', 'ops',
    ] as const) {
      expect(names.has(required), `missing ${required}`).toBe(true);
    }
  });
});
