import fs from 'node:fs/promises';
import path from 'node:path';
import { llm, type ProviderOverride } from '../brain/llm.js';
import type { Message } from '../types/index.js';
import { executeToolCall, type ConfirmFn } from './tool-runner.js';
import {
  emitResearchProgress,
  legacyProgressLine,
  type ResearchProgressHandler,
} from './research-progress.js';
import {
  evaluateResearchQuality,
  passesResearchQualityGate,
  researchQualityThreshold,
} from './research-quality-gate.js';
import {
  escalateToTeacher,
  resolveTeacherProviderOverride,
  shouldEscalateStudentProvider,
} from './teacher-escalation.js';
import { sanitizeCarinaProse } from '../security/writing-style.js';
import {
  citationStylePromptBlock,
  formatInlineCitation,
  formatReferenceEntry,
  parseCitationStyle,
  referencesHeading,
  type CitationStyleId,
} from '../research/citation-styles.js';

export interface DeepResearchOptions {
  query: string;
  maxRounds?: number;
  maxSources?: number;
  outputFormat?: 'markdown' | 'html';
  citationStyle?: CitationStyleId | string;
  saveToFile?: string;
  providerOverride?: ProviderOverride;
  sessionId?: string;
  onProgress?: (line: string) => void;
  onProgressEvent?: ResearchProgressHandler;
  persist?: boolean;
  onSaved?: (meta: import('../research/research-store.js').ResearchRecordMeta) => void;
  skipVerify?: boolean;
  maxQualityPasses?: number;
  parallelSearch?: boolean;
}

/** Keprix-style depth presets mapped from the UI rounds slider. */
export type ResearchDepthLabel = 'quick' | 'standard' | 'deep';

export type ResearchDepthConfig = {
  label: ResearchDepthLabel;
  subQuestions: number;
  sourcesPerQuestion: number;
  maxSources: number;
  targetWords: number;
  minSections: number;
  minBodyChars: number;
  minSummaryChars: number;
  pageChars: number;
  searchCount: number;
};

export function resolveResearchDepth(maxRounds = 3): ResearchDepthConfig {
  const rounds = Number.isFinite(maxRounds) ? Math.min(Math.max(1, Math.round(maxRounds)), 10) : 3;
  if (rounds <= 3) {
    return {
      label: 'quick',
      subQuestions: 5,
      sourcesPerQuestion: 3,
      maxSources: 12,
      targetWords: 500,
      minSections: 3,
      minBodyChars: 900,
      minSummaryChars: 80,
      pageChars: 10_000,
      searchCount: 5,
    };
  }
  if (rounds <= 6) {
    return {
      label: 'standard',
      subQuestions: 8,
      sourcesPerQuestion: 3,
      maxSources: 24,
      targetWords: 1500,
      minSections: 4,
      minBodyChars: 2800,
      minSummaryChars: 120,
      pageChars: 12_000,
      searchCount: 6,
    };
  }
  return {
    label: 'deep',
    subQuestions: 12,
    sourcesPerQuestion: 5,
    maxSources: 48,
    targetWords: 3000,
    minSections: 5,
    minBodyChars: 5500,
    minSummaryChars: 160,
    pageChars: 16_000,
    searchCount: 8,
  };
}

export interface ResearchSection {
  heading: string;
  body: string;
  sourceCitations: string[];
}

export interface SourceCitation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  fetchedAt: string;
  verified?: boolean;
  verifyNote?: string;
}

export interface DeepResearchReport {
  title: string;
  summary: string;
  sections: ResearchSection[];
  sources: SourceCitation[];
  searchQueries: string[];
  roundCount: number;
  generatedAt: string;
  citationStyle?: CitationStyleId;
}

const autoConfirm: ConfirmFn = async () => true;
const SUMMARY_UNAVAILABLE_RE = /^summary unavailable\.?$/i;

