import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../memory/db.js';
import type {
  BlogIncident,
  BlogSubscriber,
  IncidentCategory,
  IncidentListSort,
  IncidentStatus,
  ResearchRun,
} from './types.js';
import { generateIncidentPage } from './page-generator.js';
import { generateSlug } from './slug.js';

function parseSources(raw: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const label = String(obj.label ?? '').trim();
      const url = String(obj.url ?? '').trim();
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((entry): entry is { label: string; url: string } => entry !== null);
}

function rowToIncident(row: Record<string, unknown>): BlogIncident {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    company: String(row.company),
    damage: String(row.damage),
    category: String(row.category) as IncidentCategory,
    dateOccurred: String(row.date_occurred),
    bodyHtml: String(row.body_html),
    sources: parseSources(row.sources_json),
    scoutFixHtml: String(row.scout_fix_html),
    status: String(row.status) as IncidentStatus,
    publishedAt: row.published_at ? new Date(String(row.published_at)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? new Date(String(row.approved_at)) : null,
    newsletterSent: Boolean(row.newsletter_sent),
    newsletterSentAt: row.newsletter_sent_at ? new Date(String(row.newsletter_sent_at)) : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
  };
}

function rowToSubscriber(row: Record<string, unknown>): BlogSubscriber {
  return {
    id: String(row.id),
    email: String(row.email),
    subscribedAt: new Date(String(row.subscribed_at)),
    confirmed: Boolean(row.confirmed),
    confirmToken: row.confirm_token ? String(row.confirm_token) : null,
    unsubscribedAt: row.unsubscribed_at ? new Date(String(row.unsubscribed_at)) : null,
    lastSentAt: row.last_sent_at ? new Date(String(row.last_sent_at)) : null,
    source: String(row.source ?? 'incidents-page'),
  };
}

function stripTags(input: string): string {
  return input
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function incidentBlockToRow(block: string, category: IncidentCategory): CreateIncidentInput | null {
  const titleMatch = block.match(/<span class="ir-incident-company">([\s\S]*?)<\/span>/i);
  const damageMatch = block.match(/<span class="ir-incident-damage">([\s\S]*?)<\/span>/i);
  const dateMatch = block.match(/<span class="ir-incident-date">([\s\S]*?)<\/span>/i);
  const bodyMatch = block.match(/<p class="ir-incident-body">([\s\S]*?)<\/p>/i);
  const scoutFixMatch = block.match(/Scout fix:\s*([\s\S]*?)(?:<\/span>|<\/footer>|$)/i);
  const sources = [...block.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ label: stripTags(match[2] ?? ''), url: match[1] ?? '' }))
    .filter((entry) => entry.label && entry.url);

  if (!titleMatch || !damageMatch || !dateMatch || !bodyMatch || !scoutFixMatch) return null;

  return {
    title: stripTags(titleMatch[1] ?? ''),
    company: stripTags(titleMatch[1] ?? ''),
    damage: stripTags(damageMatch[1] ?? ''),
    category,
    dateOccurred: stripTags(dateMatch[1] ?? ''),
    bodyHtml: bodyMatch[1].trim(),
    sources,
    scoutFixHtml: stripTags(scoutFixMatch[1] ?? ''),
    status: 'published',
  };
}

