ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS triage_status TEXT DEFAULT 'inbox';
