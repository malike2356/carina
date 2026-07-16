import { describe, expect, it } from 'vitest';
import { formatEventDescription, formatEventTypeLabel } from '../format-event-display.js';

describe('format-event-display', () => {
  it('labels common event types', () => {
    expect(formatEventTypeLabel('session_metrics')).toBe('Session telemetry');
    expect(formatEventTypeLabel('cli_test')).toBe('Pairing test');
  });

  it('formats session_metrics JSON as readable text', () => {
    const desc = formatEventDescription(
      'session_metrics',
      JSON.stringify({
        tool_calls_per_5min: 0,
        unique_tools_used: 0,
        injection_attempt_count: 0,
        egress_blocked_count: 0,
      }),
      'carina-production',
    );
    expect(desc).toContain('Session idle');
    expect(desc).toContain('carina-production');
  });

  it('keeps plain descriptions short', () => {
    expect(formatEventDescription('cli_test', 'pairing test', null)).toBe('pairing test');
  });
});
