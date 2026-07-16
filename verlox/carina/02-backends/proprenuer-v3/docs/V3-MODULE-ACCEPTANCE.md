# Propreneur v3 Module Acceptance Matrix

**Purpose:** Sign-off checklist for full v3: same product as Propreneur v2 Business Edition, agent runtime on **carina-core**, governed by **Scout**, Laravel owns the property OS.

**Updated:** 2026-07-04  
**Baseline codebase:** `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/`  
**Target codebase:** `/opt/lampp/htdocs/verlox/propreneur/propreneur-v3/` (fork)  
**Build prompts:** `carina/02-backends/proprenuer-v3/prompts/28-module-acceptance-matrix.md`

---

## How to use this document

1. Run acceptance on **staging** with pilot tenant (`xelox` recommended).
2. Set `CARINA_AGENT_RUNTIME=kernel` and Scout enabled (BE).
3. For each row: run automated test if listed; mark manual UI smoke PASS/FAIL.
4. Module is **ACCEPTED** only when all critical journeys PASS on kernel path **and** PHP fallback smoke still passes (OS unchanged).
5. Full v3 ship requires this matrix **plus** prompt 30 ship gate.

**Status key:** `NOT RUN` | `PASS` | `FAIL` | `N/A`

---

## Out of scope (not shipped in v2)

| Module | v2 status | v3 note |
|--------|-----------|---------|
| Project Management | Not started (`72-project-management-module.md` spec only) | Do not block v3 ship |
| HR and Payroll | Not started | BE edition placeholder only |

---

## Cross-cutting acceptance (all modules)

### Edition and billing

| Check | v2 reference | Kernel test | Status |
|-------|--------------|-------------|--------|
| Deployment edition | `config/edition.php` `PROPRENEUR_EDITION=business` | v3 remains BE product | NOT RUN |
| Plan module sets | `config/billing.php` module_sets | Feature gates unchanged | NOT RUN |
| Carina AI always on | `BillingModule::CarinaAi` alwaysOn | Chat available; agent tools gated | NOT RUN |
| Carina Agent tools | `BillingModule::CarinaAgent` on operator/mentor/trial | Agent mode blocked on investor-only plan | NOT RUN |
| Document vault always on | `BillingModule::DocumentVault` alwaysOn | Routes still work on all plans | NOT RUN |
| Communications hub gate | `feature:communications_hub` (note: not in all module_sets) | Verify flag vs plan entitlement | NOT RUN |

**Watch item:** Communications Hub uses feature flag middleware without `subscription.feature:communications_hub` on all routes. Document actual behavior before v3 ship.

### Scout (Labyrinth)

| Check | v2 reference | Kernel test | Status |
|-------|--------------|-------------|--------|
| Tool pre-flight | `LabyrinthScoutService` via `CarinaModuleToolDispatcher` | Prompt 23: bridge validates before PHP execute | NOT RUN |
| Agent kill switch | `CarinaAgentService`, scheduled agent | Sidecar kill switch listener (prompt 22) | NOT RUN |
| Tenant settings UI | `/settings/labyrinth-scout` | Unchanged | NOT RUN |
| Central webhooks | `routes/api.php` kill-switch routes | Unchanged | NOT RUN |
| BE requires Scout for kernel | New v3 policy | Kernel refused when Scout unhealthy (configurable) | NOT RUN |

### Platform Carina (central, not tenant)

| Check | v2 reference | Kernel test | Status |
|-------|--------------|-------------|--------|
| Platform chat UI | `routes/web.php` `/carina/conversations*` | Prompt 24: platform sidecar path | NOT RUN |
| Platform tools (16) | `app/Services/Carina/PlatformTools/` | Platform tool bridge | NOT RUN |
| Knowledge training ops | `/carina/knowledge-training/*` | Unchanged (Laravel ops) | NOT RUN |
| Tenant isolation | Platform tools must not leak tenant data | JWT context=platform only | NOT RUN |

### Remote channels (tenant)

