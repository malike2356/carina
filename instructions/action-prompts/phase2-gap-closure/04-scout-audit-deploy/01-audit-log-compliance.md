# Action: Build the Immutable Audit Log and GDPR Compliance Layer

## Goal
Extend the EXISTING event/export infrastructure into a formal, immutable, append-only `audit_log` table covering tool calls, model requests, security events, admin actions, and auth events, with a search API, CSV/PDF export, retention policies, and the GDPR Subject Access Request / Right to Erasure endpoints the spec requires (genuinely greenfield).

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/04-scout-audit-deploy/01-audit-log-compliance.md`
- **Partial gap-closure: event recording and export already exist; immutability, search, and ALL of GDPR/compliance are greenfield.** Read these first:
  - `console.labyrinthscout.com/src/api/events.ts` (280 lines) — read in FULL; this is almost certainly where security/admin/auth events are currently recorded and queried; map its current event shape against the spec's `AuditEvent` interface (lines 25-40)
  - `console.labyrinthscout.com/src/api/export.ts` (157 lines) — read in FULL; this ALREADY does CSV export; the spec's `audit-export.ts` (CSV/PDF) should EXTEND this, not duplicate it — confirm its query/filter shape against the spec's search API (lines 104-113)
  - `console.labyrinthscout.com/src/migrations.ts` — read to find the current event/log table schema (`grep -n "CREATE TABLE" migrations.ts`); compare column-for-column against the spec's `audit_log` schema (lines 84-94)
- Confirmed via `grep -ril "gdpr\|subject access\|right to erasure\|sar\b\|compliance\|anonymiz" console.labyrinthscout.com/src core.carinaai.uk/src` → **NOTHING FOUND**. The entire `compliance/` subtree (SAR, erasure, retention policies, GDPR report) is genuinely greenfield — build it fresh, but reuse the existing event-recording pipeline as its data source.
- Conventions: TypeScript strict, no emojis/em-dashes, PostgreSQL via the existing `pool`/migration patterns, every new module gets a `*.test.ts`.

## Files to create
```
console.labyrinthscout.com/src/audit/
  audit-logger.ts              — Thin wrapper that normalizes events from existing call sites into the AuditEvent shape and writes to audit_log
  audit-search.ts              — Search with the documented filters (tenant_id, event_type, severity, from, to, query, page, per_page)
  audit-retention.ts           — Scheduled job applying RETENTION_POLICIES (lines 141-149)
  audit-schemas.ts             — AuditEventType union + AuditEvent interface exactly per spec lines 25-40
  compliance/
    gdpr-report.ts             — Aggregate compliance report generator
    data-access-request.ts     — POST /api/admin/compliance/sar handler (full data export)
    data-deletion.ts           — POST /api/admin/compliance/erase handler (anonymize + delete, retain audit trail)
    retention-policy.ts        — RETENTION_POLICIES constant + scheduling glue for audit-retention.ts
  __tests__/
    audit-logger.test.ts
    audit-search.test.ts
    audit-retention.test.ts
    data-access-request.test.ts
    data-deletion.test.ts
console.labyrinthscout.com/src/api/
  audit-search.ts              — GET /api/admin/scout/audit/search route (or extend events.ts if its existing route already serves this purpose — confirm in Step 1)
  compliance.ts                — POST /api/admin/compliance/sar and /erase routes
