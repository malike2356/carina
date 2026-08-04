# v1 data migration (CLI and platform admin)

**Last updated:** 2026-05-03

**Purpose:** Operators moving data from legacy Propreneur v1 into a v2 tenant can use Artisan commands plus an optional platform UI. This is not general-purpose ETL; it is wired to `App\Services\Migration\MigrationOrchestratorService` and central `Tenant` targeting.

## Feature gates (platform)

- Feature flag: `v1_data_migration_tools`.
- Permission: `manage-v1-data-migration` (see `config/platform_permissions.php`).

## Platform admin HTTP (central)

Under `routes/web.php`, group `Route::prefix('admin')->name('admin.')`:

- URL prefix: **`/admin/migration`**.
- Route names: **`admin.migration.*`** (for example `admin.migration.status`, `admin.migration.start`).
- Middleware: `feature:v1_data_migration_tools`, `platform.grant:manage-v1-data-migration`.
- Endpoints: `MigrationController` (`status`, `start`, `validate/{module}`, `progress`, `rollback`) and `MigrationExportController` (`export`, `download`, `schema`) for module keys validated as `[a-z]+`.

Controllers live in `App\Http\Controllers\Central\Admin\MigrationController.php` and `MigrationExportController.php`.

## Artisan commands (central coordinates tenant)

All take a **central tenant UUID** (and optional `--dry-run` where supported):

| Signature | Description |
| --- | --- |
| `migrate:v1-all {tenant} {--dry-run}` | Ordered users, properties, deals, contacts |
| `migrate:v1-users {tenant}` | Users slice |
| `migrate:v1-properties {tenant}` | Properties slice |
| `migrate:v1-deals {tenant}` | Deals slice |
| `migrate:v1-contacts {tenant}` | Contacts slice |
| `migrate:v1-validate {tenant} {module=all}` | `module` = `users`, `properties`, `deals`, `contacts`, or `all`; prints v2 integrity JSON and optional v1 schema column count |
| `migrate:v1-rollback {batch} --tenant=` | Deletes v2 rows created in the given migration batch UUID for that central tenant |

Files: `app/Console/Commands/MigrateV1*.php`.

## Related knowledge

- `99-tech-stack-comparison.md` (migration effort narrative).
- `15-platform-admin.md` (permissions and admin areas).
