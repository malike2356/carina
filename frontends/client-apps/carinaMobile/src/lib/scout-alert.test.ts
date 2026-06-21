import { describe, expect, it } from 'vitest';
import { buildScoutAlertContent, shouldAlertForSeverity } from './scout-alert';

describe('scout-alert', () => {
  it('alerts on warning and above', () => {
    expect(shouldAlertForSeverity('warning')).toBe(true);
    expect(shouldAlertForSeverity('critical')).toBe(true);
    expect(shouldAlertForSeverity('info')).toBe(false);
  });

  it('builds critical alert copy', () => {
    const content = buildScoutAlertContent({
      id: '1',
      severity: 'critical',
      source: 'scout',
      event_type: 'injection_block',
      description: 'Prompt injection blocked on chat endpoint',
      created_at: new Date().toISOString(),
    });
    expect(content.title).toBe('Scout security alert');
    expect(content.body).toContain('Prompt injection');
  });
});
