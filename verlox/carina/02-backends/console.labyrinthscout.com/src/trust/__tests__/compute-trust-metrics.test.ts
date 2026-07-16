import { describe, expect, it } from 'vitest';
import {
  buildAttestations,
  buildPublicTrustPayload,
  computeRiskScore,
  formatRelativeTime,
  riskTierFromScore,
} from '../compute-trust-metrics.js';

const healthyInput = {
  agentsTotal: 2,
  agentsActive: 2,
  agentsSuspended: 0,
  runtimeIncidents30d: 0,
  warning24h: 0,
  breach30d: 0,
  eventsToday: 1284,
  injectionBlocks24h: 0,
  blocked24h: 0,
  threats24h: 0,
  lastEventAt: '2026-06-09T12:00:00.000Z',
  lastHeartbeatAt: '2026-06-09T12:01:00.000Z',
};

describe('computeRiskScore', () => {
  it('returns a low score for a healthy deployment', () => {
    expect(computeRiskScore(healthyInput)).toBeLessThanOrEqual(20);
  });

  it('raises score for runtime incidents and offline agents', () => {
    const score = computeRiskScore({
      ...healthyInput,
      runtimeIncidents30d: 2,
      agentsActive: 0,
      agentsSuspended: 1,
    });
    expect(score).toBeGreaterThan(40);
  });
});

describe('riskTierFromScore', () => {
  it('maps score bands to tiers', () => {
    expect(riskTierFromScore(12)).toBe('low');
    expect(riskTierFromScore(35)).toBe('moderate');
    expect(riskTierFromScore(55)).toBe('elevated');
    expect(riskTierFromScore(75)).toBe('high');
    expect(riskTierFromScore(95)).toBe('critical');
  });
});

describe('formatRelativeTime', () => {
  it('formats recent timestamps', () => {
    const now = new Date('2026-06-09T12:02:00.000Z').getTime();
    expect(formatRelativeTime('2026-06-09T12:01:30.000Z', now)).toBe('30 seconds ago');
  });
});

describe('buildPublicTrustPayload', () => {
  it('builds a public payload with attestations', () => {
    const payload = buildPublicTrustPayload(healthyInput, {
      erc8004: 'registering',
      erc8126: 'enterprise',
    }, new Date('2026-06-09T12:02:00.000Z'));

    expect(payload.source).toBe('labyrinth-scout');
    expect(payload.monitoring.scout_active).toBe(true);
    expect(payload.metrics.events_today).toBe(1284);
    expect(payload.attestations.length).toBeGreaterThan(0);
    expect(payload.attestations[0].hash_preview).toMatch(/^[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/);
  });
});

describe('buildAttestations', () => {
  it('includes shield attestation when blocks occurred', () => {
    const items = buildAttestations({
      ...healthyInput,
      injectionBlocks24h: 3,
      blocked24h: 4,
    }, '2026-06-09T12:00:00.000Z');

    expect(items.some((item) => item.type === 'Shield')).toBe(true);
  });
});
