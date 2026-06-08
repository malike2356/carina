import { describe, it, expect } from 'vitest';
import { getChannelsForSeverity, SEVERITY_ROUTING } from '../routing.js';
import type { AlertSeverity } from '../types.js';

describe('Alert Routing', () => {
  it('routes breach to all channels', () => {
    expect(getChannelsForSeverity('breach')).toEqual([
      'telegram', 'email', 'sms', 'dashboard',
    ]);
  });

  it('routes critical to telegram, email, sms, dashboard', () => {
    expect(getChannelsForSeverity('critical')).toEqual([
      'telegram', 'email', 'sms', 'dashboard',
    ]);
  });

  it('routes warning to telegram, email, dashboard', () => {
    expect(getChannelsForSeverity('warning')).toEqual([
      'telegram', 'email', 'dashboard',
    ]);
  });

  it('routes info to dashboard only', () => {
    expect(getChannelsForSeverity('info')).toEqual(['dashboard']);
  });

  it('every defined severity has an entry', () => {
    const severities: AlertSeverity[] = ['info', 'warning', 'critical', 'breach'];
    for (const s of severities) {
      expect(SEVERITY_ROUTING[s]).toBeDefined();
    }
  });
});
