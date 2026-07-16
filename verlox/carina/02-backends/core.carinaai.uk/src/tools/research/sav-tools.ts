import type { Tool } from '../../types/index.js';
import {
  checkSavDependencies,
  formatSavReadMarkdown,
  formatSpvReadMarkdown,
  readSavFile,
  readSpvFile,
  writeSavFile,
  type SavVariable,
} from './sav-executor.js';

export const savReadTool: Tool = {
  name: 'sav_read',
  description:
    'Read an SPSS .sav data file. Returns variable names, labels, value labels, measure levels, ' +
    'missing counts, and an optional data preview.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to the .sav file' },
      maxRows: { type: 'number', description: 'Maximum data rows to return in the preview' },
      metadataOnly: {
        type: 'boolean',
        description: 'Return variable metadata without data rows',
      },
    },
    required: ['file'],
  },
  execute: async (params) => {
    try {
      const deps = checkSavDependencies();
      if (!deps.pyreadstat) {
        return {
          error: "pyreadstat is not installed. Run: pip install pyreadstat pandas",
          dependencies: deps,
        };
      }

      const result = readSavFile({
        file: String(params.file ?? ''),
        maxRows: typeof params.maxRows === 'number' ? params.maxRows : undefined,
        metadataOnly: Boolean(params.metadataOnly),
      });

      if (result.error) {
        return { error: result.error, file: result.file };
      }

      return {
        success: true,
        markdown: formatSavReadMarkdown(result),
        ...result,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const savWriteTool: Tool = {
  name: 'sav_write',
  description:
    'Write records to an SPSS .sav file with optional variable labels, value labels, and measure levels.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Output .sav path' },
      data: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of row objects to write',
      },
      metadata: {
        type: 'object',
        description: 'Optional variable metadata (labels, value labels, measure)',
      },
    },
    required: ['file', 'data'],
  },
  execute: async (params) => {
    try {
      const deps = checkSavDependencies();
      if (!deps.pyreadstat) {
        return {
          error: "pyreadstat is not installed. Run: pip install pyreadstat pandas",
          dependencies: deps,
        };
      }

      const data = Array.isArray(params.data)
        ? (params.data as Record<string, unknown>[])
        : [];
      if (data.length === 0) {
        return { error: 'data must be a non-empty array of row objects' };
      }

      const result = writeSavFile({
        file: String(params.file ?? ''),
        data,
        metadata: params.metadata as { variables?: SavVariable[] } | undefined,
      });

      if (result.error) {
        return { error: result.error, file: result.file };
      }

      return result;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const spvReadTool: Tool = {
  name: 'spv_read',
  description:
    'Read an SPSS viewer output .spv file. Extracts table-like rows and text blocks from the ZIP/XML archive.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to the .spv file' },
    },
    required: ['file'],
  },
  execute: async (params) => {
    try {
      const result = readSpvFile({ file: String(params.file ?? '') });
      if (result.error) {
        return { error: result.error, file: result.file };
      }

      return {
        success: true,
        markdown: formatSpvReadMarkdown(result),
        ...result,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
