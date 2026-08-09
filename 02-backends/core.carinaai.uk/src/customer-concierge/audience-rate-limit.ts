/**
 * Durable audience rate limits (Prompt 701).
 */
import { pool } from '../memory/db.js';

export async function consumeAudienceRateBucket(input: {
  bucketKey: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const resetAt = new Date(Date.now() + input.windowMs);
  const result = await pool.query(
    `INSERT INTO audience_rate_buckets (bucket_key, hit_count, reset_at, updated_at)
     VALUES ($1, 1, $2, NOW())
     ON CONFLICT (bucket_key) DO UPDATE SET
       hit_count = CASE
         WHEN audience_rate_buckets.reset_at <= NOW() THEN 1
         ELSE audience_rate_buckets.hit_count + 1
       END,
       reset_at = CASE
         WHEN audience_rate_buckets.reset_at <= NOW() THEN EXCLUDED.reset_at
         ELSE audience_rate_buckets.reset_at
       END,
       updated_at = NOW()
     RETURNING hit_count, reset_at`,
    [input.bucketKey, resetAt.toISOString()],
  );
  const hitCount = Number(result.rows[0]?.hit_count ?? 1);
  const rowReset = new Date(String(result.rows[0]?.reset_at ?? resetAt)).toISOString();
  if (hitCount > input.limit) {
    return { allowed: false, remaining: 0, resetAt: rowReset };
  }
  return {
    allowed: true,
    remaining: Math.max(0, input.limit - hitCount),
    resetAt: rowReset,
  };
}

export async function consumeEmbedNonce(input: {
  nonce: string;
  workerId: string;
  ttlMs?: number;
}): Promise<boolean> {
  const ttlMs = input.ttlMs ?? 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const inserted = await pool.query(
    `INSERT INTO audience_embed_nonces (nonce, worker_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (nonce) DO NOTHING
     RETURNING nonce`,
    [input.nonce, input.workerId, expiresAt.toISOString()],
  );
  if (!inserted.rows[0]) {
    // Already seen: reject replay
    return false;
  }
  await pool.query(
    `UPDATE audience_embed_nonces SET consumed_at = NOW() WHERE nonce = $1`,
    [input.nonce],
  );
  return true;
}

export async function assertFreshEmbedNonce(input: {
  nonce: string;
  workerId: string;
}): Promise<boolean> {
  const existing = await pool.query(
    `SELECT consumed_at, expires_at, worker_id FROM audience_embed_nonces WHERE nonce = $1`,
    [input.nonce],
  );
  if (existing.rows[0]) {
    return false;
  }
  return consumeEmbedNonce(input);
}
