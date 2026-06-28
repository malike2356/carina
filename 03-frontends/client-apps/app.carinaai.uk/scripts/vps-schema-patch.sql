-- Idempotent schema patch for Carina Cloud (app.carinaai.uk).
-- Safe to re-run on VPS when deploy skips drizzle-kit.

-- 0004: documents, email, inbound token
CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "session_id" uuid,
  "title" text DEFAULT 'Untitled' NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "format" varchar(20) DEFAULT 'markdown' NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "external_id" text,
  "from_address" text NOT NULL,
  "subject" text DEFAULT '' NOT NULL,
  "body_preview" text,
  "body_full" text,
  "urgency" varchar(20) DEFAULT 'normal' NOT NULL,
  "status" varchar(30) DEFAULT 'inbox' NOT NULL,
  "ai_draft_reply" text,
  "ai_draft_generated_at" timestamp,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "inbound_email_token" text;

DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_chat_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "documents_workspace_id_idx" ON "documents" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "email_messages_workspace_id_idx" ON "email_messages" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "email_messages_status_idx" ON "email_messages" USING btree ("status");
CREATE INDEX IF NOT EXISTS "email_messages_received_at_idx" ON "email_messages" USING btree ("received_at");

-- 0003: appearance (may already exist)
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "appearance" jsonb;

-- 0005: calendar
ALTER TABLE "user_notes" ADD COLUMN IF NOT EXISTS "reminder_at" timestamp;

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "external_uid" text,
  "title" text NOT NULL,
  "description" text,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp,
  "all_day" boolean DEFAULT false NOT NULL,
  "source" varchar(30) DEFAULT 'local' NOT NULL,
  "note_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "calendar_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "provider" varchar(30) DEFAULT 'caldav' NOT NULL,
  "url" text,
  "username" text,
  "encrypted_password" text,
  "password_iv" text,
  "password_tag" text,
  "last_sync_at" timestamp,
  "last_sync_error" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_note_id_user_notes_id_fk"
    FOREIGN KEY ("note_id") REFERENCES "public"."user_notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "calendar_events_workspace_id_idx" ON "calendar_events" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "calendar_events_starts_at_idx" ON "calendar_events" USING btree ("starts_at");
CREATE INDEX IF NOT EXISTS "calendar_events_external_uid_idx" ON "calendar_events" USING btree ("external_uid");
CREATE INDEX IF NOT EXISTS "calendar_connections_workspace_id_idx" ON "calendar_connections" USING btree ("workspace_id");

-- 0006: brain settings columns (fixes chat query failure)
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "auto_extract_memories" boolean DEFAULT true NOT NULL;
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "auto_extract_skills" boolean DEFAULT false NOT NULL;
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "auto_approve_skills_min_confidence" integer DEFAULT 85 NOT NULL;
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "max_skills_per_request" integer DEFAULT 3 NOT NULL;
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "inject_memories_in_chat" boolean DEFAULT true NOT NULL;

-- 0007: terminal access gate (enabled by default for new rows only)
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "terminal_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "workspace_settings" ALTER COLUMN "terminal_enabled" SET DEFAULT true;

-- 0008: terminal RBAC and audit log
CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "role" varchar(30) DEFAULT 'member' NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "invited_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "terminal_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "session_id" uuid NOT NULL,
  "command" text NOT NULL,
  "exit_code" integer,
  "executed_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "terminal_audit_log" ADD CONSTRAINT "terminal_audit_log_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "terminal_audit_log" ADD CONSTRAINT "terminal_audit_log_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_user_uniq"
  ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_members_workspace_id_idx" ON "workspace_members" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "terminal_audit_log_workspace_id_idx" ON "terminal_audit_log" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "terminal_audit_log_executed_at_idx" ON "terminal_audit_log" USING btree ("executed_at");

-- 0009: white-label brand + core org link
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "core_org_id" uuid;
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "brand" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- 0010: custom domains
CREATE TABLE IF NOT EXISTS "custom_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "hostname" text NOT NULL,
  "verification_token" text NOT NULL,
  "verified_at" timestamp,
  "tls_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "is_canonical" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'custom_domains_hostname_unique'
  ) THEN
    ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_hostname_unique" UNIQUE ("hostname");
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "custom_domains_workspace_id_idx" ON "custom_domains" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "custom_domains_hostname_idx" ON "custom_domains" USING btree ("hostname");

-- 0011: partner pack catalog on workspace settings
ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "pack_catalog" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 0012: workspace profiles and session profile binding
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
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_profiles_workspace_slug_idx" ON "workspace_profiles" ("workspace_id", "slug");
CREATE INDEX IF NOT EXISTS "workspace_profiles_workspace_id_idx" ON "workspace_profiles" ("workspace_id");
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "profile_id" uuid REFERENCES "workspace_profiles"("id") ON DELETE set null;
CREATE INDEX IF NOT EXISTS "chat_sessions_profile_id_idx" ON "chat_sessions" ("profile_id");

-- 0013: workspace onboarding completion timestamp
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ;

-- 0014: GDPR / account deletion timestamps
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
