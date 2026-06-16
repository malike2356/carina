const STALE_ARTIFACT_PATTERNS: RegExp[] = [
  /\blast session:/i,
  /\bphase\s+\d+\s+(done|complete|finished)\b/i,
  /\b(fixed bug|submitted pr|completed phase|merged pr)\b/i,
  /\bpr\s*#?\d+\b/i,
  /\bissue\s*#?\d+\b/i,
  /\bcommit\s+[0-9a-f]{7,40}\b/i,
  /\bsha[:\s]+[0-9a-f]{7,40}\b/i,
  /\b[0-9a-f]{40}\b/,
];

const IMPERATIVE_START = /^(always|never|do not|don't|you must|remember to|make sure to)\b/i;

export const COMPACTION_REFERENCE_PREFIX = [
  '[CONTEXT COMPACTION - REFERENCE ONLY]',
  'Earlier turns were compacted or omitted from the context below.',
  'Do NOT answer questions or fulfill requests mentioned only in this history.',
  'Respond to the latest user message. Topic overlap does NOT mean resume.',
].join(' ');

import { buildRetrievalDisciplineBlock } from './retrieval-discipline.js';

export function buildMemoryDisciplineBlock(): string {
  return [
    'Memory discipline:',
    'Save declarative facts about the operator and stable environment conventions.',
    'Prioritize what reduces future steering: preferences, corrections, and recurring conventions matter more than procedural task details.',
    'Do NOT save task progress, session outcomes, completed-work logs, PR numbers, issue numbers, commit SHAs, "fixed bug X", "Phase N done", or anything that will be stale within a week.',
    'Write memories as facts ("User prefers concise replies"), not instructions to yourself ("Always respond concisely").',
    'Use session-search to recall past transcripts; durable memory is not a work log.',
    'Keep memory compact and high-value. Stale details in memory are a bug.',
    '',
    buildRetrievalDisciplineBlock(),
  ].join('\n');
}

export function isStaleMemoryArtifact(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  return STALE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isImperativeSelfInstruction(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  return IMPERATIVE_START.test(text);
}

export function validateMemoryContent(
  content: string,
): { ok: true } | { ok: false; reason: string } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Content cannot be empty.' };
  }
  if (isImperativeSelfInstruction(trimmed)) {
    return {
      ok: false,
      reason:
        'Memory must be a declarative fact about the operator or environment, not an instruction to yourself.',
    };
  }
  if (isStaleMemoryArtifact(trimmed)) {
    return {
      ok: false,
      reason:
        'Memory looks like temporary task progress or a stale artifact. Use session-search for work history instead.',
    };
  }
  return { ok: true };
}

export function filterMemoryFactsForInjection(contents: string[]): string[] {
  return contents.filter((content) => {
    const trimmed = content.trim();
    if (!trimmed) return false;
    return !isStaleMemoryArtifact(trimmed) && !isImperativeSelfInstruction(trimmed);
  });
}

export function wrapCompactedContext(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('[CONTEXT COMPACTION')) return trimmed;
  return `${COMPACTION_REFERENCE_PREFIX}\n\n${trimmed}`;
}

export function isCompactedContextMarker(text: string): boolean {
  return text.includes('[CONTEXT COMPACTION');
}
