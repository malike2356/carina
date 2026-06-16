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

export interface DeepResearchOptions {
  query: string;
  maxRounds?: number;
  maxSources?: number;
  outputFormat?: 'markdown' | 'html';
  saveToFile?: string;
  providerOverride?: ProviderOverride;
  sessionId?: string;
  onProgress?: (line: string) => void;
  onProgressEvent?: ResearchProgressHandler;
  persist?: boolean;
  skipVerify?: boolean;
  maxQualityPasses?: number;
  parallelSearch?: boolean;
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
}

const autoConfirm: ConfirmFn = async () => true;

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

export function parseSubQuestions(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(?:\d+[\.\)]\s*|[-*]\s*)(.+)$/);
    if (!match?.[1]) continue;
    let q = match[1].trim();
    if (!q.endsWith('?')) q = `${q}?`;
    questions.push(q);
  }
  return [...new Set(questions)].slice(0, 5);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPageText(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: string; text?: string; body?: string };
      const text = parsed.content ?? parsed.text ?? parsed.body;
      if (typeof text === 'string') return text.slice(0, 8000);
    } catch {
      // fall through
    }
  }
  if (/<html|<body|<div/i.test(trimmed)) return stripHtml(trimmed).slice(0, 8000);
  return trimmed.slice(0, 8000);
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
  providerOverride?: ProviderOverride,
): Promise<string[]> {
  const prompt = [
    'You are planning a multi-source research report.',
    `Main topic: ${query}`,
    'Return exactly 3 to 5 specific sub-questions that must be answered to cover this topic well.',
    'Format as a numbered list only. No preamble.',
  ].join('\n');

  const text = await chatText([
    { role: 'user', content: prompt, timestamp: new Date() },
  ], providerOverride);

  const questions = parseSubQuestions(text);
  if (questions.length >= 3) return questions;

  return [
    `What is the current state of ${query}?`,
    `What recent changes or updates apply to ${query}?`,
    `What are the key facts and figures about ${query}?`,
  ];
}

