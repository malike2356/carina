import { afterEach, describe, expect, it } from 'vitest';
import {
  consumeBoundApproval,
  createBoundApproval,
  resetActionRiskCache,
  resetBoundApprovalsForTests,
  setOperatorPause,
  assertMutationAllowed,
  isOperatorPauseActive,
  redactSecrets,
} from './propreneur-action-risk.js';

describe('propreneur-action-risk approvals', () => {
  afterEach(() => {
    resetBoundApprovalsForTests();
    resetActionRiskCache();
    setOperatorPause(false);
  });

  it('fails when args are altered after approval', () => {
    const payload = { tool: 'propreneur-propose-expense', amount: 100, propertyId: 1 };
    const approval = createBoundApproval({
      riskClass: 'financial',
      actorId: 'user-a',
      payload,
      authFingerprint: 'auth-1',
      resourceVersion: 4,
    });
    const altered = consumeBoundApproval({
      approvalId: approval.id,
      payload: { ...payload, amount: 999 },
      approverId: 'user-b',
      authFingerprint: 'auth-1',
      resourceVersion: 4,
      dualControl: false,
    });
    expect(altered.ok).toBe(false);
    if (!altered.ok) expect(altered.reason).toBe('digest_mismatch');
  });

  it('fails when the same approval is reused', () => {
    const payload = { tool: 'propreneur-propose-deal', title: 'Deal' };
    const approval = createBoundApproval({
      riskClass: 'routine_write',
      actorId: 'user-a',
      payload,
      authFingerprint: 'auth-1',
    });
    const first = consumeBoundApproval({
      approvalId: approval.id,
      payload,
      approverId: 'user-b',
      authFingerprint: 'auth-1',
      dualControl: false,
    });
    expect(first.ok).toBe(true);
    const second = consumeBoundApproval({
      approvalId: approval.id,
      payload,
      approverId: 'user-c',
      authFingerprint: 'auth-1',
      dualControl: false,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('already_used');
  });

  it('fails dual-control when the same identity approves both roles', () => {
    const payload = { tool: 'bulk-update', count: 40 };
    const approval = createBoundApproval({
      riskClass: 'bulk',
      actorId: 'user-a',
      payload,
      authFingerprint: 'auth-1',
    });
    const same = consumeBoundApproval({
      approvalId: approval.id,
      payload,
      approverId: 'user-a',
      authFingerprint: 'auth-1',
      dualControl: true,
    });
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.reason).toBe('dual_control_same_identity');
  });

  it('blocks mutations while operator pause is active', () => {
    setOperatorPause(true);
    expect(isOperatorPauseActive()).toBe(true);
    expect(() => assertMutationAllowed('financial')).toThrow(/Operator pause/);
    expect(() => assertMutationAllowed('read')).not.toThrow();
  });

  it('redacts secret keys in audit payloads', () => {
    const redacted = redactSecrets(
      { api_key: 'secret-value', amount: 10, nested: { token: 'x', ok: true } },
      ['api_key', 'token'],
    ) as Record<string, unknown>;
    expect(redacted.api_key).toBe('[REDACTED]');
    expect(redacted.amount).toBe(10);
    expect((redacted.nested as Record<string, unknown>).token).toBe('[REDACTED]');
  });
});
