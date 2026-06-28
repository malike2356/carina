import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkPspp } from './pspp-check.js';
import { formatAsApa, parsePsppOutput } from './pspp-output.js';
import {
  generateSyntax,
  type PsppAnalysisType,
  type SyntaxRequest,
  type SyntaxRequestOptions,
} from './pspp-syntax.js';

export type PsppOutputFormat = 'text' | 'json' | 'apa';

export interface PsppExecuteRequest extends SyntaxRequest {
  outputFormat?: PsppOutputFormat;
}

const ANALYSIS_TYPES = new Set<PsppAnalysisType>([
  'descriptive',
  'ttest',
  'anova',
  'chi-square',
  'correlation',
  'regression',
  'nonparametric',
  'factor',
]);

const UNSAFE_PATH = /[;|`$&<>(){}[\]!#*?~\n\r\0]/;

function assertSafePath(filePath: string, label: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (UNSAFE_PATH.test(trimmed)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return resolve(trimmed);
}

export function parsePsppParams(params: Record<string, unknown>): PsppExecuteRequest {
  const analysisType = String(params.analysisType ?? '').trim() as PsppAnalysisType;
  if (!ANALYSIS_TYPES.has(analysisType)) {
    throw new Error(`analysisType must be one of: ${[...ANALYSIS_TYPES].join(', ')}`);
  }

  const optionsRaw = params.options;
  let options: SyntaxRequestOptions | undefined;
  if (optionsRaw && typeof optionsRaw === 'object' && !Array.isArray(optionsRaw)) {
    const o = optionsRaw as Record<string, unknown>;
    options = {
      posthoc: o.posthoc === 'bonferroni' || o.posthoc === 'tukey' || o.posthoc === 'none'
        ? o.posthoc
        : undefined,
      normality: typeof o.normality === 'boolean' ? o.normality : undefined,
      effectSize: typeof o.effectSize === 'boolean' ? o.effectSize : undefined,
      missingListwise: typeof o.missingListwise === 'boolean' ? o.missingListwise : undefined,
    };
  }

  const outputFormat = params.outputFormat;
  const format: PsppOutputFormat =
    outputFormat === 'text' || outputFormat === 'json' || outputFormat === 'apa'
      ? outputFormat
      : 'apa';

  return {
    dataFile: String(params.dataFile ?? ''),
    analysisType,
    variables: Array.isArray(params.variables)
      ? params.variables.map((v) => String(v).trim()).filter(Boolean)
      : undefined,
    groupBy: params.groupBy ? String(params.groupBy).trim() : undefined,
    dependentVar: params.dependentVar ? String(params.dependentVar).trim() : undefined,
    independentVars: Array.isArray(params.independentVars)
      ? params.independentVars.map((v) => String(v).trim()).filter(Boolean)
      : undefined,
    options,
    outputFormat: format,
  };
}

export async function executePsppAnalysis(params: PsppExecuteRequest): Promise<unknown> {
  const pspp = checkPspp();
  if (!pspp.installed) {
    return {
      error: pspp.error,
      installed: false,
      fallback:
        'Use stats_describe or stats_compare_groups for Python-based analysis instead.',
    };
  }

  const dataFile = assertSafePath(params.dataFile, 'dataFile');
  if (!existsSync(dataFile)) {
    return { error: `Data file not found: ${dataFile}` };
  }

  const syntax = generateSyntax({ ...params, dataFile });
  const workDir = mkdtempSync(join(tmpdir(), 'carina-pspp-'));
  const syntaxFile = join(workDir, 'analysis.sps');
  const outputFile = join(workDir, 'output.txt');

  try {
    writeFileSync(syntaxFile, syntax, 'utf-8');

    execFileSync('pspp', ['-o', outputFile, syntaxFile], {
      encoding: 'utf-8',
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: workDir,
    });

    let output = '';
    if (existsSync(outputFile)) {
      output = readFileSync(outputFile, 'utf-8');
    }

    const parsed = parsePsppOutput(output);

    if (params.outputFormat === 'json') {
      return {
        success: true,
        syntaxFile,
        parsed,
        rawOutput: output,
      };
    }

    if (params.outputFormat === 'apa') {
      return {
        success: true,
        format: 'apa',
        markdown: formatAsApa(parsed, { ...params, dataFile }),
        tableCount: parsed.tables.length,
        warnings: parsed.warnings,
        errors: parsed.errors,
        syntax,
      };
    }

    const preview = output.length > 5000 ? `${output.slice(0, 5000)}\n... (truncated)` : output;
    return {
      success: true,
      format: 'text',
      tableCount: parsed.tables.length,
      warningCount: parsed.warnings.length,
      errorCount: parsed.errors.length,
      output: preview,
      syntax,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `PSPP execution failed: ${message}`,
      syntax,
      syntaxFile,
    };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
