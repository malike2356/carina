import type { Tool } from '../../types/index.js';
import { executePsppAnalysis, parsePsppParams } from './pspp-executor.js';

export const psppAnalyzeTool: Tool = {
  name: 'pspp_analyze',
  description:
    'Run statistical analysis using PSPP (free SPSS clone). ' +
    'Generates SPSS syntax, executes PSPP, parses output, returns APA-formatted results. ' +
    'Supports: descriptive, t-test, ANOVA, chi-square, correlation, regression, nonparametric, factor analysis.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string', description: 'Path to .sav or .csv data file' },
      analysisType: {
        type: 'string',
        enum: [
          'descriptive',
          'ttest',
          'anova',
          'chi-square',
          'correlation',
          'regression',
          'nonparametric',
          'factor',
        ],
      },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variables to analyse',
      },
      groupBy: { type: 'string', description: 'Grouping variable for t-test/ANOVA' },
      dependentVar: { type: 'string', description: 'Dependent variable for regression' },
      independentVars: {
        type: 'array',
        items: { type: 'string' },
        description: 'Independent variables for regression',
      },
      options: {
        type: 'object',
        properties: {
          posthoc: { type: 'string', enum: ['bonferroni', 'tukey', 'none'] },
          normality: { type: 'boolean' },
          effectSize: { type: 'boolean' },
        },
      },
      outputFormat: { type: 'string', enum: ['text', 'json', 'apa'], default: 'apa' },
    },
    required: ['dataFile', 'analysisType'],
  },
  execute: async (params) => {
    try {
      const request = parsePsppParams(params);
      return await executePsppAnalysis(request);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
