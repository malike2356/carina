-- Gmail / Outlook OAuth fields for per-worker email connections

ALTER TABLE worker_email_connections
  ADD COLUMN IF NOT EXISTS oauth_provider TEXT;

ALTER TABLE worker_email_connections
  ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;
