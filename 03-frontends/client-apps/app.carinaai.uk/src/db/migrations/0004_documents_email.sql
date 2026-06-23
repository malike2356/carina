CREATE TABLE "documents" (
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
--> statement-breakpoint
CREATE TABLE "email_messages" (
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
--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "inbound_email_token" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_workspace_id_idx" ON "documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "email_messages_workspace_id_idx" ON "email_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "email_messages_status_idx" ON "email_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_messages_received_at_idx" ON "email_messages" USING btree ("received_at");