async function seedFromStaticIncidentPage(force = false): Promise<void> {
  if (!force) {
    const existing = await pool.query(`SELECT COUNT(*)::text AS count FROM incident_blog`);
    if (Number(existing.rows[0]?.count ?? 0) > 0) return;
  } else {
    const published = await pool.query(`SELECT COUNT(*)::text AS count FROM incident_blog WHERE status = 'published'`);
    if (Number(published.rows[0]?.count ?? 0) > 0) return;
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const candidates = [
    path.join(root, 'labyrinthscout.com', 'incidents', 'index.legacy.html'),
    path.join(root, 'labyrinthscout.com', 'incidents', 'index.html'),
    path.join(root, '..', '..', 'frontends', 'marketing', 'labyrinthscout.com', 'incidents', 'index.html'),
    '/var/www/labyrinthscout.com/incidents/index.legacy.html',
    '/var/www/labyrinthscout.com/incidents/index.html',
  ];
  let html = '';
  for (const pagePath of candidates) {
    html = await fs.readFile(pagePath, 'utf8').catch(() => '');
    if (html.includes('CATEGORY 1: FINANCIAL')) break;
    html = '';
  }
  if (!html) return;

  const sections: Array<{ category: IncidentCategory; start: string; end: string }> = [
    { category: 'financial', start: '<!-- CATEGORY 1: FINANCIAL -->', end: '<!-- CATEGORY 2: SECURITY -->' },
    { category: 'security', start: '<!-- CATEGORY 2: SECURITY -->', end: '<!-- CATEGORY 3: BRAND DAMAGE -->' },
    { category: 'brand', start: '<!-- CATEGORY 3: BRAND DAMAGE -->', end: '<!-- CATEGORY 4: LEGAL LIABILITY -->' },
    { category: 'legal', start: '<!-- CATEGORY 4: LEGAL LIABILITY -->', end: '<!-- SCOUT ANSWER TABLE -->' },
  ];

  for (const section of sections) {
    const start = html.indexOf(section.start);
    const end = html.indexOf(section.end);
    if (start < 0 || end < 0 || end <= start) continue;
    const chunk = html.slice(start, end);
    const blocks = [...chunk.matchAll(/<article class="ir-incident"[^>]*>([\s\S]*?)<\/article>/gi)];
    for (const match of blocks) {
      const input = incidentBlockToRow(match[1] ?? '', section.category);
      if (!input) continue;
      const slug = generateSlug(input.title) || randomUUID();
      await pool.query(
        `INSERT INTO incident_blog
          (title, slug, company, damage, category, date_occurred, body_html, sources_json, scout_fix_html, status, published_at, newsletter_sent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'published', NOW(), FALSE)
         ON CONFLICT (slug) DO NOTHING`,
        [
          input.title,
          slug,
          input.company,
          input.damage,
          input.category,
          input.dateOccurred,
          input.bodyHtml,
          JSON.stringify(input.sources),
          input.scoutFixHtml,
        ],
      );
    }
  }
}

export interface CreateIncidentInput {
  title: string;
  slug?: string;
  company: string;
  damage: string;
  category: IncidentCategory;
  dateOccurred: string;
  bodyHtml: string;
  sources: Array<{ label: string; url: string }>;
  scoutFixHtml: string;
  status?: IncidentStatus;
}

export interface UpdateIncidentInput {
  title?: string;
  slug?: string;
  company?: string;
  damage?: string;
  category?: IncidentCategory;
  dateOccurred?: string;
  bodyHtml?: string;
  sources?: Array<{ label: string; url: string }>;
  scoutFixHtml?: string;
  status?: IncidentStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  publishedAt?: Date | null;
  newsletterSent?: boolean;
  newsletterSentAt?: Date | null;
  rejectionReason?: string | null;
}

async function ensureIncidentBlogReady(): Promise<void> {
  await ensureIncidentBlogSchema();
}

export async function ensurePublishedIncidentSeed(): Promise<number> {
  await ensureIncidentBlogSchema();
  const before = await pool.query(`SELECT COUNT(*)::text AS count FROM incident_blog WHERE status = 'published'`);
  const beforeCount = Number(before.rows[0]?.count ?? 0);
  if (beforeCount > 0) return beforeCount;
  await seedFromStaticIncidentPage(true);
  const after = await pool.query(`SELECT COUNT(*)::text AS count FROM incident_blog WHERE status = 'published'`);
  return Number(after.rows[0]?.count ?? 0);
}

export async function ensureIncidentBlogSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_blog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      damage TEXT NOT NULL,
      category TEXT NOT NULL,
      date_occurred TEXT NOT NULL,
      body_html TEXT NOT NULL,
      sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      scout_fix_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE,
      newsletter_sent_at TIMESTAMPTZ,
      rejection_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS incident_blog_subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      confirm_token TEXT,
      unsubscribed_at TIMESTAMPTZ,
      last_sent_at TIMESTAMPTZ,
      source TEXT DEFAULT 'incidents-page'
    );

    CREATE TABLE IF NOT EXISTS incident_research_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      triggered_by TEXT NOT NULL,
      found_count INTEGER NOT NULL DEFAULT 0,
      drafted_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      error_log TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_incident_blog_status ON incident_blog(status);
    CREATE INDEX IF NOT EXISTS idx_incident_blog_category ON incident_blog(category);
    CREATE INDEX IF NOT EXISTS idx_incident_blog_published_at ON incident_blog(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_incident_blog_slug ON incident_blog(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_blog_subscribers_email ON incident_blog_subscribers(email);
  `);
  await seedFromStaticIncidentPage().catch((err) => {
    console.warn('[blog] static incident seed skipped:', err instanceof Error ? err.message : String(err));
  });
}

export async function createIncident(input: CreateIncidentInput): Promise<BlogIncident> {
  await ensureIncidentBlogReady();
  const slug = input.slug?.trim() || generateSlug(input.title) || randomUUID();
  const result = await pool.query(
    `INSERT INTO incident_blog
      (title, slug, company, damage, category, date_occurred, body_html, sources_json, scout_fix_html, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
     RETURNING *`,
    [
      input.title.trim(),
      slug,
      input.company.trim(),
      input.damage.trim(),
      input.category,
      input.dateOccurred.trim(),
      input.bodyHtml.trim(),
      JSON.stringify(input.sources ?? []),
      input.scoutFixHtml.trim(),
      input.status ?? 'draft',
    ],
  );
  const incident = rowToIncident(result.rows[0]);
  if (incident.status === 'published') {
    await generateIncidentPage().catch((err) => {
      console.warn('[blog] page generation failed during create:', err);
    });
  }
  return incident;
}

export async function getIncident(idOrSlug: string): Promise<BlogIncident | null> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT * FROM incident_blog WHERE id::text = $1 OR slug = $1 LIMIT 1`,
    [idOrSlug],
  );
  if (result.rows.length === 0) return null;
  return rowToIncident(result.rows[0]);
}

function incidentListFilter(opts: {
  status?: IncidentStatus;
  category?: IncidentCategory;
}): { where: string; params: unknown[]; nextIdx: number } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (opts.status) {
    clauses.push(`status = $${idx++}`);
    params.push(opts.status);
  }
  if (opts.category) {
    clauses.push(`category = $${idx++}`);
    params.push(opts.category);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params, nextIdx: idx };
}

