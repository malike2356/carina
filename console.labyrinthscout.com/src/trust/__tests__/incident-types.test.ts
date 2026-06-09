import { describe, expect, it } from 'vitest';
import { classifyIncident, mapEventToIncident } from '../incident-types.js';

describe('classifyIncident', () => {
  it('classifies runtime escape as type1', () => {
    expect(classifyIncident('sandbox_violation', 'critical', 'namespace transition detected')).toBe('type1');
  });

  it('classifies privilege events as type2', () => {
    expect(classifyIncident('egress_blocked', 'warning', 'domain not in allowlist')).toBe('type2');
  });

  it('classifies injection as type3', () => {
    expect(classifyIncident('prompt_injection_blocked', 'warning', 'jailbreak attempt')).toBe('type3');
  });
});

describe('mapEventToIncident', () => {
  it('maps DB row to classified incident', () => {
    const item = mapEventToIncident({
      id: 'abc',
      severity: 'critical',
      event_type: 'prompt_injection_blocked',
      description: 'blocked',
      instance_id: 'carina-1',
      session_id: 'sess-1',
      created_at: '2026-06-10T12:00:00.000Z',
    });
    expect(item.incident_type).toBe('type3');
    expect(item.incident_label).toContain('Type 3');
  });
});
