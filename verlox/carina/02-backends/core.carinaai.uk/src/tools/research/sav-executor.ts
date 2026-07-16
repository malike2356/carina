import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { resolveResearchAsset } from './research-paths.js';

const SAV_IO_PY = resolveResearchAsset('sav-io.py');

export interface SavVariable {
  name: string;
  type: string;
  label?: string;
  missing_count?: number;
  value_labels?: Record<string, string>;
  measure?: string;
}

export interface SavReadResult {
  file?: string;
  rows?: number;
  columns?: number;
  file_label?: string | null;
  variables?: SavVariable[];
  data?: Record<string, unknown>[];
  data_row_count?: number;
  data_truncated?: boolean;
  error?: string;
}

export interface SavWriteResult {
  success?: boolean;
  file?: string;
  rows?: number;
  columns?: number;
  error?: string;
}

export interface SpvReadResult {
  file?: string;
  tables?: Array<{ title: string; source?: string; rows: string[][] }>;
  text?: string[];
  error?: string;
}

export interface SavDependencies {
  pyreadstat?: boolean;
  pandas?: boolean;
  error?: string;
}

const UNSAFE_PATH = /[;|`$&<>(){}[\]!#*?~\n\r\0]/;

function runSavIo(args: string[]): string {
  return execFileSync('python3', [SAV_IO_PY, ...args], {
    encoding: 'utf-8',
    timeout: 60_000,
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

export function checkSavDependencies(): SavDependencies {
  try {
    return JSON.parse(runSavIo(['deps'])) as SavDependencies;
  } catch (err) {
    return {
      pyreadstat: false,
      pandas: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function readSavFile(params: {
  file: string;
  maxRows?: number;
  metadataOnly?: boolean;
}): SavReadResult {
  const file = assertSafePath(params.file, 'file');
  const args = ['read', '--file', file];
  if (params.maxRows !== undefined) args.push('--max-rows', String(params.maxRows));
  if (params.metadataOnly) args.push('--metadata-only');
  return JSON.parse(runSavIo(args)) as SavReadResult;
}

export function writeSavFile(params: {
  file: string;
  data: Record<string, unknown>[];
  metadata?: { variables?: SavVariable[] };
}): SavWriteResult {
  const file = assertSafePath(params.file, 'file');
  const args = ['write', '--file', file, '--data', JSON.stringify(params.data)];
  if (params.metadata) args.push('--metadata', JSON.stringify(params.metadata));
  return JSON.parse(runSavIo(args)) as SavWriteResult;
}

export function readSpvFile(params: { file: string }): SpvReadResult {
  const file = assertSafePath(params.file, 'file');
  return JSON.parse(runSavIo(['spv', '--file', file])) as SpvReadResult;
}

export function formatSavReadMarkdown(data: SavReadResult): string {
  const lines: string[] = [
    `## ${data.file ?? 'SPSS data file'}`,
    `**Rows:** ${data.rows ?? 0} | **Columns:** ${data.columns ?? 0}`,
  ];

  if (data.file_label) {
    lines.push(`**File label:** ${data.file_label}`);
  }
  lines.push('', '### Variables');

  for (const variable of data.variables ?? []) {
    let line = `- **${variable.name}** (${variable.type})`;
    if (variable.label) line += ` - ${variable.label}`;
    if (variable.measure) line += ` [${variable.measure}]`;
    if (variable.missing_count && variable.missing_count > 0) {
      line += ` [${variable.missing_count} missing]`;
    }
    lines.push(line);
    if (variable.value_labels) {
      const values = Object.entries(variable.value_labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      lines.push(`  Values: ${values}`);
    }
  }

  if (data.data?.length) {
    lines.push('', `### Data Preview (${data.data_row_count ?? data.data.length} rows)`);
    lines.push(formatDataPreviewTable(data.variables ?? [], data.data.slice(0, 10)));
    if (data.data_truncated) {
      lines.push('', '_Preview truncated; use maxRows to adjust._');
    }
  }

  return lines.join('\n');
}

export function formatDataPreviewTable(
  variables: SavVariable[],
  rows: Record<string, unknown>[],
): string {
  const columns = variables.length
    ? variables.map((variable) => variable.name)
    : Object.keys(rows[0] ?? {});
  if (columns.length === 0) return '_No data rows._';

  const header = `| ${columns.join(' | ')} |`;
  const divider = `|${columns.map(() => '---').join('|')}|`;
  const body = rows.map((row) => `| ${columns.map((col) => String(row[col] ?? '')).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

export function formatSpvReadMarkdown(data: SpvReadResult): string {
  const lines: string[] = [`## ${data.file ?? 'SPSS output file'}`, ''];

  if (data.tables?.length) {
    lines.push('### Tables');
    for (const table of data.tables) {
      lines.push('', `#### ${table.title}`);
      for (const row of table.rows.slice(0, 20)) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      if (table.rows.length > 20) {
        lines.push('', `_Table truncated (${table.rows.length} rows)._`);
      }
    }
  }

  if (data.text?.length) {
    lines.push('', '### Text');
    for (const chunk of data.text.slice(0, 20)) {
      lines.push(chunk);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}
