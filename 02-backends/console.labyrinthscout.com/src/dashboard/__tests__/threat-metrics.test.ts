import { describe, expect, it } from 'vitest';
import { buildThreatMetrics, classifyThreatEvent } from '../widgets/threat-metrics.js';

describe('classifyThreatEvent', () => {
  it('treats admin events separately from attacks', () => {
    expect(classifyThreatEvent('kill_switch_activated', 'critical')).toBe('admin');
    expect(classifyThreatEvent('alert_test', 'warning')).toBe('admin');
  });

  it('does not classify generic warnings as attacks', () => {
    expect(classifyThreatEvent('tool_call', 'warning')).toBe('noise');
    expect(classifyThreatEvent('session_metrics', 'warning')).toBe('noise');
  });

  it('classifies injection and egress blocks correctly', () => {
    expect(classifyThreatEvent('injection_blocked', 'critical')).toBe('blocked');
    expect(classifyThreatEvent('prompt_injection_detected', 'critical')).toBe('attack');
  });
});

describe('buildThreatMetrics', () => {
  it('counts attacks, blocked, admin, and anomalies separately', () => {
    const summary = buildThreatMetrics([
      {
        severity: 'critical',
        event_type: 'injection_blocked',
        ip_address: '10.0.0.1',
        instance_id: 'inst-1',
        metadata: { pattern_ids: ['INJ-001'], hostname: 'evil.example' },
        created_at: '2026-06-07T11:00:00Z',
      },
      {
        severity: 'warning',
        event_type: 'egress_blocked',
        ip_address: '10.0.0.1',
        instance_id: 'inst-1',
        metadata: { hostname: 'bad.example', tool: 'http-request' },
        created_at: '2026-06-07T11:30:00Z',
      },
      {
        severity: 'critical',
        event_type: 'kill_switch_activated',
        ip_address: null,
        instance_id: 'inst-1',
        metadata: {},
        created_at: '2026-06-07T11:40:00Z',
      },
      {
        severity: 'warning',
        event_type: 'tool_call',
        ip_address: null,
        instance_id: 'inst-1',
        metadata: {},
        created_at: '2026-06-07T11:45:00Z',
      },
    ], new Date('2026-06-07T12:00:00Z'));

    expect(summary.attacks).toBe(0);
    expect(summary.blocked).toBe(2);
    expect(summary.admin_actions).toBe(1);
    expect(summary.threats).toBe(summary.attacks);
    expect(summary.topBlockedDestinations[0]).toEqual({ destination: 'evil.example', count: 1 });
    expect(summary.topTools[0]).toEqual({ tool: 'http-request', count: 1 });
  });
});
