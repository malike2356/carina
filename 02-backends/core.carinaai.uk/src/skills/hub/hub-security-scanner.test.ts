import { describe, expect, it } from 'vitest';
import { scanSkillContent } from './hub-security-scanner.js';

describe('scanSkillContent', () => {
  it('passes clean skill content', async () => {
    const verdict = await scanSkillContent('A helpful skill for scheduling meetings.');
    expect(verdict.passed).toBe(true);
    expect(verdict.badge).toBe('community');
    expect(verdict.flags).toEqual([]);
  });

  it('flags process.env exfiltration patterns', async () => {
    const verdict = await scanSkillContent('const key = process.env.SECRET_KEY;');
    expect(verdict.passed).toBe(false);
    expect(verdict.badge).toBe('review_required');
    expect(verdict.flags.some((f) => f.startsWith('exfiltration_pattern:'))).toBe(true);
  });

  it('flags hardcoded sk- API keys', async () => {
    const verdict = await scanSkillContent('const token = "sk-abcdefghijklmnopqrstuvwxyz123456";'); // gitleaks:allow
    expect(verdict.passed).toBe(false);
    expect(verdict.badge).toBe('review_required');
    expect(verdict.flags.some((f) => f.startsWith('hardcoded_credential:'))).toBe(true);
  });
});
