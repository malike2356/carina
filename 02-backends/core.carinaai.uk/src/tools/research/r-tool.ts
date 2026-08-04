import type { Tool } from '../../types/index.js';
import { executeRAnalysis, parseRParams } from './r-executor.js';

export const rAnalyzeTool: Tool = {
  name: 'r_analyze',
  description:
    'Run statistical analysis using R (haven + broom). Generates and executes an R script via Rscript. ' +
    'Supports descriptive, t-test, ANOVA, correlation, regression, chi-square, factor, and reliability.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string', description: 'Path to .sav or .csv file' },
      analysisType: {
        type: 'string',
        enum: [
          'descriptive',
          'ttest',
          'anova',
          'correlation',
          'regression',
          'chi-square',
          'factor',
          'reliability',
        ],
      },
      variables: { type: 'array', items: { type: 'string' } },
      groupBy: { type: 'string' },
      dependentVar: { type: 'string' },
      independentVars: { type: 'array', items: { type: 'string' } },
      outputFormat: { type: 'string', enum: ['text', 'json', 'apa'], default: 'apa' },
    },
    required: ['dataFile', 'analysisType', 'variables'],
  },
  execute: async (params) => {
    try {
      return await executeRAnalysis(parseRParams(params));
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
