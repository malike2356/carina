import { describe, it, expect } from 'vitest';
import { mapVendorSeverity, meetsMinSeverity } from '../severity-map.js';

describe('severity-map', () => {
  it('maps Scout severity to SentinelOne severity', () => {
    expect(mapVendorSeverity('sentinelone', 'critical')).toBe('Critical');
    expect(mapVendorSeverity('sentinelone', 'info')).toBe('Suspicious');
  });

  it('evaluates minimum severity thresholds', () => {
    expect(meetsMinSeverity('critical', 'high')).toBe(true);
    expect(meetsMinSeverity('low', 'high')).toBe(false);
  });
});
