import { query, tableExists } from './db.js';

/** Matches core.carinaai.uk/src/agents/standing-orders-types.ts */
const STANDING_ORDERS_SCHEMA = `
CREATE TABLE IF NOT EXISTS standing_orders (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT '*',
  directive TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'user',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_standing_orders_agent ON standing_orders(agent_id, enabled);
`;

export async function ensureStandingOrdersSchema(): Promise<void> {
  if (await tableExists('standing_orders')) return;

  const statements = STANDING_ORDERS_SCHEMA
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const statement of statements) {
    await query(statement);
  }
}

export async function standingOrdersTableReady(): Promise<boolean> {
  await ensureStandingOrdersSchema().catch(() => undefined);
  return tableExists('standing_orders');
}
