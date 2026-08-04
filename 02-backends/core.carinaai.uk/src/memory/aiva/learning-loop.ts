import { createHash } from 'crypto';
import { pool } from '../db.js';
import {
  addWorkerPersistentFact,
  getWorkerMemoryBudgetStatus,
  listWorkerPersistentFacts,
  removeWorkerPersistentFact,
  type WorkerMemoryTarget,
} from './worker-persistent-memory.js';
import type { AivaChannelName } from '../../channels/types.js';

export type AivaLearningKind = 'fact' | 'preference' | 'decision' | 'lesson' | 'tool_failure';
export type AivaLearningStatus = 'pending' | 'approved' | 'removed' | 'auto_saved';

export interface AivaLearningItem {
  id: string;
  workspaceId: string;
  workerId: string;
  contactId: string | null;
  channel: string | null;
  kind: AivaLearningKind;
  content: string;
  confidence: number;
  status: AivaLearningStatus;
  sourceSessionId: string | null;
  sourceMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface AivaLearningCandidate {
  kind: AivaLearningKind;
  content: string;
  confidence: number;
  target: WorkerMemoryTarget;
  autoSave?: boolean;
}

let schemaReady: Promise<void> | null = null;
let schedulerStarted = false;

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapRow(row: Record<string, unknown>): AivaLearningItem {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    contactId: row.contact_id ? String(row.contact_id) : null,
    channel: row.channel ? String(row.channel) : null,
    kind: String(row.kind) as AivaLearningKind,
    content: String(row.content ?? ''),
    confidence: Number(row.confidence ?? 0),
    status: String(row.status ?? 'pending') as AivaLearningStatus,
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    sourceMessage: row.source_message ? String(row.source_message) : null,
    metadata: metadata(row.metadata_json),
    createdAt: new Date(String(row.created_at)).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
  };
}

