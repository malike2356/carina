import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluatePolicy,
  resetPolicyGatewayDeps,
  setPolicyGatewayDeps,
} from '../policy-gateway.js';
import { resetShieldModesForTests, setShieldMode } from '../session-shield.js';

describe('PolicyGateway', () => {
  afterEach(() => {
    resetPolicyGatewayDeps();
    resetShieldModesForTests();
  });

  it('allows low-risk actions in observe mode', async () => {
    const decision = await evaluatePolicy({
      actionType: 'tool_chain',
      sessionId: 'sess-1',
      toolName: 'web-search',
    });
    expect(decision.decision).toBe('allow');
    expect(decision.shieldMode).toBe('observe');
  });

  it('blocks dangerous shell commands', async () => {
    const decision = await evaluatePolicy({
      actionType: 'shell',
      sessionId: 'sess-2',
      toolName: 'shell-exec',
      params: { command: 'rm -rf /' },
    });
    expect(decision.decision).toBe('block');
    expect(decision.reason).toContain('dangerous command');
  });

  it('requires approval for confirm-list tools', async () => {
    const decision = await evaluatePolicy({
      actionType: 'file_write',
      sessionId: 'sess-3',
      toolName: 'file-write',
      params: { path: '/tmp/test.txt' },
    });
    expect(decision.decision).toBe('require_approval');
  });

  it('allows confirmed tools on requireConfirmList', async () => {
    const decision = await evaluatePolicy({
      actionType: 'file_write',
      sessionId: 'sess-3b',
      toolName: 'file-write',
      params: { path: '/tmp/test.txt' },
      confirmed: true,
    });
    expect(decision.decision).toBe('allow');
  });

  it('quarantines session when shield mode is quarantine', async () => {
    await setShieldMode('sess-4', 'quarantine', 'test', 'suspicious activity');
    const decision = await evaluatePolicy({
      actionType: 'tool_chain',
      sessionId: 'sess-4',
      toolName: 'web-search',
    });
    expect(decision.decision).toBe('quarantine_session');
  });

  it('blocks restricted tools in restrict mode', async () => {
    await setShieldMode('sess-5', 'restrict', 'test');
    const decision = await evaluatePolicy({
      actionType: 'shell',
      sessionId: 'sess-5',
      toolName: 'shell-exec',
      params: { command: 'ls' },
    });
    expect(decision.decision).toBe('block');
  });

  it('requires approval for risky tools in guard mode', async () => {
    await setShieldMode('sess-6', 'guard', 'test');
    const decision = await evaluatePolicy({
      actionType: 'file_write',
      sessionId: 'sess-6',
      toolName: 'file-write',
      params: { path: '/tmp/x' },
      confirmed: false,
    });
    expect(decision.decision).toBe('require_approval');
  });

  it('blocks when session is blocked', async () => {
    setPolicyGatewayDeps({ isSessionBlocked: async () => true });
    const decision = await evaluatePolicy({
      actionType: 'tool_chain',
      sessionId: 'sess-blocked',
      toolName: 'web-search',
    });
    expect(decision.decision).toBe('quarantine_session');
  });

  it('blocks quarantined tools', async () => {
    setPolicyGatewayDeps({
      isToolQuarantined: async (_inst, tool) => tool === 'shell-exec',
    });
    const decision = await evaluatePolicy({
      actionType: 'shell',
      sessionId: 'sess-7',
      instanceId: 'inst-1',
      toolName: 'shell-exec',
      params: { command: 'echo hi' },
    });
    expect(decision.decision).toBe('block');
    expect(decision.reason).toContain('quarantined');
  });

  it('logs policy decisions via deps', async () => {
    const logDecision = vi.fn().mockResolvedValue(undefined);
    setPolicyGatewayDeps({ logDecision });
    await evaluatePolicy({
      actionType: 'tool_chain',
      sessionId: 'sess-8',
      toolName: 'web-search',
    });
    expect(logDecision).toHaveBeenCalledOnce();
  });
});
