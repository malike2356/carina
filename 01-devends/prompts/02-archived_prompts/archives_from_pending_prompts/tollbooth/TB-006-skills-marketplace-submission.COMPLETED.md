# TB-006: Skills Marketplace Submission, Approval, and Payout

**Sprint:** Tollbooth platform infrastructure
**Phase:** 3 - Build the network effect
**Depends on:** TB-001 (events track installs), TB-003 (gateway serves skills)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

The skills hub registry (`src/skills/hub/registry.ts`) already has the data shape for
published packs: `author_revenue_share_bps`, `carina_revenue_share_bps`, `platform_fee_bps`,
`pricing_tier`, `price_gbp_cents`. The hub database is separate from the main org database
(it uses `hubPool` from `src/skills/hub/migrations.js`).

This sprint adds:
1. A submission flow: third-party authors submit packs for review
2. An approval workflow: VERLOX ops approves or rejects submissions
3. Install tracking: `download_count` incremented, billing event fired
4. Payout tracking: per-month author earnings recorded for future Stripe Connect payout

This is Phase 3 work. Only begin this sprint after TB-001 and TB-003 are complete and
at least one certified partner is actively using the gateway.

---

## Task

### 1. Migration: submissions table (hub database)

Add to the hub migrations (check `src/skills/hub/migrations.js` for the pattern):

```sql
CREATE TABLE IF NOT EXISTS pack_submissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name       TEXT        NOT NULL,
  version         TEXT        NOT NULL,
  author_handle   TEXT        NOT NULL,
  author_email    TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  category        TEXT,
  pricing_tier    TEXT        NOT NULL DEFAULT 'free'
                  CHECK (pricing_tier IN ('free', 'premium', 'certified')),
  price_gbp_cents INTEGER,
  author_share_bps INTEGER    NOT NULL DEFAULT 7000,
  pack_archive_url TEXT       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  reviewer_notes  TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ
);
```

`author_share_bps = 7000` means 70% to the author; Carina keeps 30%.
`pack_archive_url` is the URL of the submitted .zip or GitHub release.
Do not store the actual pack archive in the database.

Also add a column to the existing `hub_packs` table (check its name in migrations.js):
```sql
ALTER TABLE hub_packs ADD COLUMN IF NOT EXISTS install_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hub_packs ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE hub_packs ADD COLUMN IF NOT EXISTS author_share_bps INTEGER NOT NULL DEFAULT 7000;
```

### 2. Submission API

In the hub server (check `src/skills/hub/` for the Express router), add:

**POST /hub/api/submissions**
No auth (public). Rate limited to 3 submissions per email per day (in-memory counter is fine).

Body:
```json
{
  "packName": "my-legal-review",
  "version": "1.0.0",
  "authorHandle": "acme-ai",
  "authorEmail": "dev@acmecorp.example",
  "description": "Skill pack for legal document review.",
  "category": "legal",
  "pricingTier": "premium",
  "priceGbpCents": 499,
  "packArchiveUrl": "https://github.com/acmecorp/packs/releases/download/v1.0.0/legal-review.zip"
}
```

Validates:
- `packName` matches `^[a-z0-9-]{3,48}$`
- `version` matches semantic version pattern
- `authorEmail` is a valid email format
- `pricingTier` is one of the allowed values
- If `pricingTier = 'premium'`, `priceGbpCents` must be > 0
- `packArchiveUrl` must start with `https://`

Sends a confirmation email to `authorEmail` via the existing Resend integration
(check how brand-email.ts uses Resend and follow that pattern).
`from` address: `marketplace@carinaai.uk`

Returns `{ submissionId: string, status: 'pending' }`.

**GET /hub/api/submissions/:id** (auth: `CARINA_OPS_TOKEN`)
Returns full submission detail including `reviewer_notes`.

**PATCH /hub/api/submissions/:id** (auth: `CARINA_OPS_TOKEN`)
Approve or reject a submission.
Body: `{ action: 'approve' | 'reject', reviewerNotes?: string }`

