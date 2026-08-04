/**
 * Rolling semantic summarization for long Aiva conversations.
 * Compresses older episodic turns into aiva_thread_summaries so the bridge
 * can inject gist + recent verbatim turns instead of silently dropping history.
 */
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../db.js';
import { callAuxiliaryModel } from '../../brain/auxiliary-client.js';

export interface SummarizationConfig {
  triggerAfterTurns: number;
  windowKeepRecent: number;
  maxSummaryTokens: number;
  compressionModel?: string;
}

export interface ThreadSummary {
  summaryText: string;
  coveredRange: [number, number];
  compressedAt: Date;
}

export const DEFAULT_SUMMARIZATION_CONFIG: SummarizationConfig = {
  triggerAfterTurns: 30,
  windowKeepRecent: 15,
  maxSummaryTokens: 500,
};

const SCHEMA_SQL = `
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS turn_number INTEGER;
CREATE INDEX IF NOT EXISTS idx_episodic_memories_turn
  ON episodic_memories (conversation_id, turn_number);
CREATE TABLE IF NOT EXISTS aiva_thread_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  session_epoch INTEGER NOT NULL DEFAULT 1,
  summary_text TEXT NOT NULL,
  covered_turn_range INT4RANGE NOT NULL,
  compressed_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT NOT NULL DEFAULT '',
  token_count_before INTEGER DEFAULT 0,
  token_count_after INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_summaries_epoch_range
  ON aiva_thread_summaries (conversation_id, session_epoch, covered_turn_range);
`;

let schemaReady: Promise<void> | null = null;

export async function ensureThreadSummariesSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(SCHEMA_SQL);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

/** Reserve this many chars of the bridge prompt budget for summary text. */
export const SUMMARY_CHAR_BUDGET = 1200;

export async function countConversationTurns(conversationId: string): Promise<number> {
  if (!isDatabaseConfigured() || !conversationId.trim()) return 0;
  try {
    await ensureThreadSummariesSchema();
    const result = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM episodic_memories
       WHERE conversation_id = $1::uuid
         AND role IN ('user', 'assistant')`,
      [conversationId],
    );
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

async function backfillMissingTurnNumbers(conversationId: string): Promise<void> {
  const missing = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM episodic_memories
     WHERE conversation_id = $1::uuid
       AND turn_number IS NULL`,
    [conversationId],
  );
  if (Number(missing.rows[0]?.c ?? 0) === 0) return;

  await pool.query(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
       FROM episodic_memories
       WHERE conversation_id = $1::uuid
     )
     UPDATE episodic_memories e
     SET turn_number = o.rn
     FROM ordered o
     WHERE e.id = o.id`,
    [conversationId],
  );
}

async function generateSummary(
  turns: Array<{ turn_number: number | null; role: string; content: string }>,
  cfg: SummarizationConfig,
): Promise<{ text: string; modelUsed: string; tokensBefore: number; tokensAfter: number }> {
  const transcript = turns
    .map((t) => `${t.role}: ${String(t.content ?? '').trim()}`)
    .filter((line) => line.length > 6)
    .join('\n');

  const tokensBefore = Math.ceil(transcript.length / 4);
  const systemPrompt =
    'Summarize this conversation segment. Preserve: key decisions, action items, '
    + 'user preferences stated, topics discussed, and context needed to continue '
    + 'the conversation naturally. Omit: pleasantries, repetitions, tool call details. '
    + 'Write plain prose only. No emojis. No bullet decoration beyond short lines when needed.';

  const prompt =
    `Target length: about ${cfg.maxSummaryTokens} tokens.\n\n`
    + `Conversation segment:\n${transcript.slice(0, 48_000)}`;

  let text = '';
  let modelUsed = process.env.CARINA_SUMMARY_MODEL?.trim()
    || cfg.compressionModel?.trim()
    || 'auxiliary:summarization';

  try {
    text = await callAuxiliaryModel('summarization', prompt, systemPrompt);
  } catch {
    try {
      const { llm } = await import('../../brain/llm.js');
      const cheap = await llm.chatCheap([
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: prompt, timestamp: new Date() },
      ]);
      text = String(cheap?.content ?? '').trim();
      modelUsed = 'llm.chatCheap';
    } catch {
      text = '';
    }
  }

  text = text.trim();
  if (!text) {
    // Deterministic fallback so long threads still get a continuity stub.
    const preview = turns
      .slice(0, 8)
      .map((t) => `${t.role}: ${String(t.content ?? '').trim().slice(0, 120)}`)
      .join(' | ');
    text = `Earlier conversation covered ${turns.length} turns. Highlights: ${preview}`.slice(0, 900);
    modelUsed = 'fallback-extract';
  }

  const maxChars = cfg.maxSummaryTokens * 4;
  if (text.length > maxChars) text = text.slice(0, maxChars);
  const tokensAfter = Math.ceil(text.length / 4);
  return { text, modelUsed, tokensBefore, tokensAfter };
}

export async function loadThreadSummaries(opts: {
  conversationId: string;
  sessionEpoch: number;
}): Promise<string[]> {
  if (!isDatabaseConfigured() || !opts.conversationId.trim()) return [];
  try {
    await ensureThreadSummariesSchema();
    const result = await pool.query<{ summary_text: string }>(
      `SELECT summary_text
       FROM aiva_thread_summaries
       WHERE conversation_id = $1::uuid AND session_epoch = $2
       ORDER BY lower(covered_turn_range) ASC`,
      [opts.conversationId, opts.sessionEpoch],
    );
    return result.rows
      .map((row) => String(row.summary_text ?? '').trim())
      .filter((text) => text.length > 0);
  } catch {
    return [];
  }
}

export function formatSummaryPrefix(summaries: string[]): string {
  if (summaries.length === 0) return '';
  const body = summaries.map((s, i) => `${i + 1}. ${s}`).join('\n\n');
  let prefix = `## Conversation summary (earlier)\n\n${body}\n\n---`;
  if (prefix.length > SUMMARY_CHAR_BUDGET) {
    prefix = `${prefix.slice(0, SUMMARY_CHAR_BUDGET - 3)}...`;
  }
  return prefix;
}

