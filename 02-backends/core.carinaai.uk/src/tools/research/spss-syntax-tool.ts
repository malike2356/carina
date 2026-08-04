import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../types/index.js';
import { generateSyntax, type PsppAnalysisType } from './pspp-syntax.js';

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

export const spssSyntaxGenerateTool: Tool = {
  name: 'spss_syntax_generate',
  description:
    'Generate SPSS/PSPP syntax (.sps) for a statistical analysis. Save the file for manual use in SPSS or PSPP, ' +
    'or pass it to pspp_analyze.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string', description: 'Path to the .sav or .csv data file referenced in GET FILE' },
      analysisType: {
        type: 'string',
        enum: [
          'descriptive',
          'ttest',
          'anova',
          'chi-square',
          'correlation',
          'regression',
          'nonparametric',
          'factor',
        ],
      },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Variables to analyse',
      },
      groupBy: { type: 'string', description: 'Grouping variable for t-test/ANOVA' },
      dependentVar: { type: 'string', description: 'Dependent variable for regression' },
      independentVars: {
        type: 'array',
        items: { type: 'string' },
        description: 'Independent variables for regression',
      },
      options: {
        type: 'object',
        properties: {
          posthoc: { type: 'string', enum: ['bonferroni', 'tukey', 'none'] },
          normality: { type: 'boolean' },
          effectSize: { type: 'boolean' },
        },
      },
      outputPath: { type: 'string', description: 'Where to save the generated .sps file' },
    },
    required: ['analysisType'],
  },
  execute: async (params) => {
    try {
      const analysisType = String(params.analysisType ?? '').trim() as PsppAnalysisType;
      if (!ANALYSIS_TYPES.has(analysisType)) {
        return {
          error: `analysisType must be one of: ${[...ANALYSIS_TYPES].join(', ')}`,
        };
      }

      const dataFile = String(params.dataFile ?? 'data.sav').trim() || 'data.sav';
      const syntax = generateSyntax({
        dataFile,
        analysisType,
        variables: Array.isArray(params.variables)
          ? params.variables.map((value) => String(value).trim()).filter(Boolean)
          : undefined,
        groupBy: params.groupBy ? String(params.groupBy).trim() : undefined,
        dependentVar: params.dependentVar ? String(params.dependentVar).trim() : undefined,
        independentVars: Array.isArray(params.independentVars)
          ? params.independentVars.map((value) => String(value).trim()).filter(Boolean)
          : undefined,
        options:
          params.options && typeof params.options === 'object' && !Array.isArray(params.options)
            ? (params.options as {
                posthoc?: 'bonferroni' | 'tukey' | 'none';
                normality?: boolean;
                effectSize?: boolean;
              })
            : undefined,
      });

      const outputPath = resolve(
        String(params.outputPath ?? `/tmp/carina-analysis-${Date.now()}.sps`),
      );
      writeFileSync(outputPath, syntax, 'utf-8');

      return {
        success: true,
        file: outputPath,
        analysisType,
        syntax,
        markdown: `SPSS syntax saved to ${outputPath}\n\n\`\`\`spss\n${syntax}\n\`\`\``,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
