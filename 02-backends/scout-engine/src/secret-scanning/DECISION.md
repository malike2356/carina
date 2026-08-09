# Repository secret scanning on live Carina Scout

Live Contabo / OPS Scout uses `accounts` (not SaaS organizations/workspaces).

- Lifecycle truth: `repo_secret_*` tables
- Optional mirror: `findings` with `finding_type = exposed_secret` (metadata only)
- Operator UI: OPS `https://ops.carinaai.uk/security/repository-security`
- Ingest: `POST /api/v1/repository-secret-scans` on scout-engine (X-Scout-Key + signed envelope)

Standalone `scout/` SaaS remains a future product surface; do not cut DNS to it without owner approval.
