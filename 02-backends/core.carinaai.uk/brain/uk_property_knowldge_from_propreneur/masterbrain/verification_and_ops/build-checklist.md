# Propreneur v2 - Master Build Checklist

Last updated: 2026-05-16 (sync: **108**, **110-111** PIN deal/SCOUT prompts; **75-82**, **93-98**; **80** listings toggle; **76** compliance parity; **74** payroll phase 1; **81** invoicing)

This checklist covers every module and feature prompt under `brain/prompts/` (canonical library; content formerly maintained in sibling `v2-prompts/`), including **53-56** (platform Carina agentic, Carina security layers, conversation insight extraction).

Tick `[x]` only when migration(s), model(s), service(s), controller(s), routes, and at least one Pest test exist in `propreneur-v2`, and `brain/knowledge/` has been updated for the feature where applicable. Partial implementations stay `[ ]`.

Cross-reference: `memory.md` (*Current Build Status* and *Product module matrix*), `CLAUDE.md` (*The 13 Modules*), implementation status files `brain/prompts/49-lead-funnel-implementation-status.md`, `brain/prompts/52-vical-implementation-status.md`, prompt index **`brain/prompts/readme-prompts.md`** (includes **prompt refresh waves 1-5**, 2026), and **`brain/prompts/PROMPT-CONVENTIONS.md`** (stack truth for all prompts).

**Mobile app pairing rule:** This checklist is also the gating document for `propreneur-mobile/v2` (`/opt/lampp/htdocs/VERLOX/propreneur/propreneur-mobile/v2/`). The app uses **legacy** Sanctum helpers `POST/GET/DELETE /api/mobile/v1/token|me` plus **full JSON** under **`/api/v1/mobile/*`** (`routes/tenant/mobile_v1_api.php`) and **pipeline parity** under **`/api/mobile/v1/pipeline/*`** (`routes/tenant/mobile_pipeline_api.php`). Any session that touches the mobile app must open this file first and only wire mobile screens against `[x]` rows. When a v2 module is newly ticked `[x]`, note which mobile endpoints it unlocks here so the mobile build stays in sync.

**19-mobile-api.md sync rule:** `brain/prompts/19-mobile-api.md` is a living API contract. Whenever any endpoint, feature, or CRUD operation is added or changed in propreneur-v2 - in any module, any session - `19-mobile-api.md` must be updated to record the change and mark the endpoint `[mobile: pending]` (v2 has it, mobile does not yet) or `[mobile: done]` (both sides live). This is the single document that prevents mobile vs web drift.

### Agent procedure: "What to build next"

When the operator asks what to build next: (1) walk open `[ ]` rows from the top; (2) confirm each against `app/`, `routes/`, `database/migrations/`, `tests/`, and `memory.md`; (3) update this file so each row's checkbox and one-line note match the codebase; (4) answer with the next product-critical gap, preferring **`instructions.md`** *Priority Order* when it narrows focus (for example Communications Hub before polish-only infrastructure rows).

---

## FOUNDATION MODULES

- [x] 01 - Multi-tenancy (stancl/tenancy v3, wildcard subdomain)
- [x] 02 - Authentication (central platform guard + tenant web guard)
- [x] 03 - User Manager (platform users, roles, invitations; central admin + tenant workspace admin API)
- [x] 04 - Feature Flags (per-tenant gating)
- [x] 05 - System Settings (platform-level config)
- [x] 06 - AI Provider BYOK (multi-provider key management)

## CARINA AI

- [x] 07 - Carina Core (conversations, streaming, rate limiting, token tracking)
- [x] 08 - Carina RAG Pipeline (document ingestion, embeddings, pgvector search)

## PLATFORM CARINA AND SECURITY PROMPTS (53-56)

Indexed from `brain/prompts/53-platform-carina-agentic.md` through `56-carina-conversation-insight-extraction.md`. Build order in specs: **53 → 54 → 55**; **56** after Carina RAG (08) and platform agent (53).

