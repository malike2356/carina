# GDPR and data subject rights (tenant workspace)

**Scope:** Per-tenant GDPR tooling for workspace users and admins. This is separate from **platform remote access** GDPR acknowledgements when staff open a tenant session (see `15-platform-admin.md` and central remote-access views).

**Last updated:** 2026-05-15

## What exists in the product

### Data subject requests
- **Tables (tenant):** `data_subject_requests` (type `export` | `deletion`, status workflow, JSON `data`, optional `tenant_id`, `expires_at`).
- **Model:** `App\Models\Tenant\Gdpr\DataSubjectRequest`.
- **Export:** `App\Services\Gdpr\DataExportService` packages profile + linked CRM contacts (assigned or created by user), builds a ZIP (`data.json` + archive), stores a hashed download token and encrypted token payload in `data`, sets status `completed`. Public download: `GET /api/gdpr/export/{token}/download` (no login; throttle). Authenticated status: `GET /api/gdpr/export`, queue: `POST /api/gdpr/export`.
- **Deletion:** User requests `POST /api/gdpr/deletion` (receives a one-time `confirm_token` in the JSON response). Confirmation: `POST /api/gdpr/deletion/confirm` with password + token sets `user_confirmed_at` in `data` and leaves status `pending` until the cooling-off window passes. **`GDPR_DELETION_COOLING_OFF_HOURS`** (default 24; `0` in `phpunit.xml` for tests) controls when `php artisan gdpr:process-requests` may move the request to `processing` and dispatch `ProcessDataDeletionJob`. Workspace admins may **approve** a pending deletion immediately: `POST /admin/gdpr/requests/{id}/approve` (role `tenant_admin`), which sets `processing` and dispatches the job without waiting for cooling-off.
- **Anonymization:** `App\Services\Gdpr\DataAnonymizationService` - revokes Sanctum tokens, clears PII fields, assigns placeholder email, deactivates user, clears CRM `assigned_to`, removes consent and policy acceptance rows for that user, marks the deletion request `completed`.

### Consent and policies
- **Tables:** `consent_logs` (purpose, accepted, IP, user agent, `created_at` only), `privacy_policies` (`document_type` `privacy` | `dpa`, version, content, `is_current`, `effective_date`), `policy_acceptances`.
- **Service:** `App\Services\Gdpr\ConsentService` - purposes fixed to `marketing`, `cookies`, `analytics`; short-lived cache key `gdpr:consents:v1:{userId}`.
- **Routes:** `GET|POST|DELETE /api/gdpr/consents` and `/api/gdpr/consents/{purpose}`; `GET /privacy-policy` and `GET /privacy-policy/history` (public); `POST /privacy-policy/accept` (auth); `GET /api/gdpr/policies` (auth, JSON index).

### Retention and breach logging
- **Table:** `data_retention_policies` (`model_type`, `retention_days`, `action` `delete` | `anonymize` | `archive`). Enforcement is **whitelist-only** in `App\Services\Gdpr\RetentionEnforcementService` (currently `App\Models\Tenant\Contact` on `created_at`). `archive` writes JSON snapshots under `storage` disk path `gdpr-retention-archives/` before hard delete when applicable.
- **Commands:** `gdpr:apply-retention` (queues `ApplyRetentionPolicyJob` per policy), `gdpr:anonymize-expired`, `gdpr:cleanup-exports`, `gdpr:process-requests` (pending exports + cooling-off deletions).
- **Breach:** `data_breach_incidents` + `App\Services\Gdpr\DataBreachNotificationService` (in-app record + structured log channel from `config/gdpr.php`).

### Configuration
- **`config/gdpr.php`:** `export_disk`, `retention_archive_disk`, `breach_log_channel`, `deletion_cooling_off_hours` (env `GDPR_DELETION_COOLING_OFF_HOURS`).

### Events (for listeners / queues)
- `App\Events\Gdpr\DataExportRequested`, `DataDeletionRequested`, `ConsentWithdrawn`.

### Tests
- `tests/Feature/Gdpr/GdprModuleTest.php` - export completion, consent toggle, admin-approved member deletion, retention anonymize on stale contacts.

## Carina guidance

- Do **not** advise bypassing export, deletion, consent, or retention controls. Point users to **Settings / privacy** flows: `/privacy-policy`, tenant `api/gdpr/*`, or workspace admin `admin/gdpr/requests` as appropriate.
- **Lead funnel CRM erasure** (Meta and other ad identifiers) remains in `App\Services\LeadFunnel\LeadFunnelGdprService` and CRM delete hooks; that is complementary to this module, not replaced by it.

## Operator note

After editing this file or any `brain/knowledge/*.md`, refresh embeddings: `php artisan rag:ingest-brain-knowledge --sync` (see `brain/knowledge/00-README.md`).

**Spec reference:** `brain/prompts/30-gdpr-compliance.md`.
