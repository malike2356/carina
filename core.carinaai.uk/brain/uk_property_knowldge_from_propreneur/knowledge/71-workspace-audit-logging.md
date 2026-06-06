# Workspace audit logging (tenant)

**Scope:** Immutable tenant audit trail for workspace admins - not the central “remote access” audit hub (see `15-platform-admin.md` for platform-side audit exports).

## Behaviour

- **Tables:** `audit_logs`, `audit_log_hashes` (tenant migrations under `database/migrations/tenant/`).
- **Models:** `App\Models\Tenant\AuditLog`, `AuditLogHash`; models use `App\Models\Tenant\Concerns\Auditable` for create/update/delete events.
- **Services:** `App\Services\Audit\AuditService`, `AuditHashService`, `AuditRetentionService`.
- **UI:** Tenant route `tenant.admin.audit.logs.index` (`/admin/audit/logs`) behind feature flag `workspace_audit_logging` (see `PlatformFeatureCatalogue` and settings hub).
- **Artisan:** `audit:cleanup`, `audit:archive`, `audit:verify-chain`.
- **Tests:** `tests/Feature/Audit/AuditLoggingTest.php` and unit tests under `tests/Unit/Services/Audit/`.

## Optional extensions

- Central remote-access audit HTTP Feature tests (separate from tenant workspace audit).
- Broader `Auditable` coverage on additional tenant models.
- Spec: `brain/prompts/22-audit-logging.md` (REFERENCE / full prompt scope).
