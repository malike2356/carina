ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "pack_catalog" jsonb NOT NULL DEFAULT '[]'::jsonb;
