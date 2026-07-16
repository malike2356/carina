import { describe, expect, it } from 'vitest';
import {
  buildAttestations,
  buildPublicTrustPayload,
  computeRiskScore,
} from '../compute-trust-metrics.js';

/**
 * End-to-end trust pipeline (off-chain):
 * Scout event metrics change -> risk score + attestations update -> public API payload.
 */
describe('trust pipeline e2e (off-chain)', () => {
  const baseline = {
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
    lastEventAt: '2026-06-10T10:00:00.000Z',
    lastHeartbeatAt: '2026-06-10T10:00:00.000Z',
  };

  it('increases attestations when new security events arrive', () => {
    const before = buildAttestations(baseline, '2026-06-10T10:00:00.000Z');
    const after = buildAttestations(
      { ...baseline, eventsToday: 42, injectionBlocks24h: 3, blocked24h: 2 },
      '2026-06-10T10:05:00.000Z',
    );

    expect(after.length).toBeGreaterThanOrEqual(before.length);
    expect(after.some((a) => a.type === 'Shield')).toBe(true);
    expect(after.find((a) => a.type === 'Audit')?.summary).toContain('42');
  });

  it('raises risk score after runtime incidents', () => {
    const healthy = computeRiskScore(baseline);
    const compromised = computeRiskScore({
      ...baseline,
      runtimeIncidents30d: 1,
      warning24h: 2,
    });

    expect(compromised).toBeGreaterThan(healthy);
  });

  it('builds a public payload wired for the Carina trust dashboard', () => {
    const payload = buildPublicTrustPayload(
      baseline,
      { erc8004: 'registering', erc8126: 'enterprise' },
      {
        registered: false,
        slug: 'carina-reference',
        name: 'Carina AI Agent',
        agent_id: null,
        agent_registry: null,
        wallet_address: null,
        registry_explorer_url: null,
        register_tx_url: null,
        status: 'pending',
      },
    );

    expect(payload.source).toBe('labyrinth-scout');
    expect(payload.monitoring.scout_active).toBe(true);
    expect(payload.identity?.slug).toBe('carina-reference');
    expect(payload.attestations.length).toBeGreaterThan(0);
    expect(payload.chain.erc8004_status).toBe('registering');
  });
});