| Channel | Inbound route | Kernel test (prompt 25) | Status |
|---------|---------------|-------------------------|--------|
| HTTP Remote API | `POST /api/remote/carina/chat` | Prompt 15 | NOT RUN |
| CarinaHub | `POST /api/remote/inbound/carina-hub` | Prompt 16 | NOT RUN |
| Telegram | `/api/remote/inbound/telegram` | Prompt 25 | NOT RUN |
| WhatsApp Web | `/api/remote/inbound/whatsapp-web` | Prompt 25 | NOT RUN |
| WhatsApp Cloud | `/api/remote/inbound/whatsapp` | Prompt 25 | NOT RUN |
| Slack | `/api/remote/inbound/slack` | Prompt 25 | NOT RUN |
| Email | `/api/remote/inbound/email` | Prompt 25 | NOT RUN |
| Generic webhook | `/api/remote/inbound/webhook` | Prompt 25 | NOT RUN |

**Note:** All inbound routes are **tenant subdomain** scoped (`routes/tenant.php`). Never test on bare `propreneur.uk`.

### Carina UX (kernel path)

| Feature | v2 reference | Prompt | Status |
|---------|--------------|--------|--------|
| Brain modifiers | `metadata.brain_key`, CAP-05 | 27 | NOT RUN |
| Incognito mode | `CarinaIncognitoService` | 27 | NOT RUN |
| Usage limits | billing + Carina metering | 27 | NOT RUN |
| Confirmation gates | write tools | 13, 27 | NOT RUN |
| Floating widget | `CarinaWidgetController` | 17 | NOT RUN |
| Scheduled digests | `CarinaScheduledAgentService` | 26 | NOT RUN |
| Deep-link context | `/carina/open/*` routes | 17 | NOT RUN |

### Mobile API (`129-mobile-api.md`)

| Prefix | Modules | Contract test (prompt 29) | Status |
|--------|---------|----------------------------|--------|
| `/api/v1/mobile/*` | auth, sync, profile, properties, deals | Mobile test suite | NOT RUN |
| `/api/v1/mobile/crm/*` | CRM | `MobileCrm*` tests | NOT RUN |
| `/api/v1/mobile/compliance/*` | Compliance | `MobileComplianceTest` | NOT RUN |
| `/api/v1/mobile/documents/*` | Document vault | `MobileDocumentTest` | NOT RUN |
| `/api/v1/mobile/carina/*` | Carina + coach | `MobileCarinaTest` | NOT RUN |
| `/api/v1/mobile/vcal/*` | viCal | `MobileVcalBookingsTest` | NOT RUN |
| `/api/v1/mobile/mentoring-os/*` | Mentoring | `MobileMentoringTest` | NOT RUN |
| `/api/v1/mobile/pipeline/*` | Pipeline | pipeline mobile tests | NOT RUN |
| Drift gate | `php artisan api:docs:build --check` | CI unchanged | NOT RUN |

### Aiva federation (external)

| Check | v2 reference | v3 note | Status |
|-------|--------------|---------|--------|
| Standalone bridge | `core.carinaai.uk/src/bridges/propreneur-bridge.ts` | Unchanged; hits Remote API | NOT RUN |
| Remote session prefix | `carina_standalone_*` | Same on kernel path | NOT RUN |
| Portfolio read tools | aiva-bridge endpoints | Laravel unchanged | NOT RUN |

---

## Module 1: Deal Engine

**BillingModule:** `deal_engine` (all plan sets; pipeline implies access)

| Reference | Path |
|-----------|------|
| Knowledge | `brain/knowledge/04-deals.md`, `41-deal-workspace-v1-parity-journey.md`, `39-deal-calculator-v1-v2-parity-and-refurb-plan.md` |
| Routes | `/deals/*`, `/deals/board`, `/deals/workspace`, `/deals/sourcing/*`, refurb API |
| Services | `app/Services/Deals/` (42 files) |
| Tests | `tests/Feature/Deals/*` (34 files) |
| Mobile | `/api/v1/mobile/deals/*` |

### Carina tools (tenant)

`run_calculator`, `run_development_calculator`, `get_deal_analysis`, `list_deal_analyses`, `get_deal_sourcing_intelligence`, `generate_deal_pack`, `run_strategy_finder`, `find_dossier_overlaps`, plus `DealsToolHandler`, `DealAnalysisHandler`, `SourcingToolHandler`, persona deal tools.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Paste listing URL, create deal, run BTL calculator, save analysis | `DealCalculatorApiTest` | Deal workspace | Ask Carina to run BTL on saved deal | NOT RUN |
| 2 | Sourcing criterion + listing poll + inbox match | `ListingSourceIngestTest` | Sourcing inbox | - | NOT RUN |
| 3 | Refurb catalogue lines + deal pack PDF export | `DealRefurbApiTest`, `DealPackExportTest` | Deal show pack | `generate_deal_pack` confirmation | NOT RUN |
| 4 | Carina verdict/narrative on deal show | `DealCarinaVerdictTest` | Deal Carina panel | Agent uses deal context | NOT RUN |
| 5 | Won pipeline card promotes to portfolio property | `PipelinePortfolioBadgeTest` | Pipeline won action | - | NOT RUN |

