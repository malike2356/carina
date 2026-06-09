import { describe, expect, it } from 'vitest';
import { securityScoreFromRisk } from '../attestation-namespace.js';
import { computeRuntimeHours, evaluateEligibility } from '../attestation-metrics.js';
import { computeRiskScore } from '../compute-trust-metrics.js';

describe('evaluateEligibility', () => {
  const healthy = {
    agentsTotal: 1,
    agentsActive: 1,
    agentsSuspended: 0,
    runtimeIncidents30d: 0,
    warning24h: 0,
    breach30d: 0,
    eventsToday: 10,
    injectionBlocks24h: 0,
    blocked24h: 0,
    threats24h: 0,
    lastEventAt: '2026-06-10T10:00:00.000Z',
    lastHeartbeatAt: '2026-06-10T10:00:00.000Z',
  };

  it('allows attestation on clean runtime with active agents', () => {
    expect(evaluateEligibility(healthy)).toEqual({ eligible: true });
  });

  it('blocks attestation when critical incidents exist', () => {
    const result = evaluateEligibility({ ...healthy, runtimeIncidents30d: 2 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('2');
  });

  it('blocks attestation when no agents are active', () => {
    const result = evaluateEligibility({ ...healthy, agentsActive: 0 });
    expect(result.eligible).toBe(false);
  });
});

describe('computeRuntimeHours', () => {
  it('returns 720h when no incidents and no heartbeat baseline', () => {
    expect(computeRuntimeHours(null, null, new Date('2026-06-10T12:00:00.000Z'))).toBe(720);
  });

  it('counts hours since last incident', () => {
    const now = new Date('2026-06-10T12:00:00.000Z');
    const lastIncident = new Date('2026-06-09T12:00:00.000Z');
    expect(computeRuntimeHours(lastIncident, null, now)).toBe(24);
  });
});

describe('securityScoreFromRisk', () => {
  it('inverts Scout risk score into attestation score', () => {
    const risk = computeRiskScore({
      agentsTotal: 1,
      agentsActive: 1,
      agentsSuspended: 0,
      runtimeIncidents30d: 0,
      warning24h: 0,
      breach30d: 0,
      eventsToday: 5,
      injectionBlocks24h: 0,
      blocked24h: 0,
      threats24h: 0,
      lastEventAt: null,
      lastHeartbeatAt: null,
    });
    expect(securityScoreFromRisk(risk)).toBeGreaterThan(80);
  });
});
