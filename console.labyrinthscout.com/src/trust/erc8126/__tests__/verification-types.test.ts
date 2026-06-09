import { describe, expect, it } from 'vitest';
import {
  buildVerificationPayload,
  computeUnifiedRiskScore,
  trustResponseFromRisk,
} from '../verification-types.js';

describe('computeUnifiedRiskScore', () => {
  it('averages applicable WAV and WV scores', () => {
    const score = computeUnifiedRiskScore({
      wav: { applicable: true, risk_score: 20, notes: '', checks: {} },
      wv: { applicable: true, risk_score: 40, notes: '', checks: {} },
    });
    expect(score).toBe(30);
  });

  it('ignores non-applicable verification types', () => {
    const score = computeUnifiedRiskScore({
      wav: { applicable: false, risk_score: 100, notes: '', checks: {} },
      wv: { applicable: true, risk_score: 50, notes: '', checks: {} },
    });
    expect(score).toBe(50);
  });
});

describe('buildVerificationPayload', () => {
  it('builds an ERC-8126 payload with unified tier', () => {
    const payload = buildVerificationPayload('42', {
      wav: { applicable: true, risk_score: 10, notes: 'ok', checks: {} },
      wv: { applicable: true, risk_score: 10, notes: 'ok', checks: {} },
    }, new Date('2026-06-10T12:00:00.000Z'));

    expect(payload.standard).toBe('ERC-8126');
    expect(payload.agentId).toBe('42');
    expect(payload.unifiedRiskScore).toBe(10);
    expect(payload.unifiedRiskTier).toBe('low');
    expect(payload.provider).toBe('labyrinth-scout');
  });
});

describe('trustResponseFromRisk', () => {
  it('inverts risk into ERC-8004 trust response score', () => {
    expect(trustResponseFromRisk(20)).toBe(80);
  });
});