**Module status:** NOT RUN

---

## Module 2: CRM

**BillingModule:** `crm` (implied by Communications, Lead Funnel, Reporting)

| Reference | Path |
|-----------|------|
| Knowledge | `brain/knowledge/05-crm.md`, `32-contact-intelligence-and-lead-scoring.md`, `71-contact-network-graph.md` |
| Routes | `/contacts/*`, `/investors/*`, `api/crm/*`, communications inbox |
| Services | `ContactService`, `ContactScoringService`, import/export, network |
| Tests | `tests/Feature/Crm/*`, `Communications/CrmInboxTest.php` |
| Mobile | `/api/v1/mobile/crm/contacts/*` |

### Carina tools

`search_contacts`, `create_contact`, `update_contact`, `delete_contact`, `list_contacts`, `get_contact_network`, `CrmToolHandler` (timeline, merge, import, investor score).

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Create contact, log interaction, view timeline | CRM feature tests | Contact show | `search_contacts` + timeline | NOT RUN |
| 2 | CSV import/export round-trip | import/export tests | Contacts index | - | NOT RUN |
| 3 | Investor score + matched pipeline deals | investor score tests | Contact investor tab | Carina investor view modifier | NOT RUN |
| 4 | CRM inbox thread reply | `CrmInboxTest` | Inbox | - | NOT RUN |
| 5 | Merge duplicate contacts | handler tests | Contact merge UI | Carina merge suggestion | NOT RUN |

**Module status:** NOT RUN

---

## Module 3: Pipeline

**BillingModule:** `pipeline` (implies `deal_engine`)

| Reference | Path |
|-----------|------|
| Knowledge | `brain/knowledge/06-pipeline.md` |
| Routes | `/pipelines/*`, `api/pipeline/*`, `api/mobile/v1/pipeline/*` |
| Services | `PipelineService`, `StageTransitionService`, `PortfolioPromotionService` |
| Tests | `tests/Feature/Pipeline/*` (4 files) |
| Mobile | `/api/v1/mobile/pipeline/*` |

### Carina tools

`add_pipeline_card`, `list_pipeline_deals`, `close_pipeline_deal`, `PipelineToolHandler`.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Create stage, add card, move between stages | Pipeline feature tests | Kanban board | `add_pipeline_card` | NOT RUN |
| 2 | Bulk move via API | pipeline API tests | - | - | NOT RUN |
| 3 | Won deal cascade to property | portfolio promotion tests | Won dialog | - | NOT RUN |
| 4 | Stage automation on transition | automation tests | Stage settings | - | NOT RUN |
| 5 | Analytics velocity/conversion API | analytics tests | Reporting link | `list_pipeline_deals` stale scan | NOT RUN |

**Module status:** NOT RUN

---

## Module 4: Communications Hub

**BillingModule:** `communications_hub` (feature flag; verify plan entitlements)

| Reference | Path |
|-----------|------|
| Knowledge | `brain/knowledge/31-comms-and-engagement-engine.md` |
| Routes | `/communications/*`, `/community/messages`, automation settings |
| Services | `CommunicationEnrollmentService`, `CommunicationSequenceTriggerDispatcher` |
| Tests | `tests/Feature/Communications/*` (6 files) |
| Mobile | No dedicated REST; server-triggered sequences |

### Carina tools

`send_communication_sequence`, `CommsManagementToolHandler`, `TenantCommunicationHandler`.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Multi-step sequence (email + SMS), manual enroll | Communications tests | Sequence builder | - | NOT RUN |
| 2 | Automation `communication_enroll` on deal/contact event | trigger tests | Automation rules | - | NOT RUN |
| 3 | Email template library slug on step | template tests | Step editor | - | NOT RUN |
| 4 | Carina send sequence with confirmation | handler tests | - | `send_communication_sequence` gate | NOT RUN |
| 5 | Community messages access gated | `CommunityMessagesAccessTest` | Community | - | NOT RUN |

**Module status:** NOT RUN

---

## Module 5: Accounting

