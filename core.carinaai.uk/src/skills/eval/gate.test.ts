import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('pack publish gating', () => {
  it('is off by default', async () => {
    delete process.env.CARINA_EVAL_GATE;
    const { resolveGateMode, runPackEvalGate } = await import('./gate.js');
    expect(resolveGateMode()).toBe('off');
    const result = await runPackEvalGate('productivity');
    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('bypasses when mode is bypass', async () => {
    const { runPackEvalGate } = await import('./gate.js');
    const result = await runPackEvalGate('productivity', { mode: 'bypass' });
    expect(result.passed).toBe(true);
    expect(result.message).toContain('bypassed');
  });

  it('skips packs without eval definitions', async () => {
    const { runPackEvalGate } = await import('./gate.js');
    const result = await runPackEvalGate('nonexistent-pack-xyz', { mode: 'warn' });
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipped');
  });

  it('runs eval for productivity pack in warn mode', async () => {
    const { runPackEvalGate } = await import('./gate.js');
    const result = await runPackEvalGate('productivity', { mode: 'warn', passes: 1 });
    expect(result.runId).toBeDefined();
    expect(result.blocked).toBe(false);
  });
});
