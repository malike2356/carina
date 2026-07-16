# Artisan command and scheduler catalog

**Last updated:** 2026-05-14 (added: `lead-funnel:*`, `vcal:send-booking-reminders`, `mentorship:generate-invoices`, `compliance:expiry-digest`, `communications:sequence-triggers`, `workspace:automation-seed-builtin`, `backup:*`, `scout:*`, `remote-access:cleanup-expired`, `rag:*`, `reports:*`, `analytics:*`, `billing:*`, `investors:score`, `sourcing:process-alerts`, `theme:reset-minimal`)  
**Purpose:** Every shipped Artisan command, `routes/console.php` schedule map, and the `PlatformScheduleCatalog` (DB-driven scheduler). Commands registered via `Artisan::command` closures are **not** listed; grep `routes/console.php`.

**Related:** `62-jobs-and-events-catalog.md`, `59-carina-propreneur-full-codex.md`, `36-backup-disaster-recovery.md`, `57-v1-migration-and-platform-migration-console.md`, `08-carina.md`, `108-lead-funnel-module.md`

---

## Command groups

### `analytics:`

| Signature | Description |
| --- | --- |
| `analytics:process-events` | Roll up queued analytics events |

### `backup:`

| Signature | Description |
| --- | --- |
| `backup:cleanup` | Clean expired backup artefacts |
| `backup:list` | List backup jobs |
| `backup:restore {backupJob} {--target-tenant=}` | Restore one backup to a tenant |
| `backup:run {--tenant=}` | Run backup now |
| `backup:schedule` | Dispatch due backup schedules (runs every minute) |
| `backup:verify {backupJob}` | Verify one backup integrity |

### `billing:`

| Signature | Description |
| --- | --- |
| `billing:check-trials` | Trial expiry checks |
| `billing:send-invoice-reminders` | Send unpaid invoice reminders |
| `billing:sync-subscriptions` | Reconcile Stripe subscription state |

### `carina:`

| Signature | Description |
| --- | --- |
| `carina:verify {--tenant=} {--ping}` | Verify Carina chat and RAG for a tenant |

### `compliance:`

| Signature | Description |
| --- | --- |
| `compliance:expiry-digest` | Daily digest of expired/expiring compliance items |

### `communications:`

| Signature | Description |
| --- | --- |
| `communications:sequence-triggers` | Enrol contacts into sequences by trigger key |

### `deals:`

| Signature | Description |
| --- | --- |
| `deals:poll-listing-sources` | Poll BYO listing sources (RSS, webhook, email) |

### `integrations:`

| Signature | Description |
| --- | --- |
| `integrations:sync {provider?} {--tenant=}` | Trigger integration sync |
| `integrations:test {provider} {--tenant=}` | Test integration connectivity |
| `integrations:webhook-retry-failed` | Retry failed webhooks |

### `investors:`

| Signature | Description |
| --- | --- |
| `investors:score {--all}` | Score investors across workspaces |

### `lead-funnel:` (marketing intake)

| Signature | Description |
| --- | --- |
| - (all lead funnel jobs are job-class-based in `PlatformScheduleCatalog`; no dedicated Artisan command) |

### `mentorship:`

| Signature | Description |
| --- | --- |
| `mentorship:generate-invoices` | Generate recurring mentorship invoices |

### `migrate:v1`

| Signature | Description |
| --- | --- |
| `migrate:v1:all` | Full v1 → v2 migration |
| `migrate:v1:contacts` | Migrate contacts only |
| `migrate:v1:deals` | Migrate deals only |
| `migrate:v1:properties` | Migrate properties only |
| `migrate:v1:rollback {migrationLog}` | Roll back one migration |
| `migrate:v1:users` | Migrate users only |
| `migrate:v1:validate` | Validate v1 data before migration |

### `prune:`

| Signature | Description |
| --- | --- |
| `prune:non-demo-tenants` | Prune non-demo tenant databases |

### `rag:`

| Signature | Description |
| --- | --- |
| `rag:create-starter-document` | Create starter RAG document |
| `rag:ensure-embedding-schema {--tenant=} {--index-pending}` | Ensure pgvector schema in one tenant DB |
| `rag:index-pending {--tenant=}` | Re-queue unindexed RAG documents |
| `rag:ingest-brain-knowledge {--tenant=} {--fresh} {--sync}` | Ingest `brain/knowledge/*.md` into RAG documents |
| `rag:reindex {document} {--tenant=}` | Rebuild one RAG document chunks |
| `rag:sync-sources {--tenant=} {--sync}` | Sync RAG source configurations |

### `remote-access:`

| Signature | Description |
| --- | --- |
| `remote-access:cleanup-expired` | Expire ended remote access sessions |

### `reports:`