function emitProgress(
  phase: Parameters<typeof emitResearchProgress>[0],
  message: string,
  options: Pick<DeepResearchOptions, 'onProgress' | 'onProgressEvent'>,
  detail?: Record<string, unknown>,
): void {
  emitResearchProgress(phase, message, options.onProgressEvent, detail);
  options.onProgress?.(legacyProgressLine({
    phase,
    message,
    detail,
    at: new Date().toISOString(),
  }));
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sourceSnippet(source: SourceCitation): string {
  return source.snippet.replace(/\s+/g, ' ').trim().slice(0, 360);
}

function hasUsableResearchContent(report: DeepResearchReport): boolean {
  const summary = report.summary.trim();
  const bodyChars = report.sections.reduce((sum, section) => sum + section.body.trim().length, 0);
  return report.sources.length > 0 && (
    (summary.length >= 40 && !SUMMARY_UNAVAILABLE_RE.test(summary))
    || bodyChars >= 80
  );
}

function buildQualityRecoveryReport(
  report: DeepResearchReport,
  query: string,
  reasons: string[],
): DeepResearchReport {
  const existingBody = report.sections
    .map((section) => section.body.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 1800);
  const usableSources = report.sources.slice(0, 8);
  const sourceEvidence = usableSources
    .map((source) => `- ${source.title}: ${sourceSnippet(source)} [${source.id}]`)
    .join('\n');
  const citedIds = usableSources.map((source) => source.id);
  const qualityNote = reasons.length > 0
    ? `The automated quality gate asked for more depth before marking this complete: ${reasons.join('; ')}.`
    : 'The automated quality gate asked for more depth before marking this complete.';
  const summary = report.summary.trim() && !SUMMARY_UNAVAILABLE_RE.test(report.summary.trim())
    ? report.summary.trim()
    : [
        `Partial research report for: ${query}.`,
        `Carina found ${report.sources.length} source(s), but synthesis did not reach the normal depth threshold.`,
        'The report below keeps the evidence that was gathered and highlights what still needs review.',
      ].join(' ');

  const sections: ResearchSection[] = [];
  if (existingBody) {
    sections.push({
      heading: 'Available synthesis',
      body: existingBody,
      sourceCitations: report.sections.flatMap((section) => section.sourceCitations).slice(0, 12),
    });
  }

  sections.push(
    {
      heading: 'Source-backed evidence gathered',
      body: sourceEvidence || 'Sources were recorded, but snippets were too thin to quote usefully.',
      sourceCitations: citedIds,
    },
    {
      heading: 'Quality note',
      body: qualityNote,
      sourceCitations: [],
    },
    {
      heading: 'What to do next',
      body: [
        'Use this as a working draft rather than a final board-ready report.',
        'Ask a follow-up question for the missing sections, or rerun research with a narrower query.',
        'For forecasts, ask Carina to separate hard evidence, analyst estimates, and speculation.',
      ].join('\n'),
      sourceCitations: [],
    },
  );

  return {
    ...report,
    title: report.title.trim() || `Research: ${query}`,
    summary,
    sections,
  };
}

export function parseSubQuestions(text: string, maxQuestions = 5): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(?:\d+[\.\)]\s*|[-*]\s*)(.+)$/);
    if (!match?.[1]) continue;
    let q = match[1].trim();
    if (!q.endsWith('?')) q = `${q}?`;
    questions.push(q);
  }
  return [...new Set(questions)].slice(0, Math.max(1, maxQuestions));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPageText(body: string, pageChars = 8000): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: string; text?: string; body?: string };
      const text = parsed.content ?? parsed.text ?? parsed.body;
      if (typeof text === 'string') return text.slice(0, pageChars);
    } catch {
      // fall through
    }
  }
  if (/<html|<body|<div/i.test(trimmed)) return stripHtml(trimmed).slice(0, pageChars);
  return trimmed.slice(0, pageChars);
}

async function chatText(
  messages: Message[],
  providerOverride?: ProviderOverride,
): Promise<string> {
  const response = await llm.chat(messages, undefined, providerOverride);
  return response.content.trim();
}

