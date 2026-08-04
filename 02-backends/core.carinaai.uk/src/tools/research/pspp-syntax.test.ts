import { describe, expect, it } from 'vitest';
import { generateSyntax } from './pspp-syntax.js';

describe('generateSyntax', () => {
  it('builds descriptive analysis syntax', () => {
    const syntax = generateSyntax({
      dataFile: '/data/sample.sav',
      analysisType: 'descriptive',
      variables: ['age', 'income'],
    });

    expect(syntax).toContain("GET FILE='/data/sample.sav'.");
    expect(syntax).toContain('DESCRIPTIVES VARIABLES=age income');
    expect(syntax).toContain('FREQUENCIES VARIABLES=age income');
  });

  it('escapes single quotes in data file paths', () => {
    const syntax = generateSyntax({
      dataFile: "/data/user's/file.sav",
      analysisType: 'correlation',
      variables: ['x', 'y'],
    });

    expect(syntax).toContain("GET FILE='/data/user''s/file.sav'.");
  });

  it('builds t-test syntax with effect size option', () => {
    const syntax = generateSyntax({
      dataFile: '/data/sample.sav',
      analysisType: 'ttest',
      variables: ['score'],
      groupBy: 'group',
      options: { effectSize: true },
    });

    expect(syntax).toContain('T-TEST GROUPS=group(1,2)');
    expect(syntax).toContain('/VARIABLES=score');
    expect(syntax).toContain('/CRITERIA=CI(.95).');
  });

  it('builds ANOVA syntax with Tukey post-hoc', () => {
    const syntax = generateSyntax({
      dataFile: '/data/sample.sav',
      analysisType: 'anova',
      variables: ['score'],
      groupBy: 'condition',
      options: { posthoc: 'tukey', effectSize: true },
    });

    expect(syntax).toContain('ONEWAY score BY condition');
    expect(syntax).toContain('/POSTHOC=TUKEY ALPHA(0.05).');
    expect(syntax).toContain('/STATISTICS EFFECTS.');
  });

  it('builds regression syntax', () => {
    const syntax = generateSyntax({
      dataFile: '/data/sample.sav',
      analysisType: 'regression',
      dependentVar: 'y',
      independentVars: ['x1', 'x2'],
    });

    expect(syntax).toContain('/DEPENDENT y');
    expect(syntax).toContain('/METHOD=ENTER x1 x2.');
  });
});
