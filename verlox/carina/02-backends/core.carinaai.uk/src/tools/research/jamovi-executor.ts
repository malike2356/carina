import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatJamoviAsApa, type JamoviAnalysisPayload } from './jamovi-format.js';
import { resolveResearchAsset } from './research-paths.js';

const CLIENT_PY = resolveResearchAsset('jamovi-client.py');

export type JamoviAnalysisType =
  | 'descriptive'
  | 'ttest_independent'
  | 'ttest_paired'
  | 'ttest_one_sample'
  | 'anova'
  | 'anova_repeated'
  | 'ancova'
  | 'chi_square'
  | 'correlation'
  | 'regression_linear'
  | 'regression_logistic'
  | 'nonparametric_mann_whitney'
  | 'nonparametric_wilcoxon'
  | 'nonparametric_kruskal_wallis'
  | 'factor'
  | 'reliability';

export type JamoviOutputFormat = 'text' | 'json' | 'apa';

export interface JamoviAvailability {
  running: boolean;
  url?: string | null;
  datasetCount?: number;
  jmvAvailable?: boolean;
  error?: string;
}

export interface JamoviExecuteRequest {
  dataFile: string;
  analysisType: JamoviAnalysisType;
  variables: string[];
  groupBy?: string;
  dependentVar?: string;
  covariates?: string[];
  options?: Record<string, unknown>;
  jamoviUrl?: string;
  outputFormat?: JamoviOutputFormat;
}

const ANALYSIS_TYPES = new Set<JamoviAnalysisType>([
  'descriptive',
  'ttest_independent',
  'ttest_paired',
  'ttest_one_sample',
  'anova',
  'anova_repeated',
  'ancova',
  'chi_square',
  'correlation',
  'regression_linear',
  'regression_logistic',
  'nonparametric_mann_whitney',
  'nonparametric_wilcoxon',
  'nonparametric_kruskal_wallis',
  'factor',
  'reliability',
]);

const UNSAFE_PATH = /[;|`$&<>(){}[\]!#*?~\n\r\0]/;

function runPython(args: string[]): string {
  return execFileSync('python3', [CLIENT_PY, ...args], {
    encoding: 'utf-8',
    timeout: 130_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function assertSafePath(filePath: string, label: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (UNSAFE_PATH.test(trimmed)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return resolve(trimmed);
}

export function checkJamovi(jamoviUrl?: string): JamoviAvailability {
  try {
    const args = ['check'];
    if (jamoviUrl) args.push('--url', jamoviUrl);
    return JSON.parse(runPython(args)) as JamoviAvailability;
  } catch (err) {
    return {
      running: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseJamoviParams(params: Record<string, unknown>): JamoviExecuteRequest {
  const analysisType = String(params.analysisType ?? '').trim() as JamoviAnalysisType;
  if (!ANALYSIS_TYPES.has(analysisType)) {
    throw new Error(`analysisType must be one of: ${[...ANALYSIS_TYPES].join(', ')}`);
  }

  const variables = Array.isArray(params.variables)
    ? params.variables.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (variables.length === 0) {
    throw new Error('variables is required');
  }

  const outputFormat = params.outputFormat;
  const format: JamoviOutputFormat =
    outputFormat === 'text' || outputFormat === 'json' || outputFormat === 'apa'
      ? outputFormat
      : 'apa';

  let options: Record<string, unknown> | undefined;
  if (params.options && typeof params.options === 'object' && !Array.isArray(params.options)) {
    options = params.options as Record<string, unknown>;
  }

  return {
    dataFile: String(params.dataFile ?? ''),
    analysisType,
    variables,
    groupBy: params.groupBy ? String(params.groupBy).trim() : undefined,
    dependentVar: params.dependentVar ? String(params.dependentVar).trim() : undefined,
    covariates: Array.isArray(params.covariates)
      ? params.covariates.map((v) => String(v).trim()).filter(Boolean)
      : undefined,
    options,
    jamoviUrl: params.jamoviUrl ? String(params.jamoviUrl).trim() : undefined,
    outputFormat: format,
  };
}

export async function executeJamoviAnalysis(params: JamoviExecuteRequest): Promise<unknown> {
  const availability = checkJamovi(params.jamoviUrl);
  if (!availability.jmvAvailable) {
    return {
      error:
        "R package 'jmv' is not available. Install R and run install.packages(c('jmv', 'haven', 'jsonlite')).",
      jamovi: availability,
      fallback: 'Use pspp_analyze or Python stats tools instead.',
    };
  }

  const dataFile = assertSafePath(params.dataFile, 'dataFile');
  if (!existsSync(dataFile)) {
    return { error: `Data file not found: ${dataFile}` };
  }

  const args = [
    'run',
    '--data',
    dataFile,
    '--analysis',
    params.analysisType,
    '--variables',
    params.variables.join(','),
  ];
  if (params.jamoviUrl) args.push('--url', params.jamoviUrl);
  if (params.groupBy) args.push('--group-by', params.groupBy);
  if (params.dependentVar) args.push('--dependent', params.dependentVar);
  if (params.covariates?.length) args.push('--covariates', params.covariates.join(','));
  if (params.options) args.push('--options', JSON.stringify(params.options));

  try {
    const stdout = runPython(args);
    const parsed = JSON.parse(stdout) as JamoviAnalysisPayload;

    if (parsed.error) {
      return {
        error: parsed.error,
        jamovi: parsed.jamovi ?? availability,
      };
    }

    if (params.outputFormat === 'json') {
      return parsed;
    }

    if (params.outputFormat === 'apa') {
      return {
        success: true,
        format: 'apa',
        markdown: formatJamoviAsApa(parsed, {
          dataFile,
          analysisType: params.analysisType,
          variables: params.variables,
        }),
        tableCount: parsed.tables?.length ?? 0,
        jamovi: parsed.jamovi ?? availability,
      };
    }

    return {
      success: true,
      format: 'text',
      tableCount: parsed.tables?.length ?? 0,
      analysisType: parsed.analysisType,
      jamovi: parsed.jamovi ?? availability,
    };
  } catch (err) {
    return {
      error: `Jamovi execution failed: ${err instanceof Error ? err.message : String(err)}`,
      jamovi: availability,
    };
  }
}