**BillingModule:** `accounting` (Investor+; permission middleware)

| Reference | Path |
|-----------|------|
| Knowledge | `brain/knowledge/105-accounting-finance.md`, `33-accounting-module.md`, `147-bank-transactions.md` |
| Routes | `/accounting/*`, `api/accounting/*`, invoicing routes |
| Services | `app/Services/Accounting/` |
| Tests | `tests/Feature/Accounting/*`, `Banking/RoomRentMatchingTest.php` |
| Mobile | Billing read-only only |

### Carina tools

`get_journal_entry`, `list_recent_journal_entries`, `get_accounting_integrations_catalog`, `AccountingToolHandler` (13 tools).

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Post balanced journal, view trial balance | `AccountingApiTest` | Journal UI | `run_trial_balance` tool | NOT RUN |
| 2 | Bank CSV import + reconcile | reconciliation tests | Bank rec | - | NOT RUN |
| 3 | Property-level P&L export | export tests | P&L report | `run_profit_and_loss` | NOT RUN |
| 4 | External integration sync | integration tests | Integrations | - | NOT RUN |
| 5 | Carina create expense | handler tests | - | `create_expense` | NOT RUN |

**Module status:** NOT RUN

---

## Module 6: Compliance

**BillingModule:** `compliance` (all plan sets)

| Reference | Path |
|-----------|------|
| Knowledge | `07-compliance.md`, `117-compliance-deep.md`, HMO/FRA/RRA docs (`98`-`105`, `165`-`167`) |
| Routes | `/compliance/*`, fire/HMO/HHSRS, inspections, rent reviews, public complaint embed |
| Services | `app/Services/Compliance/` (20+ services) |
| Tests | `tests/Feature/Compliance/*` (15+ files), `CarinaComplianceContextTest` |
| Mobile | `/api/v1/mobile/compliance/items/*` |

### Carina tools

`get_compliance_items`, HMO suite (`get_compliance_score`, `check_licence_expiry`, `get_fire_log_status`, `get_awaabs_at_risk`, `draft_section_8`), BTL `draft_section_21`, `batch_compliance_check`, dashboard stats.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Starter checklist + expiry digest | compliance digest tests | Compliance index | Scheduled digest (prompt 26) | NOT RUN |
| 2 | HMO licence renewal + document link | HMO licence tests | HMO workflow | `check_licence_expiry` | NOT RUN |
| 3 | Fire risk assessment + defects | FRA tests | FRA form | - | NOT RUN |
| 4 | AML deal log | AML tests | AML hub | - | NOT RUN |
| 5 | RRA 2025 hub tracking | RRA tests | RRA dashboard | - | NOT RUN |

**Module status:** NOT RUN

---

## Module 7: Document Vault

**BillingModule:** `document_vault` (alwaysOn)

| Reference | Path |
|-----------|------|
| Knowledge | `07-compliance.md` vault section, `176-nexio-ai-certificate-scanning.md` |
| Routes | `/documents/*`, deal inline, property vault |
| Services | `DocumentVaultService`, `CertScanningService` |
| Tests | `DocumentVaultTest`, versioning, mobile, `CarinaDocumentReadTest` |
| Mobile | `/api/v1/mobile/documents/*`, `scan-cert` |

### Carina tools

`DocumentVaultToolHandler`, `DocumentUploadHandler`, `upload_document`.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Upload + version chain | versioning tests | Documents index | `list_documents` | NOT RUN |
| 2 | Link doc to compliance item | compliance show tests | Compliance show | - | NOT RUN |
| 3 | Deal show inline vault | deal tests | Deal vault tab | - | NOT RUN |
| 4 | Mobile cert scan prefill | mobile scan tests | scan-cert flow | - | NOT RUN |
| 5 | Download + metadata edit + archive | edit tests | Document detail | `archive_document` | NOT RUN |

**Module status:** NOT RUN

---

## Module 8: viCal (Booking Calendar)

**BillingModule:** `booking_calendar` (BE edition module; Investor+)

| Reference | Path |
|-----------|------|
| Knowledge | `141-vcal-external-calendar-sync.md`, masterbrain `39-vcal-booking-module.md` |
| Routes | `/vical/*`, public `/book/{slug}`, `api/vcal/*`, public REST |
| Services | `app/Services/Vcal/` (20 files) |
| Tests | `tests/Feature/Vcal/*` (13 files) |
| Mobile | `/api/v1/mobile/vcal/bookings/*` |

