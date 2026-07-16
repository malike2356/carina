# Deal Engine - Gap closures (2026-05-20 batch)

**Last updated:** 2026-05-14  
**Scope:** Compare view, SDLT sidebar, Carina verdict JSON, PDF + public share, pipeline list + stage automations, offer log, market timing, AirDNA snapshot, central share lookup.

---

## 1. Deal comparison (2 to 5 analyses)

- **Behaviour:** Index checkboxes and sticky bar open `GET /deals/compare?ids[]=...` for side-by-side metrics.
- **Route:** `tenant.deals.compare` -> `DealController@compare`.
- **View:** `resources/views/tenant/deals/compare.blade.php`; index: `tenant/deals/index.blade.php`.
- **Models:** `DealAnalysis` (with `property`), labels from `DealCalculatorRegistry::labels()`.

## 2. SDLT inline on deal show

- **Behaviour:** Collapsible card; `POST /deals/calculate/sdlt` (existing `tenant.deals.calculate`) with JSON body.
- **No new routes.** View: `tenant/deals/show.blade.php`.

## 3. Carina Buy / Hold / Pass verdict

- **Storage:** Tenant column `deal_analyses.carina_verdict` (jsonb).
- **Route:** `POST /deals/{deal}/carina-verdict` -> `tenant.deals.carina-verdict` (middleware: Deal Engine plus **Carina AI** subscription/feature).
- **Service:** `CarinaService::generateDealVerdict()`, `DealAnalysisService::generateAndStoreVerdict()`.
- **View:** Investment verdict block on `tenant/deals/show.blade.php` (when Carina AI is enabled for the tenant).

## 4. Investor deal pack (PDF + public link)

- **Tenant columns:** `deal_analyses.share_token` (uuid, nullable, unique).
- **Central table:** `deal_share_tokens` (`token`, `tenant_id`, `deal_analysis_id`); model `App\Models\Central\DealShareToken` on `central` connection.
- **Tenant routes:** `GET /deals/{deal}/export-pack` (`tenant.deals.export-pack`), `POST` and `DELETE` on `/deals/{deal}/share-token` (generate/revoke).
- **Public route (central app, no auth):** `GET /deals/share/{token}` -> `deals.public-pack` -> `DealController@publicPack` (initializes tenancy from central row, renders HTML).
- **Views:** `tenant/deals/pdf-pack.blade.php` (inline CSS for dompdf), `tenant/deals/public-pack.blade.php` (Tailwind HTML string).

## 5. Pipeline board / list toggle

- **Behaviour:** Alpine `view` (`kanban` or `list`) persisted via `localStorage` key `pipeline-view`; list table iterates stages then deals.
- **View:** `resources/views/tenant/pipeline/show.blade.php` only.

## 6. Pipeline stage automations (on enter)

- **Table:** `pipeline_stage_automations` (tenant): `stage_id`, `trigger` (`on_enter`), `action_type`, `action_config`, `is_active`.
- **Actions:** `create_compliance_item` (requires pipeline card `deal_analysis_id`), `create_project` (requires `property_id`).
- **Service:** `PipelineStageAutomationService::fireOnEnter()` called from `PipelineService::moveDeal()` after the deal is saved to the new stage.
- **Routes:** `POST` and `DELETE` on `/pipelines/{pipeline}/stages/{stage}/automations` and `/pipelines/{pipeline}/stages/{stage}/automations/{automation}` (`tenant.pipelines.stages.automations.*`).
- **Controller:** `PipelineStageAutomationController`.

## 7. Offer tracking

- **Table:** `deal_offers` (tenant): amounts in **pence** (`amount_minor`), types `asking_price`, `offer_made`, `counter_offer`, `accepted`, `rejected`.
- **Routes:** `POST /deals/{deal}/offers`, `DELETE /deals/{deal}/offers/{offer}` (`tenant.deals.offers.*`).
- **Model:** `DealOffer`; `DealAnalysis::offers()`.
- **View:** Timeline and form on `tenant/deals/show.blade.php`.

## 8. Time on market + price reductions

- **Columns:** `deal_analyses.listed_at` (date), `price_reductions` (jsonb array of `{date, from, to, note?}`).
- **Accessor:** `days_on_market` (null if no `listed_at`).
- **Routes:** `POST /deals/{deal}/price-reduction` (`tenant.deals.price-reduction.store`); edit form field `listed_at` validated in `StoreDealAnalysisRequest` (inherits to `UpdateDealAnalysisRequest`).
- **Service:** `DealAnalysisService` `create` / `update` pass through validated attributes including `listed_at` when present on the model.

## 9. AirDNA short-let snapshot (SA / HMO)

- **Columns:** `airdna_snapshot` (jsonb), `airdna_snapshot_at`.
- **Route:** `GET /deals/{deal}/airdna-data` (`tenant.deals.airdna-data`), strategy must be `sa` or `hmo`; throttled.
- **Service:** `App\Services\Deals\AirDnaService` reads **`PlatformSetting::get('airdna_api_key')`** (also in central admin integrations / settings UI).
- **View:** Conditional card on deal show for `sa` / `hmo`.