async function planResearch(
  query: string,
  subQuestionCount: number,
  providerOverride?: ProviderOverride,
): Promise<string[]> {
  const count = Math.max(3, subQuestionCount);
  const prompt = [
    'You are planning a multi-source research report.',
    `Main topic: ${query}`,
    `Return exactly ${count} specific sub-questions that must be answered to cover this topic thoroughly.`,
    'Cover background, recent developments, evidence, stakeholders, risks or caveats, and practical implications where relevant.',
    'Format as a numbered list only. No preamble.',
  ].join('\n');

  const text = await chatText([
    { role: 'user', content: prompt, timestamp: new Date() },
  ], providerOverride);

  const questions = parseSubQuestions(text, count);
  const seed = [
    `What is the current state of ${query}?`,
    `What recent changes or updates apply to ${query}?`,
    `What are the key facts, figures, and evidence about ${query}?`,
    `Who are the main stakeholders and what do they claim about ${query}?`,
    `What risks, caveats, or open questions remain about ${query}?`,
    `What practical next steps or recommendations follow from the evidence on ${query}?`,
    `How do competing viewpoints or alternatives compare for ${query}?`,
    `What timelines, regulations, or market forces shape ${query}?`,
    `What case studies or concrete examples illuminate ${query}?`,
    `What should a decision-maker watch next regarding ${query}?`,
    `Which sources are most authoritative on ${query} and why?`,
    `What counter-evidence challenges the mainstream narrative on ${query}?`,
  ];

  const merged = [...questions];
  for (const item of seed) {
    if (merged.length >= count) break;
    if (!merged.includes(item)) merged.push(item);
  }
  return merged.slice(0, count);
}

