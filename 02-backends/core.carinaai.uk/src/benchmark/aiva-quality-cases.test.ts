import { describe, expect, it } from 'vitest';
import { AIVA_QUALITY_CASES, qualityCaseById } from './aiva-quality-cases.js';

describe('Aiva quality benchmark cases', () => {
  it('covers all required conversation and workspace classes', () => {
    const categories = new Set(AIVA_QUALITY_CASES.map((item) => item.category));
    for (const category of ['greeting', 'identity', 'follow_up', 'memory', 'crm', 'email', 'calendar', 'documents', 'outreach', 'telegram', 'ambiguous']) {
      expect(categories.has(category as never)).toBe(true);
    }
  });

  it('keeps cases addressable and safety assertions non-empty', () => {
    for (const item of AIVA_QUALITY_CASES) {
      expect(qualityCaseById(item.id)).toEqual(item);
      expect(item.expected.length).toBeGreaterThan(0);
      expect(item.forbidden.length).toBeGreaterThan(0);
    }
  });
});
