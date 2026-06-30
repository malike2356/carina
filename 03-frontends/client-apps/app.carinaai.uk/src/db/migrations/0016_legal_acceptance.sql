CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_type" text NOT NULL,
  "version" text NOT NULL,
  "effective_date" date NOT NULL,
  "content_url" text NOT NULL,
  "is_current" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "legal_documents_type_version_uniq" UNIQUE("document_type", "version")
);

CREATE TABLE IF NOT EXISTS "legal_acceptances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "workspace_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "document_version" text NOT NULL,
  "accepted_at" timestamp DEFAULT now() NOT NULL,
  "ip_address_hash" text,
  "user_agent" text,
  CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
  CONSTRAINT "legal_acceptances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade,
  CONSTRAINT "legal_acceptances_document_fk" FOREIGN KEY ("document_type", "document_version") REFERENCES "legal_documents"("document_type", "version"),
  CONSTRAINT "legal_acceptances_user_doc_version_uniq" UNIQUE("user_id", "document_type", "document_version")
);

CREATE INDEX IF NOT EXISTS "legal_acceptances_user_document_idx" ON "legal_acceptances" ("user_id", "document_type");
CREATE INDEX IF NOT EXISTS "legal_acceptances_workspace_accepted_idx" ON "legal_acceptances" ("workspace_id", "accepted_at" DESC);

INSERT INTO "legal_documents" ("document_type", "version", "effective_date", "content_url", "is_current")
VALUES
  ('terms_of_service', '1.0', '2026-06-30', '/legal/terms', true),
  ('privacy_policy', '1.0', '2026-06-30', '/legal/privacy', true),
  ('dpa', '1.0', '2026-06-30', '/legal/dpa', true)
ON CONFLICT ("document_type", "version") DO NOTHING;
