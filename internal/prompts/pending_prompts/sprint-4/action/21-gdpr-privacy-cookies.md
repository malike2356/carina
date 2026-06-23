# Sprint 4 - Prompt e/01: GDPR, Privacy Policy, Cookie Consent

**Sprint:** 4 - Foundation
**Prompt number:** e/01
**Name:** Privacy policy, terms of service, cookie consent banner, data export, data deletion
**Primary agent:** Cursor (pages/UI) + Claude Code (backend export/deletion routes)
**Estimated hours:** 8-10 h
**Depends on:** Nothing. Can build independently.

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/e/`.

---

## Read First

1. `frontends/marketing/carinaai.uk/` - existing marketing site structure; Privacy and ToS pages go here
2. `frontends/client-apps/app.carinaai.uk/src/app/(auth)/register/` - registration page; must record consent at registration
3. `backends/servers/core.carinaai.uk/src/db/migrations/` - latest migration number; new columns go in a new migration

---

## Step 1: Legal pages on marketing site

Create two static HTML pages in the marketing site:

**`frontends/marketing/carinaai.uk/privacy/index.html`** - Privacy Policy

Use plain prose, UK-focused legal language. Cover:
- Who we are: "VERLOX Ltd, registered in England and Wales"
- What data we collect: name, email, business name, conversation content, payment data (via Stripe)
- Why we collect it: to provide the Aiva service, process payments, send transactional emails
- Who we share it with: Anthropic (AI processing), Stripe (payments), Resend (email delivery), Scout (agent monitoring), Backblaze (encrypted backups)
- Retention: account data kept for 30 days after cancellation, then permanently deleted; conversation data deleted with account; invoices kept for 7 years (legal requirement)
- Rights: access, rectification, erasure, portability, object to processing
- How to exercise rights: email privacy@carinaai.uk (create this email alias or use lordsesame@gmail.com as contact)
- Cookies: see Cookie Policy section
- Blockchain: explain that action hashes (not conversation content) are recorded on a public ledger; this cannot be deleted (explain this clearly)
- ICO registration number: [add when registered]
- Last updated: 2026-06-23

**`frontends/marketing/carinaai.uk/terms/index.html`** - Terms of Service

Cover:
- Service description: AI assistant service, not a regulated financial or legal service
- Trial: 15 days free, no card required; credit card required at upgrade
- Subscriptions: monthly or annual billing via Stripe; cancel anytime; cancels at period end
- Acceptable use: no illegal content, no spam, no impersonation, no use for regulated financial advice
- Limitation of liability: AI outputs are not guaranteed accurate; not responsible for decisions made based on Aiva responses
- Refund policy: 15-day money-back guarantee on first subscription payment; no refund on subsequent months
- Termination: VERLOX reserves right to suspend accounts violating these terms
- Governing law: England and Wales
- Last updated: 2026-06-23

Both pages must link to each other and back to the homepage.
Footer on `carinaai.uk` must include links: Privacy Policy | Terms of Service | Contact

---

## Step 2: Consent recording at registration

Add to the registration form:

```tsx
// In (auth)/register/page.tsx
// Add a checkbox before the submit button:
<label>
  <input type="checkbox" name="terms_accepted" required />
  I agree to the{' '}
  <a href="https://carinaai.uk/terms" target="_blank">Terms of Service</a>
  {' '}and{' '}
  <a href="https://carinaai.uk/privacy" target="_blank">Privacy Policy</a>
</label>
```

The checkbox must be unchecked by default and required. The form must not submit without it.

Add to DB:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
```

On registration, set:
```typescript
terms_accepted_at: new Date(),
terms_version: '2026-06-23',  // matches the "Last updated" date on the ToS page
```

---

## Step 3: Cookie consent banner

UK PECR requires consent before setting non-essential cookies.
Aiva uses: iron-session (essential), Sentry (functional/analytics), no advertising cookies.

Sentry sets no cookies but does use local storage and sends data to Sentry servers. Under a
strict interpretation of PECR, Sentry requires consent. Build consent as follows:

Create `src/components/CookieConsent.tsx` in `app.carinaai.uk`:

```tsx
// Small banner at the bottom of the screen shown on first visit
// Dismissed state stored in localStorage: carina_cookie_consent = 'accepted' | 'declined'

// If localStorage key does not exist: show banner
// If 'accepted': load Sentry, hide banner
// If 'declined': do not load Sentry, hide banner

// Banner content:
// "We use cookies and analytics to improve your experience.
//  [Accept] [Decline] [Privacy Policy]"

// Do NOT use a modal. A bottom banner is less disruptive and acceptable for PECR.
```