async function gatherSourcesForQuestions(
  questions: string[],
  sessionId: string,
  maxSources: number,
  progress: Pick<DeepResearchOptions, 'onProgress' | 'onProgressEvent'>,
  parallelSearch: boolean,
  sourcesPerQuestion = 3,
  pageChars = 8000,
  searchCount = 5,
): Promise<{ sources: SourceCitation[]; searchQueries: string[] }> {
  const sources: SourceCitation[] = [];
  const searchQueries: string[] = [];
  let sourceCounter = 1;

  const ingestHits = async (question: string, hits: Array<{ title: string; url: string; description: string }>) => {
    searchQueries.push(question);
    for (const hit of hits.slice(0, sourcesPerQuestion)) {
      if (sources.length >= maxSources) break;
      if (!/^https?:\/\//i.test(hit.url)) continue;
      if (sources.some((s) => s.url === hit.url)) continue;

      emitProgress('extract', `Reading: ${hit.url}`, progress);
      const pageText = await fetchPageText(hit.url, sessionId, pageChars);
      const id = `src-${sourceCounter}`;
      sourceCounter += 1;
      sources.push({
        id,
        title: hit.title || hit.url,
        url: hit.url,
        snippet: (pageText || hit.description || hit.title).slice(0, pageChars),
        fetchedAt: new Date().toISOString(),
      });
    }
  };

  if (parallelSearch && questions.length > 1) {
    emitProgress('search', `Parallel search across ${questions.length} queries`, progress, {
      queries: questions,
    });
    const batches = await Promise.all(questions.map(async (question) => {
      emitProgress('search', `Searching: ${question}`, progress);
      try {
        return { question, hits: await runWebSearchTool(question, sessionId, searchCount) };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emitProgress('search', `Search skipped: ${msg}`, progress, { question });
        return { question, hits: [] as Array<{ title: string; url: string; description: string }> };
      }
    }));
    for (const batch of batches) {
      await ingestHits(batch.question, batch.hits);
      if (sources.length >= maxSources) break;
    }
    return { sources, searchQueries };
  }

  for (const question of questions) {
    if (sources.length >= maxSources) break;
    emitProgress('search', `Searching: ${question}`, progress);
    try {
      const hits = await runWebSearchTool(question, sessionId, searchCount);
      await ingestHits(question, hits);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitProgress('search', `Search skipped: ${msg}`, progress, { question });
    }
  }

  return { sources, searchQueries };
}

function normalizeSearchHits(
  result: unknown,
): Array<{ title: string; url: string; description: string }> {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && Array.isArray((result as { results?: unknown }).results)
      ? (result as { results: unknown[] }).results
      : null;

  if (!rows) return [];

  return rows.map((hit) => ({
    title: String((hit as { title?: string }).title ?? ''),
    url: String((hit as { url?: string }).url ?? '').trim(),
    description: String(
      (hit as { description?: string }).description
      ?? (hit as { content?: string }).content
      ?? '',
    ),
  })).filter((h) => /^https?:\/\//i.test(h.url));
}

async function runWebSearchTool(
  query: string,
  sessionId: string,
  searchCount = 5,
): Promise<Array<{ title: string; url: string; description: string }>> {
  // Prefer the search provider directly so research does not depend on session tool policy.
  try {
    const { runWebSearch } = await import('../tools/web-search-provider.js');
    return normalizeSearchHits(await runWebSearch(query, searchCount));
  } catch (directErr) {
    const result = await executeToolCall({
      type: 'tool_call',
      toolName: 'web-search',
      toolCallId: `research-search-${Date.now()}`,
      params: { query, count: searchCount },
    }, autoConfirm, false, sessionId);

    if (result && typeof result === 'object' && 'error' in result) {
      const toolError = String((result as { error: string }).error);
      const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
      throw new Error(toolError || directMsg);
    }

    const hits = normalizeSearchHits(result);
    if (hits.length > 0) return hits;

    const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
    throw new Error(directMsg || 'web-search returned no results');
  }
}

async function fetchPageText(url: string, sessionId: string, pageChars = 8000): Promise<string> {
  const result = await executeToolCall({
    type: 'tool_call',
    toolName: 'http-request',
    toolCallId: `research-fetch-${Date.now()}`,
    params: { method: 'GET', url },
  }, autoConfirm, true, sessionId);

  if (result && typeof result === 'object') {
    if ('error' in result) return '';
    const body = (result as { body?: string }).body;
    if (typeof body === 'string') return extractPageText(body, pageChars);
  }
  return '';
}

async function synthesizeReport(
  query: string,
  subQuestions: string[],
  sources: SourceCitation[],
  depth: ResearchDepthConfig,
  providerOverride?: ProviderOverride,
  citationStyle: CitationStyleId = 'apa7',
): Promise<DeepResearchReport> {
  const sourceBlock = sources.map((s) => (
    `[${s.id}] ${s.title}\nURL: ${s.url}\nContent: ${s.snippet}`
  )).join('\n\n');

  const prompt = [
    `Write a university-style research paper on: ${query}`,
    `Depth: ${depth.label}. Target length: about ${depth.targetWords} words across the full paper.`,
    citationStylePromptBlock(citationStyle),
    'Research plan sub-questions:',
    ...subQuestions.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Sources (cite using source IDs in brackets, e.g. [src-1]; the renderer will convert them to the citation style):',
    sourceBlock || '(No fetched sources; be explicit about uncertainty.)',
    '',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "title": string,',
    '  "summary": string (abstract; 4-8 sentences with key takeaways),',
    '  "sections": [{ "heading": string, "body": string, "sourceCitations": string[] }]',
    '}',
    `Include at least ${depth.minSections} section headings (Introduction, themed body sections, Conclusion).`,
    'Each section body must be detailed prose with evidence. Use short bullet lists only when they clarify structure.',
    'Use markdown emphasis inside body strings: **bold**, *italic*, - bullets, 1. numbered lists, and ### subheadings when needed.',
    'Address disagreements between sources, caveats, and what remains unknown.',
    'Every major claim should cite at least one source ID when sources exist.',
    'Do not append a References section in JSON; the system will format it.',
  ].join('\n');

  const text = await chatText([
    { role: 'user', content: prompt, timestamp: new Date() },
  ], providerOverride);

  const parsed = extractJsonObject(text);
  const title = sanitizeCarinaProse(String(parsed?.title ?? `Research: ${query}`));
  const summary = sanitizeCarinaProse(String(parsed?.summary ?? 'Summary unavailable.'));
  const rawSections = Array.isArray(parsed?.sections) ? parsed.sections : [];

  const sections: ResearchSection[] = rawSections.map((section) => {
    const row = section as Record<string, unknown>;
    return {
      heading: sanitizeCarinaProse(String(row.heading ?? 'Section')),
      body: sanitizeCarinaProse(String(row.body ?? '')),
      sourceCitations: Array.isArray(row.sourceCitations)
        ? row.sourceCitations.map(String)
        : [],
    };
  });

  if (sections.length === 0) {
    sections.push({
      heading: 'Findings',
      body: sanitizeCarinaProse(text),
      sourceCitations: sources.map((s) => s.id),
    });
  }

  return {
    title,
    summary,
    sections,
    sources,
    searchQueries: [],
    roundCount: 0,
    generatedAt: new Date().toISOString(),
    citationStyle,
  };
}

async function verifySources(
  query: string,
  sources: SourceCitation[],
  providerOverride?: ProviderOverride,
): Promise<SourceCitation[]> {
  const candidates = sources.filter((s) => s.snippet.trim().length >= 80);
  if (candidates.length === 0) {
    return sources.map((s) => ({ ...s, verified: true, verifyNote: 'thin content retained' }));
  }
  if (candidates.length === 1) {
    return candidates.map((s) => ({ ...s, verified: true, verifyNote: 'single source or thin content' }));
  }

  const prompt = [
    `Research topic: ${query}`,
    'Mark which sources are relevant and likely trustworthy for a cited report.',
    'Sources:',
    ...candidates.map((s) => `${s.id} | ${s.title} | ${s.url} | ${s.snippet.slice(0, 200)}`),
    '',
    'Return ONLY JSON: {"keep":[{"id":"src-1","note":"why"}]}',
    'Drop sources that are off-topic, empty, or untrustworthy.',
  ].join('\n');

  const text = await chatText([
    { role: 'user', content: prompt, timestamp: new Date() },
  ], providerOverride);

  const parsed = extractJsonObject(text);
  const keep = Array.isArray(parsed?.keep) ? parsed.keep : [];
  const keepIds = new Set(keep.map((row) => String((row as { id?: string }).id ?? '')));

  if (keepIds.size === 0) {
    return candidates.map((s) => ({ ...s, verified: true, verifyNote: 'verify fallback' }));
  }

  const noteById = new Map<string, string>();
  for (const row of keep) {
    const id = String((row as { id?: string }).id ?? '');
    const note = String((row as { note?: string }).note ?? 'relevant');
    if (id) noteById.set(id, note);
  }

  return candidates
    .filter((s) => keepIds.has(s.id))
    .map((s) => ({
      ...s,
      verified: true,
      verifyNote: noteById.get(s.id) ?? 'relevant',
    }));
}

export function linkInlineCitations(
  body: string,
  sources: SourceCitation[],
  style: CitationStyleId = 'apa7',
): string {
  let linked = body;
  sources.forEach((source, index) => {
    const bracket = `[${source.id}]`;
    const citation = formatInlineCitation(style, source, index);
    const footnote = `[${citation}](${source.url} "${source.title}")`;
    linked = linked.split(bracket).join(footnote);
  });
  return linked;
}

export function renderReportMarkdown(report: DeepResearchReport): string {
  const style = parseCitationStyle(report.citationStyle);
  const lines: string[] = [
    `# ${report.title}`,
    '',
    '## Abstract',
    '',
    report.summary,
    '',
  ];

  for (const section of report.sections) {
    lines.push(
      `## ${section.heading}`,
      '',
      linkInlineCitations(section.body, report.sources, style),
      '',
    );
  }

  if (report.sources.length > 0) {
    lines.push(`## ${referencesHeading(style)}`, '');
    report.sources.forEach((source, index) => {
      lines.push(`${index + 1}. ${formatReferenceEntry(style, source, index)}`);
      lines.push('');
    });
  }

  lines.push(
    '---',
    '',
    `*Generated ${report.generatedAt} · ${style.toUpperCase()} · ${report.sources.length} sources*`,
  );

  return sanitizeCarinaProse(lines.join('\n'), { preserveWhitespace: true });
}

export function renderReportHtml(report: DeepResearchReport): string {
  const md = renderReportMarkdown(report);
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const body = escaped
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return '';
      return `<p>${line}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.title}</title></head><body>${body}</body></html>`;
}

export function formatGatewaySummary(report: DeepResearchReport, plainTextChannel: boolean): string {
  const sourceLines = report.sources.slice(0, plainTextChannel ? 5 : report.sources.length)
    .map((s) => `- ${s.title} (${s.url})`)
    .join('\n');

  const parts = [
    `Deep Research: ${report.title}`,
    '',
    report.summary,
    '',
    `Sections: ${report.sections.length} | Sources: ${report.sources.length}`,
  ];

  if (plainTextChannel && report.sources.length > 0) {
    parts.push('', 'Sources (truncated):', sourceLines);
  }

  return parts.join('\n');
}

export async function runDeepResearch(options: DeepResearchOptions): Promise<DeepResearchReport> {
  const sessionId = options.sessionId ?? 'deep-research';
  const depth = resolveResearchDepth(options.maxRounds ?? 3);
  const maxSources = options.maxSources ?? depth.maxSources;
  const maxQualityPasses = options.maxQualityPasses ?? Math.min(5, Math.max(1, Math.ceil((options.maxRounds ?? 3) / 2)));
  const parallelSearch = options.parallelSearch !== false;
  const citationStyle = parseCitationStyle(options.citationStyle);
  const progress = {
    onProgress: options.onProgress,
    onProgressEvent: options.onProgressEvent,
  };

  emitProgress('plan', `Planning ${depth.label} research (${depth.subQuestions} sub-questions)`, progress, {
    depth: depth.label,
    targetWords: depth.targetWords,
    maxSources,
  });
  const subQuestions = await planResearch(options.query, depth.subQuestions, options.providerOverride);
  if (subQuestions.length < 3) {
    throw new Error('Planning failed to produce enough sub-questions.');
  }
  emitProgress('plan', `Planned ${subQuestions.length} sub-questions`, progress, {
    subQuestions,
  });

  let { sources, searchQueries } = await gatherSourcesForQuestions(
    subQuestions,
    sessionId,
    maxSources,
    progress,
    parallelSearch,
    depth.sourcesPerQuestion,
    depth.pageChars,
    depth.searchCount,
  );

  if (sources.length === 0) {
    throw new Error(
      'Deep research found no web sources. Configure TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or SEARXNG_URL on core, then retry.',
    );
  }

  let qualityPass = 0;
  let report: DeepResearchReport | null = null;

  while (qualityPass <= maxQualityPasses) {
    let verifiedSources = sources;
    if (!options.skipVerify && sources.length > 0) {
      emitProgress('verify', 'Verifying sources', progress);
      verifiedSources = await verifySources(options.query, sources, options.providerOverride);
      emitProgress('verify', `Verified ${verifiedSources.length}/${sources.length} sources`, progress, {
        verified: verifiedSources.length,
        total: sources.length,
      });
    }

    emitProgress('synthesize', `Synthesising ${depth.label} report (~${depth.targetWords} words)`, progress);
    report = await synthesizeReport(
      options.query,
      subQuestions,
      verifiedSources,
      depth,
      options.providerOverride,
      citationStyle,
    );
    report.searchQueries = [...searchQueries];
    report.roundCount = qualityPass + 1;
    report.citationStyle = citationStyle;

    const quality = evaluateResearchQuality(report, { ...depth, maxSources });
    const passed = passesResearchQualityGate(report, { ...depth, maxSources });
    emitProgress(
      'quality_gate',
      passed ? 'Quality gate passed' : `Quality gate score ${quality.score} (need ${researchQualityThreshold()})`,
      progress,
      { score: quality.score, passed, reasons: quality.reasons, depth: depth.label },
    );

    if (passed) break;

    qualityPass += 1;
    if (qualityPass > maxQualityPasses) {
      const providerName = options.providerOverride?.name ?? llm.current().name;
      if (shouldEscalateStudentProvider(providerName)) {
        emitProgress('escalate', 'Escalating synthesis to teacher model', progress);
        const teacherOverride = resolveTeacherProviderOverride();
        report = await synthesizeReport(
          options.query,
          subQuestions,
          verifiedSources,
          depth,
          teacherOverride,
          citationStyle,
        );
        report.searchQueries = [...searchQueries];
        report.roundCount = qualityPass + 1;
        report.citationStyle = citationStyle;

        const teacherQuality = evaluateResearchQuality(report, { ...depth, maxSources });
        emitProgress(
          'quality_gate',
          `Teacher synthesis score ${teacherQuality.score}`,
          progress,
          {
            score: teacherQuality.score,
            passed: passesResearchQualityGate(report, { ...depth, maxSources }),
            reasons: teacherQuality.reasons,
            teacher: teacherOverride?.name,
          },
        );

        try {
          const escalation = await escalateToTeacher({
            userMessage: options.query,
            studentReply: report.summary,
            toolResults: quality.reasons.map((reason) => ({ output: reason })),
            failureReason: `Research quality gate failed: ${quality.reasons.join('; ')}`,
          });
          if (escalation.skillPath) {
            emitProgress('retain', `Retained skill: ${escalation.skill?.name ?? 'teacher-skill'}`, progress, {
              skillPath: escalation.skillPath,
            });
          }
        } catch {
          // skill retention must not block report delivery
        }
      }
      break;
    }

    const retryIndex = qualityPass % subQuestions.length;
    const retryQuestions = subQuestions.slice(retryIndex, retryIndex + 2);
    if (retryQuestions.length === 0) retryQuestions.push(subQuestions[retryIndex]!);

    emitProgress('search', `Quality retry ${qualityPass}: gathering more sources`, progress, {
      reasons: quality.reasons,
    });
    const remaining = Math.max(0, maxSources - sources.length);
    if (remaining > 0) {
      const extra = await gatherSourcesForQuestions(
        retryQuestions,
        sessionId,
        remaining,
        progress,
        parallelSearch,
        depth.sourcesPerQuestion,
        depth.pageChars,
        depth.searchCount,
      );
      sources = [...sources, ...extra.sources];
      searchQueries = [...searchQueries, ...extra.searchQueries];
    }
  }

  if (!report) {
    throw new Error('Research synthesis failed.');
  }

  const finalQuality = evaluateResearchQuality(report, { ...depth, maxSources });
  if (!passesResearchQualityGate(report, { ...depth, maxSources })) {
    if (!hasUsableResearchContent(report)) {
      throw new Error(
        `Research quality gate failed after ${report.roundCount} round(s): ${finalQuality.reasons.join('; ') || `score ${finalQuality.score}`}`,
      );
    }
    report = buildQualityRecoveryReport(report, options.query, finalQuality.reasons);
    emitProgress('quality_gate', 'Quality gate did not pass, saving partial research with evidence', progress, {
      score: finalQuality.score,
      reasons: finalQuality.reasons,
      partial: true,
    });
  }

  emitProgress('done', 'Research complete', progress, {
    title: report.title,
    sourceCount: report.sources.length,
  });

  if (options.saveToFile) {
    const content = options.outputFormat === 'html'
      ? renderReportHtml(report)
      : renderReportMarkdown(report);
    await fs.mkdir(path.dirname(options.saveToFile), { recursive: true });
    await fs.writeFile(options.saveToFile, content, 'utf8');
  }

  if (options.persist !== false) {
    const { saveResearchReport } = await import('../research/research-store.js');
    const saved = await saveResearchReport(report, {
      query: options.query,
      format: options.outputFormat === 'html' ? 'html' : 'both',
    });
    options.onSaved?.(saved);
  }

  return report;
}

export async function writeResearchReportFile(
  report: DeepResearchReport,
  format: 'markdown' | 'html' = 'markdown',
): Promise<string> {
  const dir = path.join(process.env.HOME ?? process.cwd(), '.carina', 'research');
  await fs.mkdir(dir, { recursive: true });
  const ext = format === 'html' ? 'html' : 'md';
  const filename = `research-${Date.now()}.${ext}`;
  const filePath = path.join(dir, filename);
  const content = format === 'html' ? renderReportHtml(report) : renderReportMarkdown(report);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}
