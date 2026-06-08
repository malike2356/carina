import { describe, expect, it } from 'vitest';
import { _resetShieldReportCounters, buildShieldReport } from './shield-report.js';

describe('buildShieldReport', () => {
  it('generates the standard blocked message and ref format', async () => {
    _resetShieldReportCounters();
    const db = { query: async () => { throw new Error('offline'); } };

    const report = await buildShieldReport(
      { layer: 1, confidence: 95, patterns: ['ignore-previous-instructions'] },
      db,
      new Date('2026-06-07T12:00:00Z'),
    );

    expect(report.ref).toBe('SHIELD-2026-06-07-001');
    expect(report.message).toBe(
      "I'm unable to process that request. Security shield detected a potential prompt injection attempt. This incident has been logged. (Ref: SHIELD-2026-06-07-001)",
    );
  });

  it('generates unique refs across calls on the same day', async () => {
    _resetShieldReportCounters();
    const db = { query: async () => { throw new Error('offline'); } };

    const first = await buildShieldReport(
      { layer: 2, confidence: 85, patterns: ['judge'] },
      db,
      new Date('2026-06-07T12:00:00Z'),
    );
    const second = await buildShieldReport(
      { layer: 3, confidence: 90, patterns: ['tool'] },
      db,
      new Date('2026-06-07T12:01:00Z'),
    );

    expect(first.ref).toBe('SHIELD-2026-06-07-001');
    expect(second.ref).toBe('SHIELD-2026-06-07-002');
  });
});
