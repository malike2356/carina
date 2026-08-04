import { pool } from '../memory/db.js';

export type AivaVaProvisionSource = 'manual' | 'verlox_mis' | 'migration';

export interface ProvisionAivaVaMemberInput {
  name: string;
  email: string;
  maxLoad?: number;
  verloxVaAssistantId?: string | number | null;
  source?: AivaVaProvisionSource;
  available?: boolean;
}

export interface ProvisionAivaVaMemberResult {
  id: string;
  name: string;
  email: string;
  maxLoad: number;
  available: boolean;
  source: string;
  verloxVaAssistantId: string | null;
  created: boolean;
  linked: boolean;
}

let schemaReady: Promise<void> | null = null;

export async function ensureVaTeamMembersSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS va_team_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          available BOOLEAN NOT NULL DEFAULT true,
          current_load INTEGER NOT NULL DEFAULT 0,
          max_load INTEGER NOT NULL DEFAULT 5,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`ALTER TABLE va_team_members ADD COLUMN IF NOT EXISTS verlox_va_assistant_id TEXT`);
      await pool.query(`ALTER TABLE va_team_members ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS va_team_members_email_lower_uidx
          ON va_team_members (lower(email))
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function clampMaxLoad(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '5'), 10);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

/**
 * Idempotent upsert into va_team_members keyed by lower(email).
 */
export async function provisionAivaVaMember(
  input: ProvisionAivaVaMemberInput,
): Promise<ProvisionAivaVaMemberResult> {
  await ensureVaTeamMembersSchema();

  const name = String(input.name ?? '').trim();
  const email = normalizeEmail(String(input.email ?? ''));
  if (!name || !email || !email.includes('@')) {
    throw new Error('name and a valid email are required');
  }

  const maxLoad = clampMaxLoad(input.maxLoad);
  const source: AivaVaProvisionSource = input.source ?? 'manual';
  const verloxId =
    input.verloxVaAssistantId === null || input.verloxVaAssistantId === undefined
      ? null
      : String(input.verloxVaAssistantId);
  const available = input.available === undefined ? true : Boolean(input.available);

  const existing = await pool.query(
    `SELECT * FROM va_team_members WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0] as Record<string, unknown>;
    const updated = await pool.query(
      `UPDATE va_team_members SET
         name = $2,
         max_load = COALESCE($3, max_load),
         available = COALESCE($4, available),
         verlox_va_assistant_id = COALESCE($5, verlox_va_assistant_id),
         source = CASE
           WHEN $6::text IS NOT NULL AND $6::text <> 'manual' THEN $6::text
           ELSE source
         END
       WHERE id = $1
       RETURNING *`,
      [
        row.id,
        name,
        maxLoad,
        available,
        verloxId,
        source === 'manual' ? null : source,
      ],
    );
    const out = updated.rows[0] as Record<string, unknown>;
    return {
      id: String(out.id),
      name: String(out.name),
      email: String(out.email),
      maxLoad: Number(out.max_load ?? 5),
      available: Boolean(out.available),
      source: String(out.source ?? 'manual'),
      verloxVaAssistantId: out.verlox_va_assistant_id ? String(out.verlox_va_assistant_id) : null,
      created: false,
      linked: true,
    };
  }

  const inserted = await pool.query(
    `INSERT INTO va_team_members
       (name, email, max_load, available, verlox_va_assistant_id, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, email, maxLoad, available, verloxId, source],
  );
  const out = inserted.rows[0] as Record<string, unknown>;
  return {
    id: String(out.id),
    name: String(out.name),
    email: String(out.email),
    maxLoad: Number(out.max_load ?? 5),
    available: Boolean(out.available),
    source: String(out.source ?? source),
    verloxVaAssistantId: out.verlox_va_assistant_id ? String(out.verlox_va_assistant_id) : null,
    created: true,
    linked: Boolean(verloxId),
  };
}
