import fs from 'node:fs/promises';
import path from 'node:path';
import { llm, type ProviderOverride } from '../brain/llm.js';
import type { Message } from '../types/index.js';
import { executeToolCall, type ConfirmFn } from './tool-runner.js';

export interface DeepResearchOptions {
  query: string;
  maxRounds?: number;
  maxSources?: number;
  outputFormat?: 'markdown' | 'html';
  saveToFile?: string;
  providerOverride?: ProviderOverride;
  sessionId?: string;
  onProgress?: (line: string) => void;
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

function emitProgress(line: string, onProgress?: (line: string) => void): void {
  onProgress?.(line);
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
    lines.push(`## ${section.heading}`, '', section.body, '');
  }

  lines.push('## Sources', '');
  for (const source of report.sources) {
    lines.push(`- [${source.id}] [${source.title}](${source.url})`);
  }

  lines.push(
    '',
    `---`,
    `Generated: ${report.generatedAt}`,
    `Search queries: ${report.searchQueries.length}`,
    `Rounds: ${report.roundCount}`,
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
  const searchRoundCount = Math.max(1, (options.maxRounds ?? 4) - 1);
  const onProgress = options.onProgress;

  emitProgress('Planning...', onProgress);
  const subQuestions = await planResearch(options.query, options.providerOverride);
  if (subQuestions.length < 3) {
    throw new Error('Planning failed to produce enough sub-questions.');
  }

  const sources: SourceCitation[] = [];
  const searchQueries: string[] = [];
  let sourceCounter = 1;

  for (let round = 0; round < searchRoundCount && sources.length < maxSources; round += 1) {
    const question = subQuestions[round % subQuestions.length]!;
    emitProgress(`Searching: ${question}`, onProgress);
    searchQueries.push(question);

    let hits: Array<{ title: string; url: string; description: string }>;
    try {
      hits = await runWebSearchTool(question, sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitProgress(`Search skipped: ${msg}`, onProgress);
      continue;
    }

    for (const hit of hits.slice(0, 3)) {
      if (sources.length >= maxSources) break;
      if (!hit.url.startsWith('https://')) continue;
      if (sources.some((s) => s.url === hit.url)) continue;

      emitProgress(`Reading: ${hit.url}`, onProgress);
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
  }

  emitProgress('Synthesising...', onProgress);
  const report = await synthesizeReport(
    options.query,
    subQuestions,
    sources,
    options.providerOverride,
  );

  report.searchQueries = searchQueries;
  report.roundCount = searchRoundCount + 1;

  if (options.saveToFile) {
    const content = options.outputFormat === 'html'
      ? renderReportHtml(report)
      : renderReportMarkdown(report);
    await fs.mkdir(path.dirname(options.saveToFile), { recursive: true });
    await fs.writeFile(options.saveToFile, content, 'utf8');
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
