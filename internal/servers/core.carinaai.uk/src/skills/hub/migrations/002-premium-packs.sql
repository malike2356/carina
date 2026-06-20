-- Premium domain packs on Carina Hub (skill_packs table)
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS pricing_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS price_gbp_cents INT;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS author_revenue_share_bps INT NOT NULL DEFAULT 7000;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS carina_revenue_share_bps INT NOT NULL DEFAULT 2000;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS platform_fee_bps INT NOT NULL DEFAULT 1000;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skill_packs_pricing_tier_check'
  ) THEN
    ALTER TABLE skill_packs ADD CONSTRAINT skill_packs_pricing_tier_check
      CHECK (pricing_tier IN ('free', 'premium', 'certified'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pack_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL REFERENCES skill_packs(name) ON DELETE CASCADE,
  license_token TEXT UNIQUE NOT NULL,
  purchaser_email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pack_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL,
  purchaser_email TEXT NOT NULL,
  amount_gbp_cents INT NOT NULL,
  author_share_bps INT NOT NULL,
  carina_share_bps INT NOT NULL,
  platform_fee_bps INT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pack_licenses_email_idx ON pack_licenses(purchaser_email);
CREATE INDEX IF NOT EXISTS pack_licenses_pack_idx ON pack_licenses(pack_name);
CREATE INDEX IF NOT EXISTS pack_sales_pack_idx ON pack_sales(pack_name);
