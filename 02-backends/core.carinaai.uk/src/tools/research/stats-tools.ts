import type { Tool } from '../../types/index.js';
import {
  checkStatsDependencies,
  formatGenericApa,
  formatStatsAsApa,
  runStatsAnalysis,
  type StatsAnalysisCommand,
} from './stats-executor.js';

function parseVariables(params: Record<string, unknown>): string[] {
  const variables = Array.isArray(params.variables)
    ? params.variables.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (variables.length === 0) {
    throw new Error('variables is required');
  }
  return variables;
}

function parseFile(params: Record<string, unknown>): string {
  const file = String(params.dataFile ?? params.file ?? '').trim();
  if (!file) throw new Error('dataFile or file is required');
  return file;
}

async function runAnalysisTool(
  params: Record<string, unknown>,
  analysis: StatsAnalysisCommand,
  options?: { requireGroupBy?: boolean; requireDependent?: boolean },
): Promise<unknown> {
  const deps = checkStatsDependencies();
  if (!deps.pandas || !deps.scipy || !deps.statsmodels) {
    return {
      error: 'Python stats stack missing. Run: pip install -r src/tools/research/requirements.txt',
      dependencies: deps,
    };
  }

  const file = parseFile(params);
  const variables = parseVariables(params);
  const groupBy = params.groupBy ? String(params.groupBy).trim() : undefined;
  const dependent = params.dependentVar
    ? String(params.dependentVar).trim()
    : params.dependent
      ? String(params.dependent).trim()
      : undefined;

  if (options?.requireGroupBy && !groupBy) {
    return { error: 'groupBy is required' };
  }
  if (options?.requireDependent && !dependent) {
    return { error: 'dependentVar is required' };
  }

  const payload = runStatsAnalysis({
    analysis,
    file,
    variables,
    groupBy,
    dependent,
    method: params.method === 'spearman' ? 'spearman' : 'pearson',
    regressionType:
      params.regressionType === 'logistic' || params.analysisType === 'logistic'
        ? 'logistic'
        : 'linear',
  });

  if (payload.error) {
    return { error: payload.error, analysis };
  }

  const outputFormat = params.outputFormat === 'json' ? 'json' : 'apa';
  if (outputFormat === 'json') {
    return { success: true, ...payload };
  }

  return {
    success: true,
    analysis,
    markdown: formatStatsAsApa(analysis, payload.results),
    results: payload.results,
  };
}

export const statsDescribeTool: Tool = {
  name: 'stats_describe',
  description: 'Run descriptive statistics (mean, SD, median, skew, kurtosis) on .sav or .csv data.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string', description: 'Alias for dataFile' },
      variables: { type: 'array', items: { type: 'string' } },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables'],
  },
  execute: (params) => runAnalysisTool(params, 'descriptive'),
};

export const statsNormalityTool: Tool = {
  name: 'stats_normality',
  description: 'Run Shapiro-Wilk or Kolmogorov-Smirnov normality tests for numeric variables.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: { type: 'array', items: { type: 'string' } },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables'],
  },
  execute: (params) => runAnalysisTool(params, 'normality'),
};

export const statsCompareGroupsTool: Tool = {
  name: 'stats_compare_groups',
  description:
    'Compare groups with t-test, ANOVA, Mann-Whitney U, or Kruskal-Wallis, including effect sizes where applicable.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: { type: 'array', items: { type: 'string' } },
      groupBy: { type: 'string' },
      analysisType: {
        type: 'string',
        enum: ['ttest', 'anova', 'mann_whitney', 'kruskal_wallis'],
        default: 'ttest',
      },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables', 'groupBy'],
  },
  execute: async (params) => {
    const raw = String(params.analysisType ?? 'ttest').trim();
    const analysis: StatsAnalysisCommand =
      raw === 'anova'
        ? 'anova'
        : raw === 'mann_whitney'
          ? 'mann_whitney'
          : raw === 'kruskal_wallis'
            ? 'kruskal_wallis'
            : 'ttest';
    return runAnalysisTool(params, analysis, { requireGroupBy: true });
  },
};

export const statsCorrelationTool: Tool = {
  name: 'stats_correlation',
  description: 'Compute Pearson or Spearman correlation coefficients with p-values.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: { type: 'array', items: { type: 'string' } },
      method: { type: 'string', enum: ['pearson', 'spearman'], default: 'pearson' },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables'],
  },
  execute: (params) => runAnalysisTool(params, 'correlation'),
};

export const statsRegressionTool: Tool = {
  name: 'stats_regression',
  description: 'Run linear or logistic regression with coefficients and significance tests.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: { type: 'array', items: { type: 'string' }, description: 'Independent variables' },
      dependentVar: { type: 'string' },
      regressionType: { type: 'string', enum: ['linear', 'logistic'], default: 'linear' },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables', 'dependentVar'],
  },
  execute: (params) => runAnalysisTool(params, 'regression', { requireDependent: true }),
};

export const statsChiSquareTool: Tool = {
  name: 'stats_chi_square',
  description: 'Chi-square test of independence for two categorical variables with Cramer V.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exactly two categorical variables',
      },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables'],
  },
  execute: (params) => runAnalysisTool(params, 'chi_square'),
};

export const statsPosthocTool: Tool = {
  name: 'stats_posthoc',
  description: 'Tukey HSD post-hoc comparisons after a significant ANOVA.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      file: { type: 'string' },
      variables: { type: 'array', items: { type: 'string' }, description: 'Dependent variable' },
      groupBy: { type: 'string' },
      outputFormat: { type: 'string', enum: ['apa', 'json'] },
    },
    required: ['variables', 'groupBy'],
  },
  execute: (params) => runAnalysisTool(params, 'posthoc', { requireGroupBy: true }),
};

export const apaFormatTool: Tool = {
  name: 'apa_format',
  description: 'Format structured statistical results as APA-style markdown tables.',
  parameters: {
    type: 'object',
    properties: {
      analysisType: { type: 'string' },
      results: { type: 'object', description: 'Structured analysis output to format' },
      payload: { type: 'object', description: 'Alternative wrapper with analysisType and results' },
    },
    required: ['results'],
  },
  execute: async (params) => {
    const payload = {
      analysisType: String(params.analysisType ?? 'results'),
      results: params.results ?? params.payload,
    };
    return {
      success: true,
      markdown: formatGenericApa(payload as Record<string, unknown>),
    };
  },
};

export const STATS_TOOLS = [
  statsDescribeTool,
  statsCompareGroupsTool,
  statsCorrelationTool,
  statsRegressionTool,
  statsChiSquareTool,
  statsNormalityTool,
  statsPosthocTool,
  apaFormatTool,
] as const;
