import { describe, expect, it } from 'vitest';
import { redirectSystemPath } from '../../app/+native-intent';

describe('redirectSystemPath', () => {
  it('maps inbox escalations deep link to inbox escalations page', () => {
    expect(
      redirectSystemPath({ path: 'carina://inbox/escalations', initial: false }),
    ).toBe('/(tabs)/inbox/escalations');
  });

  it('maps governance deep link', () => {
    expect(redirectSystemPath({ path: 'carina://governance', initial: false })).toBe(
      '/governance',
    );
  });

  it('maps employee settings deep link to worker detail', () => {
    expect(
      redirectSystemPath({
        path: 'carina://employee/abc/settings',
        initial: false,
      }),
    ).toBe('/employee/abc');
  });

  it('maps hire deep link', () => {
    expect(redirectSystemPath({ path: 'carina://hire', initial: false })).toBe('/hire');
  });
});
