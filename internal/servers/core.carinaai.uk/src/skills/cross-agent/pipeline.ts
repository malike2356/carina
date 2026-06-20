import fs from 'fs/promises';
import path from 'path';
import { detectFormat } from './detector.js';
import { getConverter } from './converter-router.js';
import { llmConvert } from './llm-service.js';
import { scanSkillContent } from '../hub/hub-security-scanner.js';
import { writeImportedSkill } from './store.js';
import type { CarinaSkill, FormatMetadata, IngestOptions, IngestResult } from './types.js';
import { nameFromFileName, slugify } from './utils.js';
import { serializeCarinaSkill } from './serialize.js';

export async function fetchSkillContent(source: string): Promise<{ content: string; fileName: string; sourceUrl: string }> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Failed to fetch skill: HTTP ${res.status}`);
    const content = await res.text();
    const fileName = decodeURIComponent(new URL(source).pathname.split('/').pop() ?? 'skill.md');
    return { content, fileName, sourceUrl: source };
  }

  const resolved = path.resolve(source);
  const content = await fs.readFile(resolved, 'utf8');
  return { content, fileName: path.basename(resolved), sourceUrl: resolved };
}

export function buildMetadata(
  content: string,
  fileName: string,
  sourceUrl: string,
  originalFormat: string,
): FormatMetadata {
  return { content, fileName, sourceUrl, originalFormat };
}

async function validateSecurity(content: string, skip = false): Promise<string[]> {
  if (skip) return [];
  const verdict = await scanSkillContent(content);
  return verdict.flags;
}

export async function convertSkillContent(
  content: string,
  metadata: FormatMetadata,
  detectionFormat: string,
  converterId: string,
  options: IngestOptions = {},
): Promise<{ skill: CarinaSkill; usedLlm: boolean }> {
  if (options.forceLlm || converterId === 'llm-fallback') {
    const llm = await llmConvert(content, metadata, { model: options.llmModel });
    return { skill: llm.skill, usedLlm: true };
  }

  const converter = getConverter(converterId);
  if (!converter) {
    const llm = await llmConvert(content, metadata, { model: options.llmModel });
    return { skill: llm.skill, usedLlm: true };
  }

  return { skill: converter(content, metadata), usedLlm: false };
}

export async function ingestSkill(source: string, options: IngestOptions = {}): Promise<IngestResult> {
  const fetched = await fetchSkillContent(source);
  const detection = await detectFormat(fetched.content, fetched.fileName);

  if (detection.format === 'mcp-server') {
    throw new Error(
      'This source is an MCP server config. Use: carina mcp connect <package-or-url>',
    );
  }

  const useLlm = options.forceLlm
    || detection.confidence < 0.5
    || detection.converter === 'llm-fallback';

  const metadata = buildMetadata(
    fetched.content,
    fetched.fileName,
    fetched.sourceUrl,
    detection.format,
  );

  const { skill, usedLlm } = useLlm
    ? { skill: (await llmConvert(fetched.content, metadata, { model: options.llmModel })).skill, usedLlm: true }
    : await convertSkillContent(
      fetched.content,
      metadata,
      detection.format,
      detection.converter ?? 'plain-instructions',
      options,
    );

  if (options.hub) {
    skill.source.hub = options.hub;
    skill.category = skill.category.startsWith('imported-') ? skill.category : `imported-${options.hub}`;
  }

  skill.name = slugify(skill.name || nameFromFileName(fetched.fileName));
  const securityContent = serializeCarinaSkill(skill);
  const securityFlags = await validateSecurity(securityContent, options.skipSecurity);

  if (securityFlags.some((f) => f.startsWith('hardcoded_credential') || f.startsWith('prompt_injection'))) {
    throw new Error(`Security sandbox rejected skill: ${securityFlags.join(', ')}`);
  }

  const filePath = await writeImportedSkill(skill);

  try {
    const { clearSkillIndexCache } = await import('../skill-index.js');
    clearSkillIndexCache();
  } catch {
    // optional
  }

  return {
    skill,
    filePath,
    detection,
    securityFlags,
    usedLlm,
  };
}

export async function ingestNamedEcosystemSkill(
  hub: string,
  name: string,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const { CrossEcosystemSearch } = await import('./discovery/search.js');
  const search = new CrossEcosystemSearch();
  const result = await search.getSkill(hub, name);
  if (!result) throw new Error(`Skill not found in ${hub}: ${name}`);
  return ingestSkill(result.installUrl || result.sourceUrl, { ...options, hub: result.source });
}
