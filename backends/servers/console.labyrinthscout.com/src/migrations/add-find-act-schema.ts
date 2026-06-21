import type pg from 'pg';

export async function runFindActSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS action_playbooks (
      id           TEXT PRIMARY KEY,
      event_type   TEXT NOT NULL,
      min_severity TEXT NOT NULL CHECK (min_severity IN ('info','warning','critical','breach')),
      title        TEXT NOT NULL,
      summary      TEXT NOT NULL,
      risk_note    TEXT NOT NULL,
      category     TEXT NOT NULL CHECK (category IN ('auto','human','monitor')),
      actions      JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS pending_actions (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id     UUID NOT NULL REFERENCES security_events(id) ON DELETE CASCADE,
      playbook_id  TEXT NOT NULL REFERENCES action_playbooks(id),
      status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','resolved','dismissed','auto_resolved')),
      resolved_by  TEXT,
      resolved_at  TIMESTAMPTZ,
      resolution   TEXT,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS action_executions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pending_id    UUID REFERENCES pending_actions(id),
      event_id      UUID NOT NULL REFERENCES security_events(id) ON DELETE CASCADE,
      action_id     TEXT NOT NULL,
      action_label  TEXT NOT NULL,
      executed_by   TEXT NOT NULL,
      execution_type TEXT NOT NULL CHECK (execution_type IN ('auto','manual')),
      outcome       TEXT NOT NULL CHECK (outcome IN ('success','failure','partial','dry_run')),
      output        TEXT,
      metadata      JSONB DEFAULT '{}',
      executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_actions_status
      ON pending_actions(status) WHERE status = 'pending'
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_actions_event
      ON pending_actions(event_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_action_executions_event
      ON action_executions(event_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_action_executions_executed_at
      ON action_executions(executed_at DESC)
  `);
}
