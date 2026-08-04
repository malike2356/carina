import type { FormatDetectionResult } from './types.js';
import {
  extractFirstHeading,
  extractFirstParagraph,
  nameFromFileName,
  parseSimpleFrontmatter,
} from './utils.js';

export interface FormatSignature {
  format: string;
  patterns: RegExp[];
  confidence: number;
  converter: string;
}

export const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    format: 'mcp-server',
    patterns: [
      /"mcpServers"\s*:/,
      /"command"\s*:\s*"(npx|uvx|node|python)/,
      /"transport"\s*:\s*"(stdio|sse|http)"/,
    ],
    confidence: 0.95,
    converter: 'mcp-native',
  },
  {
    format: 'cursor-rules',
    patterns: [
      /^You are an expert/m,
      /\.cursorrules/,
      /description:\s*".+"/,
      /globs:\s*\[/,
    ],
    confidence: 0.9,
    converter: 'cursor-rules',
  },
  {
    format: 'claude-md',
    patterns: [
      /^# CLAUDE\.MD/im,
      /CLAUDE\.MD/,
      /When asked to.*always/i,
    ],
    confidence: 0.85,
    converter: 'claude-md',
  },
  {
    format: 'windsurf-rules',
    patterns: [/\.windsurfrules/, /Windsurf Rules/, /windsurf:\s*true/],
    confidence: 0.85,
    converter: 'windsurf-rules',
  },
  {
    format: 'aider-conventions',
    patterns: [
      /^# Aider Conventions/im,
      /\.aider\.conf\.(yml|yaml)/,
      /aider:\s*true/,
      /read-only:\s*\[/,
    ],
    confidence: 0.85,
    converter: 'aider-conventions',
  },
  {
    format: 'continue-config',
    patterns: [
      /"models"\s*:\s*\[/,
      /"slashCommands"\s*:\s*\[/,
      /"tabAutocompleteModel"/,
      /"embeddingsProvider"/,
    ],
    confidence: 0.9,
    converter: 'continue-config',
  },
  {
    format: 'cline-rules',
    patterns: [/\.clinerules/, /Cline Rules/, /cline_custom_instructions/],
    confidence: 0.85,
    converter: 'cline-rules',
  },
  {
    format: 'copilot-instructions',
    patterns: [
      /\.github\/copilot-instructions\.md/,
      /GitHub Copilot Instructions/,
      /copilot-instructions:/,
    ],
    confidence: 0.85,
    converter: 'copilot-instructions',
  },
  {
    format: 'crewai-agent',
    patterns: [
      /role:\s*"[^"]+"/,
      /goal:\s*"[^"]+"/,
      /backstory:\s*"[^"]+"/,
      /tools:\s*\[/,
    ],
    confidence: 0.9,
    converter: 'crewai-agent',
  },
  {
    format: 'langchain-config',
    patterns: [
      /from langchain/,
      /llm:\s*(ChatOpenAI|ChatAnthropic)/,
      /chain:\s*(\||Runnable)/,
    ],
    confidence: 0.8,
    converter: 'langchain-config',
  },
  {
    format: 'autogpt-agent',
    patterns: [
      /ai_name:\s*["']/,
      /ai_role:\s*["']/,
      /ai_goals:\s*\[/,
    ],
    confidence: 0.9,
    converter: 'autogpt-agent',
  },
  {
    format: 'devin-task',
    patterns: [/devin\.yaml/, /devin\.yml/, /tasks:\s*\n\s*-/],
    confidence: 0.8,
    converter: 'devin-task',
  },
  {
    format: 'generic-skill-md',
    patterns: [/^---\s*\nname:\s*/, /^---\s*\ndescription:/],
    confidence: 0.75,
    converter: 'generic-skill-md',
  },
  {
    format: 'plain-instructions',
    patterns: [/^#+\s/, /^\*\*[^*]+\*\*/],
    confidence: 0.5,
    converter: 'plain-instructions',
  },
];

function extractMetadata(sample: string, format: string, fileName: string): Record<string, unknown> {
  const meta: Record<string, unknown> = { fileName };
  if (format === 'generic-skill-md' || format.endsWith('-rules')) {
    const { meta: fm } = parseSimpleFrontmatter(sample);
    if (fm.name) meta.name = fm.name;
    if (fm.description) meta.description = fm.description;
  }
  if (format === 'claude-md') {
    const heading = extractFirstHeading(sample);
    if (heading) meta.name = heading;
  }
  if (!meta.name) meta.name = nameFromFileName(fileName);
  if (!meta.description) {
    const desc = extractFirstParagraph(sample);
    if (desc) meta.description = desc;
  }
  return meta;
}

function matchesFileName(fileName: string, format: string): number {
  const lower = fileName.toLowerCase();
  const hints: Record<string, string[]> = {
    'cursor-rules': ['.cursorrules', '.mdc'],
    'claude-md': ['claude.md'],
    'windsurf-rules': ['.windsurfrules'],
    'cline-rules': ['.clinerules'],
    'copilot-instructions': ['copilot-instructions'],
    'continue-config': ['config.json'],
    'crewai-agent': ['agents.yaml', 'agents.yml'],
    'aider-conventions': ['.aider.conf', 'conventions.md'],
    'autogpt-agent': ['ai_settings.yaml'],
    'devin-task': ['devin.yaml', 'devin.yml'],
    'generic-skill-md': ['skill.md'],
  };
  const patterns = hints[format] ?? [];
  return patterns.some((p) => lower.includes(p)) ? 0.2 : 0;
}

export function detectFormatFromSignatures(
  content: string,
  fileName: string,
): FormatDetectionResult {
  const sample = content.slice(0, 2048);
  let best: FormatDetectionResult | null = null;

  for (const sig of FORMAT_SIGNATURES) {
    const matchCount = sig.patterns.filter((p) => p.test(sample) || p.test(fileName)).length;
    const coverage = matchCount / sig.patterns.length;
    if (coverage < 0.5) continue;

    const fileBoost = matchesFileName(fileName, sig.format);
    const confidence = Math.min(1, sig.confidence * coverage + fileBoost);
    const result: FormatDetectionResult = {
      format: sig.format,
      confidence,
      converter: sig.converter,
      metadata: extractMetadata(sample, sig.format, fileName),
    };
    if (!best || result.confidence > best.confidence) best = result;
  }

  if (best) return best;

  return {
    format: 'unknown',
    confidence: 0,
    converter: 'llm-fallback',
    metadata: { fileName },
  };
}

export async function detectFormat(
  content: string,
  fileName: string,
): Promise<FormatDetectionResult> {
  try {
    const { getFormatRegistryClient } = await import('./registry-client.js');
    const registry = getFormatRegistryClient();
    await registry.ensureLoaded();
    const registryMatch = registry.matchFormat(content, fileName);
    if (registryMatch) return registryMatch;
  } catch {
    // registry unavailable; use hardcoded signatures
  }
  return detectFormatFromSignatures(content, fileName);
}
