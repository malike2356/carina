ALTER TABLE "workspace_settings" ADD COLUMN "auto_extract_memories" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "auto_extract_skills" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "auto_approve_skills_min_confidence" integer DEFAULT 85 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "max_skills_per_request" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "inject_memories_in_chat" boolean DEFAULT true NOT NULL;