function incidentListOrderBy(sort: IncidentListSort = 'newest'): string {
  if (sort === 'incident_date') {
    return 'date_occurred DESC NULLS LAST, created_at DESC';
  }
  if (sort === 'updated') {
    return 'updated_at DESC NULLS LAST, created_at DESC';
  }
  return 'created_at DESC';
}

export function parseIncidentListSort(value: unknown): IncidentListSort {
  const raw = String(value ?? '').trim();
  if (raw === 'incident_date' || raw === 'updated') return raw;
  return 'newest';
}

export async function countIncidents(opts: {
  status?: IncidentStatus;
  category?: IncidentCategory;
} = {}): Promise<number> {
  await ensureIncidentBlogReady();
  const { where, params } = incidentListFilter(opts);
  const result = await pool.query(
    `SELECT COUNT(*)::text AS count FROM incident_blog ${where}`,
    params,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getIncidentStatusStats(): Promise<{
  draftCount: number;
  approvedCount: number;
  publishedCount: number;
  rejectedCount: number;
}> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT status, COUNT(*)::text AS count FROM incident_blog GROUP BY status`,
  );
  const stats = {
    draftCount: 0,
    approvedCount: 0,
    publishedCount: 0,
    rejectedCount: 0,
  };
  for (const row of result.rows) {
    const count = Number(row.count ?? 0);
    const status = String(row.status);
    if (status === 'draft') stats.draftCount = count;
    else if (status === 'approved') stats.approvedCount = count;
    else if (status === 'published') stats.publishedCount = count;
    else if (status === 'rejected') stats.rejectedCount = count;
  }
  return stats;
}

export async function listIncidents(opts: {
  status?: IncidentStatus;
  category?: IncidentCategory;
  limit?: number;
  offset?: number;
  sort?: IncidentListSort;
} = {}): Promise<BlogIncident[]> {
  await ensureIncidentBlogReady();
  const { where, params, nextIdx } = incidentListFilter(opts);
  let idx = nextIdx;
  params.push(opts.limit ?? 100);
  params.push(opts.offset ?? 0);
  const orderBy = incidentListOrderBy(opts.sort);
  const result = await pool.query(
    `SELECT * FROM incident_blog ${where} ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
    params,
  );
  return result.rows.map(rowToIncident);
}