- [x] 53 - Platform Carina agentic (`PlatformCarinaTool`, `PlatformCarinaToolRegistry`, `PlatformCarinaAgentService`, 10 platform tools, `PlatformCarinaController` + confirm route; Pest `tests/Feature/PlatformCarina/PlatformCarinaAgentTest.php`; see `brain/knowledge/08-carina.md` *Platform admin agentic and security (prompts 53-55)*.)
- [x] 54 - Carina security input/output (`CarinaInputSanitizer`, `CarinaOutputFilter`, `ConversationAnomalyDetector`, `CarinaSecurityAuditLogger`, tenant `carina_security_events`; unit tests `CarinaInputSanitizerTest`, `CarinaOutputFilterTest`, `ConversationAnomalyDetectorTest`; wired in `CarinaService`.)
- [x] 55 - Carina security RAG/tools/platform (`RagDocumentSecurityScanner` in `RAGService`, `CarinaToolArgumentValidator` on tenant + platform agents, `PlatformCarinaGuardrail`; Pest `RagDocumentSecurityScannerTest`, `CarinaToolArgumentValidatorTest`, `PlatformCarinaGuardrailTest`.)
- [x] 56 - Carina conversation insight extraction (`InsightExtractionService`, `ConversationPreRedactor`, `InsightPromotionService`, central migrations `carina_conversation_insights` + `carina_extraction_log`, `carina:extract-conversation-insights`, `carina:promote-insights`, `CarinaInsightsController`, Pest `InsightExtractionServiceTest`, `ExtractConversationInsightsCommandTest`, `InsightPromotionServiceTest`; spec `56-carina-conversation-insight-extraction.md`.)

## DEAL ENGINE

- [x] 09 - Deal & Property (property model, deal creation, deal workspace)
- [x] 10 - Deal Calculators (BTL, HMO, BRR, SA, Flip, wholesale, SDLT, bridging)
- [x] 11 - Deal Sourcing (sourcing criteria, area research, goldmine workflow)
- [x] 80 - Deal listings grid/list toggle (`x-tenant.view-mode-toggle`, Sourced Listings + Deal Engine index; `PortalListingsController` + `DealController` `$viewMode`; Pest `DealListingsViewModeTest`; **`brain/knowledge/04-deals.md`** *Listing view modes*, **`12-ui-components.md`**; spec `80-deal-listings-grid-list-toggle.md`)
- [x] 78 - Property due diligence intelligence hub (`DueDiligenceHubController`, `due_diligence_snapshots`, PropertyData/EPC bundle services; Pest `DueDiligenceHubTest`, `DueDiligenceSupplementTest`; spec `78-property-due-diligence-and-intelligence-hub.md`; cross-link **`brain/knowledge/04-deals.md`**)
- [x] 79 - Deal tasks (`deal_tasks`, `DealTaskController`, dashboard widget; Pest `DealTaskTest.php`; spec `79-deal-tasks-monetisation-comparables.md`)
- [x] 82 - Listing capture and import overhaul (portal drivers Rightmove/Zoopla/OTM/OpenRent/SpareRoom/URL/chain, `ListingImportPropertyMapper`, extension API; Pest `ListingImportTest`, `ListingImportDriversTest`; spec `82-listing-capture-and-scraping-overhaul.md`; **`brain/knowledge/04-deals.md`**)
- [x] 93 - SA vs BTL strategy calculator (`SaVsBtlCalculatorService`, registry tool slug, playground; Pest `SaVsBtlCalculatorTest`, unit `SaVsBtlCalculatorServiceTest`; spec `93-sa-vs-btl-strategy-calculator.md`)
- [x] 94 - Motivated seller scoring upgrade (`MotivatedSellerScoringService`, `MotivatedSellerScoringRunner`, `deals:rescore-motivation`; Pest `MotivatedSellerScoringTest`, unit `MotivatedSellerScoringServiceTest`; spec `94-motivated-seller-scoring-upgrade.md`)
- [x] 95 - Deal pack generator (`DealPackGeneratorService`, `DealPackController`, settings, PDF export; Pest `DealPackGeneratorTest`, `DealPackExportTest`; spec `95-deal-pack-generator.md`)
- [x] 97 - Commercial property module (`commercial` strategy calculator, `PropertyCommercialLeaseController`, `CommercialLeaseService`; Pest `CommercialCalculatorTest`; spec `97-commercial-property-module.md`; **`brain/knowledge/84-commercial-property-investment.md`**)
- [x] 98 - Calculator UX fix and surpass (SA/HMO/R2R/BRR primary inputs, live calc, `dealVerdict()`, sensitivity grid; Pest `CalculatorInputFormatTest`; spec `98-calculator-ux-fix-and-surpass.md`)
- [x] 110 - BMV no-money-down calculator (`BmvNoMoneyDownCalculator`, `bmv_no_money_down` in `DealCalculatorRegistry`, playground + deal workbench panels, `deal-calculator-form.js` `bmvResultsData()`; Pest `tests/Unit/Deals/BmvNoMoneyDownCalculatorTest.php`; spec `110-bmv-no-money-down-deal-calculator.md`; **`brain/knowledge/92-bmv-motivated-seller-and-100-finance.md`**)
- [x] 111 - Motivated seller sourcing intelligence (`App\Support\DealSourcingIntelligence`, tenant migration `2026_05_16_120000_add_sourcing_intelligence_to_deal_analyses` (7 columns on `deal_analyses`), create/edit form + list filters + badge, `DealSourcingIntelligenceCarinaContext`, Carina `GetDealSourcingIntelligenceTool`; Pest `DealSourcingIntelligenceTest`, `tests/Feature/Tenant/Deals/DealSourcingIntelligenceTest.php`; spec `111-motivated-seller-deal-sourcing-intelligence.md`)

