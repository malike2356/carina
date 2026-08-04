import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/index.js', () => ({
  config: {
    auth: { apiKey: 'test-scout-key' },
    console: { dashboardUrl: 'http://localhost:4444' },
  },
}));

import { TelegramAdapter } from '../../alerts/telegram.js';

describe('TelegramAdapter action guidance', () => {
  const adapter = new TelegramAdapter();

  const baseEvent = {
    id: 'test-id',
    instance_id: 'carina-local',
    session_id: 'some-session-uuid',
    created_at: new Date(),
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
  };

  it('anomaly_detected critical includes action guidance', () => {
    const msg = adapter.formatMessage({
      ...baseEvent,
      event_type: 'anomaly_detected',
      severity: 'critical',
      description: JSON.stringify({ metricName: 'uniquetoolsused', zScore: 6.1, currentValue: 3, baselineMean: 0.08 }),
    });
    expect(msg).toContain('What you can do');
    expect(msg).toContain('Review in Labyrinth dashboard');
    expect(msg).toContain('tab=actions');
  });

  it('alert_test includes no-action-needed message', () => {
    const msg = adapter.formatMessage({
      ...baseEvent,
      event_type: 'alert_test',
      severity: 'info',
      description: 'Test alert',
    });
    expect(msg).toContain('No action needed');
  });

  it('breach_detected includes high-impact actions', () => {
    const msg = adapter.formatMessage({
      ...baseEvent,
      event_type: 'breach_detected',
      severity: 'breach',
      description: 'Confirmed breach via prompt injection',
    });
    expect(msg).toContain('High impact');
    expect(msg).toContain('What you can do');
  });
});
