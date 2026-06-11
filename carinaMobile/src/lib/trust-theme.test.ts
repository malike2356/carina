import { describe, expect, it } from 'vitest';
import { riskTierColor, severityColor } from './trust-theme';
import { colors } from '@/theme/tokens';

describe('trust-theme', () => {
  it('maps risk tiers to palette colors', () => {
    expect(riskTierColor('low')).toBe(colors.success);
    expect(riskTierColor('critical')).toBe(colors.danger);
  });

  it('maps severities to palette colors', () => {
    expect(severityColor('warning')).toBe(colors.amber);
    expect(severityColor('info')).toBe(colors.tealLight);
  });
});
