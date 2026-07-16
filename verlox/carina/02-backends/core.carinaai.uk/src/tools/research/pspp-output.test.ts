import { describe, expect, it } from 'vitest';
import { formatAsApa, parsePsppOutput } from './pspp-output.js';

const SAMPLE_OUTPUT = `
Note: Processing complete.

==============================
Descriptive Statistics
==============================
Variable    Mean    Std Dev
age         25.3    4.1
income      42.1    8.2
==============================

Warning: 2 cases had missing values.
`;

describe('parsePsppOutput', () => {
  it('extracts notes, warnings, and tables', () => {
    const parsed = parsePsppOutput(SAMPLE_OUTPUT);

    expect(parsed.notes).toHaveLength(1);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.tables).toHaveLength(1);
    expect(parsed.tables[0]?.title).toBe('Descriptive Statistics');
    expect(parsed.tables[0]?.rows[0]).toEqual(['Variable', 'Mean', 'Std Dev']);
  });
});

describe('formatAsApa', () => {
  it('renders markdown tables from parsed output', () => {
    const parsed = parsePsppOutput(SAMPLE_OUTPUT);
    const markdown = formatAsApa(parsed, {
      dataFile: '/data/sample.sav',
      analysisType: 'descriptive',
      variables: ['age', 'income'],
    });

    expect(markdown).toContain('# Statistical Analysis Results');
    expect(markdown).toContain('**Analysis type:** descriptive');
    expect(markdown).toContain('| Variable | Mean | Std Dev |');
    expect(markdown).toContain('**Warnings:**');
  });
});
