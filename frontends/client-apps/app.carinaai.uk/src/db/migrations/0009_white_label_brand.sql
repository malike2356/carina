ALTER TABLE "workspaces" ADD COLUMN "core_org_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "brand" jsonb DEFAULT '{}'::jsonb NOT NULL;
