import type { SyntaxRequest } from './pspp-syntax.js';

export interface PsppTable {
  title: string;
  rows: string[][];
}

export interface ParsedPsppOutput {
  tables: PsppTable[];
  notes: string[];
  warnings: string[];
  errors: string[];
}

function splitTableRow(line: string): string[] {
  return line.trim().split(/\s{2,}/).filter(Boolean);
}

export function parsePsppOutput(output: string): ParsedPsppOutput {
  const tables: PsppTable[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const lines = output.split('\n');
  let currentTable: PsppTable | null = null;
  let tablePhase: 'none' | 'title' | 'body' = 'none';

  for (const line of lines) {
    if (line.startsWith('Note:')) notes.push(line);
    if (line.startsWith('Warning')) warnings.push(line);
    if (line.startsWith('error:') || line.includes('Error:')) errors.push(line);

    if (line.match(/^[=\-]{10,}$/)) {
      if (tablePhase === 'title' && currentTable) {
        tablePhase = 'body';
        continue;
      }
      if (tablePhase === 'body' && currentTable) {
        if (currentTable.rows.length > 0) tables.push(currentTable);
        currentTable = null;
        tablePhase = 'none';
        continue;
      }
      if (tablePhase === 'none') {
        tablePhase = 'title';
        currentTable = { title: '', rows: [] };
        continue;
      }
      continue;
    }

    if (tablePhase === 'title' && currentTable && line.trim()) {
      currentTable.title = line.trim();
      continue;
    }

    if (tablePhase === 'body' && currentTable && line.trim()) {
      const cells = splitTableRow(line);
      if (cells.length > 0) currentTable.rows.push(cells);
    }
  }

  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }

  return { tables, notes, warnings, errors };
}

export function formatAsApa(parsed: ParsedPsppOutput, params: SyntaxRequest): string {
  const lines: string[] = [
    '# Statistical Analysis Results',
    '',
    `**Analysis type:** ${params.analysisType}`,
    `**Data file:** ${params.dataFile}`,
    `**Variables:** ${params.variables?.join(', ') || 'all'}`,
    '',
  ];

  for (const table of parsed.tables) {
    lines.push(`### ${table.title}`);
    lines.push('');
    if (table.rows.length > 0) {
      lines.push(`| ${table.rows[0]?.join(' | ')} |`);
      lines.push(`|${table.rows[0]?.map(() => '---').join('|')}|`);
      for (const row of table.rows.slice(1)) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }
  }

  if (parsed.warnings.length > 0) {
    lines.push(`**Warnings:** ${parsed.warnings.join('; ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
