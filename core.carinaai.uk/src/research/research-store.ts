import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { resolveCarinaHome } from '../config/paths.js';
import type { DeepResearchReport } from '../agents/deep-research.js';
import { renderReportHtml, renderReportMarkdown } from '../agents/deep-research.js';

export interface ResearchRecordMeta {
  id: string;
  title: string;
  query: string;
  summary: string;
  sourceCount: number;
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
  shareId: string;
  markdownPath: string;
  htmlPath?: string;
}

interface ResearchIndex {
  version: number;
  reports: ResearchRecordMeta[];
}

function researchDir(): string {
  return path.join(resolveCarinaHome(), 'research');
}

function indexPath(): string {
  return path.join(researchDir(), 'index.json');
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'report';
}

async function readIndex(): Promise<ResearchIndex> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw) as ResearchIndex;
    if (!Array.isArray(parsed.reports)) return { version: 1, reports: [] };
    return parsed;
  } catch {
    return { version: 1, reports: [] };
  }
}

async function writeIndex(index: ResearchIndex): Promise<void> {
  await fs.mkdir(researchDir(), { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(index, null, 2), 'utf8');
}

export function buildShareId(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 12);
}

export async function saveResearchReport(
  report: DeepResearchReport,
  options: { query: string; format?: 'markdown' | 'html' | 'both' } = { query: report.title, format: 'both' },
): Promise<ResearchRecordMeta> {
  const dir = researchDir();
  await fs.mkdir(dir, { recursive: true });

  const id = randomUUID();
  const stamp = Date.now();
  const base = `${stamp}-${slugify(report.title)}`;
  const markdownPath = path.join(dir, `${base}.md`);
  const htmlPath = path.join(dir, `${base}.html`);

  await fs.writeFile(markdownPath, renderReportMarkdown(report), 'utf8');
  if (options.format === 'html' || options.format === 'both') {
    await fs.writeFile(htmlPath, renderReportHtml(report), 'utf8');
  }

  const meta: ResearchRecordMeta = {
    id,
    title: report.title,
    query: options.query,
    summary: report.summary,
    sourceCount: report.sources.length,
    sectionCount: report.sections.length,
    createdAt: report.generatedAt,
    updatedAt: new Date().toISOString(),
    shareId: buildShareId(options.query),
    markdownPath,
    htmlPath: options.format === 'markdown' ? undefined : htmlPath,
  };

  const index = await readIndex();
  index.reports.unshift(meta);
  index.reports = index.reports.slice(0, 200);
  await writeIndex(index);

  return meta;
}

export async function listResearchReports(limit = 30): Promise<ResearchRecordMeta[]> {
  const index = await readIndex();
  return index.reports.slice(0, Math.min(100, limit));
}

export async function getResearchReport(idOrShare: string): Promise<{
  meta: ResearchRecordMeta;
  markdown: string;
  html?: string;
} | null> {
  const index = await readIndex();
  const meta = index.reports.find((r) => r.id === idOrShare || r.shareId === idOrShare);
  if (!meta) return null;

  const markdown = await fs.readFile(meta.markdownPath, 'utf8');
  let html: string | undefined;
  if (meta.htmlPath) {
    try {
      html = await fs.readFile(meta.htmlPath, 'utf8');
    } catch {
      html = undefined;
    }
  }
  return { meta, markdown, html };
}

export async function updateResearchReport(
  id: string,
  patch: { title?: string; markdown?: string },
): Promise<ResearchRecordMeta | null> {
  const index = await readIndex();
  const idx = index.reports.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const meta = index.reports[idx]!;
  if (patch.title) meta.title = patch.title;
  if (patch.markdown) {
    await fs.writeFile(meta.markdownPath, patch.markdown, 'utf8');
    if (meta.htmlPath) {
      await fs.unlink(meta.htmlPath).catch(() => undefined);
      meta.htmlPath = undefined;
    }
  }
  meta.updatedAt = new Date().toISOString();
  index.reports[idx] = meta;
  await writeIndex(index);
  return meta;
}
