import { describe, expect, it } from 'vitest';
import { runSecurityAudit } from './security-audit.js';

describe('security-audit', () => {
  it('returns structured report', async () => {
    const report = await runSecurityAudit();
    expect(report.checks.length).toBeGreaterThan(5);
    expect(report.summary.ok + report.summary.warn + report.summary.fail).toBe(report.checks.length);
    expect(report.checks.some((c) => c.id === 'prompt-guard')).toBe(true);
  });
});
