import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { formatJamoviAsApa } from './jamovi-format.js';
import { checkR } from './r-check.js';
import { generateRScript, type RAnalysisType } from './r-generator.js';
import { resolveResearchAsset } from './research-paths.js';

const R_ANALYZE_SCRIPT = resolveResearchAsset('r-analyze.R');

export type ROutputFormat = 'text' | 'json' | 'apa';

export interface RExecuteRequest {
  dataFile: string;
  analysisType: RAnalysisType;
  variables: string[];
  groupBy?: string;
  dependentVar?: string;
  independentVars?: string[];
  outputFormat?: ROutputFormat;
}

const ANALYSIS_TYPES = new Set<RAnalysisType>([
  'descriptive',
  'ttest',
  'anova',
  'correlation',
  'regression',
  'chi-square',
  'factor',
  'reliability',
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

export function parseRParams(params: Record<string, unknown>): RExecuteRequest {
  const analysisType = String(params.analysisType ?? '').trim() as RAnalysisType;
  if (!ANALYSIS_TYPES.has(analysisType)) {
    throw new Error(`analysisType must be one of: ${[...ANALYSIS_TYPES].join(', ')}`);
  }

  const variables = Array.isArray(params.variables)
    ? params.variables.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (variables.length === 0) {
    throw new Error('variables is required');
  }

  const outputFormat = params.outputFormat;
  const format: ROutputFormat =
    outputFormat === 'text' || outputFormat === 'json' || outputFormat === 'apa'
      ? outputFormat
      : 'apa';

  return {
    dataFile: String(params.dataFile ?? ''),
    analysisType,
    variables,
    groupBy: params.groupBy ? String(params.groupBy).trim() : undefined,
    dependentVar: params.dependentVar ? String(params.dependentVar).trim() : undefined,
    independentVars: Array.isArray(params.independentVars)
      ? params.independentVars.map((value) => String(value).trim()).filter(Boolean)
      : undefined,
    outputFormat: format,
  };
}

export async function executeRAnalysis(params: RExecuteRequest): Promise<unknown> {
  const availability = checkR(['psych']);
  if (!availability.installed) {
    return {
      error: 'R is not installed. Install with: sudo apt install r-base',
      fallback: 'Use stats_describe or stats_compare_groups instead.',
    };
  }

  const missing = Object.entries(availability.packages ?? {})
    .filter(([, installed]) => !installed)
    .map(([name]) => name);
  if (missing.length > 0) {
    return {
      error: `Missing R packages: ${missing.join(', ')}. Install with install.packages(c("${missing.join('","')}"))`,
      packages: availability.packages,
    };
  }

  const dataFile = assertSafePath(params.dataFile, 'dataFile');
  if (!existsSync(dataFile)) {
    return { error: `Data file not found: ${dataFile}` };
  }

  const workDir = mkdtempSync(resolve(tmpdir(), 'carina-r-'));
  const configPath = resolve(workDir, 'config.json');
  const scriptPath = resolve(workDir, 'analysis.R');

  try {
    const config = {
      dataFile,
      analysisType: params.analysisType,
      variables: params.variables,
      groupBy: params.groupBy,
      dependentVar: params.dependentVar,
      independentVars: params.independentVars,
    };
    writeFileSync(configPath, JSON.stringify(config), 'utf-8');
    writeFileSync(
      scriptPath,
      generateRScript({
        ...params,
        dataFile,
        apaFormat: params.outputFormat === 'apa',
      }),
      'utf-8',
    );

    const stdout = execFileSync('Rscript', [R_ANALYZE_SCRIPT, configPath], {
      encoding: 'utf-8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: workDir,
    });

    const parsed = JSON.parse(stdout) as {
      success?: boolean;
      error?: string;
      analysisType?: string;
      tables?: Array<{ title: string; header?: string[]; rows: string[][] }>;
    };

    if (parsed.error) {
      return { error: parsed.error, scriptPath };
    }

    if (params.outputFormat === 'json') {
      return { success: true, ...parsed, script: readFileSync(scriptPath, 'utf-8') };
    }

    if (params.outputFormat === 'text') {
      return {
        success: true,
        analysisType: params.analysisType,
        script: readFileSync(scriptPath, 'utf-8'),
        stdout: stdout.slice(0, 8000),
      };
    }

    return {
      success: true,
      format: 'apa',
      markdown: formatJamoviAsApa(
        {
          success: true,
          analysisType: params.analysisType,
          tables: (parsed.tables ?? []).map((table) => ({
            title: table.title,
            header: table.header,
            rows: table.rows,
          })),
        },
        {
          dataFile,
          analysisType: params.analysisType,
          variables: params.variables,
        },
      ).replace('Jamovi / jmv', 'R / haven'),
      tableCount: parsed.tables?.length ?? 0,
      rVersion: availability.version,
      script: readFileSync(scriptPath, 'utf-8'),
    };
  } catch (err) {
    return {
      error: `R execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
