import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveResearchAsset } from './research-paths.js';

const STATS_PY = resolveResearchAsset('stats-analysis.py');

export type StatsAnalysisCommand =
  | 'descriptive'
  | 'normality'
  | 'ttest'
  | 'mann_whitney'
  | 'anova'
  | 'kruskal_wallis'
  | 'correlation'
  | 'regression'
  | 'chi_square'
  | 'posthoc';

export interface StatsAnalysisPayload {
  analysis?: string;
  results?: unknown;
  error?: string;
}

export interface StatsDependencies {
  numpy?: boolean;
  pandas?: boolean;
  scipy?: boolean;
  statsmodels?: boolean;
  pyreadstat?: boolean;
  error?: string;
}

const UNSAFE_PATH = /[;|`$&<>(){}[\]!#*?~\n\r\0]/;

function runStatsPython(args: string[]): string {
  return execFileSync('python3', [STATS_PY, ...args], {
    encoding: 'utf-8',
    timeout: 90_000,
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

export function checkStatsDependencies(): StatsDependencies {
  try {
    return JSON.parse(runStatsPython(['deps'])) as StatsDependencies;
  } catch (err) {
    return {
      numpy: false,
      pandas: false,
      scipy: false,
      statsmodels: false,
      pyreadstat: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function runStatsAnalysis(params: {
  analysis: StatsAnalysisCommand;
  file: string;
  variables: string[];
  groupBy?: string;
  dependent?: string;
  method?: 'pearson' | 'spearman';
  regressionType?: 'linear' | 'logistic';
}): StatsAnalysisPayload {
  const file = assertSafePath(params.file, 'file');
  if (!existsSync(file)) {
    return { error: `Data file not found: ${file}` };
  }

  const args = [
    'run',
    '--analysis',
    params.analysis,
    '--file',
    file,
    '--variables',
    params.variables.join(','),
  ];
  if (params.groupBy) args.push('--group-by', params.groupBy);
  if (params.dependent) args.push('--dependent', params.dependent);
  if (params.method) args.push('--method', params.method);
  if (params.regressionType) args.push('--regression-type', params.regressionType);

  const payload = JSON.parse(runStatsPython(args)) as StatsAnalysisPayload;
  const results = payload.results;
  if (results && typeof results === 'object' && results !== null && 'error' in results) {
    return { error: String((results as { error: string }).error), analysis: params.analysis };
  }
  return payload;
}

export function formatStatsAsApa(analysis: string, results: unknown): string {
  const lines = ['# Statistical Analysis Results (Python)', '', `**Analysis:** ${analysis}`, ''];

  if (Array.isArray(results)) {
    if (results.length === 0) {
      lines.push('_No results returned._');
      return lines.join('\n');
    }

    const columns = Object.keys(results[0] as Record<string, unknown>);
    lines.push(`| ${columns.join(' | ')} |`);
    lines.push(`|${columns.map(() => '---').join('|')}|`);
    for (const row of results) {
      const record = row as Record<string, unknown>;
      lines.push(`| ${columns.map((col) => String(record[col] ?? '')).join(' | ')} |`);
    }
    return lines.join('\n');
  }

  if (results && typeof results === 'object') {
    const record = results as Record<string, unknown>;
    if (Array.isArray(record.comparisons)) {
      lines.push(`**Variable:** ${record.variable ?? ''}`);
      lines.push(`**Method:** ${record.method ?? 'tukey'}`, '');
      const comparisons = record.comparisons as Array<Record<string, unknown>>;
      const columns = Object.keys(comparisons[0] ?? {});
      lines.push(`| ${columns.join(' | ')} |`);
      lines.push(`|${columns.map(() => '---').join('|')}|`);
      for (const row of comparisons) {
        lines.push(`| ${columns.map((col) => String(row[col] ?? '')).join(' | ')} |`);
      }
      return lines.join('\n');
    }

    if (Array.isArray(record.coefficients)) {
      const isLogistic = record.regression_type === 'logistic';
      lines.push(`**Dependent variable:** ${record.dependent ?? ''}`);
      if (isLogistic) {
        lines.push(
          `**Model:** logistic; **Pseudo R²:** ${record.pseudo_r_squared ?? ''}; ` +
            `**LLR p:** ${record.llr_p_value ?? ''}`,
          '',
        );
      } else {
        lines.push(
          `**R²:** ${record.r_squared ?? ''}; **Adj. R²:** ${record.adj_r_squared ?? ''}; ` +
            `**F:** ${record.f_statistic ?? ''}, *p* = ${record.f_p_value ?? ''}`,
          '',
        );
      }
      const coefficients = record.coefficients as Array<Record<string, unknown>>;
      const columns = Object.keys(coefficients[0] ?? {});
      lines.push(`| ${columns.join(' | ')} |`);
      lines.push(`|${columns.map(() => '---').join('|')}|`);
      for (const row of coefficients) {
        lines.push(`| ${columns.map((col) => String(row[col] ?? '')).join(' | ')} |`);
      }
      return lines.join('\n');
    }

    for (const [key, value] of Object.entries(record)) {
      if (key === 'table' && Array.isArray(value)) continue;
      lines.push(`- **${key}:** ${String(value)}`);
    }
    if (Array.isArray(record.table)) {
      lines.push('', '### Contingency table');
      const table = record.table as Array<Record<string, unknown>>;
      const columns = Object.keys(table[0] ?? {});
      lines.push(`| ${columns.join(' | ')} |`);
      lines.push(`|${columns.map(() => '---').join('|')}|`);
      for (const row of table) {
        lines.push(`| ${columns.map((col) => String(row[col] ?? '')).join(' | ')} |`);
      }
    }
    return lines.join('\n');
  }

  lines.push(String(results));
  return lines.join('\n');
}

export function formatGenericApa(payload: Record<string, unknown>): string {
  const analysis = String(payload.analysisType ?? payload.analysis ?? 'results');
  const results = payload.results ?? payload.data ?? payload;
  return formatStatsAsApa(analysis, results);
}
