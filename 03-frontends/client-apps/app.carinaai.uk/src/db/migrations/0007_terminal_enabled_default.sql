ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "terminal_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ALTER COLUMN "terminal_enabled" SET DEFAULT true;--> statement-breakpoint
UPDATE "workspace_settings" SET "terminal_enabled" = true WHERE "terminal_enabled" = false;
