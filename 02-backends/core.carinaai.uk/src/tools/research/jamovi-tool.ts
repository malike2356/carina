import type { Tool } from '../../types/index.js';
import { executeJamoviAnalysis, parseJamoviParams } from './jamovi-executor.js';

export const jamoviAnalyzeTool: Tool = {
  name: 'jamovi_analyze',
  description:
    'Run statistical analysis using Jamovi/jmv. Discovers a running Jamovi session via jmvconnect ' +
    '(/api/datasets) and executes analyses through the R jmv package on a local .sav or .csv file. ' +
    'Returns APA-formatted results. Supports descriptive, t-tests, ANOVA, chi-square, correlation, ' +
    'regression, factor analysis, and reliability.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string', description: 'Path to .sav or .csv file' },
      analysisType: {
        type: 'string',
        enum: [
          'descriptive',
          'ttest_independent',
          'ttest_paired',
          'ttest_one_sample',
          'anova',
          'chi_square',
          'correlation',
          'regression_linear',
          'regression_logistic',
          'factor',
          'reliability',
          'nonparametric_mann_whitney',
          'nonparametric_wilcoxon',
          'nonparametric_kruskal_wallis',
        ],
      },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variables to analyse',
      },
      groupBy: { type: 'string', description: 'Grouping variable for t-test/ANOVA' },
      dependentVar: { type: 'string', description: 'Dependent variable for regression' },
      covariates: {
        type: 'array',
        items: { type: 'string' },
        description: 'Covariates for regression',
      },
      options: { type: 'object' },
      jamoviUrl: { type: 'string', description: 'Override Jamovi base URL (optional)' },
      outputFormat: { type: 'string', enum: ['text', 'json', 'apa'], default: 'apa' },
    },
    required: ['dataFile', 'analysisType', 'variables'],
  },
  execute: async (params) => {
    try {
      const request = parseJamoviParams(params);
      return await executeJamoviAnalysis(request);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
