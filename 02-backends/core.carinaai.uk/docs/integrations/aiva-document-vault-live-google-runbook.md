# Aiva Document Vault live Google runbook (owner-gated)

**Purpose:** Controlled real-Google Drive validation without putting credentials in fixtures, logs, commits, or evidence JSON.

## Prerequisites

- Owner Google test account (not production customer data)
- OAuth client credentials already in Contabo / local secrets (`.access/` or VPS secrets), never in repo
- Public HTTPS webhook URL for watch channels (production uses `DOCUMENT_VAULT_GOOGLE_WEBHOOK_URL`)

## Steps

1. Sign in to Aiva as a test workspace owner on `admin.hireaiva.co.uk`
2. Open `/documents` → Drive panel
3. Connect with the least scope (`drive.file` unless full Drive explicitly required)
4. Create a vault markdown file; request outbound sync
5. Edit the same file in Drive; trigger reconcile / wait for watch wakeup
6. Force a conflict (edit both sides); confirm preserve-both UI and Soft Wall resolve
7. Renew watch; disconnect cleanly

## Evidence rules

Record only:

- workspace id (non-secret)
- timestamps
- item ids / Drive file ids
- pass/fail notes

Never paste access tokens, refresh tokens, client secrets, or raw grant ciphertext into chat, tickets, or `docs/integrations/evidence/`.

## Matrix honesty

Until this run succeeds, conformance row `live_google_owner_run` stays `BLOCKED_OPTIONAL_CREDENTIALS`. Hermetic Google unit tests remain `REAL`.
