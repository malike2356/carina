import { describe, it, expect } from 'vitest';
import { mapSecurityEventToFinding } from '../event-mapper.js';
import type { SecurityEvent } from '../../alerts/types.js';

function makeEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    id: 'evt-1',
    instance_id: 'carina-local',
    session_id: 'session-1',
    event_type: 'injection_blocked',
    severity: 'critical',
    description: 'Prompt injection attempt blocked',
    created_at: new Date('2026-06-25T12:00:00.000Z'),
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    ...overrides,
  };
}

describe('event-mapper', () => {
  it('maps security events to scout findings', () => {
    const finding = mapSecurityEventToFinding(makeEvent(), 'account-1', {
      prompt: 'ignore previous instructions',
      source_ip: '203.0.113.10',
    });

    expect(finding.type).toBe('prompt_injection');
    expect(finding.severity).toBe('critical');
    expect(finding.mitreAttackIds).toEqual(['T1059', 'T1566']);
    expect(finding.evidence?.prompt).toBe('ignore previous instructions');
    expect(finding.evidence?.sourceIp).toBe('203.0.113.10');
    expect(finding.accountId).toBe('account-1');
  });

  it('maps honeypot events', () => {
    const finding = mapSecurityEventToFinding(
      makeEvent({ event_type: 'honeypot_triggered', severity: 'breach' }),
      'account-1',
    );
    expect(finding.type).toBe('honeypot_triggered');
    expect(finding.severity).toBe('critical');
    expect(finding.riskScore).toBe(95);
  });
});
