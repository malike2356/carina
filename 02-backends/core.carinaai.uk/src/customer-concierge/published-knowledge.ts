/**
 * Published knowledge search with citations (Prompt 702).
 * Visitors never see draft/archived/unpublished sources.
 */
import { pool } from '../memory/db.js';

export type KnowledgePublishState = 'draft' | 'published' | 'archived';

export interface PublishedKnowledgeHit {
  id: string;
  title: string;
  type: 'document' | 'faq';
  excerpt: string;
  revision: number;
  publishState: KnowledgePublishState;
  confidence: number;
}

export interface GroundedAnswerResult {
  grounded: boolean;
  confidence: number;
  citations: Array<{ id: string; title: string; revision: number }>;
  excerpts: string[];
  fallbackReason?: string;
}

const SENSITIVE_INTENT_RE =
  /\b(refund|chargeback|lawsuit|solicitor|attorney|legal advice|diagnos|prescri|medical advice|password reset|2fa|mfa|account takeover|security incident|data breach|hacked)\b/i;

export function detectSensitiveIntent(text: string): string | null {
  const m = text.match(SENSITIVE_INTENT_RE);
  return m?.[1]?.toLowerCase() ?? (m ? m[0].toLowerCase() : null);
}

export async function searchPublishedKnowledge(input: {
  workerId: string;
  workspaceId: string;
  query: string;
  knowledgeSourceIds: string[];
  includeDraft?: boolean;
  limit?: number;
}): Promise<PublishedKnowledgeHit[]> {
  const ids = input.knowledgeSourceIds.filter(Boolean);
  if (ids.length === 0) return [];

  const terms = input.query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 8);

  const states = input.includeDraft ? ['published', 'draft'] : ['published'];
  const params: unknown[] = [input.workerId, input.workspaceId, ids, states];
  let whereExtra = '';
  if (terms.length > 0) {
    const clauses = terms.map((_, i) => {
      params.push(`%${terms[i]}%`);
      return `(lower(title) LIKE $${params.length} OR lower(content) LIKE $${params.length})`;
    });
    whereExtra = `AND (${clauses.join(' OR ')})`;
  }
  const limit = Math.min(8, Math.max(1, input.limit ?? 4));
  params.push(limit);

  const result = await pool.query(
    `SELECT id, type, title, content, revision, publish_state
     FROM aiva_knowledge_base
     WHERE worker_id = $1
       AND workspace_id = $2
       AND enabled = true
       AND id = ANY($3::uuid[])
       AND publish_state = ANY($4::text[])
       ${whereExtra}
     ORDER BY
       CASE publish_state WHEN 'published' THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows.map((row) => {
    const content = String(row.content ?? '');
    const title = String(row.title ?? 'Source');
    const excerpt = content.slice(0, 500).trim();
    const hay = `${title}\n${content}`.toLowerCase();
    const hits = terms.filter((t) => hay.includes(t)).length;
    const confidence = terms.length === 0
      ? 0.35
      : Math.min(0.95, 0.35 + hits / Math.max(1, terms.length) * 0.6);
    return {
      id: String(row.id),
      title,
      type: String(row.type) as 'document' | 'faq',
      excerpt,
      revision: Number(row.revision ?? 1),
      publishState: String(row.publish_state) as KnowledgePublishState,
      confidence,
    };
  });
}

export function buildGroundedAnswer(input: {
  query: string;
  hits: PublishedKnowledgeHit[];
  minConfidence?: number;
}): GroundedAnswerResult {
  const min = input.minConfidence ?? 0.45;
  const sensitive = detectSensitiveIntent(input.query);
  if (sensitive) {
    return {
      grounded: false,
      confidence: 0,
      citations: [],
      excerpts: [],
      fallbackReason: `sensitive_intent:${sensitive}`,
    };
  }
  if (input.hits.length === 0) {
    return {
      grounded: false,
      confidence: 0,
      citations: [],
      excerpts: [],
      fallbackReason: 'no_published_match',
    };
  }
  const best = Math.max(...input.hits.map((h) => h.confidence));
  if (best < min) {
    return {
      grounded: false,
      confidence: best,
      citations: input.hits.slice(0, 3).map((h) => ({
        id: h.id,
        title: h.title,
        revision: h.revision,
      })),
      excerpts: input.hits.slice(0, 2).map((h) => h.excerpt),
      fallbackReason: 'low_confidence',
    };
  }
  return {
    grounded: true,
    confidence: best,
    citations: input.hits.slice(0, 5).map((h) => ({
      id: h.id,
      title: h.title,
      revision: h.revision,
    })),
    excerpts: input.hits.slice(0, 4).map((h) => h.excerpt),
  };
}

export async function setKnowledgePublishState(input: {
  workerId: string;
  workspaceId: string;
  entryId: string;
  publishState: KnowledgePublishState;
  createdBy?: string | null;
}): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM aiva_knowledge_base
       WHERE worker_id = $1 AND workspace_id = $2 AND id = $3
       FOR UPDATE`,
      [input.workerId, input.workspaceId, input.entryId],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    const row = current.rows[0] as Record<string, unknown>;
    const nextRevision = Number(row.revision ?? 1) + (input.publishState === 'published' ? 1 : 0);
    const revisionToStore = input.publishState === 'published' ? nextRevision : Number(row.revision ?? 1);
    await client.query(
      `UPDATE aiva_knowledge_base SET
         publish_state = $4,
         published_at = CASE WHEN $4 = 'published' THEN NOW() ELSE published_at END,
         revision = $5,
         enabled = CASE WHEN $4 = 'archived' THEN false ELSE enabled END
       WHERE id = $3 AND worker_id = $1 AND workspace_id = $2`,
      [input.workerId, input.workspaceId, input.entryId, input.publishState, revisionToStore],
    );
    await client.query(
      `INSERT INTO aiva_knowledge_revisions (
         entry_id, worker_id, workspace_id, revision, title, content, publish_state, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (entry_id, revision) DO NOTHING`,
      [
        input.entryId,
        input.workerId,
        input.workspaceId,
        revisionToStore,
        String(row.title),
        String(row.content),
        input.publishState,
        input.createdBy ?? null,
      ],
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listKnowledgeRevisions(input: {
  workerId: string;
  entryId: string;
}): Promise<Array<{ revision: number; title: string; publishState: string; createdAt: string }>> {
  const result = await pool.query(
    `SELECT revision, title, publish_state, created_at
     FROM aiva_knowledge_revisions
     WHERE worker_id = $1 AND entry_id = $2
     ORDER BY revision DESC
     LIMIT 50`,
    [input.workerId, input.entryId],
  );
  return result.rows.map((row) => ({
    revision: Number(row.revision),
    title: String(row.title),
    publishState: String(row.publish_state),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}