Sentry initialization in `sentry.client.config.ts` must be conditional:

```typescript
const consent = typeof window !== 'undefined' && localStorage.getItem('carina_cookie_consent');
if (consent === 'accepted') {
  Sentry.init({ dsn: process.env.SENTRY_DSN_APP, ... });
}
```

Add `CookieConsent` to the workspace layout `(workspace)/layout.tsx` and to the auth layout.

Also add to the marketing site `carinaai.uk`: a simpler pure-JS cookie banner in the site's
shared `<head>` or footer template.

---

## Step 4: Data export

Add to workspace settings page: a "Your data" section with an "Export my data" button.

**Next.js route:** `POST /api/workspace/export`

```typescript
// Requires workspace session
// Creates an export job; sends an email with a download link when ready
// (For small accounts, can generate synchronously; for large accounts, async with email)
// v1: synchronous (returns a ZIP within 30 seconds)

// Returns: { downloadUrl: string; expiresAt: string }
// downloadUrl is a signed URL with 15-minute expiry
```

**Core backend route:** `POST /api/workspace/export`

```typescript
// Fetches all data for the workspace and packages as JSON/CSV files:

// account.json: { workspaceName, ownerEmail, createdAt, planTier }
// aivas.json: Array<{ id, name, role, status, createdAt, channels: [...] }>
// conversations.csv: columns: aiva_name, channel, contact_id, role ('user'|'aiva'|'va'), content, timestamp, attestation_tx
//   Source: ai_worker_activity WHERE action_type IN ('message_received','message_sent','va_reply')
//   With JOIN to get aiva name
// automations.json: Array<{ name, scheduleLabel, enabled, lastRunAt }>
// invoices.csv: columns: date, amount, status, plan, invoice_id

// Package as ZIP using the 'archiver' npm package:
// npm install archiver
// npm install --save-dev @types/archiver

// Return the ZIP as a response with Content-Disposition: attachment; filename="carina-data-export.zip"
// OR: save to a temp location and return a signed URL

// For v1, return the ZIP directly (stream it):
res.setHeader('Content-Type', 'application/zip');
res.setHeader('Content-Disposition', 'attachment; filename="carina-export.zip"');
archive.pipe(res);
```

The Next.js proxy route passes the ZIP response directly to the client.

On the settings page, clicking "Export my data" triggers a download. Show "Preparing export..."
while the request is in progress.

---

## Step 5: Data deletion (right to erasure)

Add to workspace settings page: a "Delete my account" option (separate from cancellation).

**Warning modal before deletion:**
```
[heading] Delete your account and all data

This will permanently delete:
- Your account and login credentials
- All your Aivas and their configurations
- All conversation history
- All automation schedules

This cannot be undone.

Note: Blockchain attestation records (SHA-256 hashes) are on a public ledger and cannot be
deleted. These hashes contain no personal data - only cryptographic identifiers.

Invoice records are retained for 7 years as required by UK law, in anonymized form.

[Type DELETE to confirm] [text input]
[Cancel] [Delete everything]
```

**Next.js route:** `DELETE /api/workspace`

**Core backend route:** `DELETE /api/workspace`

```typescript
// Steps:
// 1. Cancel Stripe subscription (if active) via stripe.subscriptions.cancel()
// 2. Pause all Aivas: UPDATE ai_workers SET status='dismissed' WHERE workspace_id=$1
// 3. Soft delete workspace data:
//    - UPDATE workspaces SET deleted_at=NOW() WHERE id=$1
//    - UPDATE users SET deleted_at=NOW(), email=NULL, password_hash=NULL WHERE workspace_id=$1
//    - The email and password are cleared immediately
//    - ai_worker_activity rows: clear inputSummary and outputSummary columns (these contain conversation content)
//    - Keep the rows for attestation chain integrity (attestation_tx, timestamps, action_types remain)
// 4. Schedule hard delete:
//    - Add a record to a pending_deletions table with delete_after = NOW() + INTERVAL '30 days'
//    - A daily cron will permanently DELETE all rows for completed soft-deletions

// A daily cron (add to cron-scheduler.ts):
// DELETE FROM workspaces WHERE deleted_at < NOW() - INTERVAL '30 days'
// CASCADE handles related tables

// Return: { deleted: true }
// Then send a "Your account has been deleted" confirmation email
// (send before clearing the email address)
```