### Carina tools

`list_vcal_event_types`, `check_vcal_availability`, `schedule_session`, `VcalBookingToolHandler`.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Event type + availability + public book | Vcal booking tests | Public book page | - | NOT RUN |
| 2 | Intake pool routing | intake tests | Pool admin | - | NOT RUN |
| 3 | Approve/reject booking + reminders | approval tests | Booking inbox | - | NOT RUN |
| 4 | Google/Outlook OAuth sync | OAuth tests | Calendar settings | - | NOT RUN |
| 5 | Public Carina assist on booking page | public assist tests | `/book/{slug}` | Remote/public path | NOT RUN |

**Module status:** NOT RUN

---

## Module 9: Mentoring OS

**BillingModule:** `mentoring_os` (BE edition; mentor plan + trial_expanded)

| Reference | Path |
|-----------|------|
| Knowledge | `106-mentoring-os.md`, masterbrain `09-mentoring-os-tenant-surface.md`, `173-propreneur-academy-mentor-guide.md` |
| Routes | `/mentoring/*`, public intake, `mentoring-os/*` API |
| Services | goals, sessions, matching, alerts, programme RAG |
| Tests | `tests/Feature/Mentoring/*` (10 files), `MobileMentoringTest` |
| Mobile | `/api/v1/mobile/mentoring-os/*` |

### Carina tools

`MentoringToolHandler` (9 tools), `ScheduleSessionTool`, academy/quiz context tools.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Mentor profile + package + Stripe checkout intake | intake tests | Public apply | - | NOT RUN |
| 2 | Match approve/reject, relationship hub | matching tests | Mentor hub | - | NOT RUN |
| 3 | Goals/milestones with evidence | goals tests | Goals UI | `update_mentorship_goal` | NOT RUN |
| 4 | Session notes + action items | session tests | Session notes | - | NOT RUN |
| 5 | Recurring invoice generation | invoice command tests | Billing | `generate_mentorship_invoice` | NOT RUN |

**Module status:** NOT RUN

---

## Module 10: Reporting and Intelligence

**BillingModule:** `reporting_intelligence` (implies deal_engine + crm)

| Reference | Path |
|-----------|------|
| Knowledge | masterbrain `42-reporting-analytics-module.md`, `66-asset-manager-and-net-worth-dashboard.md` |
| Routes | `/reporting/*`, `reports/*`, `dashboard/*`, pipeline analytics |
| Services | `ReportGenerationService`, `AnalyticsService`, `InvestorReportService` |
| Tests | `tests/Feature/Reporting/*` |
| Mobile | `/api/v1/mobile/assets/*` (net worth, allocation) |

### Carina tools

`ReportingToolHandler`, `AssetNetWorthTool`, `AssetAllocationTool`, `portfolio_health`, `pipeline_overview`.

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel Carina | Status |
|---|---------|----------------|----------|---------------|--------|
| 1 | Reporting hub KPI charts | `ReportingModuleTest` | `/reporting` | - | NOT RUN |
| 2 | Create report definition + download | execution tests | Report builder | `generate_report` | NOT RUN |
| 3 | Scheduled recurring report | scheduled report tests | Schedule toggle | - | NOT RUN |
| 4 | Dashboard widget reorder | widget tests | Dashboard | - | NOT RUN |
| 5 | Investor ROI/cashflow API | investor report tests | Investor portal | - | NOT RUN |

**Module status:** NOT RUN

---

## Module 11: Carina AI

**BillingModule:** `carina_ai` alwaysOn; `carina_agent` for tool mode (Professional+)

| Reference | Path |
|-----------|------|
| Knowledge | `08-carina.md`, `130-carina-provider-policy.md`, `131-carina-voice-and-webhooks.md`, `132-aiva-propreneur-bridge-phase1.md` |
| Routes | `/carina/*`, `/api/carina/*`, `/api/rag/*`, `/api/remote/*`, settings |
| Services | `app/Services/Carina/` (80+ files) |
| Tool registry | `config/carina_module_tools.php` (133 entries) + 61 class tools + 38 handlers |
| Tests | `tests/Feature/Carina/*` (40+ files) |

### v3-specific kernel acceptance

