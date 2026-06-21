import { describe, it, expect } from 'vitest';
import { secretsAuditTool } from './secrets-audit-tool.js';

describe('secrets-audit tool', () => {
  it('returns a structured audit report without secret values', async () => {
    const result = await secretsAuditTool.execute({}) as {
      summary: { ok: number; warn: number; fail: number };
      findings: Array<{ key: string; severity: string }>;
      generated_at: string;
    };
    expect(result.generated_at).toBeTruthy();
    expect(result.summary).toMatchObject({
      ok: expect.any(Number),
      warn: expect.any(Number),
      fail: expect.any(Number),
    });
    expect(Array.isArray(result.findings)).toBe(true);
    for (const finding of result.findings) {
      expect(finding).toHaveProperty('key');
      expect(finding).toHaveProperty('severity');
      expect(finding).not.toHaveProperty('value');
    }
  });
});