export async function ensureAivaLearningSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aiva_learning_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
        contact_id TEXT,
        channel TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('fact','preference','decision','lesson','tool_failure')),
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        confidence NUMERIC(4,3) NOT NULL DEFAULT 0.750,
        status TEXT NOT NULL CHECK (status IN ('pending','approved','removed','auto_saved')) DEFAULT 'pending',
        source_session_id TEXT,
        source_message TEXT,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS aiva_learning_items_unique_hash
        ON aiva_learning_items (workspace_id, worker_id, kind, content_hash);
      CREATE INDEX IF NOT EXISTS aiva_learning_items_worker_status_idx
        ON aiva_learning_items (workspace_id, worker_id, status, created_at DESC);
    `);
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
}

function compactContent(value: string, maxLen = 280): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^["'\s]+|["'\s.]+$/g, '')
    .trim()
    .slice(0, maxLen);
}

function looksSensitive(text: string): boolean {
  return [
    /\b(api[_\s-]?key|secret|password|passcode|token|private key|bearer)\b/i,
    /sk-[A-Za-z0-9_-]{16,}/,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  ].some((re) => re.test(text));
}

function isUsefulCandidate(text: string, confidence = 0): boolean {
  const maxLen = confidence >= 0.9 ? 400 : 280;
  if (text.length < 12 || text.length > maxLen) return false;
  if (looksSensitive(text)) return false;
  if (/^(hi|hello|thanks|thank you|ok|okay|yes|no)\b/i.test(text)) return false;
  return true;
}

function pushCandidate(
  candidates: AivaLearningCandidate[],
  kind: AivaLearningKind,
  rawContent: string,
  confidence: number,
  target: WorkerMemoryTarget,
): void {
  const maxLen = confidence >= 0.9 ? 400 : 280;
  const content = compactContent(rawContent, maxLen);
  if (!isUsefulCandidate(content, confidence)) return;
  if (candidates.some((c) => c.content.toLowerCase() === content.toLowerCase())) return;
  candidates.push({
    kind,
    content,
    confidence,
    target,
    autoSave: confidence >= 0.86,
  });
}

export function extractAivaLearningCandidates(input: {
  userMessage: string;
  assistantReply?: string;
}): AivaLearningCandidate[] {
  const candidates: AivaLearningCandidate[] = [];
  const user = input.userMessage.trim();
  const assistant = input.assistantReply?.trim() ?? '';

  const remember = user.match(/\b(?:remember|keep in mind|note that)\b[:,]?\s+(.+)/i);
  if (remember?.[1]) {
    pushCandidate(candidates, 'fact', remember[1], 0.92, 'user');
  }

  const callMe = user.match(/\b(?:call me|refer to me as)\s+([A-Za-z][A-Za-z0-9 .'-]{1,60})/i);
  if (callMe?.[1]) {
    pushCandidate(candidates, 'preference', `Call the user ${callMe[1].trim()}.`, 0.9, 'user');
  }

  const prefer = user.match(/\b(?:i prefer|my preference is|i like|i want you to|always|do not|don't)\b\s+(.+)/i);
  if (prefer?.[0]) {
    pushCandidate(candidates, 'preference', prefer[0], 0.88, 'user');
  }

  const decision = user.match(/\b(?:we decided|we agreed|approved|go with|use .+ from now on)\b[:,]?\s+(.+)/i);
  if (decision?.[0]) {
    pushCandidate(candidates, 'decision', decision[0], 0.84, 'user');
  }

  const correction = user.match(/\b(?:no,|actually|next time|you should|instead)\b\s+(.+)/i);
  if (correction?.[0]) {
    // Task corrections about drafting/sending are not durable search preferences.
    const taskAction = /\b(draft|approv|send|email|telegram|whatsapp|message|keep in workspace)\b/i
      .test(correction[0]);
    if (!taskAction) {
      // Explicit "next time when I ask you to find..." standing search policy auto-saves.
      const searchPref = /\b(search|find|check|look|proactive|do not stop|don't stop|any means|internal)\b/i
        .test(correction[0]);
      pushCandidate(
        candidates,
        'lesson',
        searchPref
          ? 'When looking something up: start with known internal workspace sources '
            + '(contacts, email, Drive, documents, memory, chat), then expand to other internal tools, '
            + 'then the open web if needed. Do not stop after one empty source. Do not ask clarifying '
            + 'questions about what internal means; escalate until found or sources are exhausted.'
          : `Operator correction: ${correction[0]}`,
        searchPref ? 0.92 : 0.78,
        'memory',
      );
    }
  }

  // Short task confirmations must not invent preference lessons from the assistant reply.
  const isShortTaskConfirm = /^(yes|yeah|yep|ok|okay|do it|go ahead|confirm|no draft|draft)\b/i
    .test(user);
  if (
    !isShortTaskConfirm
    && /\b(i will use|next time i will|i should use|i need to use)\b/i.test(assistant)
    && /\b(tool|search|memory|drive|email|calendar|document|workspace)\b/i.test(assistant)
  ) {
    pushCandidate(candidates, 'lesson', assistant.slice(0, 220), 0.72, 'memory');
  }

  return candidates.slice(0, 3);
}

async function saveLearningItem(input: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
  channel?: string | null;
  candidate: AivaLearningCandidate;
  status: AivaLearningStatus;
  sourceSessionId?: string | null;
  sourceMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AivaLearningItem> {
  await ensureAivaLearningSchema();
  const contentHash = hashContent(input.candidate.content);
  const result = await pool.query(
    `INSERT INTO aiva_learning_items
       (workspace_id, worker_id, contact_id, channel, kind, content, content_hash, confidence, status,
        source_session_id, source_message, metadata_json, reviewed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,
       CASE WHEN $9 IN ('approved','auto_saved') THEN NOW() ELSE NULL END)
     ON CONFLICT (workspace_id, worker_id, kind, content_hash)
     DO UPDATE SET
       confidence = GREATEST(aiva_learning_items.confidence, EXCLUDED.confidence),
       status = CASE
         WHEN aiva_learning_items.status IN ('approved','auto_saved') THEN aiva_learning_items.status
         WHEN EXCLUDED.status = 'auto_saved' THEN 'auto_saved'
         ELSE aiva_learning_items.status
       END,
       reviewed_at = COALESCE(aiva_learning_items.reviewed_at, EXCLUDED.reviewed_at)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.contactId ?? null,
      input.channel ?? null,
      input.candidate.kind,
      input.candidate.content,
      contentHash,
      input.candidate.confidence,
      input.status,
      input.sourceSessionId ?? null,
      input.sourceMessage?.slice(0, 1000) ?? null,
      JSON.stringify({
        target: input.candidate.target,
        ...(input.metadata ?? {}),
      }),
    ],
  );
  return mapRow(result.rows[0]);
}

async function persistCandidateToMemory(input: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
  candidate: AivaLearningCandidate;
  sourceSessionId?: string | null;
}): Promise<boolean> {
  try {
    await addWorkerPersistentFact({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      target: input.candidate.target,
      content: input.candidate.content,
      contactId: input.candidate.target === 'user' ? input.contactId ?? null : null,
      sessionId: input.sourceSessionId ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}

export async function learnFromAivaTurn(input: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
  channel?: AivaChannelName | string | null;
  sessionId?: string | null;
  userMessage: string;
  assistantReply: string;
}): Promise<{ candidates: number; autoSaved: number; pending: number; skipped: number }> {
  const candidates = extractAivaLearningCandidates({
    userMessage: input.userMessage,
    assistantReply: input.assistantReply,
  });
  let autoSaved = 0;
  let pending = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.autoSave) {
      const saved = await persistCandidateToMemory({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        contactId: input.contactId,
        candidate,
        sourceSessionId: input.sessionId,
      });
      await saveLearningItem({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        contactId: input.contactId,
        channel: input.channel,
        candidate,
        status: saved ? 'auto_saved' : 'pending',
        sourceSessionId: input.sessionId,
        sourceMessage: input.userMessage,
      });
      if (saved) autoSaved += 1;
      else pending += 1;
      continue;
    }

    await saveLearningItem({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      contactId: input.contactId,
      channel: input.channel,
      candidate,
      status: 'pending',
      sourceSessionId: input.sessionId,
      sourceMessage: input.userMessage,
    });
    pending += 1;
  }

  skipped = Math.max(0, 3 - candidates.length);
  return { candidates: candidates.length, autoSaved, pending, skipped };
}

