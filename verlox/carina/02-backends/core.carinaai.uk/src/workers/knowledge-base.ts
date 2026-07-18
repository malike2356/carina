import { isBusinessPlan } from '../billing/plan-tier.js';
import { pool } from '../memory/db.js';
import { getSubscription } from './aiva-subscription-store.js';

export const KNOWLEDGE_CHAR_LIMIT = 50_000;
export const DOC_CHAR_LIMIT = 20_000;
/** Ops Drive / capture docs are editable copies; they are not injected into the RAG persona budget. */
export const OPS_DOC_CHAR_LIMIT = 200_000;
export const FAQ_PAIR_CHAR_LIMIT = 500;

/** Defaults for Ops Drive claim, sync, capture, and bootstrap document writes. */
export const OPS_KNOWLEDGE_WRITE = {
  enabled: false,
  countTowardLimit: false,
  maxChars: OPS_DOC_CHAR_LIMIT,
} as const;

export interface KnowledgeEntry {
  id: string;
  workerId: string;
  workspaceId: string;
  type: 'document' | 'faq';
  title: string;
  content: string;
  charCount: number;
  enabled: boolean;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    type: String(row.type) as 'document' | 'faq',
    title: String(row.title),
    content: String(row.content),
    charCount: Number(row.char_count ?? 0),
    enabled: Boolean(row.enabled),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listKnowledgeEntries(workerId: string): Promise<KnowledgeEntry[]> {
  const result = await pool.query(
    `SELECT * FROM aiva_knowledge_base
     WHERE worker_id = $1
     ORDER BY type, created_at ASC`,
    [workerId],
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export interface KnowledgeSummary {
  id: string;
  type: 'document' | 'faq';
  title: string;
  charCount: number;
  enabled: boolean;
  createdAt: string;
  preview?: string;
}

export async function listKnowledgeSummaries(workerId: string): Promise<KnowledgeSummary[]> {
  const entries = await listKnowledgeEntries(workerId);
  return entries.map((entry) => {
    let preview: string | undefined;
    if (entry.type === 'faq') {
      const match = entry.content.match(/^A:\s*(.+)$/m);
      preview = match?.[1]?.trim() ?? entry.content;
    }
    return {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      charCount: entry.charCount,
      enabled: entry.enabled,
      createdAt: entry.createdAt,
      preview,
    };
  });
}

const KNOWLEDGE_SECTION_START = '--- Knowledge Base ---';
const KNOWLEDGE_SECTION_END = '--- End Knowledge Base ---';

export function stripKnowledgeFromPersona(personaPrompt: string): string {
  const start = personaPrompt.indexOf(KNOWLEDGE_SECTION_START);
  if (start === -1) return personaPrompt.trimEnd();
  return personaPrompt.slice(0, start).trimEnd();
}

export async function workspaceHasKnowledgeAccess(workspaceId: string): Promise<boolean> {
  const sub = await getSubscription(workspaceId);
  return isBusinessPlan(sub?.planTier ?? 'trial');
}

export async function resolvePersonaWithKnowledge(
  workerId: string,
  basePersona: string,
  workspaceId: string,
): Promise<string> {
  const stripped = stripKnowledgeFromPersona(basePersona);
  if (!(await workspaceHasKnowledgeAccess(workspaceId))) {
    return stripped;
  }
  return appendKnowledgeToPersona(stripped, workerId);
}

export async function getKnowledgeCharTotal(workerId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(char_count), 0)::int AS total
     FROM aiva_knowledge_base
     WHERE worker_id = $1 AND enabled = true`,
    [workerId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function appendKnowledgeToPersona(
  personaPrompt: string,
  workerId: string,
): Promise<string> {
  const result = await pool.query(
    `SELECT type, title, content FROM aiva_knowledge_base
     WHERE worker_id = $1 AND enabled = true
     ORDER BY type, created_at ASC`,
    [workerId],
  );
  if (result.rows.length === 0) return personaPrompt;

  const kbSection = [
    '--- Knowledge Base ---',
    'Use the following information to answer questions accurately. Prioritize this information over general knowledge when it is relevant.',
    '',
    ...result.rows.map((row) =>
      String(row.type) === 'faq'
        ? String(row.content)
        : `[${String(row.title)}]\n${String(row.content)}`,
    ),
    '--- End Knowledge Base ---',
  ].join('\n');

  return `${personaPrompt}\n\n${kbSection}`;
}

export async function extractDocumentText(filename: string, buffer: Buffer): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.txt')) {
    return buffer.toString('utf8');
  }
  if (lower.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return String(data.text ?? '');
  }
  if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return String(result.value ?? '');
  }
  throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
}

export function truncateDocumentText(text: string, maxChars: number = DOC_CHAR_LIMIT): string {
  const limit = Math.max(1, maxChars);
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}\n\n[Document truncated to ${limit.toLocaleString()} characters]`;
}

export async function getKnowledgeEntry(
  workerId: string,
  entryId: string,
): Promise<KnowledgeEntry | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_knowledge_base WHERE worker_id = $1 AND id = $2`,
    [workerId, entryId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function insertKnowledgeDocument(input: {
  workerId: string;
  workspaceId: string;
  title: string;
  content: string;
  /** When false, doc is stored for Ops editing but not injected into the worker persona. Default true. */
  enabled?: boolean;
  /** When false, skip the 50k enabled-knowledge budget check. Defaults to matching `enabled`. */
  countTowardLimit?: boolean;
  maxChars?: number;
}): Promise<KnowledgeEntry> {
  const enabled = input.enabled !== false;
  const countTowardLimit = input.countTowardLimit ?? enabled;
  const content = truncateDocumentText(input.content, input.maxChars ?? DOC_CHAR_LIMIT);
  const charCount = content.length;
  if (countTowardLimit) {
    const currentTotal = await getKnowledgeCharTotal(input.workerId);
    if (currentTotal + charCount > KNOWLEDGE_CHAR_LIMIT) {
      throw new Error(`Knowledge base limit (${KNOWLEDGE_CHAR_LIMIT} chars) would be exceeded`);
    }
  }
  const result = await pool.query(
    `INSERT INTO aiva_knowledge_base (worker_id, workspace_id, type, title, content, char_count, enabled)
     VALUES ($1, $2, 'document', $3, $4, $5, $6)
     RETURNING *`,
    [
      input.workerId,
      input.workspaceId,
      input.title.trim() || 'Document',
      content,
      charCount,
      enabled,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function updateKnowledgeDocument(input: {
  workerId: string;
  entryId: string;
  title?: string;
  content?: string;
  countTowardLimit?: boolean;
  maxChars?: number;
}): Promise<KnowledgeEntry> {
  const existing = await getKnowledgeEntry(input.workerId, input.entryId);
  if (!existing || existing.type !== 'document') {
    throw new Error('Document not found');
  }
  const title = input.title !== undefined ? input.title.trim() || existing.title : existing.title;
  const content =
    input.content !== undefined
      ? truncateDocumentText(input.content, input.maxChars ?? DOC_CHAR_LIMIT)
      : existing.content;
  const charCount = content.length;
  const countTowardLimit = input.countTowardLimit ?? existing.enabled;
  if (countTowardLimit) {
    const currentTotal = await getKnowledgeCharTotal(input.workerId);
    const previousCounted = existing.enabled ? existing.charCount : 0;
    const adjusted = currentTotal - previousCounted + charCount;
    if (adjusted > KNOWLEDGE_CHAR_LIMIT) {
      throw new Error(`Knowledge base limit (${KNOWLEDGE_CHAR_LIMIT} chars) would be exceeded`);
    }
  }
  const result = await pool.query(
    `UPDATE aiva_knowledge_base
     SET title = $3, content = $4, char_count = $5
     WHERE worker_id = $1 AND id = $2
     RETURNING *`,
    [input.workerId, input.entryId, title, content, charCount],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function deleteKnowledgeEntry(workerId: string, entryId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM aiva_knowledge_base WHERE worker_id = $1 AND id = $2`,
    [workerId, entryId],
  );
  return (result.rowCount ?? 0) > 0;
}
