import { createHash } from 'node:crypto';
import { pool } from '../memory/db.js';

export type LearningEventType =
  | 'capture_skipped'
  | 'capture_deduped'
  | 'eval_malformed'
  | 'eval_empty'
  | 'preference_learned'
  | 'preference_skipped'
  | 'preference_replaced'
  | 'skill_created'
  | 'skill_refined'
  | 'skill_incremented'
  | 'skill_duplicate_avoided'
  | 'skill_conflict_resolved'
  | 'skill_refine_blocked'
  | 'skill_rolled_back'
  | 'skill_propagated'
  | 'loop_error';

export interface LearningEventInput {
  tenantId?: string;
  sessionId?: string;
  eventType: LearningEventType;
  idempotencyKey?: string;
  skillId?: string | null;
  skillName?: string;
  version?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  internalNotes?: Record<string, unknown>;
}

export interface LearningEventRecord extends LearningEventInput {
  id: string;
  tenantId: string;
  createdAt: string;
}

export function buildLearningIdempotencyKey(parts: {
  tenantId?: string;
  sessionId?: string;
  userMessage: string;
  toolsUsed: string[];
  succeeded: boolean;
  isCorrection: boolean;
}): string {
  const payload = [
    parts.tenantId ?? '__operator__',
    parts.sessionId ?? '',
    parts.isCorrection ? 'correction' : 'task',
    parts.userMessage.slice(0, 200),
    parts.toolsUsed.join(','),
    String(parts.succeeded),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 40);
}

export async function hasLearningEvent(idempotencyKey: string): Promise<boolean> {
  if (!idempotencyKey) return false;
  try {
    const result = await pool.query(
      `SELECT 1 FROM learning_events WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function appendLearningEvent(input: LearningEventInput): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO learning_events
        (tenant_id, session_id, event_type, idempotency_key, skill_id, skill_name, version,
         input_summary, output_summary, internal_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.tenantId ?? '__operator__',
        input.sessionId ?? null,
        input.eventType,
        input.idempotencyKey ?? null,
        input.skillId ?? null,
        input.skillName ?? null,
        input.version ?? null,
        input.inputSummary ? JSON.stringify(input.inputSummary) : null,
        input.outputSummary ? JSON.stringify(input.outputSummary) : null,
        input.internalNotes ? JSON.stringify(input.internalNotes) : null,
      ],
    );
    return result.rows[0] ? String(result.rows[0].id) : null;
  } catch {
    return null;
  }
}

export async function listLearningEvents(options: {
  tenantId?: string;
  sessionId?: string;
  skillName?: string;
  limit?: number;
} = {}): Promise<LearningEventRecord[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (options.tenantId) {
    clauses.push(`tenant_id = $${idx++}`);
    values.push(options.tenantId);
  }
  if (options.sessionId) {
    clauses.push(`session_id = $${idx++}`);
    values.push(options.sessionId);
  }
  if (options.skillName) {
    clauses.push(`skill_name = $${idx++}`);
    values.push(options.skillName);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  values.push(limit);

  try {
    const result = await pool.query(
      `SELECT id, tenant_id, session_id, event_type, idempotency_key, skill_id, skill_name,
              version, input_summary, output_summary, created_at
       FROM learning_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      values,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      sessionId: row.session_id ? String(row.session_id) : undefined,
      eventType: String(row.event_type) as LearningEventType,
      idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
      skillId: row.skill_id ? String(row.skill_id) : undefined,
      skillName: row.skill_name ? String(row.skill_name) : undefined,
      version: row.version == null ? undefined : Number(row.version),
      inputSummary: row.input_summary as Record<string, unknown> | undefined,
      outputSummary: row.output_summary as Record<string, unknown> | undefined,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function replayLearningEvent(eventId: string): Promise<{
  event: LearningEventRecord | null;
  internalNotes?: Record<string, unknown>;
}> {
  try {
    const result = await pool.query(
      `SELECT id, tenant_id, session_id, event_type, idempotency_key, skill_id, skill_name,
              version, input_summary, output_summary, internal_notes, created_at
       FROM learning_events
       WHERE id = $1
       LIMIT 1`,
      [eventId],
    );
    const row = result.rows[0];
    if (!row) return { event: null };
    return {
      event: {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        sessionId: row.session_id ? String(row.session_id) : undefined,
        eventType: String(row.event_type) as LearningEventType,
        idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
        skillId: row.skill_id ? String(row.skill_id) : undefined,
        skillName: row.skill_name ? String(row.skill_name) : undefined,
        version: row.version == null ? undefined : Number(row.version),
        inputSummary: row.input_summary as Record<string, unknown> | undefined,
        outputSummary: row.output_summary as Record<string, unknown> | undefined,
        createdAt: String(row.created_at),
      },
      internalNotes: row.internal_notes as Record<string, unknown> | undefined,
    };
  } catch {
    return { event: null };
  }
}
