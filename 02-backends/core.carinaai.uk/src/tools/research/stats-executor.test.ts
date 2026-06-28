import { describe, expect, it } from 'vitest';
import { formatGenericApa, formatStatsAsApa } from './stats-executor.js';

describe('formatStatsAsApa', () => {
  it('formats array results as markdown table', () => {
    const markdown = formatStatsAsApa('descriptive', [
      { variable: 'age', mean: 25.3, std: 4.1 },
    ]);
    expect(markdown).toContain('| variable | mean | std |');
    expect(markdown).toContain('25.3');
  });

  it('formats regression output', () => {
    const markdown = formatStatsAsApa('regression', {
      dependent: 'score',
      r_squared: 0.42,
      adj_r_squared: 0.39,
      f_statistic: 8.1,
      f_p_value: 0.002,
      coefficients: [
        { variable: 'const', coefficient: 1.2, p_value: 0.01 },
      ],
    });
    expect(markdown).toContain('**Dependent variable:** score');
    expect(markdown).toContain('| variable | coefficient | p_value |');
  });
});

describe('formatGenericApa', () => {
  it('wraps payload with analysis type', () => {
    const markdown = formatGenericApa({
      analysisType: 'correlation',
      results: [{ var1: 'x', var2: 'y', correlation: 0.5 }],
    });
    expect(markdown).toContain('**Analysis:** correlation');
  });
});