```

## Files to modify
- `console.labyrinthscout.com/src/api/export.ts` — extend the existing CSV export to (a) match the spec's `audit/export` path/filter contract, (b) add a PDF output option if genuinely absent (`grep -n "pdf\|PDF" export.ts`); reuse its existing query-building code rather than writing a parallel exporter
- `console.labyrinthscout.com/src/api/events.ts` — confirm whether its current recording function can be the single write path for ALL five event categories (tool_execution, model_request, security, admin, auth); if it already records security/admin events, `audit-logger.ts` should call INTO it (or its underlying writer) rather than writing to the table directly, to avoid two parallel write paths
- `console.labyrinthscout.com/src/migrations.ts` — add/alter the `audit_log` table to match the spec's schema (lines 84-94) plus the Postgres Row-Level-Security append-only policy (lines 96-99); if an existing event table is close but not identical, write a migration that renames/extends it rather than creating a second table — document the decision
- `console.labyrinthscout.com/src/server.ts` — register the new `audit-search` and `compliance` routers

## Step-by-step
1. Read `events.ts` in full (280 lines). Determine: (a) what table it writes to and its exact schema, (b) whether it already covers all five event categories the spec wants logged (tool calls, model requests, security, admin, auth — `grep -n "tool_execution\|model_request\|event_type" events.ts`), (c) what query/filter capabilities its read-side already has.
2. Read `export.ts` in full (157 lines). Confirm its current CSV generation and filter-parsing code; this is the foundation for `audit-export`/`audit-search` — do not write a second CSV serializer.
3. Read `migrations.ts` and find the current event/log table's `CREATE TABLE` statement. Diff its columns against the spec's `audit_log` (lines 84-94): `id UUID`, `tenant_id`, `timestamp`, `event_type`, `action`, `detail JSONB`, `severity`, `session_id UUID`, `ip_address INET`. Decide: rename+extend the existing table via a migration, or note that the existing table serves a different purpose (e.g. only security events) and a new `audit_log` table is genuinely needed for the broader five-category scope. Document this decision in a comment in the migration file.
4. Add the Postgres RLS append-only policy from spec lines 96-99 (`CREATE POLICY audit_append_only ON audit_log FOR INSERT WITH CHECK (true)` with no UPDATE/DELETE policies) in the migration — this is the "immutability" the spec requires and is almost certainly NOT present in the current schema (events tables are rarely append-only-enforced at the DB level).
5. Create `audit-schemas.ts` with the `AuditEventType` union (`tool_execution | model_request | security | admin | auth`) and the `AuditEvent` interface exactly per spec lines 25-40.
6. Create `audit-logger.ts`: a normalizing writer `logAuditEvent(event: AuditEvent)`. If `events.ts` already has a working writer function, call it (or its shared underlying insert) — do not duplicate the INSERT. Verify the five example payload shapes (spec lines 45-79: `tool_execution`/`model_request`/`security`/`admin`/`auth`) all map cleanly onto the `detail: Record<string, any>` field.
7. Create `audit-search.ts` implementing the documented filters (tenant_id, event_type, severity, from/to date range, free-text `query` against `action`/`detail`, pagination). If `events.ts` already has equivalent filter-parsing, factor the shared logic out rather than reimplementing it twice.
8. Create the `compliance/` subdirectory:
   - `data-access-request.ts`: `POST /api/admin/compliance/sar { tenant_id, email }` queries every table containing tenant data (conversations, audit events, uploaded files, memory — `grep -n "CREATE TABLE" migrations.ts` for the full list) and returns a single machine-readable JSON export; record a `compliance_request` row with a 30-day due date
   - `data-deletion.ts`: `POST /api/admin/compliance/erase { tenant_id }` (a) marks the tenant `erasure_requested`, (b) anonymizes PII fields in conversations/memory/files (replace with `[ERASED]` or hashed placeholders — do not hard-delete rows that other tables foreign-key to), (c) hard-deletes conversations/files/memory content, (d) retains `audit_log` rows but anonymizes their `detail.user_id`/`detail.email`/etc. fields, (e) writes a completion record
   - `retention-policy.ts`: the `RETENTION_POLICIES` constant from spec lines 141-149 verbatim
   - `gdpr-report.ts`: aggregates counts of pending SARs, erasure requests, and retention-policy compliance status for the admin dashboard
9. Create `audit-retention.ts`: a scheduled job (follow whatever cron/interval pattern this codebase already uses for scheduled work — `grep -rn "setInterval\|node-cron\|schedule" console.labyrinthscout.com/src` first) that applies each policy's auto-deletion window, skipping `audit_log`/`security_events`/`billing_records` (7-year retention, essentially permanent for this product's lifetime).
10. Wire the new `audit-search` and `compliance` routers into `server.ts`.

## Expected behavior
- `GET /api/admin/scout/audit/search?tenant_id=tenant-07&event_type=security&severity=critical&from=2026-06-01&to=2026-06-07` returns matching paginated events
- `GET /api/admin/scout/audit/export?from=2026-06-01&to=2026-06-07` downloads a CSV of all events in range (extending the existing exporter, not a new one)
- `POST /api/admin/compliance/sar {"tenant_id":"tenant-07","email":"user@example.com"}` returns a complete JSON export of every record associated with that tenant, and creates a tracked request with a 30-day due date
- `POST /api/admin/compliance/erase {"tenant_id":"tenant-07"}` anonymizes and deletes the tenant's personal data, retains anonymized audit entries, and confirms completion
- Attempting `UPDATE audit_log SET ... ` or `DELETE FROM audit_log` directly against Postgres fails due to the RLS policy (verify this in a test using a raw query, not just through the application layer)

## Test
- `audit-logger.test.ts`: each of the five event-category payload shapes round-trips through `logAuditEvent` and lands correctly in `detail`
- `audit-search.test.ts`: each documented filter narrows results correctly; pagination math is correct
- `audit-retention.test.ts`: each policy's window triggers deletion at the correct age and not before (fake timers / seeded timestamps, not real sleeps)
- `data-access-request.test.ts`: SAR export includes every table containing tenant data (assert against a fixture tenant with rows in each table)
- `data-deletion.test.ts`: erasure anonymizes rather than breaks foreign-key integrity, retains an anonymized audit trail, and is idempotent if run twice
- Run `pnpm test -- audit compliance` and confirm all pass

## Dependencies
- Read `events.ts` and `export.ts` FULLY first — most of the "audit log" infrastructure (recording + CSV export) likely already exists in some form; this prompt's job is to formalize it into the spec's immutable schema and add the genuinely-missing GDPR layer on top
- Spec 03-04-kill-switch.md's `kill-switch-audit.ts` should write into this same `audit_log` table (confirm it does, once both have landed) using `event_type: "admin"`, `action: "kill_switch_triggered"`
- `audit-retention.ts` needs whatever scheduled-job mechanism this codebase already uses; do not introduce a new job-scheduling library if one is already in use