export async function recordAivaToolFailureLesson(input: {
  workspaceId: string;
  workerId: string;
  toolName: string;
  sessionId?: string;
  failureCount: number;
}): Promise<AivaLearningItem | null> {
  const candidate: AivaLearningCandidate = {
    kind: 'tool_failure',
    content:
      `Tool ${input.toolName} failed ${input.failureCount} times in 30 minutes. `
      + 'Check credentials, use tool_status, and explain the exact missing connection before retrying.',
    confidence: 0.9,
    target: 'memory',
    autoSave: true,
  };
  const saved = await persistCandidateToMemory({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    candidate,
    sourceSessionId: input.sessionId,
  });
  return saveLearningItem({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    candidate,
    status: saved ? 'auto_saved' : 'pending',
    sourceSessionId: input.sessionId,
    metadata: { toolName: input.toolName, failureCount: input.failureCount },
  });
}

export async function listAivaLearning(input: {
  workspaceId: string;
  workerId: string;
  status?: AivaLearningStatus | 'all';
  limit?: number;
}): Promise<{
  items: AivaLearningItem[];
  budgets: {
    user: Awaited<ReturnType<typeof getWorkerMemoryBudgetStatus>>;
    memory: Awaited<ReturnType<typeof getWorkerMemoryBudgetStatus>>;
  };
  memory: {
    user: Awaited<ReturnType<typeof listWorkerPersistentFacts>>;
    notes: Awaited<ReturnType<typeof listWorkerPersistentFacts>>;
  };
}> {
  await ensureAivaLearningSchema();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const params: unknown[] = [input.workspaceId, input.workerId];
  const statusSql =
    input.status && input.status !== 'all'
      ? `AND status = $${params.push(input.status)}`
      : '';
  const result = await pool.query(
    `SELECT * FROM aiva_learning_items
     WHERE workspace_id = $1 AND worker_id = $2
       ${statusSql}
     ORDER BY created_at DESC
     LIMIT $${params.push(limit)}`,
    params,
  );
  const [userBudget, memoryBudget, userFacts, memoryFacts] = await Promise.all([
    getWorkerMemoryBudgetStatus({ workspaceId: input.workspaceId, workerId: input.workerId, target: 'user' }),
    getWorkerMemoryBudgetStatus({ workspaceId: input.workspaceId, workerId: input.workerId, target: 'memory' }),
    listWorkerPersistentFacts({ workspaceId: input.workspaceId, workerId: input.workerId, target: 'user' }),
    listWorkerPersistentFacts({ workspaceId: input.workspaceId, workerId: input.workerId, target: 'memory' }),
  ]);
  return {
    items: result.rows.map(mapRow),
    budgets: { user: userBudget, memory: memoryBudget },
    memory: { user: userFacts, notes: memoryFacts },
  };
}

export async function approveAivaLearningItem(input: {
  workspaceId: string;
  workerId: string;
  learningId: string;
  reviewedBy?: string | null;
}): Promise<AivaLearningItem | null> {
  await ensureAivaLearningSchema();
  const existing = await pool.query(
    `SELECT * FROM aiva_learning_items
     WHERE workspace_id = $1 AND worker_id = $2 AND id = $3
     LIMIT 1`,
    [input.workspaceId, input.workerId, input.learningId],
  );
  if (existing.rows.length === 0) return null;
  const row = mapRow(existing.rows[0]);
  const target = row.metadata.target === 'memory' ? 'memory' : 'user';
  await persistCandidateToMemory({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    contactId: row.contactId,
    candidate: {
      kind: row.kind,
      content: row.content,
      confidence: row.confidence,
      target,
    },
    sourceSessionId: row.sourceSessionId,
  });
  const updated = await pool.query(
    `UPDATE aiva_learning_items
     SET status = 'approved', reviewed_at = NOW(), reviewed_by = $4
     WHERE workspace_id = $1 AND worker_id = $2 AND id = $3
     RETURNING *`,
    [input.workspaceId, input.workerId, input.learningId, input.reviewedBy ?? 'owner'],
  );
  return updated.rows[0] ? mapRow(updated.rows[0]) : null;
}

