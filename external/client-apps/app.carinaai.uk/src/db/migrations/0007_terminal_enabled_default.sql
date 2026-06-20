ALTER TABLE "workspace_settings" ALTER COLUMN "terminal_enabled" SET DEFAULT true;--> statement-breakpoint
UPDATE "workspace_settings" SET "terminal_enabled" = true WHERE "terminal_enabled" = false;
