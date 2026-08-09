// Account scope for repository secret scanning on live Carina Scout.
// Live DB uses accounts (no organizations/workspaces). OPS appends account_id.
import { pool } from '../event-server/db.js';

const FALLBACK_OPS_EMAIL = 'ops-scout@carina.local';

export async function resolveAccountId(raw?: string | null): Promise<string> {
  const fromArg = typeof raw === 'string' ? raw.trim() : '';
  const fromEnv = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim() ?? '';
  const preferred = fromArg || fromEnv;

  if (preferred) {
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM accounts WHERE id = $1::uuid LIMIT 1',
      [preferred],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    // Create the operator account row when the UUID is configured but missing locally.
    await pool.query(
      `INSERT INTO accounts (id, email, password_hash, subscription_plan, is_active)
       VALUES ($1::uuid, $2, $3, 'scout_pro', true)
       ON CONFLICT (id) DO NOTHING`,
      [preferred, `ops-${preferred.slice(0, 8)}@carina.local`, 'ops-managed'],
    );
    return preferred;
  }

  const any = await pool.query<{ id: string }>('SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1');
  if (any.rows[0]) return any.rows[0].id;

  const created = await pool.query<{ id: string }>(
    `INSERT INTO accounts (email, password_hash, subscription_plan, is_active)
     VALUES ($1, $2, 'scout_pro', true)
     RETURNING id`,
    [FALLBACK_OPS_EMAIL, 'ops-managed'],
  );
  return created.rows[0].id;
}
