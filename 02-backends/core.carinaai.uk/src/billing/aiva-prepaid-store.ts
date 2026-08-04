import { pool } from '../memory/db.js';
import {
  AIVA_PREPAID_MESSAGES_PER_GBP,
  AIVA_PREPAID_PACKS,
  type AivaPrepaidPackId,
} from './aiva-prepaid-packs.js';

let schemaReady: Promise<void> | null = null;

export async function ensureAivaPrepaidSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_prepaid_ledger (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          messages INTEGER NOT NULL,
          amount_pence INTEGER,
          pack_id TEXT,
          stripe_session_id TEXT,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS aiva_prepaid_ledger_stripe_session_uidx
          ON aiva_prepaid_ledger (stripe_session_id)
          WHERE stripe_session_id IS NOT NULL
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS aiva_prepaid_ledger_workspace_idx
          ON aiva_prepaid_ledger (workspace_id, created_at DESC)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export async function getAivaPrepaidBalance(workspaceId: string): Promise<{
  remainingMessages: number;
  remainingGbp: number;
}> {
  await ensureAivaPrepaidSchema();
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(messages), 0)::TEXT AS total
     FROM aiva_prepaid_ledger
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  const remainingMessages = Math.max(0, Number(result.rows[0]?.total ?? 0));
  const remainingGbp =
    Math.round((remainingMessages / AIVA_PREPAID_MESSAGES_PER_GBP) * 100) / 100;
  return { remainingMessages, remainingGbp };
}

export async function creditAivaPrepaidTopup(input: {
  workspaceId: string;
  packId: AivaPrepaidPackId;
  stripeSessionId: string;
}): Promise<{ credited: boolean; messages: number }> {
  await ensureAivaPrepaidSchema();
  const pack = AIVA_PREPAID_PACKS[input.packId];
  try {
    await pool.query(
      `INSERT INTO aiva_prepaid_ledger
         (workspace_id, event_type, messages, amount_pence, pack_id, stripe_session_id, note)
       VALUES ($1, 'topup', $2, $3, $4, $5, $6)`,
      [
        input.workspaceId,
        pack.messages,
        pack.amountPence,
        pack.id,
        input.stripeSessionId,
        `stripe:${input.stripeSessionId}`,
      ],
    );
    return { credited: true, messages: pack.messages };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      return { credited: false, messages: pack.messages };
    }
    throw err;
  }
}

export async function debitAivaPrepaidMessage(workspaceId: string): Promise<boolean> {
  await ensureAivaPrepaidSchema();
  const balance = await getAivaPrepaidBalance(workspaceId);
  if (balance.remainingMessages <= 0) return false;
  await pool.query(
    `INSERT INTO aiva_prepaid_ledger
       (workspace_id, event_type, messages, note)
     VALUES ($1, 'usage', -1, 'managed_message')`,
    [workspaceId],
  );
  return true;
}
