export const PROFILE_ISOLATION_MIGRATION = `
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS profile_name TEXT DEFAULT 'default';
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS model_provider TEXT;
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS model_name TEXT;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_profile_status
  ON scheduled_tasks (profile_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_completed
  ON scheduled_task_runs (completed_at DESC);
ALTER TABLE persistent_facts ADD COLUMN IF NOT EXISTS profile_name TEXT DEFAULT 'default';
ALTER TABLE persistent_facts ADD COLUMN IF NOT EXISTS agent_name TEXT;
CREATE INDEX IF NOT EXISTS idx_persistent_facts_profile_target
  ON persistent_facts (profile_name, target, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_persistent_facts_agent_target
  ON persistent_facts (profile_name, agent_name, target, created_at ASC);
`;