## CRM & PIPELINE

- [x] 12 - CRM Contacts (contact CRUD, contact types, investor scoring)
- [x] 13 - Pipeline Kanban (stages, deal cards, drag-and-drop, automations)
- [x] 75 - CRM inbox and threads (`contact_threads`, `contact_thread_messages`, `/crm/inbox`, `CrmInboxController`, outbound mail + manual inbound; Pest `CrmInboxTest.php`; spec `75-crm-inbox-and-threads.md`)

## COMPLIANCE

- [x] 14 - Compliance Module (tenant CRUD, starter checklist, rules engine, expiry digest, workspace vault link + document versioning; property `PropertyDocument` vault unchanged)
- [x] 76 - Compliance full v1 parity (`brain/prompts/76-compliance-full-parity.md`): AML hub (`aml_records`, `aml_training_logs`, `AmlController`), complaints CRUD, requirements + checks, regulatory profile singleton, PDF export (`tenant.compliance.export.pdf`), Right to Rent in rules engine + starter checklist, `compliance:expiry-digest --days` + five console schedules, Compliance nav sub-group; Pest `tests/Feature/Compliance/ComplianceParityTest.php`; **`brain/knowledge/07-compliance.md`**)

## BILLING

- [x] 15 - Billing (Stripe subscriptions, plans, invoices, tenant billing API and UI surfaces)

## ADDITIONAL CORE MODULES

- [x] 16 - Integrations (Zapier/Make-style webhooks, registry, tenant settings hub)
- [x] 17 - Community & Learning (LMS, cohorts, courses, community hub)
- [x] 18 - Reporting & Analytics (dashboards, exports, portfolio metrics)
- [x] 96 - SA Performance Analytics (`sa_metrics` JSONB on `properties`, `SaPerformanceService`, property SA panel + `/properties/{property}/sa-performance` edit, `/reporting/sa-portfolio`, Carina property appendix; Pest `tests/Feature/Tenant/Properties/SaPerformanceTest.php`; **`brain/knowledge/03-properties.md`**; spec `96-sa-performance-analytics.md`)

## COMMUNICATIONS HUB (MODULE 4)

- [x] Communications Hub - Not a single `brain/prompts/0N-*.md` row; tracked in **`instructions.md`** priority 14 and **`brain/masterbrain/process_and_workflow/14-comms-and-engagement-engine.md`**. Shipped: `/communications` UI, sequences, steps, enrollments, `ProcessCommunicationStepJob`, `App\Support\Communications\CommunicationSequenceTriggers` (pipeline, deal, lead, compliance, stale, engagement, manual), `communications:sequence-triggers`, per-step `email_template_slug`, SMS path + `tests/Feature/Communications/*.php`. Spec backlog only: richer `communication_sends` delivery audit, Twilio status webhooks, in-app / WhatsApp channels (see masterbrain doc status line).

