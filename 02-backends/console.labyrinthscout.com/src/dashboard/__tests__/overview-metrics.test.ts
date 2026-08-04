import { describe, expect, it } from 'vitest';
import {
  buildOverviewMetrics,
  deriveThreatLevel,
} from '../widgets/overview-metrics.js';

describe('deriveThreatLevel', () => {
  it('returns CRITICAL for 3+ open incidents', () => {
    expect(deriveThreatLevel(3, 0)).toBe('CRITICAL');
  });

  it('returns ELEVATED for open incidents or many blocks', () => {
    expect(deriveThreatLevel(1, 0)).toBe('ELEVATED');
    expect(deriveThreatLevel(0, 3)).toBe('ELEVATED');
  });

  it('returns NORMAL when quiet', () => {
    expect(deriveThreatLevel(0, 0)).toBe('NORMAL');
  });
});

describe('buildOverviewMetrics', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it('aggregates volume, coverage, open incidents, and kill state coherently', () => {
    const metrics = buildOverviewMetrics({
      now,
      killTriggered: false,
      killReason: null,
      findingsScore: 100,
      honeypotHits24h: 2,
      tripwireHits24h: 1,
      agents: [
        {
          id: 'a1',
          name: 'carina-l',
          status: 'active',
          suspension_reason: null,
          last_heartbeat: '2026-07-28T11:59:30.000Z',
        },
        {
          id: 'a2',
          name: 'offline',
          status: 'active',
          suspension_reason: null,
          last_heartbeat: '2026-07-28T10:00:00.000Z',
        },
      ],
      events: [
        {
          id: 'e1',
          severity: 'critical',
          event_type: 'prompt_injection_detected',
          ip_address: '1.1.1.1',
          instance_id: 'a1',
          metadata: {},
          description: 'Injection attempt',
          acknowledged: false,
          mitigated: false,
          created_at: '2026-07-28T11:00:00.000Z',
        },
        {
          id: 'e2',
          severity: 'warning',
          event_type: 'injection_blocked',
          ip_address: null,
          instance_id: 'a1',
          metadata: { hostname: 'evil.example' },
          description: 'Blocked',
          acknowledged: false,
          mitigated: false,
          created_at: '2026-07-28T11:10:00.000Z',
        },
        {
          id: 'e3',
          severity: 'info',
          event_type: 'tool_call',
          ip_address: null,
          instance_id: 'a1',
          metadata: {},
          description: 'tool ok',
          acknowledged: false,
          mitigated: false,
          created_at: '2026-07-28T11:20:00.000Z',
        },
        {
          id: 'e4',
          severity: 'critical',
          event_type: 'breach_detected',
          ip_address: null,
          instance_id: 'a1',
          metadata: {},
          description: 'ackd',
          acknowledged: true,
          mitigated: false,
          created_at: '2026-07-28T11:30:00.000Z',
        },
      ],
    });

    expect(metrics.volume24h).toBe(4);
    expect(metrics.auditEvents24h).toBe(4);
    expect(metrics.openIncidents24h).toBe(1);
    expect(metrics.highSeverity24h).toBe(2);
    expect(metrics.threatLevel).toBe('ELEVATED');
    expect(metrics.agents.registered).toBe(2);
    expect(metrics.agents.online).toBe(1);
    expect(metrics.agents.coveragePercent).toBe(50);
    expect(metrics.threatLoad).toBe(metrics.threatsBlocked24h + metrics.highSeverity24h);
    expect(metrics.volumeHourly.reduce((a, b) => a + b, 0)).toBe(4);
    expect(metrics.scoutScore).toBe(100);
    expect(metrics.scoutScoreLabel).toContain('findings posture');
    expect(metrics.killSwitch.halted).toBe(false);
    expect(metrics.killSwitch.state).toBe('standby');
    expect(metrics.controlState).toBe('LIVE');
    expect(metrics.systemStatus).toBe('ALERT');
    expect(metrics.feed[0].id).toBe('e4');
    expect(metrics.honeypotHits24h).toBe(2);
    expect(metrics.tripwireHits24h).toBe(1);
  });

  it('marks kill switch halted and control state HALTED when triggered', () => {
    const metrics = buildOverviewMetrics({
      now,
      killTriggered: true,
      killReason: 'manual halt',
      findingsScore: 90,
      agents: [],
      events: [],
    });

    expect(metrics.killSwitch).toEqual({
      state: 'halted',
      halted: true,
      reason: 'manual halt',
    });
    expect(metrics.controlState).toBe('HALTED');
    expect(metrics.systemStatus).toBe('ALERT');
    expect(metrics.threatLevel).toBe('NORMAL');
  });

  it('does not treat standby kill arming as halted', () => {
    const metrics = buildOverviewMetrics({
      now,
      killTriggered: false,
      killReason: null,
      findingsScore: null,
      agents: [
        {
          id: 'a1',
          name: 'carina-l',
          status: 'active',
          suspension_reason: null,
          last_heartbeat: '2026-07-28T11:59:50.000Z',
        },
      ],
      events: [],
    });

    expect(metrics.killSwitch.halted).toBe(false);
    expect(metrics.controlState).toBe('LIVE');
    expect(metrics.systemStatus).toBe('OK');
    expect(metrics.volume24h).toBe(0);
  });
});
