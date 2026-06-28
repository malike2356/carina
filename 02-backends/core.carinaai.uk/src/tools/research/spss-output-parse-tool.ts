import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../types/index.js';
import { formatAsApa, parsePsppOutput } from './pspp-output.js';
import type { PsppAnalysisType } from './pspp-syntax.js';
import { formatSpvReadMarkdown, readSpvFile } from './sav-executor.js';

function assertSafePath(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) throw new Error('file is required');
  if (/[;|`$&<>(){}[\]!#*?~\n\r\0]/.test(trimmed)) {
    throw new Error('file contains unsupported characters');
  }
  return resolve(trimmed);
}

export const spssOutputParseTool: Tool = {
  name: 'spss_output_parse',
  description:
    'Parse SPSS/PSPP output into structured tables. Supports .spv viewer archives and plain-text PSPP/SPSS output files.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to .spv or .txt output file' },
      outputFormat: { type: 'string', enum: ['json', 'apa', 'text'], default: 'apa' },
    },
    required: ['file'],
  },
  execute: async (params) => {
    try {
      const file = assertSafePath(String(params.file ?? ''));
      const lower = file.toLowerCase();
      const outputFormat = params.outputFormat === 'json' || params.outputFormat === 'text'
        ? params.outputFormat
        : 'apa';

      if (lower.endsWith('.spv')) {
        const spv = readSpvFile({ file });
        if (spv.error) return { error: spv.error, file };
        if (outputFormat === 'json') return { success: true, ...spv };
        return {
          success: true,
          format: outputFormat,
          markdown: formatSpvReadMarkdown(spv),
          ...spv,
        };
      }

      const raw = readFileSync(file, 'utf-8');
      const parsed = parsePsppOutput(raw);
      if (outputFormat === 'json') {
        return { success: true, file, parsed, rawOutput: raw };
      }

      const markdown = formatAsApa(parsed, {
        dataFile: file,
        analysisType: 'descriptive' satisfies PsppAnalysisType,
        variables: [],
      });

      return {
        success: true,
        format: outputFormat,
        markdown,
        tableCount: parsed.tables.length,
        warnings: parsed.warnings,
        errors: parsed.errors,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