## INFRASTRUCTURE

- [x] 19 - Mobile API (legacy PAT + **`/api/v1/mobile/*`** incl. property/deal write + refurb + documents/tenancies; **`/api/mobile/v1/pipeline/*`**; Pest `tests/Feature/Mobile/*`; contract **`brain/prompts/19-mobile-api.md`**. Expo parity for CRM/accounting/etc. still open - see contract `[mobile: pending]` rows.)
- [x] 20 - Data Migration (v1 migration console and Artisan commands; `App\Http\Controllers\Central\Admin\MigrationController` + `MigrationOrchestratorService`; ops detail in **`memory.md`** / stage log - no numbered `brain/knowledge/57-*` file in trimmed corpus)
- [x] 21 - Backup & Disaster Recovery (central backup jobs, admin hub, schedules)
- [x] 22 - Audit Logging (tenant workspace: `audit_logs` + `audit_log_hashes`, `Auditable` on core models, `App\Services\Audit\*`, tenant `/admin/audit/logs` behind `workspace_audit_logging`, Artisan `audit:cleanup|archive|verify-chain`, Pest `tests/Feature/Audit/AuditLoggingTest.php` + unit tests; **`brain/knowledge/71-workspace-audit-logging.md`**. Central: remote-access audit hub `AuditLogController` + `admin/audit-logs` exports; `SettingAuditLog`; SCOUT `security_activity_logs`. Optional follow-ups: Feature tests for central remote-access HTTP routes; extend `Auditable` to more models.)
- [x] 108 - SCOUT page refactor (`resources/views/central/admin/scout/index.blade.php`, `resources/js/scout.js` + `scoutDashboard`/`confirmAndSubmit` Alpine modal replacing six native `confirm()` calls, SCOUT tokens in `app.css` `@layer components`; Pest `ScoutDashboardTest`; spec `108-scout-page-refactor.md`)
- [x] 23 - Search Infrastructure (Scout + Meilisearch, global search feature)
- [x] 24 - Webhook System (inbound/outbound tenant webhooks, deliveries, retries)
- [x] 25 - Queue Monitoring (Horizon, failed-job patterns)
- [x] 26 - API Security (Sanctum, throttles, CORS, feature middleware)
- [x] 27 - Tenant Onboarding (wizard depth shipped per `memory.md`)
- [x] 28 - Health Monitoring (`/health` and disclosure hardening per security knowledge)

## CROSS-CUTTING FEATURES

- [x] 29 - Localisation (`LocalizationService`, tenant settings UI `/settings/localization`, `/admin/translations`, `workspace_localization` flag, Pest `LocalizationSettingsTest.php`; `brain/knowledge/73-workspace-localization-and-staff.md`)
- [x] 30 - GDPR Compliance (tenant: export/deletion/consents/policies/retention/breach + commands; `brain/knowledge/72-gdpr-data-subject-rights.md`; Pest `tests/Feature/Gdpr/GdprModuleTest.php`. Lead funnel: existing `LeadFunnelGdprService` erasure hooks unchanged.)
- [x] 31 - Waitlist & Marketing (central `GET /waitlist` HTML signup + thanks, JSON API, confirm/referral/status, admin campaigns, Pest `WaitlistModuleTest` + `WaitlistSignupFormTest.php`; marketing site static remains out of repo)
- [x] 32 - API Documentation (`config/api_docs.php`, `php artisan api:docs:build [--check]`, Swagger UI `/admin/api-docs`, OpenAPI JSON `/admin/api-docs/openapi.json`, Pest `tests/Feature/ApiDocs/ApiDocsGeneratorTest.php`, CI `--check`; knowledge **`brain/knowledge/74-api-docs-and-openapi.md`**)
- [x] 33 - Maintenance Commands (Artisan + schedule catalogue: **`brain/masterbrain/process_and_workflow/23-artisan-and-scheduler-catalog.md`**; commands under `app/Console/Commands/`)
- [x] 34 - UI/UX Frontend (Blade + Alpine + Tailwind v4 design system)

## ADDITIONAL MODULES (v1 PARITY)

