import { describe, expect, it } from 'vitest';
import { classifyIncident, incidentTypeSqlCondition } from '../incident-types.js';

describe('classifyIncident', () => {
  it('does not classify every critical event as type3', () => {
    expect(classifyIncident('egress_blocked', 'critical', 'blocked outbound')).toBe('type2');
    expect(classifyIncident('sandbox_escape', 'critical', 'runtime violation')).toBe('type1');
  });

  it('classifies injection events as type3 even when blocked', () => {
    expect(classifyIncident('injection_blocked', 'warning', 'pattern INJ-001')).toBe('type3');
    expect(classifyIncident('egress_blocked', 'critical', 'blocked outbound')).toBe('type2');
  });
});

describe('incidentTypeSqlCondition', () => {
  it('returns SQL for each incident type filter', () => {
    expect(incidentTypeSqlCondition('type1')).toContain('runtime_escape');
    expect(incidentTypeSqlCondition('type2')).toContain('kill_switch');
    expect(incidentTypeSqlCondition('type3')).toContain('injection');
    expect(incidentTypeSqlCondition('other')).toBeNull();
  });
});
