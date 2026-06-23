CREATE TABLE "custom_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "hostname" text NOT NULL,
  "verification_token" text NOT NULL,
  "verified_at" timestamp,
  "tls_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "is_canonical" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "custom_domains_hostname_unique" UNIQUE("hostname")
);--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_domains_workspace_id_idx" ON "custom_domains" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "custom_domains_hostname_idx" ON "custom_domains" USING btree ("hostname");
