import { describe, expect, it } from 'vitest';
import { buildThreatMetrics } from '../widgets/threat-metrics.js';

describe('buildThreatMetrics', () => {
  it('counts threats, blocked events, sources, and patterns', () => {
    const summary = buildThreatMetrics([
      {
        severity: 'critical',
        event_type: 'injection_blocked',
        ip_address: '10.0.0.1',
        metadata: { pattern_ids: ['INJ-001'] },
        created_at: '2026-06-07T11:00:00Z',
      },
      {
        severity: 'warning',
        event_type: 'egress_blocked',
        ip_address: '10.0.0.1',
        metadata: { pattern: 'egress' },
        created_at: '2026-06-07T11:30:00Z',
      },
      {
        severity: 'info',
        event_type: 'tool_call',
        ip_address: null,
        metadata: {},
        created_at: '2026-06-07T11:45:00Z',
      },
    ], new Date('2026-06-07T12:00:00Z'));

    expect(summary.threats).toBe(2);
    expect(summary.blocked).toBe(2);
    expect(summary.topAttackSources[0]).toEqual({ source: '10.0.0.1', count: 2 });
    expect(summary.topPatterns).toContainEqual({ pattern: 'INJ-001', count: 1 });
  });
});
