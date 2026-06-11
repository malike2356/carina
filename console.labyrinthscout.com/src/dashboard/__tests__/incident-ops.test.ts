import { describe, expect, it } from 'vitest';
import { buildIncidentOps } from '../widgets/incident-ops.js';

describe('buildIncidentOps', () => {
  it('counts open critical and average time to acknowledge', () => {
    const summary = buildIncidentOps([
      {
        id: '1',
        severity: 'critical',
        event_type: 'injection_blocked',
        acknowledged: false,
        acknowledged_at: null,
        mitigated: false,
        created_at: '2026-06-07T10:00:00Z',
      },
      {
        id: '2',
        severity: 'breach',
        event_type: 'honeypot_triggered',
        acknowledged: true,
        acknowledged_at: '2026-06-07T10:05:00Z',
        mitigated: false,
        created_at: '2026-06-07T10:00:00Z',
      },
    ]);

    expect(summary.open_critical).toBe(1);
    expect(summary.acknowledged_count).toBe(1);
    expect(summary.avg_time_to_acknowledge_ms).toBe(5 * 60 * 1000);
  });
});
