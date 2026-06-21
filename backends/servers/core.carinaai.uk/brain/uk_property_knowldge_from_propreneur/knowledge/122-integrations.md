# Accounting Integrations - Xero, FreeAgent, Sage, Zoho, QuickBooks

**Last updated:** 2026-05-20
**Routes:** `/settings/integrations` in tenant routes

## Overview

Connect Propreneur to external accounting systems. Supported providers: **Xero**, **FreeAgent**, **Sage**, **Zoho** (full OAuth2 + API). **QuickBooks** is a clear stub with a "coming soon" message. Ad platform integrations (Facebook, LinkedIn, TikTok) and webhook management are also in the integration hub.

## Architecture

Each provider follows the same three-class pattern:

| Class | Role |
|-------|------|
| `*OAuth2` | OAuth2 flow - authorization URL, token exchange, refresh |
| `*ApiService` | Low-level HTTP calls - push journals, pull invoices, test connection |
| `*Provider` | Implements `AccountingIntegrationProvider` - wires OAuth + API, logs operations |

Base class: `App\Services\Accounting\BaseAccountingIntegrationProvider`.

Provider registry: `App\Services\Accounting\AccountingIntegrationRegistry` resolves provider by slug.

## OAuth2 flow

```
GET  /settings/integrations/{provider}/connect      → redirects to provider OAuth screen
GET  /settings/integrations/{provider}/callback     → exchanges code, stores tokens in IntegrationConfig
POST /settings/integrations/{provider}/disconnect   → revokes and deletes config
POST /settings/integrations/{provider}/test         → tests current connection
```

Tokens are stored in `integration_configs` (tenant DB): `access_token`, `refresh_token`, `expires_at`. Auto-refresh runs before every API call.

## Xero (`App\Services\Accounting\Xero\`)

- OAuth2: `XeroOAuth2` → `https://login.xero.com/identity/connect/authorize`
- API: `XeroApiService` - push journal entries, pull invoices, list tenants
- `XeroProvider::pushJournals(?array $entryIds)` - pushes unsynced `journal_entries` to Xero manual journals
- `XeroProvider::pullInvoices()` - imports Xero invoices as `accounting_invoices` records
- Required env: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`
- Tests: `tests/Feature/Accounting/XeroOAuthTest.php`

## FreeAgent (`App\Services\Accounting\FreeAgent\`)

- OAuth2: `FreeAgentOAuth2` → `https://api.freeagent.com/v2/approve_app`
- API: `FreeAgentApiService` - push journal entries as FreeAgent bank transactions, pull invoices
- `FreeAgentProvider::pushJournals()` and `pullInvoices()` match Xero pattern
- Required env: `FREEAGENT_CLIENT_ID`, `FREEAGENT_CLIENT_SECRET`, `FREEAGENT_REDIRECT_URI`
- Tests: `tests/Feature/Accounting/FreeAgentOAuthTest.php`

## Sage (`App\Services\Accounting\Sage\`)

- OAuth2: `SageOAuth2` → `https://www.sageone.com/oauth2/auth/central`
- API: `SageApiService` - push journal entries, pull invoices from Sage Business Cloud
- `SageProvider::pushJournals()` and `pullInvoices()` match Xero/FreeAgent pattern
- Required env: `SAGE_CLIENT_ID`, `SAGE_CLIENT_SECRET`, `SAGE_REDIRECT_URI`

## Zoho

Follows same pattern, was built in an earlier phase. Documented in the integrations hub. Required env: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI`.

## QuickBooks

Stub only - UI shows "QuickBooks integration coming soon." No OAuth or API implementation exists yet.

## Common operations

### Push journals

All providers expose `pushJournals(?array $entryIds = null)`:
- Queries `journal_entries` with `xero_synced_at IS NULL` (or provider equivalent)
- Pushes each entry; marks synced on success
- Returns `['pushed' => n, 'failed' => n, 'message' => '...']`
- Logs operation to `integration_activity_logs`

### Pull invoices

`pullInvoices()` fetches invoices from the provider and upserts into `accounting_invoices` by provider invoice ID.

### Connection status

`getConnectionStatus(IntegrationConfig $config)` returns `['connected' => bool, 'tenant_name' => string, 'expires_at' => ?Carbon]`.

## Ad platform integrations

Facebook/Meta, Instagram, LinkedIn, TikTok - OAuth connections for lead ingestion via lead gen forms. Managed in the same integration hub UI. Separate from accounting providers.

## Webhook management

Configure inbound webhook endpoints with event subscriptions and HMAC verification secrets. View webhook receipts and errors in the integration activity log.

## Integration activity log

All push/pull operations, auth events, webhook receipts, and errors are logged to `integration_activity_logs`. Accessible at `/settings/integrations/activity`.
