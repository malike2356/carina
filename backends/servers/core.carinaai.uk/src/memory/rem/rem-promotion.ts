import { pool } from '../db.js';
import { addPersistentFact, activeAgentName, type MemoryTarget } from '../persistent-memory.js';
import { getMemoryBackend, resolveBuiltinTarget } from '../backends/index.js';
import {
  buildPromotionRationale,
  distillEpisodeContent,
  inferPromotionTarget,
  scoreEpisode,
  type MemoryTier,
} from './rem-scorer.js';
import { syncDreamsFile } from './dreams.js';

export interface PromotionQueueRow {
  id: string;
  episodeId: string;
  proposedContent: string;
  proposedTarget: MemoryTarget;
  score: number;
  rationale: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'auto_promoted';
  createdAt: Date;
}

export interface RemCycleResult {
  scanned: number;
  enqueued: number;
  autoPromoted: number;
  dreamsPath?: string;
}

function rowToQueue(row: Record<string, unknown>): PromotionQueueRow {
  return {
    id: String(row.id),
    episodeId: String(row.episode_id),
    proposedContent: String(row.proposed_content),
    proposedTarget: String(row.proposed_target) as MemoryTarget,
    score: Number(row.score),
    rationale: row.rationale ? String(row.rationale) : null,
    status: String(row.status) as PromotionQueueRow['status'],
    createdAt: new Date(String(row.created_at)),
  };
}

export function isRemAvailable(): boolean {
  const backend = getMemoryBackend().name;
  if (backend === 'postgres') return true;
  if (backend === 'builtin') return resolveBuiltinTarget().name === 'postgres';
  return false;
}

function promoteThreshold(): number {
  return Number(process.env.CARINA_REM_PROMOTE_THRESHOLD ?? '0.72');
}

function autoPromoteThreshold(): number {
  return Number(process.env.CARINA_REM_AUTO_PROMOTE_THRESHOLD ?? '0.92');
}

function minAgeMinutes(): number {
  return Number(process.env.CARINA_REM_MIN_AGE_MINUTES ?? '30');
}

export async function listPromotionQueue(
  status: PromotionQueueRow['status'] | 'all' = 'pending',
): Promise<PromotionQueueRow[]> {
  const clause = status === 'all' ? '' : 'WHERE status = $1';
  const params = status === 'all' ? [] : [status];
  const result = await pool.query(
    `SELECT id, episode_id, proposed_content, proposed_target, score, rationale, status, created_at
     FROM memory_promotion_queue
     ${clause}
     ORDER BY score DESC, created_at ASC`,
    params,
  );
  return result.rows.map(rowToQueue);
}

export async function enqueuePromotion(input: {
  episodeId: string;
  proposedContent: string;
  proposedTarget: MemoryTarget;
  score: number;
  rationale: string;
}): Promise<PromotionQueueRow | null> {
  const existing = await pool.query(
    `SELECT id FROM memory_promotion_queue
     WHERE episode_id = $1 AND status = 'pending'`,
    [input.episodeId],
  );
  if ((existing.rowCount ?? 0) > 0) return null;

  const result = await pool.query(
    `INSERT INTO memory_promotion_queue
       (episode_id, proposed_content, proposed_target, score, rationale, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, episode_id, proposed_content, proposed_target, score, rationale, status, created_at`,
    [
      input.episodeId,
      input.proposedContent,
      input.proposedTarget,
      input.score,
      input.rationale,
    ],
  );
  await pool.query(
    `UPDATE episodic_memories SET promotion_score = $1, updated_at = NOW() WHERE id = $2`,
    [input.score, input.episodeId],
  );
  return rowToQueue(result.rows[0]);
}

async function markEpisodeLongTerm(episodeId: string, score: number): Promise<void> {
  await pool.query(
    `UPDATE episodic_memories
     SET memory_tier = 'long_term', promotion_score = $1, updated_at = NOW()
     WHERE id = $2`,
    [score, episodeId],
  );
}

export async function approvePromotion(queueId: string): Promise<PromotionQueueRow> {
  const row = await pool.query(
    `SELECT * FROM memory_promotion_queue WHERE id = $1`,
    [queueId],
  );
  if (row.rows.length === 0) throw new Error(`Promotion ${queueId} not found.`);
  const item = rowToQueue(row.rows[0]);
  if (item.status !== 'pending') throw new Error(`Promotion ${queueId} is already ${item.status}.`);

  await addPersistentFact(
    item.proposedTarget,
    item.proposedContent,
    item.proposedTarget === 'memory' ? { agentId: activeAgentName() } : {},
  );
  await markEpisodeLongTerm(item.episodeId, item.score);
  await pool.query(
    `UPDATE memory_promotion_queue
     SET status = 'approved', reviewed_at = NOW()
     WHERE id = $1`,
    [queueId],
  );

  const pending = await listPromotionQueue('pending');
  await syncDreamsFile(pending);
  return { ...item, status: 'approved' };
}