export async function updateIncident(id: string, data: UpdateIncidentInput): Promise<BlogIncident | null> {
  await ensureIncidentBlogReady();
  const current = await getIncident(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    title: data.title,
    slug: data.slug,
    company: data.company,
    damage: data.damage,
    category: data.category,
    date_occurred: data.dateOccurred,
    body_html: data.bodyHtml,
    sources_json: data.sources ? JSON.stringify(data.sources) : undefined,
    scout_fix_html: data.scoutFixHtml,
    status: data.status,
    approved_by: data.approvedBy,
    approved_at: data.approvedAt,
    published_at: data.publishedAt,
    newsletter_sent: data.newsletterSent,
    newsletter_sent_at: data.newsletterSentAt,
    rejection_reason: data.rejectionReason,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }
  if (fields.length === 0) return getIncident(id);
  params.push(id);
  const result = await pool.query(
    `UPDATE incident_blog SET ${fields.join(', ')}, updated_at = NOW() WHERE id::text = $${idx} RETURNING *`,
    params,
  );
  if (result.rows.length === 0) return null;
  const incident = rowToIncident(result.rows[0]);
  if (current?.status === 'published' || incident.status === 'published') {
    await generateIncidentPage().catch((err) => {
      console.warn('[blog] page generation failed during update:', err);
    });
  }
  return incident;
}

export async function deleteIncident(id: string): Promise<boolean> {
  await ensureIncidentBlogReady();
  const current = await getIncident(id);
  const result = await pool.query(`DELETE FROM incident_blog WHERE id::text = $1`, [id]);
  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted && current?.status === 'published') {
    await generateIncidentPage().catch((err) => {
      console.warn('[blog] page generation failed during delete:', err);
    });
  }
  return deleted;
}

export async function approveIncident(id: string, approvedBy: string): Promise<BlogIncident | null> {
  return updateIncident(id, {
    status: 'approved',
    approvedBy,
    approvedAt: new Date(),
  });
}

export async function publishIncident(id: string): Promise<BlogIncident | null> {
  return updateIncident(id, {
    status: 'published',
    publishedAt: new Date(),
  });
}

export async function rejectIncident(id: string, reason?: string): Promise<BlogIncident | null> {
  return updateIncident(id, {
    status: 'rejected',
    rejectionReason: reason ?? null,
  });
}

export async function rejectAllDrafts(reason = 'Cleared from draft queue'): Promise<number> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `UPDATE incident_blog
     SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
     WHERE status = 'draft'`,
    [reason],
  );
  return result.rowCount ?? 0;
}

export async function markNewsletterSent(id: string): Promise<void> {
  await ensureIncidentBlogReady();
  await pool.query(
    `UPDATE incident_blog SET newsletter_sent = TRUE, newsletter_sent_at = NOW(), updated_at = NOW() WHERE id::text = $1`,
    [id],
  );
}

export async function getPublishedIncidents(): Promise<BlogIncident[]> {
  await ensureIncidentBlogReady();
  const result = await pool.query(`SELECT * FROM incident_blog WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, created_at DESC`);
  return result.rows.map(rowToIncident);
}

export async function getUnsentNewsletterIncidents(): Promise<BlogIncident[]> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT * FROM incident_blog WHERE status = 'published' AND newsletter_sent = FALSE ORDER BY published_at DESC NULLS LAST, created_at DESC`,
  );
  return result.rows.map(rowToIncident);
}

export type SubscribeOutcome = 'already_confirmed' | 'pending' | 'confirmation_sent';

export interface SubscribeResult {
  subscriber: BlogSubscriber;
  outcome: SubscribeOutcome;
}

export async function getSubscriberByEmail(email: string): Promise<BlogSubscriber | null> {
  await ensureIncidentBlogReady();
  const normalized = email.trim().toLowerCase();
  const result = await pool.query(
    `SELECT * FROM incident_blog_subscribers WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if (result.rows.length === 0) return null;
  return rowToSubscriber(result.rows[0]);
}