export async function removeAivaLearningItem(input: {
  workspaceId: string;
  workerId: string;
  learningId: string;
  reviewedBy?: string | null;
  removeMemory?: boolean;
}): Promise<AivaLearningItem | null> {
  await ensureAivaLearningSchema();
  const existing = await pool.query(
    `SELECT * FROM aiva_learning_items
     WHERE workspace_id = $1 AND worker_id = $2 AND id = $3
     LIMIT 1`,
    [input.workspaceId, input.workerId, input.learningId],
  );
  if (existing.rows.length === 0) return null;
  const row = mapRow(existing.rows[0]);
  if (input.removeMemory) {
    await removeWorkerPersistentFact({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      idOrText: row.content,
    }).catch(() => ({ removed: 0, ids: [] }));
  }
  const updated = await pool.query(
    `UPDATE aiva_learning_items
     SET status = 'removed', reviewed_at = NOW(), reviewed_by = $4
     WHERE workspace_id = $1 AND worker_id = $2 AND id = $3
     RETURNING *`,
    [input.workspaceId, input.workerId, input.learningId, input.reviewedBy ?? 'owner'],
  );
  return updated.rows[0] ? mapRow(updated.rows[0]) : null;
}

export async function runAivaDailyLearningReview(input: {
  workspaceId?: string;
  workerId?: string;
  limit?: number;
} = {}): Promise<{ scanned: number; candidates: number; autoSaved: number; pending: number; skipped: number }> {
  await ensureAivaLearningSchema();
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  const params: unknown[] = [];
  const filters: string[] = ["m.session_id LIKE 'aiva-%'"];
  if (input.workerId) {
    filters.push(`m.session_id LIKE $${params.push(`aiva-${input.workerId}-%`)}`);
  }
  const rows = await pool.query(
    `SELECT m.session_id,
            regexp_replace(m.session_id, '^aiva-([^-]+(?:-[^-]+){4})-.*$', '\\1') AS guessed_worker_id,
            m.role,
            m.content,
            m.created_at,
            w.workspace_id,
            w.id AS worker_id
     FROM episodic_memories m
     LEFT JOIN ai_workers w ON m.session_id LIKE 'aiva-' || w.id::text || '-%'
     WHERE ${filters.join(' AND ')}
       AND m.role IN ('user', 'assistant')
       AND m.created_at > NOW() - INTERVAL '36 hours'
       ${input.workspaceId ? `AND w.workspace_id = $${params.push(input.workspaceId)}` : ''}
     ORDER BY m.session_id, m.created_at ASC
     LIMIT $${params.push(limit)}`,
    params,
  );
  let scanned = 0;
  let candidates = 0;
  let autoSaved = 0;
  let pending = 0;
  let skipped = 0;
  const grouped = new Map<string, Array<{ role: string; content: string; workspaceId: string; workerId: string }>>();
  for (const row of rows.rows) {
    const workerId = row.worker_id ? String(row.worker_id) : '';
    const workspaceId = row.workspace_id ? String(row.workspace_id) : '';
    if (!workerId || !workspaceId) continue;
    const sessionId = String(row.session_id);
    const list = grouped.get(sessionId) ?? [];
    list.push({
      role: String(row.role),
      content: String(row.content ?? ''),
      workspaceId,
      workerId,
    });
    grouped.set(sessionId, list);
  }

  for (const [sessionId, turns] of grouped) {
    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i];
      if (!turn || turn.role !== 'user') continue;
      const assistant = turns.slice(i + 1).find((next) => next.role === 'assistant');
      scanned += 1;
      const result = await learnFromAivaTurn({
        workspaceId: turn.workspaceId,
        workerId: turn.workerId,
        sessionId,
        userMessage: turn.content,
        assistantReply: assistant?.content ?? '',
      });
      candidates += result.candidates;
      autoSaved += result.autoSaved;
      pending += result.pending;
      skipped += result.skipped;
    }
  }

  return { scanned, candidates, autoSaved, pending, skipped };
}

export function startAivaLearningReviewScheduler(): void {
  if (schedulerStarted || process.env.AIVA_LEARNING_SCHEDULER_ENABLED === 'false') return;
  schedulerStarted = true;
  const dayMs = 24 * 60 * 60 * 1000;
  const run = () => {
    void runAivaDailyLearningReview()
      .then((result) => {
        if (result.scanned > 0 || result.candidates > 0) {
          console.info(
            `[aiva-learning] daily review scanned=${result.scanned} candidates=${result.candidates} autoSaved=${result.autoSaved} pending=${result.pending}`,
          );
        }
      })
      .catch((err) => console.warn('[aiva-learning] daily review failed', err));
  };
  setTimeout(run, 10 * 60 * 1000).unref?.();
  setInterval(run, dayMs).unref?.();
}
