export interface JamoviTable {
  title: string;
  header?: string[];
  rows: string[][];
}

export interface JamoviAnalysisPayload {
  success?: boolean;
  analysisType?: string;
  tables?: JamoviTable[];
  notes?: string[];
  error?: string;
  jamovi?: {
    running?: boolean;
    url?: string | null;
    datasetCount?: number;
    jmvAvailable?: boolean;
  };
}

export function formatJamoviAsApa(
  payload: JamoviAnalysisPayload,
  params: { dataFile: string; analysisType: string; variables: string[] },
): string {
  const lines: string[] = [
    '# Statistical Analysis Results (Jamovi / jmv)',
    '',
    `**Analysis type:** ${params.analysisType}`,
    `**Data file:** ${params.dataFile}`,
    `**Variables:** ${params.variables.join(', ')}`,
    '',
  ];

  if (payload.jamovi?.running) {
    lines.push(`**Jamovi session:** ${payload.jamovi.url} (${payload.jamovi.datasetCount ?? 0} open datasets)`);
    lines.push('');
  } else if (payload.jamovi) {
    lines.push('**Jamovi session:** not running (analysis used local file via R jmv)');
    lines.push('');
  }

  for (const table of payload.tables ?? []) {
    lines.push(`### ${table.title}`);
    lines.push('');
    const header = table.header?.length ? table.header : table.rows[0];
    const bodyRows = table.header?.length ? table.rows : table.rows.slice(1);
    if (header?.length) {
      lines.push(`| ${header.join(' | ')} |`);
      lines.push(`|${header.map(() => '---').join('|')}|`);
      for (const row of bodyRows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }
  }

  if (payload.notes?.length) {
    lines.push(`**Notes:** ${payload.notes.join('; ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
