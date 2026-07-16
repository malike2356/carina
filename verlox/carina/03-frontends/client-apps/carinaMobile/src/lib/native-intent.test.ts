import { describe, expect, it } from 'vitest';
import { redirectSystemPath } from '../../app/+native-intent';

describe('native intent redirects', () => {
  it('routes inbox segments and employee pages', () => {
    expect(redirectSystemPath({
      path: 'carina://inbox/escalations',
      initial: true,
    })).toBe('/(tabs)/inbox?segment=escalations');
    expect(redirectSystemPath({
      path: 'carina://employee/worker%201/tasks',
      initial: false,
    })).toBe('/employee/worker%25201/tasks');
  });

  it('routes approvals and preserves unknown links', () => {
    expect(redirectSystemPath({
      path: 'carina://approval/email/approval-1',
      initial: true,
    })).toBe('/approval/email/approval-1');
    expect(redirectSystemPath({
      path: 'https://example.com/unknown',
      initial: true,
    })).toBe('https://example.com/unknown');
  });
});