---

## Configuration

| Key | Where | Purpose |
|-----|--------|---------|
| `airdna_api_key` | `PlatformSetting` (central) | Bearer token for `https://api.airdna.co/api/v1` market search |

---

## Tests (one file per area)

All under `tests/Feature/Deals/` except pipeline list/automation:

| File | Focus |
|------|--------|
| `DealCompareTest.php` | Compare query validation and titles |
| `DealSdltInlineTest.php` | SDLT calculate endpoint JSON |
| `DealCarinaVerdictTest.php` | Verdict POST and persisted json |
| `DealPackExportTest.php` | PDF response, share token row, public pack |
| `DealOfferTest.php` | Offer CRUD |
| `DealMarketTimingTest.php` | Price reduction append and validation |
| `DealAirDnaTest.php` | AirDNA route with mocked service |
| `tests/Feature/Pipeline/PipelineListViewTest.php` | Show page contains board/list Alpine |
| `tests/Feature/Pipeline/PipelineStageAutomationTest.php` | Automation and `fireOnEnter` creating `ComplianceItem` |

Use the same `FeatureFlagSeeder` plus `deal_engine`, `pipeline`, and `carina_ai` toggles and absolute tenant URLs as in `DealCarinaIntegrationTest.php`.

---

## OS audit follow-up (Gaps 1, 3, 13) - 2026-05-14

These items sit outside the Deal Engine calculator surface but were tracked in the same OS audit batch.

### Gap 1 - Onboarding wizard depth (closed)

- **State:** `WorkspaceOnboardingService::defaultState()` strategy keys include `experience_level`, `capital_range`, `secondary[]`. Static helpers `experienceLevelLabels()`, `capitalRangeLabels()`, `strategySlugDescriptions()`.
- **Persistence:** On `complete()` and `exitToWorkspace()`, after `workspace_primary_strategy`, non-empty values write `workspace_experience_level` and `workspace_capital_range` in `tenant_settings`.
- **UI:** `resources/views/tenant/onboarding/show.blade.php` step 2 cards with descriptions, optional secondary checkboxes, experience radios, capital select. Review step lists secondary, experience, capital.
- **Dashboard:** `getting_started.blade.php` reads `workspace_primary_strategy` / `workspace_experience_level`; third checklist item switches between deal analysis, sourcing criteria, or HMO compliance; experienced users skip the SMTP item. `strategy_focus.blade.php` shows strategy-specific quick links when launch is finished.

### Gap 3 - Document Vault polish (closed)

- **Routes:** `tenant.documents.edit`, `tenant.documents.update` (`GET`/`PUT` `/documents/{document}` with edit registered before show).
- **Controller:** `DocumentVaultController@edit`, `@update` (title, category, notes).
- **Deal page:** `DealController@show` passes `dealDocuments`; gated `DocumentVault` module; list + upload link on `tenant/deals/show.blade.php`.

### Gap 13 - Tenancy management depth (closed)

- **Migrations:** `2026_05_20_160000_enrich_property_tenancies` (tenancy_type, rent_due_day, rent_frequency, notice_*), `2026_05_20_170000_create_tenancy_rent_payments`.
- **Models:** `PropertyTenancy` (`$connection = tenant`, helpers `isActive`, `hasActiveNotice`, `daysUntilNoticeExpires`, `rentDueThisMonth`, `tenancyTypeLabel`), `TenancyRentPayment`.
- **HTTP:** `PropertyTenancyController@storePayment`, `@markPaymentPaid`; routes `tenant.properties.tenancies.payments.store`, `tenant.properties.tenancies.payments.mark-paid`.
- **UI:** Property show tenancies card expanded with badges and collapsible rent payment log.

### Still open (same audit / adjacent)

- **Gap 7:** Compliance contextual to deals was already wired (`deal_analysis_id`, forms) - no change this batch.
- **Document Vault:** Full versioning, bulk ops, and deeper compliance vault integration remain backlog (see **`40-tenant-compliance-vault-documents-ui.md`**).
- **Tenancy:** No automated rent schedule generation or bank feed reconciliation in this slice.

---

## Migrations checklist

| Migration | Connection |
|-----------|------------|
| `2026_05_20_105000_create_deal_share_tokens_table` | central |
| `2026_05_20_100000_add_carina_verdict_to_deal_analyses` | tenant |
| `2026_05_20_110000_add_share_token_to_deal_analyses` | tenant |
| `2026_05_20_120000_create_pipeline_stage_automations_table` | tenant |
| `2026_05_20_130000_create_deal_offers_table` | tenant |
| `2026_05_20_140000_add_market_timing_to_deal_analyses` | tenant |
| `2026_05_20_160000_enrich_property_tenancies` | tenant |
| `2026_05_20_170000_create_tenancy_rent_payments` | tenant |

Run central and tenant migrations in CI/local before the feature tests.