On approve:
1. Set `status = 'approved'` and `reviewed_at = NOW()`
2. Do NOT automatically publish. Require a second explicit action to prevent
   accidental instant publication.

On reject:
1. Set `status = 'rejected'`, `reviewed_at = NOW()`, `reviewer_notes = input.reviewerNotes`
2. Send rejection email to `authorEmail` with the reviewer notes.

**POST /hub/api/submissions/:id/publish** (auth: `CARINA_OPS_TOKEN`)
Publishes an approved submission. This copies the submission data into `hub_packs`
(or the equivalent table in the hub DB), sets `status = 'published'`, `published_at = NOW()`.
Sends a publication notification email to the author.

### 3. Install tracking

When a workspace installs a pack (find the existing install handler in `src/skills/hub/`),
after the install succeeds:

```typescript
await hubPool.query(
  `UPDATE hub_packs SET install_count = install_count + 1 WHERE name = $1`,
  [packName],
);
```

Also emit a `platform_event` with:
```typescript
void emitPlatformEvent({
  orgId: context.orgId,
  partnerId: context.partnerId,
  eventType: 'skill_invocation',
  skillCalls: 1,
  metadata: { packName, action: 'install' },
});
```

### 4. Earnings tracking migration

In `src/api/hosted-migrations.ts` (main core DB, not hub DB):

```sql
CREATE TABLE IF NOT EXISTS author_earnings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_email    TEXT        NOT NULL,
  pack_name       TEXT        NOT NULL,
  billing_month   TEXT        NOT NULL, -- 'YYYY-MM'
  installs        INTEGER     NOT NULL DEFAULT 0,
  gross_pence     INTEGER     NOT NULL DEFAULT 0,
  author_pence    INTEGER     NOT NULL DEFAULT 0,
  carina_pence    INTEGER     NOT NULL DEFAULT 0,
  payout_status   TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (payout_status IN ('pending', 'paid', 'held')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_author_earnings_month
  ON author_earnings (author_email, pack_name, billing_month);
```

Add a cron-triggered route `POST /internal/billing/calculate-author-earnings`
(behind `CARINA_OPS_TOKEN`) that runs at month-end:

1. Queries installs for the month from `hub_packs` install events
2. For each premium pack with installs, calculates:
   - `gross_pence = installs * priceGbpCents`
   - `author_pence = gross_pence * author_share_bps / 10000`
   - `carina_pence = gross_pence - author_pence`
3. Upserts into `author_earnings` using the unique index

Stripe Connect payout automation is out of scope for this sprint. The `author_earnings`
table is the ledger. Actual payouts are manual via Stripe dashboard until volume
justifies automation.

---

## What NOT to do

- Do not automatically publish packs. Human review is mandatory. Every pack that runs
  in a workspace runs with Carina's implicit endorsement. The approval step is not
  bureaucracy; it is margin protection.
- Do not implement Stripe Connect in this sprint. The ledger must be accurate before
  the payout mechanism is built.
- Do not store pack archive contents in the database. `pack_archive_url` is a pointer.
  Download and validate the archive only at publish time.

---

## Done when

- [ ] `pack_submissions` table created in hub DB
- [ ] `author_earnings` table created in core DB
- [ ] `POST /hub/api/submissions` accepts valid submissions, rejects invalid ones
- [ ] Rate limiting blocks >3 submissions per email per day
- [ ] Confirmation email sent to author on submission
- [ ] `PATCH /hub/api/submissions/:id` with `action: approve` sets correct status
- [ ] `PATCH /hub/api/submissions/:id` with `action: reject` sends rejection email
- [ ] `POST /hub/api/submissions/:id/publish` inserts into `hub_packs` and sets published_at
- [ ] `install_count` increments on pack install
- [ ] `POST /internal/billing/calculate-author-earnings` produces correct `author_earnings` rows
- [ ] `pnpm build` compiles without TypeScript errors