export async function maybeSummarizeThread(params: {
  conversationId: string;
  sessionEpoch: number;
  totalTurns?: number;
  config?: Partial<SummarizationConfig>;
}): Promise<ThreadSummary | null> {
  if (!isDatabaseConfigured()) return null;
  const conversationId = params.conversationId.trim();
  if (!conversationId) return null;

  const cfg = { ...DEFAULT_SUMMARIZATION_CONFIG, ...params.config };
  await ensureThreadSummariesSchema();
  await backfillMissingTurnNumbers(conversationId);

  const totalTurns = params.totalTurns ?? (await countConversationTurns(conversationId));
  if (totalTurns < cfg.triggerAfterTurns) return null;

  const compressUpTo = totalTurns - cfg.windowKeepRecent;
  if (compressUpTo <= 0) return null;

  const existing = await pool.query<{ max_covered: number | null }>(
    `SELECT upper(covered_turn_range) AS max_covered
     FROM aiva_thread_summaries
     WHERE conversation_id = $1::uuid AND session_epoch = $2
     ORDER BY upper(covered_turn_range) DESC NULLS LAST
     LIMIT 1`,
    [conversationId, params.sessionEpoch],
  );
  // int4range upper is exclusive; treat as already covered exclusive end.
  const alreadyCovered = Number(existing.rows[0]?.max_covered ?? 0);
  if (alreadyCovered >= compressUpTo) return null;

  const turns = await pool.query<{
    turn_number: number | null;
    role: string;
    content: string;
  }>(
    `SELECT turn_number, role, content
     FROM episodic_memories
     WHERE conversation_id = $1::uuid
       AND role IN ('user', 'assistant')
       AND turn_number > $2
       AND turn_number <= $3
     ORDER BY turn_number ASC`,
    [conversationId, alreadyCovered, compressUpTo],
  );

  if (turns.rows.length === 0) return null;

  const summary = await generateSummary(turns.rows, cfg);

  try {
    await pool.query(
      `INSERT INTO aiva_thread_summaries
         (conversation_id, session_epoch, summary_text, covered_turn_range,
          model_used, token_count_before, token_count_after)
       VALUES ($1::uuid, $2, $3, int4range($4, $5, '[)'), $6, $7, $8)`,
      [
        conversationId,
        params.sessionEpoch,
        summary.text,
        alreadyCovered,
        compressUpTo,
        summary.modelUsed,
        summary.tokensBefore,
        summary.tokensAfter,
      ],
    );
  } catch (err) {
    // Unique range collision is fine under concurrent triggers.
    console.warn('[thread-summarizer] insert failed:', err instanceof Error ? err.message : err);
    return null;
  }

  return {
    summaryText: summary.text,
    coveredRange: [alreadyCovered, compressUpTo],
    compressedAt: new Date(),
  };
}

/** Fire-and-forget wrapper; never throws to callers. */
export function triggerSummarizeThread(params: {
  conversationId: string;
  sessionEpoch: number;
  totalTurns?: number;
  config?: Partial<SummarizationConfig>;
}): void {
  void maybeSummarizeThread(params).catch((err) => {
    console.warn(
      '[thread-summarizer] background summarize failed:',
      err instanceof Error ? err.message : err,
    );
  });
}
