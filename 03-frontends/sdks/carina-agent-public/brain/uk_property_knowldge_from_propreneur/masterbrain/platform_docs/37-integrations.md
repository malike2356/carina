# Third-party integrations (tenant)

**Last updated:** 2026-05-14 (TrueLayer Open Banking OAuth, IntegrationUiCatalog provider list, email transport, webhook event catalogue)

## Purpose

Workspace-level connections to external APIs (PropertyData, Zoom, Google Calendar, Xero, QuickBooks, TrueLayer, SMS, email transport) and outbound webhooks. Credentials live in the tenant database only.

## Feature flag and billing

- Feature flag key: `integrations` (see `App\Support\PlatformFeatureCatalogue`).
- Subscription module: `BillingModule::Integrations` (`integrations`) in `config/billing.php` module sets.
- Routes use `subscription.feature:integrations` and `feature:integrations`.

## Tenant UI

- **Settings → Integrations** (workspace admins): `GET /settings/integrations` (`tenant.settings.integrations.index`), Blade `resources/views/tenant/settings/integrations.blade.php`.
- **In-browser configuration:** Alpine-driven forms per provider (save, test, sync where supported, disconnect). Outbound webhook CRUD modal (name, URL, optional signing secret, event checkboxes or all-events). Data is loaded from `App\Support\Integrations\IntegrationUiCatalog` and persisted via the JSON API below (same-origin `fetch` with CSRF).
- **TrueLayer Connect:** `GET /settings/integrations/truelayer/authorize` (`tenant.settings.integrations.truelayer.authorize`) starts OAuth; `GET /settings/integrations/truelayer/callback` (`tenant.settings.integrations.truelayer.callback`) exchanges `code` for tokens via `TrueLayerService::exchangeAuthorizationCode` and merges into `integrations_config`. Register the callback URL (scheme + host + path) in TrueLayer Console.
- **Catalogued webhook events:** `config/integrations.php` key `webhook_events` (keep aligned with `WebhookDispatchService::dispatchEvent` callers).

## JSON API (workspace admin)

All under the tenant host with prefix `/api`, middleware `tenant.workspace_admin` plus subscription and feature gates (see `routes/tenant.php`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/integrations` | List integration configs (credentials masked) |
| POST | `/api/integrations` | Connect (body: `provider`, `credentials`, optional `settings`) |
| POST | `/api/integrations/{provider}/connect` | Same as connect with provider in path |
| PUT | `/api/integrations/{provider}` | Merge credentials / settings |
| DELETE | `/api/integrations/{provider}` | Remove config |
| POST | `/api/integrations/{provider}/sync` | Sync (`?queue=1` default queues `SyncIntegrationDataJob`) |
| POST | `/api/integrations/{provider}/test` | Smoke test (throttled) |
| CRUD | `/api/webhook/endpoints` | Manage outbound webhook URLs |
| GET | `/api/webhook/deliveries`, `/api/webhook/deliveries/recent` | Delivery history |
| POST | `/api/webhook/deliveries/{id}/retry` | Re-queue delivery |

**Controller note:** On wildcard subdomain routes, the domain parameter `{tenant_subdomain}` is injected before path parameters. `IntegrationController` resolves `{provider}` via `$request->route('provider')` so it is not confused with the subdomain slug.

## Database (tenant migrations)

- `integrations_config` - `provider`, encrypted credentials, JSON `settings`, `is_active`, `last_synced_at`, `tenant_id` (central tenant UUID).
- `webhook_endpoints`, `webhook_deliveries`, `integration_logs`.

## Services and jobs

- `App\Services\Integrations\*` - PropertyData (wraps deals client + audit log), Zoom, Google Calendar, Xero, QuickBooks, TrueLayer, SMS, templated email, webhook dispatch, sync coordinator.
- Jobs: `SyncIntegrationDataJob`, `DispatchWebhookJob`, `RetryFailedWebhookJob` (central tenant loaded with `Tenant::on('central')->find()` before `tenancy()->initialize()`).

## Artisan

- `integration:sync {provider} {--tenant=} {--queue}`
- `integration:test {provider} --tenant=`
- `webhook:retry-failed {--tenant=} {--limit=100} {--queue}`

## Tests

- Feature: `tests/Feature/Integrations/IntegrationsApiTest.php`, `tests/Feature/Integrations/TrueLayerOAuthCallbackTest.php`
- Unit: `tests/Unit/Integrations/*`, extended `tests/Unit/Deals/PropertyDataServiceTest.php` for PropertyData.co.uk endpoints.
