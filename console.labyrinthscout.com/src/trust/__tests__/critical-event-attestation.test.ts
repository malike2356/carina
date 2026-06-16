import { describe, expect, it } from 'vitest';
import {
  shouldAttestCriticalEvent,
  hashEventPayload,
  buildChainHash,
  signAttestation,
  CRITICAL_ATTESTATION_EVENT_TYPES,
} from '../critical-event-attestation.js';

describe('critical-event-attestation', () => {
  it('attests breach severity regardless of type', () => {
    expect(shouldAttestCriticalEvent('breach', 'anything')).toBe(true);
  });

  it('attests known critical event types', () => {
    expect(shouldAttestCriticalEvent('critical', 'tool_blocked')).toBe(true);
    expect(shouldAttestCriticalEvent('critical', 'session_metrics')).toBe(false);
  });

  it('builds stable content hash', () => {
    const hash1 = hashEventPayload({
      id: 'evt-1',
      event_type: 'tool_blocked',
      severity: 'critical',
      instance_id: 'inst',
      created_at: new Date('2026-06-15T12:00:00.000Z'),
      metadata: { tool: 'shell-exec' },
    });
    const hash2 = hashEventPayload({
      id: 'evt-1',
      event_type: 'tool_blocked',
      severity: 'critical',
      instance_id: 'inst',
      created_at: new Date('2026-06-15T12:00:00.000Z'),
      metadata: { tool: 'shell-exec' },
    });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('chains hashes and signs attestations', () => {
    const content = hashEventPayload({
      id: 'evt-2',
      event_type: 'dangerous_command_blocked',
      severity: 'critical',
      instance_id: null,
      created_at: new Date(),
      metadata: {},
    });
    const chain = buildChainHash('prev-hash', content);
    const sig = signAttestation(chain);
    expect(chain).toHaveLength(64);
    expect(sig).toHaveLength(64);
    expect(signAttestation(chain)).toBe(sig);
  });

  it('documents critical attestation event types', () => {
    expect(CRITICAL_ATTESTATION_EVENT_TYPES.has('policy_blocked')).toBe(true);
  });
});