- [x] 35 - viCal / Module 10 booking (phases 1-7: guest funnel, lifecycle mail, session pricing + refunds + payment retry, intake routing UI, analytics depth, webhooks matrix, group event check-in; Pest `tests/Feature/Vcal/*`; optional: Carina pre/post-book, mobile API, staging Stripe sign-off - **`52-vical-implementation-status.md`**)
- [x] 36 - Document Management (workspace vault CRUD, compliance link, version upload/history, index head de-duplication; property vault versioning remains on `PropertyDocument`)
- [x] 37 - Staff Management (`hr_payroll` module, `/staff` directory + leave + payroll; phase 1 pay cycle **74** - `74-hr-payroll-implementation-status.md`)
- [ ] 89 - HR Payroll Phase 2 HMRC (`89-hr-payroll-phase-2-hmrc.md` - RTI/FPS, auto PAYE/NI, pensions, P45/P60, scheduled runs; **business-triggered only**; status `90-hr-payroll-implementation-status.md`)
- [x] 38 - Investor Portal (Sanctum `/api/investor-portal` + session web `/investor-portal/*` dashboard with deal matches, CRM hub `/investors/*`, Pest `InvestorPortalWebTest.php`)
- [x] 39 - Theme Presets (central presets + tenant appearance)
- [x] 40 - Repository Setup (GitHub Actions CI, deployment docs in knowledge)

## FEATURE ADDITIONS

- [x] 41 - Lead Funnel (ingestion, scoring, automations, hub; ops verification rows remain in file 49)
- [x] 41v - viCal (same scope as **35**; see **52**)

## EXTENSION PROMPTS

- [x] 19b - AI Lead Qualification Chatbot (`/qualify`, `LeadQualificationChatService`, `ExtensionModulesPhase2Test`)
- [x] 20b - Speed-to-Lead Automation Engine (`speed_to_lead_rules`, `SpeedToLeadService`, observer wire, `/lead-funnel/speed-to-lead` UI)
- [x] 21b - Sourcing Pipeline Presets (`PipelinePresetService`, preset picker on `/pipelines`, `POST /pipelines/presets`)
- [x] 22b - Marketing Template Library (`/communications/templates` CRUD + duplicate, `marketing_template_library` flag)
- [x] 23b - Structured Qualification Form Builder (`/lead-funnel/qualification-forms`, public `/forms/{slug}`)

## GAP CLOSURES (from OS audit)

- [x] 42 - Accounting UX Gap (portfolio cashflow, rent shortcut, label fixes per `memory.md` stage log)
- [x] 43 - Deal-Investor Matching UI Gap (match routes/views + tests)
- [x] 44 - Marketing Funnel Automation Gap (`LEAD_CREATED` / `LEAD_QUALIFIED` triggers wired)
- [x] 45 - CRM-Investor Hub Bridge Gap (tests `ContactInvestorBridgeTest` and related)
- [x] 46 - Portfolio Financial Modelling Gap (projection service + `PortfolioModelTest`)
- [x] 47 - Bank Reconciliation Gap (`BankReconciliationTest`, models)
- [x] 81 - Tenant invoicing and receipts (`invoices`, `invoice_lines`, `receipts`, `routes/tenant_invoicing.php`, PDF/email, overdue commands; gated by `accounting`; Pest `InvoiceFlowTest`, `ReceiptFlowTest`; **`brain/knowledge/81-tenant-invoicing-and-receipts.md`**; spec `81-tenant-invoicing-and-receipts.md`)
- [x] 48 - Carina Page/View Awareness Gap (`CarinaContext` DTO, `#carina-page-context` in layout, deal/property/contact/pipeline/compliance surfaces, `CarinaPageContextTest`)
- [x] 57 - Platform admin revenue tracking (`RevenueAnalyticsService`, `/admin` snapshot + `/admin/revenue`, CSV export, `platform_revenue_dashboard` flag, `view-platform-revenue` permission; Pest `PlatformRevenueDashboardTest`)
- [x] 77 - Property asset register, maintenance and refurb projects (`routes/tenant-portfolio.php`, portfolio services/controllers, deal refurb carry-over, expense links; Pest `PortfolioMaintenanceTest`; **`brain/knowledge/77-property-asset-maintenance-and-refurb-projects.md`**)

