import { isBusinessPlan } from '../billing/plan-tier.js';
import { pool } from '../memory/db.js';
import { getSubscription } from './aiva-subscription-store.js';

export const KNOWLEDGE_CHAR_LIMIT = 50_000;
export const DOC_CHAR_LIMIT = 20_000;
export const FAQ_PAIR_CHAR_LIMIT = 500;

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

export function truncateDocumentText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= DOC_CHAR_LIMIT) return trimmed;
  return `${trimmed.slice(0, DOC_CHAR_LIMIT)}\n\n[Document truncated to ${DOC_CHAR_LIMIT.toLocaleString()} characters]`;
}