export async function rejectPromotion(queueId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE memory_promotion_queue
     SET status = 'rejected', reviewed_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [queueId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new Error(`Pending promotion ${queueId} not found.`);
  }
  const pending = await listPromotionQueue('pending');
  await syncDreamsFile(pending);
}

async function autoPromote(item: PromotionQueueRow): Promise<void> {
  await addPersistentFact(
    item.proposedTarget,
    item.proposedContent,
    item.proposedTarget === 'memory' ? { agentId: activeAgentName() } : {},
  );
  await markEpisodeLongTerm(item.episodeId, item.score);
  await pool.query(
    `UPDATE memory_promotion_queue
     SET status = 'auto_promoted', reviewed_at = NOW()
     WHERE id = $1`,
    [item.id],
  );
}

export async function runRemPromotionCycle(limit = 40): Promise<RemCycleResult> {
  if (!isRemAvailable()) {
    return { scanned: 0, enqueued: 0, autoPromoted: 0 };
  }
  if (process.env.CARINA_REM_ENABLED === 'false') {
    return { scanned: 0, enqueued: 0, autoPromoted: 0 };
  }

  const result = await pool.query(
    `SELECT id, role, content, priority, access_count, created_at, promotion_score
     FROM episodic_memories
     WHERE memory_tier = 'short_term'
       AND created_at < NOW() - ($1::text || ' minutes')::interval
       AND id NOT IN (
         SELECT episode_id FROM memory_promotion_queue
         WHERE status IN ('pending', 'approved', 'auto_promoted')
       )
     ORDER BY created_at ASC
     LIMIT $2`,
    [String(minAgeMinutes()), limit],
  );

  let enqueued = 0;
  let autoPromoted = 0;
  const promoteAt = promoteThreshold();
  const autoAt = autoPromoteThreshold();

  for (const row of result.rows) {
    const score = scoreEpisode({
      role: String(row.role),
      content: String(row.content),
      priority: Number(row.priority ?? 0),
      accessCount: Number(row.access_count ?? 0),
      createdAt: new Date(String(row.created_at)),
    });
    if (score < promoteAt) continue;

    const proposedContent = distillEpisodeContent(String(row.content));
    const proposedTarget = inferPromotionTarget(proposedContent);
    const rationale = buildPromotionRationale({
      role: String(row.role),
      content: proposedContent,
      priority: Number(row.priority ?? 0),
      accessCount: Number(row.access_count ?? 0),
      createdAt: new Date(String(row.created_at)),
    }, score);

    const queued = await enqueuePromotion({
      episodeId: String(row.id),
      proposedContent,
      proposedTarget,
      score,
      rationale,
    });
    if (!queued) continue;

    if (score >= autoAt) {
      await autoPromote(queued);
      autoPromoted++;
    } else {
      enqueued++;
    }
  }

  const pending = await listPromotionQueue('pending');
  const dreamsPath = await syncDreamsFile(pending);

  return {
    scanned: result.rows.length,
    enqueued,
    autoPromoted,
    dreamsPath,
  };
}

export async function recordMemoryAccess(ids: string[]): Promise<void> {
  if (ids.length === 0 || !isRemAvailable()) return;
  await pool.query(
    `UPDATE episodic_memories
     SET access_count = access_count + 1, last_accessed_at = NOW(), updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}

export async function setEpisodeTier(id: string, tier: MemoryTier): Promise<void> {
  await pool.query(
    'UPDATE episodic_memories SET memory_tier = $1, updated_at = NOW() WHERE id = $2',
    [tier, id],
  );
}

let lastRemCycleAt = 0;

export function maybeRunRemCycle(): void {
  if (process.env.CARINA_REM_ENABLED === 'false') return;
  const intervalMs = Number(process.env.CARINA_REM_CYCLE_MS ?? String(5 * 60 * 1000));
  if (Date.now() - lastRemCycleAt < intervalMs) return;
  lastRemCycleAt = Date.now();
  void runRemPromotionCycle().catch(() => {
    // non-fatal background promotion
  });
}
