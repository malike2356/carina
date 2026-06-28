ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
