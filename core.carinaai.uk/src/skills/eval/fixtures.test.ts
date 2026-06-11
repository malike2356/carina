import { describe, expect, it } from 'vitest';
import { validateEvalDefinition, validateFixture, scanForSensitive } from './fixtures.js';

describe('fixture parsing', () => {
  it('parses a valid eval definition', () => {
    const def = validateEvalDefinition({
      version: '1',
      pack: 'test-pack',
      thresholds: { minPassRate: 0.9 },
      fixtures: [{
        id: 'f1',
        input: { query: 'help with notion' },
        assertions: [{ type: 'skill_match', skill: 'notion-workspace' }],
      }],
    });
    expect(def.pack).toBe('test-pack');
    expect(def.fixtures).toHaveLength(1);
    expect(def.thresholds?.minPassRate).toBe(0.9);
  });

  it('rejects empty fixtures array', () => {
    expect(() => validateEvalDefinition({ version: '1', fixtures: [] }))
      .toThrow(/non-empty fixtures/);
  });

  it('rejects fixture without query', () => {
    expect(() => validateFixture({ id: 'x', input: {}, assertions: [{ type: 'contains', value: 'a' }] }, 0))
      .toThrow(/input.query is required/);
  });

  it('rejects unknown assertion type', () => {
    expect(() => validateFixture({
      id: 'x',
      input: { query: 'test query here' },
      assertions: [{ type: 'unknown_type' }],
    }, 0)).toThrow(/unknown assertion type/);
  });

  it('rejects sensitive patterns in fixtures', () => {
    expect(() => scanForSensitive('my key is sk-123456789012345678901234567890', 'test'))
      .toThrow(/Sensitive pattern/);
  });
});
