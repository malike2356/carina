import { countUsers, createUser } from './ops-users.js';
import { query } from './db.js';

export async function ensureOpsUsersSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ops_users (
      id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name                  TEXT NOT NULL,
      email                 TEXT NOT NULL UNIQUE,
      password_hash         TEXT NOT NULL,
      role                  TEXT NOT NULL DEFAULT 'admin'
                              CHECK (role IN ('superadmin', 'admin', 'viewer')),
      is_active             BOOLEAN NOT NULL DEFAULT true,
      force_password_change BOOLEAN NOT NULL DEFAULT false,
      reset_token           TEXT,
      reset_token_expires_at TIMESTAMPTZ,
      last_login_at         TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS ops_users_email_idx ON ops_users (lower(email))`,
  );
}

export async function bootstrapFirstUser(): Promise<void> {
  await ensureOpsUsersSchema();

  const count = await countUsers();
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL ?? 'admin@carinaai.uk';
  const name = process.env.ADMIN_NAME ?? 'Operator';
  const password = process.env.ADMIN_PASSWORD ?? 'changeme';
  const forceChange = password === 'changeme';

  await createUser(name, email, password, 'superadmin', forceChange);
  console.log(`[ops-users] Bootstrap: created superadmin ${email}${forceChange ? ' (force password change on next login)' : ''}`);
}