export async function subscribe(email: string, source = 'incidents-page'): Promise<SubscribeResult> {
  await ensureIncidentBlogReady();
  const normalized = email.trim().toLowerCase();
  const existing = await getSubscriberByEmail(normalized);
  if (existing?.confirmed && !existing.unsubscribedAt) {
    return { subscriber: existing, outcome: 'already_confirmed' };
  }
  if (existing && !existing.confirmed && !existing.unsubscribedAt) {
    return { subscriber: existing, outcome: 'pending' };
  }

  const confirmToken = randomUUID();
  if (existing) {
    await pool.query(
      `UPDATE incident_blog_subscribers
       SET confirm_token = $2, confirmed = FALSE, unsubscribed_at = NULL, source = $3
       WHERE email = $1`,
      [normalized, confirmToken, source],
    );
  } else {
    await pool.query(
      `INSERT INTO incident_blog_subscribers (email, confirmed, confirm_token, source)
       VALUES ($1, FALSE, $2, $3)`,
      [normalized, confirmToken, source],
    );
  }
  const result = await pool.query(`SELECT * FROM incident_blog_subscribers WHERE email = $1`, [normalized]);
  return { subscriber: rowToSubscriber(result.rows[0]), outcome: 'confirmation_sent' };
}

export async function confirmSubscriber(token: string): Promise<boolean> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `UPDATE incident_blog_subscribers
     SET confirmed = TRUE, confirm_token = NULL
     WHERE confirm_token = $1
     RETURNING id`,
    [token],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function unsubscribe(email: string): Promise<boolean> {
  await ensureIncidentBlogReady();
  const normalized = email.trim().toLowerCase();
  const result = await pool.query(
    `UPDATE incident_blog_subscribers
     SET unsubscribed_at = NOW()
     WHERE email = $1
     RETURNING id`,
    [normalized],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listActiveSubscribers(): Promise<BlogSubscriber[]> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT * FROM incident_blog_subscribers
     WHERE confirmed = TRUE AND unsubscribed_at IS NULL
     ORDER BY subscribed_at DESC`,
  );
  return result.rows.map(rowToSubscriber);
}

export async function listSubscribers(): Promise<BlogSubscriber[]> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT * FROM incident_blog_subscribers ORDER BY subscribed_at DESC`,
  );
  return result.rows.map(rowToSubscriber);
}

export async function recordResearchRun(result: {
  found: number;
  drafted: number;
  skipped: number;
  errors: string[];
}, triggeredBy: string): Promise<void> {
  await ensureIncidentBlogReady();
  await pool.query(
    `INSERT INTO incident_research_runs
      (triggered_by, found_count, drafted_count, skipped_count, error_log)
     VALUES ($1,$2,$3,$4,$5)`,
    [triggeredBy, result.found, result.drafted, result.skipped, result.errors.join('\n') || null],
  );
}

function rowToResearchRun(row: Record<string, unknown>): ResearchRun {
  return {
    id: String(row.id),
    runAt: new Date(String(row.run_at)),
    triggeredBy: String(row.triggered_by),
    foundCount: Number(row.found_count ?? 0),
    draftedCount: Number(row.drafted_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    errorLog: row.error_log ? String(row.error_log) : null,
  };
}

export async function getLastResearchRun(): Promise<ResearchRun | null> {
  await ensureIncidentBlogReady();
  const result = await pool.query(
    `SELECT * FROM incident_research_runs ORDER BY run_at DESC LIMIT 1`,
  );
  if (result.rows.length === 0) return null;
  return rowToResearchRun(result.rows[0] as Record<string, unknown>);
}

export async function listResearchRuns(limit = 20): Promise<ResearchRun[]> {
  await ensureIncidentBlogReady();
  const capped = Math.min(100, Math.max(1, limit));
  const result = await pool.query(
    `SELECT * FROM incident_research_runs ORDER BY run_at DESC LIMIT $1`,
    [capped],
  );
  return result.rows.map((row) => rowToResearchRun(row as Record<string, unknown>));
}

void ensureIncidentBlogSchema().catch(() => undefined);
