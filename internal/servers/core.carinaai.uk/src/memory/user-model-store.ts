import { pool } from './db.js';
import type { UserFact, UserFactCategory, UserModelMeta } from './user-model.js';
import { isUserFactCategory } from './user-model.js';

export const USER_MODEL_MIGRATION = `
CREATE TABLE IF NOT EXISTS user_model_facts (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL,
  category        TEXT NOT NULL,
  fact            TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0.8,
  observed_at     TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  confirmed_at    TEXT,
  contradicted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_model_profile ON user_model_facts(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_model_category ON user_model_facts(profile_id, category);

CREATE TABLE IF NOT EXISTS user_model_meta (
  profile_id          TEXT PRIMARY KEY,
  compiled_summary    TEXT,
  compiled_at         TEXT,
  conversation_count  INTEGER NOT NULL DEFAULT 0
);
`;

let initPromise: Promise<void> | null = null;

export async function initUserModelStore(): Promise<void> {
  if (!initPromise) {
    initPromise = pool.query(USER_MODEL_MIGRATION).then(() => undefined);
  }
  return initPromise;
}

export function rowToFact(row: Record<string, unknown>): UserFact {
  return {
    id: String(row.id),
    category: String(row.category) as UserFactCategory,
    fact: String(row.fact),
    confidence: Number(row.confidence),
    observedAt: new Date(String(row.observed_at)),
    conversationId: String(row.conversation_id),
    confirmedAt: row.confirmed_at ? new Date(String(row.confirmed_at)) : undefined,
    contradictedAt: row.contradicted_at ? new Date(String(row.contradicted_at)) : undefined,
  };
}

export async function saveFact(fact: UserFact & { profileId: string }): Promise<void> {
  if (!isUserFactCategory(fact.category)) return;
  await initUserModelStore();
  await pool.query(
    `INSERT INTO user_model_facts
       (id, profile_id, category, fact, confidence, observed_at, conversation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       confidence = EXCLUDED.confidence,
       fact = EXCLUDED.fact`,
    [
      fact.id,
      fact.profileId,
      fact.category,
      fact.fact,
      fact.confidence,
      fact.observedAt.toISOString(),
      fact.conversationId,
    ],
  );
}

export async function getFacts(
  profileId: string,
  options: { category?: UserFactCategory; minConfidence?: number } = {},
): Promise<UserFact[]> {
  await initUserModelStore();
  const minConfidence = options.minConfidence ?? 0.5;
  const params: unknown[] = [profileId, minConfidence];
  let categoryClause = '';
  if (options.category) {
    categoryClause = 'AND category = $3';
    params.push(options.category);
  }

  const result = await pool.query(
    `SELECT * FROM user_model_facts
     WHERE profile_id = $1
       AND confidence >= $2
       AND contradicted_at IS NULL
       ${categoryClause}
     ORDER BY confidence DESC, observed_at DESC`,
    params,
  );

  return result.rows.map((row) => rowToFact(row as Record<string, unknown>));
}

export async function markContradicted(factId: string): Promise<void> {
  await initUserModelStore();
  await pool.query(
    'UPDATE user_model_facts SET contradicted_at = $1 WHERE id = $2',
    [new Date().toISOString(), factId],
  );
}

export async function clearUserModel(profileId: string): Promise<void> {
  await initUserModelStore();
  await pool.query('DELETE FROM user_model_facts WHERE profile_id = $1', [profileId]);
  await pool.query('DELETE FROM user_model_meta WHERE profile_id = $1', [profileId]);
}

export async function getUserModelMeta(profileId: string): Promise<UserModelMeta | null> {
  await initUserModelStore();
  const result = await pool.query(
    'SELECT profile_id, compiled_summary, compiled_at, conversation_count FROM user_model_meta WHERE profile_id = $1',
    [profileId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    profileId: String(row.profile_id),
    compiledSummary: row.compiled_summary ? String(row.compiled_summary) : undefined,
    compiledAt: row.compiled_at ? new Date(String(row.compiled_at)) : undefined,
    conversationCount: Number(row.conversation_count ?? 0),
  };
}

export async function saveCompiledSummary(profileId: string, summary: string): Promise<void> {
  await initUserModelStore();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO user_model_meta (profile_id, compiled_summary, compiled_at, conversation_count)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (profile_id) DO UPDATE SET
       compiled_summary = EXCLUDED.compiled_summary,
       compiled_at = EXCLUDED.compiled_at`,
    [profileId, summary, now],
  );
}

export async function incrementConversationCount(profileId: string): Promise<void> {
  await initUserModelStore();
  await pool.query(
    `INSERT INTO user_model_meta (profile_id, conversation_count)
     VALUES ($1, 1)
     ON CONFLICT (profile_id) DO UPDATE SET
       conversation_count = user_model_meta.conversation_count + 1`,
    [profileId],
  );
}
