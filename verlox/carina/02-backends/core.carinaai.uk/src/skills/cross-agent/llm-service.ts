import type { CarinaSkill, FormatMetadata, LlmConversionResult } from './types.js';
import {
  buildConversionUserPrompt,
  CONVERSION_SYSTEM_PROMPT,
  stripMarkdownFences,
} from './llm-converter.js';
import { parseCarinaSkillMarkdown } from './serialize.js';
import { slugify } from './utils.js';

function chunkByHeaders(content: string): string[] {
  const parts = content.split(/(?=^#{1,3}\s)/m).filter(Boolean);
  return parts.length > 1 ? parts : [content];
}

function validateSkillShape(skill: CarinaSkill | null): string[] {
  if (!skill) return ['parse_failed'];
  const errors: string[] = [];
  if (!skill.name) errors.push('missing_name');
  if (!skill.description) errors.push('missing_description');
  if (!skill.content) errors.push('missing_content');
  if (!/^[a-z0-9-]+$/.test(skill.name)) errors.push('invalid_name_format');
  return errors;
}

async function callLlm(system: string, user: string, model?: string): Promise<{
  text: string;
  provider: string;
  model: string;
}> {
  const { llm } = await import('../../brain/llm.js');
  const response = await llm.chat(
    [
      { role: 'system', content: system, timestamp: new Date() },
      { role: 'user', content: user, timestamp: new Date() },
    ],
    undefined,
    model ? { name: llm.current().name, model } : undefined,
  );
  const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  return {
    text,
    provider: llm.current().name,
    model: model ?? llm.currentModel(),
  };
}

export async function llmConvert(
  content: string,
  metadata: FormatMetadata,
  options: { model?: string } = {},
): Promise<LlmConversionResult> {
  const warnings: string[] = [];
  const chunks = content.length > 16000 ? chunkByHeaders(content) : [content];
  if (chunks.length > 1) {
    warnings.push(`Large skill chunked into ${chunks.length} parts for conversion`);
  }

  let mergedBody = '';
  let rawOutput = '';
  let provider = '';
  let model = '';
  let parsed: CarinaSkill | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const userPrompt = buildConversionUserPrompt(
      chunk,
      metadata.fileName,
      metadata.originalFormat || 'unknown',
    );
    const result = await callLlm(CONVERSION_SYSTEM_PROMPT, userPrompt, options.model);
    provider = result.provider;
    model = result.model;
    rawOutput = result.text;
    const cleaned = stripMarkdownFences(result.text);
    const attempt = parseCarinaSkillMarkdown(cleaned);
    const errors = validateSkillShape(attempt);
    if (errors.length > 0) {
      const retryPrompt = `${userPrompt}

Your previous output failed validation:
${errors.map((e) => `- ${e}`).join('\n')}

Please correct these errors and output the complete skill again.`;
      const retry = await callLlm(CONVERSION_SYSTEM_PROMPT, retryPrompt, options.model);
      rawOutput = retry.text;
      parsed = parseCarinaSkillMarkdown(stripMarkdownFences(retry.text));
    } else {
      parsed = attempt;
    }
    if (parsed?.content) mergedBody += (mergedBody ? '\n\n' : '') + parsed.content;
  }

  if (!parsed) {
    throw new Error('LLM conversion failed to produce a valid Carina skill');
  }

  const skill: CarinaSkill = {
    ...parsed,
    name: slugify(parsed.name || metadata.fileName),
    source: {
      hub: parsed.source.hub || 'unknown',
      url: metadata.sourceUrl,
      originalFormat: metadata.originalFormat || 'unknown',
      convertedAt: new Date().toISOString(),
      converterVersion: 'llm-fallback-1.0.0',
    },
    content: mergedBody || parsed.content,
  };

  return {
    skill,
    warnings,
    confidence: 0.7,
    rawOutput,
    tokensUsed: 0,
    provider,
    model,
  };
}
