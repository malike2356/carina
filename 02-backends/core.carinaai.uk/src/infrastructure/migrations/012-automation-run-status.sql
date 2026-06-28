-- Automation run status for fleet dashboard and restore verification
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_status TEXT;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_error TEXT;

UPDATE ai_worker_automations
SET last_run_error = last_error
WHERE last_run_error IS NULL AND last_error IS NOT NULL;
