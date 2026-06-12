import { afterEach, describe, expect, it, vi } from 'vitest';
import { simulateAction } from '../action-simulator.js';
import { resetPolicyGatewayDeps, setPolicyGatewayDeps } from '../policy-gateway.js';
import { resetShieldModesForTests } from '../session-shield.js';

describe('ActionSimulator', () => {
  afterEach(() => {
    resetPolicyGatewayDeps();
    resetShieldModesForTests();
    setPolicyGatewayDeps({
      logDecision: async () => {},
      isSessionBlocked: async () => false,
      isToolQuarantined: async () => false,
    });
  });

  it('previews allowed shell command', async () => {
    const result = await simulateAction({
      sessionId: 'sim-1',
      toolName: 'web-search',
    });
    expect(result.dryRun).toBe(true);
    expect(result.wouldBlock).toBe(false);
    expect(result.preview).toContain('Would execute');
  });

  it('previews blocked dangerous command', async () => {
    const result = await simulateAction({
      sessionId: 'sim-2',
      toolName: 'shell-exec',
      params: { command: 'rm -rf /' },
    });
    expect(result.wouldBlock).toBe(true);
    expect(result.preview).toContain('BLOCKED');
  });

  it('lists touched resources for file write', async () => {
    const result = await simulateAction({
      sessionId: 'sim-3',
      toolName: 'file-write',
      params: { path: '/tmp/out.txt', confirmed: true },
    });
    expect(result.wouldTouch.some((t) => t.includes('/tmp/out.txt'))).toBe(true);
  });
});