## BACKLOG (prompts on disk, not checklist-complete)

- [ ] 92 - PropAI UX gap close (`92-cursor-propai-ux-gap-close.md` - cross-cutting design-token polish; no single module test bar; audit per section before tick)
- [x] 99 - Carina guided onboarding journey (`99-carina-guided-onboarding-journey.md` - `user_investor_profiles`, `onboarding_journeys`, `/investor-journey`, My Plan, Carina context; Pest `InvestorOnboardingJourneyTest`)

**Reference only (not build prompts):** `brain/reference/carina-knowledgebase-final-packed.md`, Carina 2.0 files under `brain/reference/`, `50`/`51` workflow docs, `91-cursor-extraction-prompt.md`, status files `49`/`52`/`90`.

---

## IMPLEMENTATION STATUS NOTES

### Lead Funnel (Prompt 41) - from `brain/prompts/49-lead-funnel-implementation-status.md`

**Done (code):** Tenant migrations for lead-funnel tables; central `lead_funnel_webhook_routes`; models under `App\Models\Tenant\LeadFunnel\`; services (OAuth, Meta, LinkedIn, TikTok, ingestion, campaigns, scoring, GDPR, Carina qualify, etc.); jobs; tenant and central routes; public tracking routes; feature flag and billing module; Filament resources; `/lead-funnel` hub; Meta webhook verification; Pest coverage for ingestion, scoring, automations, webhooks.

**Remaining (config / ops / verification):** Production Meta webhook registration; queue worker verification for dedicated queues; live OAuth callbacks on staging; full E2E manual run optional; optional Filament chart widgets.

### viCal (Prompt 41v) - from `brain/prompts/52-vical-implementation-status.md`

**Product rule:** viCal is the only scheduling stack on v2 (no Cal.com).

**Done (phases 1-7 for production scheduling):** Core schema; host `/vical`; public `/book/{slug}` + embed; multi-step funnel; session price + deposit; Stripe refunds; payment retry; full lifecycle mail; intake routing UI; reminders; host calendar + booking timeline; analytics (conversion, utilisation, by type); round-robin; public/API-key REST; webhooks (created, payment.*, disqualified, completed); group events + check-in; mentor/programme public pages; Pest `tests/Feature/Vcal/*` + `tests/Unit/Vcal/*`.

**Optional backlog:** Carina conversational qualify on public book; post-book AI brief; mobile JSON payloads; signed embed token; PropBook-tier ticket pricing; manual Xelox staging Stripe checklist.

### HR & Payroll (Prompt 74) - from `brain/prompts/74-hr-payroll-implementation-status.md`

**Done (phase 1):** Payroll runs and per-staff lines; salary on HR profiles; finalise (GL 5100/2200) and mark paid (GL 2200/1000); payslip view/print/PDF/email; `payslip_sent_at`; auto-populate lines and auto-send on mark paid (tenant settings); My payslips; Pest `StaffPayrollFullCycleTest`, `StaffPayslipDeliveryTest`.

**Deferred (phase 2 - open `89-hr-payroll-phase-2-hmrc.md` when business demands):** HMRC RTI/FPS; auto PAYE/NI from tax codes; pension auto-enrolment; P45/P60 and year-end; scheduled payroll cron; optional payslip send on finalise.

### Deal engine extensions (75-98 sync) - 2026-05-16

**Checklist rows added:** **75** CRM inbox, **78** DD hub, **79** deal tasks, **81** invoicing, **82** listing import, **93-98** calculator/commercial/scoring/pack UX, **99** guided investor journey. **Still open:** **92** (UX polish).

---

---

## HOW TO TICK AN ITEM

1. Confirm migrations in `database/migrations/` or `database/migrations/tenant/`.
2. Confirm models in `app/Models/`.
3. Confirm services in `app/Services/`.
4. Confirm controllers and `routes/*.php`.
5. Confirm at least one Pest test under `tests/`.
6. Confirm `brain/knowledge/` (or mandated knowledge path) updated for the behaviour.

Do not tick partial implementations.