async function gatherSourcesForQuestions(
  questions: string[],
  sessionId: string,
  maxSources: number,
  progress: Pick<DeepResearchOptions, 'onProgress' | 'onProgressEvent'>,
  parallelSearch: boolean,
): Promise<{ sources: SourceCitation[]; searchQueries: string[] }> {
  const sources: SourceCitation[] = [];
  const searchQueries: string[] = [];
  let sourceCounter = 1;

  const ingestHits = async (question: string, hits: Array<{ title: string; url: string; description: string }>) => {
    searchQueries.push(question);
    for (const hit of hits.slice(0, 3)) {
      if (sources.length >= maxSources) break;
      if (!hit.url.startsWith('https://')) continue;
      if (sources.some((s) => s.url === hit.url)) continue;

      emitProgress('extract', `Reading: ${hit.url}`, progress);
      const pageText = await fetchPageText(hit.url, sessionId);
      const id = `src-${sourceCounter}`;
      sourceCounter += 1;
      sources.push({
        id,
        title: hit.title || hit.url,
        url: hit.url,
        snippet: (pageText || hit.description || hit.title).slice(0, 8000),
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
        return { question, hits: await runWebSearchTool(question, sessionId) };
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
      const hits = await runWebSearchTool(question, sessionId);
      await ingestHits(question, hits);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitProgress('search', `Search skipped: ${msg}`, progress, { question });
    }
  }

  return { sources, searchQueries };
}

async function runWebSearchTool(
  query: string,
  sessionId: string,
): Promise<Array<{ title: string; url: string; description: string }>> {
  const result = await executeToolCall({
    type: 'tool_call',
    toolName: 'web-search',
    toolCallId: `research-search-${Date.now()}`,
    params: { query, count: 5 },
  }, autoConfirm, false, sessionId);

  if (Array.isArray(result)) {
    return result.map((hit) => ({
      title: String((hit as { title?: string }).title ?? ''),
      url: String((hit as { url?: string }).url ?? ''),
      description: String((hit as { description?: string }).description ?? ''),
    })).filter((h) => h.url);
  }

  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error(String((result as { error: string }).error));
  }

  return [];
}

async function fetchPageText(url: string, sessionId: string): Promise<string> {
  const result = await executeToolCall({
    type: 'tool_call',
    toolName: 'http-request',
    toolCallId: `research-fetch-${Date.now()}`,
    params: { method: 'GET', url },
  }, autoConfirm, true, sessionId);

  if (result && typeof result === 'object') {
    if ('error' in result) return '';
    const body = (result as { body?: string }).body;
    if (typeof body === 'string') return extractPageText(body);
  }
  return '';
}

async function synthesizeReport(
  query: string,
  subQuestions: string[],
  sources: SourceCitation[],
  providerOverride?: ProviderOverride,
): Promise<DeepResearchReport> {
  const sourceBlock = sources.map((s) => (
    `[${s.id}] ${s.title}\nURL: ${s.url}\nContent: ${s.snippet}`
  )).join('\n\n');

  const prompt = [
    `Write a structured research report on: ${query}`,
    'Research plan sub-questions:',
    ...subQuestions.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Sources (cite using source IDs in brackets, e.g. [src-1]):',
    sourceBlock,
    '',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "title": string,',
    '  "summary": string (2-3 sentences),',
    '  "sections": [{ "heading": string, "body": string, "sourceCitations": string[] }]',
    '}',
    'Include at least 3 section headings.',
  ].join('\n');

  const text = await chatText([
    { role: 'user', content: prompt, timestamp: new Date() },
  ], providerOverride);

  const parsed = extractJsonObject(text);
  const title = String(parsed?.title ?? `Research: ${query}`);
  const summary = String(parsed?.summary ?? 'Summary unavailable.');
  const rawSections = Array.isArray(parsed?.sections) ? parsed.sections : [];

  const sections: ResearchSection[] = rawSections.map((section) => {
    const row = section as Record<string, unknown>;
    return {
      heading: String(row.heading ?? 'Section'),
      body: String(row.body ?? ''),
      sourceCitations: Array.isArray(row.sourceCitations)
        ? row.sourceCitations.map(String)
        : [],
    };
  });

  if (sections.length === 0) {
    sections.push({
      heading: 'Findings',
      body: text,
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

export function linkInlineCitations(body: string, sources: SourceCitation[]): string {
  let linked = body;
  for (const source of sources) {
    const bracket = `[${source.id}]`;
    const footnote = `[${source.id}](${source.url} "${source.title}")`;
    linked = linked.split(bracket).join(footnote);
  }
  return linked;
}

export function renderReportMarkdown(report: DeepResearchReport): string {
  const lines: string[] = [
    `# ${report.title}`,
    '',
    '## Executive Summary',
    '',
    report.summary,
    '',
  ];

  for (const section of report.sections) {
    lines.push(`## ${section.heading}`, '', linkInlineCitations(section.body, report.sources), '');
    if (section.sourceCitations.length > 0) {
      lines.push(
        `_Citations: ${section.sourceCitations.join(', ')}_`,
        '',
      );
    }
  }

  lines.push('## Sources', '');
  for (const source of report.sources) {
    const verified = source.verified === false ? ' (unverified)' : '';
    lines.push(`- [${source.id}] [${source.title}](${source.url})${verified}`);
    if (source.verifyNote) lines.push(`  - verify: ${source.verifyNote}`);
  }

  lines.push('', '## Source Provenance', '');
  for (const source of report.sources) {
    lines.push(
      `- **${source.id}** | fetched ${source.fetchedAt} | ${source.url}`,
      `  - excerpt: ${source.snippet.slice(0, 160).replace(/\n/g, ' ')}...`,
    );
  }

  lines.push(
    '',
    '---',
    `Generated: ${report.generatedAt}`,
    `Search queries: ${report.searchQueries.length}`,
    `Rounds: ${report.roundCount}`,
    `Sources verified: ${report.sources.filter((s) => s.verified).length}/${report.sources.length}`,
  );

  return lines.join('\n');
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
  const maxSources = options.maxSources ?? 12;
  const maxQualityPasses = options.maxQualityPasses ?? 3;
  const parallelSearch = options.parallelSearch !== false;
  const progress = {
    onProgress: options.onProgress,
    onProgressEvent: options.onProgressEvent,
  };

  emitProgress('plan', 'Planning research sub-questions', progress);
  const subQuestions = await planResearch(options.query, options.providerOverride);
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
  );

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

    emitProgress('synthesize', 'Synthesising report', progress);
    report = await synthesizeReport(
      options.query,
      subQuestions,
      verifiedSources,
      options.providerOverride,
    );
    report.searchQueries = [...searchQueries];
    report.roundCount = qualityPass + 1;

    const quality = evaluateResearchQuality(report);
    const passed = passesResearchQualityGate(report);
    emitProgress(
      'quality_gate',
      passed ? 'Quality gate passed' : `Quality gate score ${quality.score} (need ${researchQualityThreshold()})`,
      progress,
      { score: quality.score, passed, reasons: quality.reasons },
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
          teacherOverride,
        );
        report.searchQueries = [...searchQueries];
        report.roundCount = qualityPass + 1;

        const teacherQuality = evaluateResearchQuality(report);
        emitProgress(
          'quality_gate',
          `Teacher synthesis score ${teacherQuality.score}`,
          progress,
          {
            score: teacherQuality.score,
            passed: passesResearchQualityGate(report),
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
      );
      for (const source of extra.sources) {
        if (sources.length >= maxSources) break;
        if (!sources.some((s) => s.url === source.url)) {
          sources.push(source);
        }
      }
      searchQueries.push(...extra.searchQueries);
    }
  }

  if (!report) {
    throw new Error('Research synthesis failed.');
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
    await saveResearchReport(report, {
      query: options.query,
      format: options.outputFormat === 'html' ? 'html' : 'both',
    });
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
