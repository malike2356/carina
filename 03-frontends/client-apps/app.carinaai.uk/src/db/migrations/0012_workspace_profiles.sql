CREATE TABLE IF NOT EXISTS "workspace_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "slug" varchar(64) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "system_prompt" text,
  "provider" varchar(50),
  "model" varchar(120),
  "is_builtin" boolean NOT NULL DEFAULT false,
  "builtin_id" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_profiles_workspace_slug_idx" ON "workspace_profiles" ("workspace_id", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_profiles_workspace_id_idx" ON "workspace_profiles" ("workspace_id");
--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "profile_id" uuid REFERENCES "workspace_profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_sessions_profile_id_idx" ON "chat_sessions" ("profile_id");
