# Investors hub (tenant web) and investor portal API

**Last updated:** 2026-05-14 (added KYC workspace routes, proof of funding, VIP subscription tracking, cross-links)

## Investors hub (workspace staff)

**Purpose:** CRM-scoped Blade surfaces for investor pipeline, funnel, workspace report, power team, and per-contact KYC helpers.

**Gates:** `subscription.feature:crm` and `feature:crm` (same as contacts), under URL prefix **`/investors`** (`routes/tenant.php` requires `routes/tenant_investors.php`).

### Routes (`routes/tenant_investors.php`)

| Method | Path | Name | Controller |
| --- | --- | --- | --- |
| GET | `/investors` | `tenant.investors.overview` | `Investors\OverviewController` |
| GET | `/investors/pipeline` | `tenant.investors.pipeline` | `Investors\PipelineBoardController@index` |
| POST | `/investors/pipeline/{contactId}` | `tenant.investors.pipeline.update` | `PipelineBoardController@update` |
| GET | `/investors/funnel` | `tenant.investors.funnel` | `FunnelController@index` |
| POST | `/investors/funnel/{contactId}` | `tenant.investors.funnel.update` | `FunnelController@update` |
| GET | `/investors/report` | `tenant.investors.report` | `WorkspaceReportController` |
| GET | `/investors/power-team` | `tenant.investors.power-team` | `PowerTeamController@dashboard` |
| GET | `/investors/power-team/directory` | `tenant.investors.power-team.directory` | `PowerTeamController@directory` |
| GET | `/investors/contacts/{contact}/kyc` | `tenant.investors.kyc.show` | `KycController@show` |
| PUT | `/investors/contacts/{contact}/kyc` | `tenant.investors.kyc.update` | `KycController@updateKyc` |
| POST | `/investors/contacts/{contact}/kyc/pof` | `tenant.investors.kyc.pof.store` | `KycController@storePof` |
| POST | `/investors/contacts/{contact}/kyc/pof/{pof}/status` | `tenant.investors.kyc.pof.status` | `KycController@updatePofStatus` |

### Carina

- `GET /carina/open-investors-hub/{surface?}` (`tenant.carina.fromInvestorsHub`) seeds a conversation with `context_type` `investors_hub`.

### Related knowledge

- `05-crm.md`, `32-contact-intelligence-and-lead-scoring.md`, `22-tenant-route-map.md`.

---

## Investor portal API (external investor auth)

**Purpose:** Sanctum-backed JSON auth for **`InvestorPortalUser`** (tenant DB), separate from workspace `User` web guard.

**Routes:** `routes/tenant.php` defines **`/api/investor-portal`** (no `IdentifyTenantMiddleware` on the snippet around guest auth; tenant is still resolved by host).

| Method | Path | Name |
| --- | --- | --- |
| POST | `/api/investor-portal/register` | `tenant.api.investor-portal.register` |
| POST | `/api/investor-portal/login` | `tenant.api.investor-portal.login` |
| GET | `/api/investor-portal/me` | `tenant.api.investor-portal.me` (requires `auth:sanctum`) |

**Controller:** `App\Http\Controllers\Api\InvestorPortal\InvestorPortalAuthController`.

**Service:** `App\Services\Investors\InvestorPortalAuthService` (register and login return Bearer token and serialized user with linked `contact`).

### Related prompts

- `brain/prompts/38-investor-portal.md` (product spec; align implementation notes with this file when the portal grows beyond auth).
