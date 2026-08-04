/**
 * Persistent Telegram preferences for the Carina gateway bot (not Aiva workers).
 * Voice preference is per chat; BYOK owner is install-wide for the single Carina bot.
 */
import { pool } from '../memory/db.js';

export type CarinaTelegramPrefs = {
  preferVoiceReplies: boolean;
  byokOwnerUserId: string | null;
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS carina_telegram_prefs (
          scope_key TEXT PRIMARY KEY,
          prefer_voice_replies BOOLEAN NOT NULL DEFAULT FALSE,
          byok_owner_user_id TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function chatScope(chatId: string): string {
  return `chat:${chatId}`;
}

const GLOBAL_SCOPE = 'global';

export async function getTelegramChatPrefs(chatId: string): Promise<CarinaTelegramPrefs> {
  await ensureSchema();
  const [chat, global] = await Promise.all([
    pool.query(
      `SELECT prefer_voice_replies FROM carina_telegram_prefs WHERE scope_key = $1`,
      [chatScope(chatId)],
    ),
    pool.query(
      `SELECT byok_owner_user_id FROM carina_telegram_prefs WHERE scope_key = $1`,
      [GLOBAL_SCOPE],
    ),
  ]);
  return {
    preferVoiceReplies: Boolean(chat.rows[0]?.prefer_voice_replies),
    byokOwnerUserId: global.rows[0]?.byok_owner_user_id
      ? String(global.rows[0].byok_owner_user_id)
      : null,
  };
}

export async function setPreferVoiceReplies(chatId: string, preferVoiceReplies: boolean): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO carina_telegram_prefs (scope_key, prefer_voice_replies, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (scope_key) DO UPDATE SET
       prefer_voice_replies = EXCLUDED.prefer_voice_replies,
       updated_at = NOW()`,
    [chatScope(chatId), preferVoiceReplies],
  );
}

export async function getByokOwnerUserId(): Promise<string | null> {
  await ensureSchema();
  const result = await pool.query(
    `SELECT byok_owner_user_id FROM carina_telegram_prefs WHERE scope_key = $1`,
    [GLOBAL_SCOPE],
  );
  const value = result.rows[0]?.byok_owner_user_id;
  return value ? String(value) : null;
}

export async function setByokOwnerUserId(userId: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO carina_telegram_prefs (scope_key, byok_owner_user_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (scope_key) DO UPDATE SET
       byok_owner_user_id = EXCLUDED.byok_owner_user_id,
       updated_at = NOW()`,
    [GLOBAL_SCOPE, userId],
  );
}

/** Tenant id used for Carina gateway BYOK keys (matches agent default). */
export const CARINA_GATEWAY_BYOK_TENANT = '__operator__';
