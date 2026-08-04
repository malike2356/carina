-- VA Queue assign/status updates expect these columns.
ALTER TABLE ai_worker_escalations
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE ai_worker_escalations
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;
