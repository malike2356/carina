DO $$ BEGIN
  CREATE TYPE "sso_provider_type" AS ENUM ('oidc', 'saml');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_sso_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "provider_type" "sso_provider_type" NOT NULL DEFAULT 'oidc',
  "display_name" text NOT NULL,
  "domain" varchar(255) NOT NULL,
  "issuer" text,
  "client_id" text,
  "client_secret_enc" text,
  "client_secret_iv" text,
  "client_secret_tag" text,
  "saml_entity_id" text,
  "saml_sso_url" text,
  "saml_certificate_enc" text,
  "saml_certificate_iv" text,
  "saml_certificate_tag" text,
  "default_role" varchar(30) NOT NULL DEFAULT 'member',
  "sso_required" boolean NOT NULL DEFAULT false,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workspace_sso_providers_workspace_id_idx" ON "workspace_sso_providers"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_sso_providers_domain_idx" ON "workspace_sso_providers"("domain");