Add to DB:
```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Soft-delete columns on activity for PII erasure
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS pii_erased_at TIMESTAMPTZ;
-- On erasure: UPDATE ai_worker_activity SET input_summary=NULL, output_summary=NULL, pii_erased_at=NOW()
--             WHERE workspace_id=$1
-- Keep: action_type, attestation_tx, created_at (needed for audit chain)
```

---

## Step 6: Admin-triggered erasure (for GDPR requests received by email)

In the admin customer detail page (sprint-6 prompt 01), add to the override panel:

```
[Erasure request]
[Delete workspace data] button (danger, requires typing workspace name to confirm)
```

Calls `POST /api/admin/customers/:id/erase` which triggers the same deletion flow as
`DELETE /api/workspace` but initiated by admin, not the workspace owner.

Logs to `admin_audit_log`: `action='gdpr_erasure', target_type='workspace'`.

---

## Step 7: Privacy settings page in workspace

Create `src/app/(workspace)/settings/privacy/page.tsx` in `app.carinaai.uk`:

Three sections:
1. "Your data" - export button
2. "Cookie preferences" - re-open the cookie consent banner (set localStorage key back to undefined)
3. "Delete account" - danger zone with deletion flow

Link "Privacy settings" in the workspace sidebar or user menu.

---

## Step 8: Legal documentation

Create `infrastructure/LEGAL.md`:

```markdown
# Legal and Compliance

## ICO Registration

Under UK GDPR, VERLOX Ltd must register with the ICO if processing personal data.
Register at: ico.org.uk/registration
Annual fee: 40 GBP (Tier 1, small organisation)
Renew annually.
Once registered, add the ICO registration number to the Privacy Policy.

## PECR Compliance

Privacy and Electronic Communications Regulations (UK). Requires:
- Cookie consent before setting non-essential cookies/storage
- Opt-in for marketing emails (enforced via email_marketing_opt_out flag)

## Blockchain disclosure

Blockchain attestation hashes are public and permanent. The Privacy Policy explains this.
The hashes contain no personal data (they are SHA-256 hashes of action metadata, not content).
Under UK GDPR, hashes are not personal data provided they cannot reasonably identify an individual.
Legal basis: legitimate interest in maintaining a tamper-evident audit trail.

## Data retention schedule

- Conversation content: deleted when workspace is deleted (30-day grace period)
- Invoices: retained 7 years (UK Companies Act requirement), then deleted
- Attestation hashes: permanent (on public blockchain, cannot be deleted)
- Admin audit log: retained 3 years, then deleted
- Backup data: retained per backup retention policy (90 days)

## Contact for data requests

privacy@carinaai.uk (forward to lordsesame@gmail.com)
Response time: 30 days (UK GDPR requirement)
```

---

## Done When

- [ ] `carinaai.uk/privacy/` page exists with comprehensive UK-focused privacy policy
- [ ] `carinaai.uk/terms/` page exists with terms of service including refund policy
- [ ] Both pages link to each other; marketing site footer has links to both
- [ ] Registration form has mandatory terms checkbox; form does not submit without it
- [ ] `terms_accepted_at` and `terms_version` stored on user row at registration
- [ ] Cookie consent banner renders on first visit to app.carinaai.uk and carinaai.uk
- [ ] Sentry initialization gated on cookie consent (not loaded if declined)
- [ ] Accepting/declining consent stores result in localStorage
- [ ] Privacy settings page exists with export, cookie preferences, and delete account sections
- [ ] "Export my data" downloads a ZIP containing account.json, aivas.json, conversations.csv, automations.json, invoices.csv
- [ ] ZIP download works end-to-end; files contain correct data
- [ ] "Delete account" modal requires typing "DELETE" to confirm
- [ ] Deletion flow: cancels Stripe subscription, clears PII from activity rows, soft-deletes workspace and user
- [ ] Confirmation email sent before email address is cleared
- [ ] 30-day hard deletion cron registered in cron-scheduler.ts
- [ ] Admin erasure button in customer detail panel works and writes to admin_audit_log
- [ ] `infrastructure/LEGAL.md` documents ICO registration, retention schedule, and PECR requirements
- [ ] No em dashes in any legal copy (required by writing style rules)
