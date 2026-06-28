-- TB-006: Pack submission workflow and author earnings tracking

CREATE TABLE IF NOT EXISTS pack_submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name        TEXT        NOT NULL,
  version          TEXT        NOT NULL,
  author_handle    TEXT        NOT NULL,
  author_email     TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  category         TEXT,
  pricing_tier     TEXT        NOT NULL DEFAULT 'free'
                   CHECK (pricing_tier IN ('free', 'premium', 'certified')),
  price_gbp_cents  INTEGER,
  author_share_bps INTEGER     NOT NULL DEFAULT 7000,
  pack_archive_url TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  reviewer_notes   TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  published_at     TIMESTAMPTZ
);

ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS install_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS author_email    TEXT;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS author_share_bps INTEGER NOT NULL DEFAULT 7000;