| Signature | Description |
| --- | --- |
| `reports:cleanup-old-executions` | Prune old report execution artefacts |
| `reports:generate-scheduled` | Dispatch due scheduled report definitions |
| `reports:generate-single {definition} {--tenant=}` | Generate one report immediately |
| `reports:send-digest` | Weekly digest email |

### `scout:`

| Signature | Description |
| --- | --- |
| `scout:patch-scan` | Composer/npm patch posture scan |
| `scout:sast-scan` | Static analysis security scan |
| `scout:sync-permissions` | Sync SCOUT permissions |

### `sourcing:`

| Signature | Description |
| --- | --- |
| `sourcing:process-alerts {--tenant=}` | Deal alert dispatch for one or all tenants |

### `tenants:`

| Signature | Description |
| --- | --- |
| `tenants:ensure-primary-domains {--dry-run} {--diagnose} {--fix-mismatch}` | Align `domains` rows to tenant slugs |
| `tenants:repair-database {tenant}` | Repair tenant database |

### `theme:`

| Signature | Description |
| --- | --- |
| `theme:reset-minimal {--force}` | Reset theme to minimal preset |

### `vcal:`

| Signature | Description |
| --- | --- |
| `vcal:send-booking-reminders` | Send 24h/1h booking reminder emails |

### `workspace:`

| Signature | Description |
| --- | --- |
| `workspace:automation-evaluate-stale-deals` | Stale pipeline cards automation |
| `workspace:automation-seed-builtin` | Seed built-in automation + comms builtins |

### Other

| Signature | Description |
| --- | --- |
| `reseed:dev-accounts` | Re-seed dev accounts |
| `reset:all-user-passwords` | Reset all user passwords |
| `run:tenant-seeder {tenant}` | Run tenant seeder |
| `db:seed --class=TenantBootstrapSeeder` | (contextual; not a custom command) |

---

## Platform schedule catalog (`PlatformScheduleCatalog`)

Scheduled tasks managed via central admin (`/admin/job-schedules`). Each has a DB row referencing a slug; the handler class is never taken from user input. Default crons listed below.

| Slug | Cron | Theme | What |
|------|------|-------|------|
| `carina-prune-conversations` | `0 2 * * *` | Carina | Prune old conversations |
| `deals-sourcing-alerts` | `30 3 * * *` | Deals | Match sourcing criteria |
| `deals-listing-automation` | `0 7,19 * * *` | Deals | Run listing watch automation |
| `deals-poll-listing-sources` | `*/15 * * * *` | Deals | Poll BYO listing source feeds |
| `deals-poll-licensed-feeds` | `*/15 * * * *` | Deals | Batch licensed feed ingestion |
| `investors-score-all` | `12 2 * * *` | CRM | Score all investors |
| `reports-generate-scheduled` | `15 4 * * *` | Reporting | Generate due reports |
| `reports-send-digest` | `30 7 * * 1` | Reporting | Weekly report digest |
| `reports-cleanup-executions` | `0 1 * * 0` | Reporting | Prune old execution artefacts |
| `analytics-process-events` | `45 2 * * *` | Analytics | Roll up queued events |
| `workspace-automation-stale-deals` | `20 5 * * *` | Automation | Evaluate stale deals |
| `billing-sync-subscriptions` | `15 4 * * 1` | Billing | Reconcile Stripe state |
| `billing-send-invoice-reminders` | `30 8 * * *` | Billing | Unpaid invoice reminders |
| `billing-check-trials` | `0 7 * * *` | Billing | Trial expiry checks |
| `billing-retry-failed-payments` | `15 6 * * *` | Billing | Retry failed Stripe charges |
| `backup-schedule-dispatch` | `* * * * *` | Backup | Dispatch due backup schedules |
| `backup-cleanup-expired` | `40 3 * * 0` | Backup | Clean expired backup artefacts |
| `scout-patch-scan` | `0 3 * * *` | Security | Composer/npm patch scan |
| `scout-sast-scan` | `0 4 * * *` | Security | Static analysis scan |
| `remote-access-cleanup` | `*/15 * * * *` | Security | Expire ended sessions |
| `compliance-expiry-digest` | `30 7 * * *` | Compliance | Daily expiry digest |
| `communications-sequence-triggers` | `25 * * * *` | Comms | Enrol contacts in sequences |
| `vcal-send-booking-reminders` | `*/15 * * * *` | viCal | Guest booking reminders |
| `mentorship-generate-invoices` | `0 6 * * *` | Mentoring | Recurring invoice generation |
| `lead-funnel-pull-linkedin` | `*/15 * * * *` | Lead Funnel | Poll LinkedIn lead gen |
| `lead-funnel-pull-tiktok` | `*/15 * * * *` | Lead Funnel | Poll TikTok lead gen |
| `lead-funnel-sync-campaign-performance` | `0 6 * * *` | Lead Funnel | Refresh campaign metrics |
| `lead-funnel-check-lead-activity` | `0 8 * * *` | Lead Funnel | Inactivity automation pass |
