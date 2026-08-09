-- 0007: Document Vault Google Drive connection, conflict fields, notification dedupe (prompt 711).

CREATE TABLE IF NOT EXISTS document_vault_drive_connections (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'outbound_only'
    CHECK (mode IN ('outbound_only', 'inbound_only', 'two_way')),
  account_email TEXT,
  scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  google_root_folder_id TEXT,
  google_root_folder_name TEXT,
  vault_root_item_id UUID,
  page_token TEXT,
  channel_id TEXT,
  resource_id TEXT,
  channel_expires_at TIMESTAMPTZ,
  verification_token_hash TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  encrypted_grant TEXT,
  grant_iv TEXT,
  grant_tag TEXT,
  shared_drives_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_vault_drive_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, notification_id)
);

CREATE INDEX IF NOT EXISTS document_vault_drive_notifications_ws_idx
  ON document_vault_drive_notifications (workspace_id, created_at DESC);

ALTER TABLE document_vault_provider_mappings
  ADD COLUMN IF NOT EXISTS content_authority TEXT NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS conflict_state TEXT,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS document_vault_provider_mappings_item_idx
  ON document_vault_provider_mappings (item_id);

ALTER TABLE document_vault_items
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS conflict BOOLEAN NOT NULL DEFAULT FALSE;
