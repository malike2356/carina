import { describe, expect, it } from 'vitest';
import {
  evaluateResearchQuality,
  passesResearchQualityGate,
  researchQualityThreshold,
} from './research-quality-gate.js';
import type { DeepResearchReport } from './deep-research.js';

function sampleReport(overrides: Partial<DeepResearchReport> = {}): DeepResearchReport {
  return {
    title: 'Sample',
    summary: 'This is a sufficiently long executive summary for the quality gate.',
    sections: [
      { heading: 'One', body: 'First section with enough content to pass the body length check easily.', sourceCitations: ['src-1'] },
      { heading: 'Two', body: 'Second section with enough content to pass the body length check easily.', sourceCitations: ['src-2'] },
      { heading: 'Three', body: 'Third section with enough content to pass the body length check easily.', sourceCitations: ['src-1'] },
    ],
    sources: [
      { id: 'src-1', title: 'A', url: 'https://example.com/a', snippet: 'x'.repeat(100), fetchedAt: '2026-01-01T00:00:00Z', verified: true },
      { id: 'src-2', title: 'B', url: 'https://example.com/b', snippet: 'y'.repeat(100), fetchedAt: '2026-01-01T00:00:00Z', verified: true },
    ],
    searchQueries: ['q1'],
    roundCount: 1,
    generatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('research-quality-gate', () => {
  it('passes a well-formed report', () => {
    const result = evaluateResearchQuality(sampleReport());
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(researchQualityThreshold());
    expect(result.reasons).toHaveLength(0);
    expect(passesResearchQualityGate(sampleReport())).toBe(true);
  });

  it('fails when summary is too short', () => {
    const result = evaluateResearchQuality(sampleReport({ summary: 'Short.' }));
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('summary too short');
  });

  it('fails when sections are missing', () => {
    const result = evaluateResearchQuality(sampleReport({ sections: [{ heading: 'Only', body: 'one', sourceCitations: [] }] }));
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('sections'))).toBe(true);
  });

  it('fails when sources are missing instead of awarding citation points', () => {
    const result = evaluateResearchQuality(sampleReport({
      sources: [],
      sections: [
        { heading: 'One', body: 'First section with enough content to pass the body length check easily.', sourceCitations: [] },
        { heading: 'Two', body: 'Second section with enough content to pass the body length check easily.', sourceCitations: [] },
        { heading: 'Three', body: 'Third section with enough content to pass the body length check easily.', sourceCitations: [] },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('need at least 2 sources');
    expect(result.score).toBeLessThan(researchQualityThreshold());
  });

  it('fails unfinished agent preamble reports', () => {
    const result = evaluateResearchQuality(sampleReport({
      summary: 'Summary unavailable.',
      sections: [
        { heading: 'Findings', body: 'I’ll start by researching the topic thoroughly before writing the report.', sourceCitations: [] },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('summary') || r.includes('preamble') || r.includes('sources'))).toBe(true);
  });
});