| # | Check | Prompt | Status |
|---|-------|--------|--------|
| 1 | In-app chat on sidecar | 17 | NOT RUN |
| 2 | All 61 tenant tools via bridge | 10-14 | NOT RUN |
| 3 | Scout blocks injection fixture | 23 | NOT RUN |
| 4 | RAG retrieval via bridge | 09 | NOT RUN |
| 5 | Hub skills on sidecar | 08 | NOT RUN |
| 6 | property-uk + propreneur-workspace packs active | 07 | NOT RUN |
| 7 | Multi-provider routing (kernel) | 21 | NOT RUN |
| 32 | Golden prompt regression | 32 | NOT RUN |

### Critical journeys

| # | Journey | Automated test | UI smoke | Kernel path | Status |
|---|---------|----------------|----------|-------------|--------|
| 1 | Chat + agent tool + confirmation | Carina chat tests | Widget + full page | Sidecar loop | NOT RUN |
| 2 | RAG against brain/knowledge | RAG tests | Knowledge query | RAG bridge | NOT RUN |
| 3 | Deep-link from deal/property/contact | deep-link tests | Open in Carina | Context in JWT | NOT RUN |
| 4 | Remote WhatsApp/Telegram inbound | Remote tests | - | Prompt 25 | NOT RUN |
| 5 | Scout kill switch blocks agent | Scout tests | Settings | Sidecar + bridge | NOT RUN |

**Module status:** NOT RUN

---

## Persona packs (Nexio / Propreneur vertical modes)

v2 ships persona-specific Carina tools and guides beyond core modules. Accept on kernel if tenant uses persona:

| Persona | Knowledge guides | Carina tool folders | Sample acceptance |
|---------|------------------|---------------------|-------------------|
| Nexio (HMO) | `157`-`170`, `176` | `Tools/Hmo/` | Room occupancy, Awaab's Law, compliance score |
| BTL | `171-propreneur-let-btl-guide.md` | `Tools/Btl/` | Section 21, renewals due |
| Agency | `180-propreneur-agency-letting-agent-guide.md` | `Tools/Agency/` | Managed properties, landlord statement |
| R2R Bridge | `182-propreneur-bridge-r2r-guide.md` | `Tools/Bridge/` | R2R margin, agreements |
| Hall (student) | `183-propreneur-hall-student-lettings-guide.md` | `Tools/Hall/` | Guarantor, summer void forecast |
| Lodge (SA) | `178-propreneur-lodge-sa-guide.md` | `Tools/Lodge/` | SA revenue, bookings |
| Steward (block) | `179-propreneur-steward-block-guide.md` | `Tools/Steward/` | Service charge, leaseholders |
| Forge (dev) | `181-propreneur-forge-developer-guide.md` | development calculator | GDV workflow |

**Persona status:** NOT RUN (run for tenants with `persona_config` enabled)

---

## Automated test commands (full regression)

Run from `propreneur-v3/` before sign-off:

```bash
# Full suite (long)
php artisan test

# Module-focused
php artisan test tests/Feature/Deals
php artisan test tests/Feature/Crm
php artisan test tests/Feature/Pipeline
php artisan test tests/Feature/Communications
php artisan test tests/Feature/Accounting
php artisan test tests/Feature/Compliance
php artisan test tests/Feature/DocumentVaultTest.php
php artisan test tests/Feature/Vcal
php artisan test tests/Feature/Mentoring
php artisan test tests/Feature/Reporting
php artisan test tests/Feature/Carina
php artisan test tests/Feature/Mobile

# API drift
php artisan api:docs:build --check

# Sidecar (when present)
cd apps/carina && pnpm test
```

---

## Sign-off summary

| Section | Modules / areas | PASS count | FAIL count | Signed off |
|---------|-----------------|------------|------------|------------|
| Cross-cutting | Scout, Platform, Channels, Mobile, Aiva | | | |
| Property modules | 1-10 | | | |
| Carina AI | 11 + kernel | | | |
| Personas | Nexio, BTL, Agency, etc. | | | |
| **Total v3** | | | | |

**Signed off by:** _______________  
**Date:** _______________  
**Pilot tenant:** _______________  
**Runtime:** kernel + Scout enabled  

---

## Related documents

- [SCOPE-PARITY.md](./SCOPE-PARITY.md)
- [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [MIGRATION-FROM-V2.md](./MIGRATION-FROM-V2.md)
- `propreneur-v2/brain/knowledge/102-propreneur-v2-complete-guide.md` (whole-product reference)
- `propreneur-v2/CLAUDE.md` (module matrix)
