import { describe, expect, it } from 'vitest';
import { redactText, deriveFixturesFromExamples, exampleToFixture } from './derive-fixtures.js';

describe('derive fixtures', () => {
  it('redacts email and phone patterns', () => {
    const redacted = redactText('Contact user@example.com or 555-123-4567');
    expect(redacted).not.toContain('user@example.com');
    expect(redacted).toContain('[email-redacted]');
  });

  it('derives fixtures from usage examples', () => {
    const fixtures = deriveFixturesFromExamples([
      { query: 'update notion page', matchedSkill: 'notion-workspace', toolsUsed: ['http-request'] },
    ]);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].assertions.some((a) => a.type === 'skill_match')).toBe(true);
  });

  it('rejects sensitive content in derived fixtures', () => {
    expect(() => exampleToFixture(
      { query: 'password=supersecret123 here' },
      0,
    )).toThrow(/Sensitive pattern/);
  });
});
