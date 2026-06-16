CREATE TABLE "workspace_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"name" text,
	"description" text,
	"github_url" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_skills" ADD CONSTRAINT "workspace_skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_skills_workspace_id_idx" ON "workspace_skills" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_skills_workspace_skill_uniq" ON "workspace_skills" USING btree ("workspace_id","skill_id");