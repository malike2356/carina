# Propreneur v2.0 Knowledge Base

**Purpose:** Carina AI training corpus, help documentation, and system reference for the Propreneur property investment management platform.

**Last updated:** 2026-05-15 (folded former **`carina2.0/`** exports into **`24`**-**`26`** + prompts **`carina-2-0-build-prompt-*`** at `brain/prompts/` root). Prior: packed KB / `08-carina-2-0-complete` splits **`16`**-**`23`**; **`15`** business journey.

## Directory Structure

| File | Topic |
|------|-------|
| `01-architecture.md` | Application architecture, stack, tenancy model |
| `02-dashboard.md` | Command centre / dashboard module |
| `03-properties.md` | Property portfolio management (hub) |
| `04-deals.md` | Deal engine / deal analysis module |
| `41-deal-workspace-v1-parity-journey.md` | Deal workspace hub, sourcing criteria CRUD, v1 parity map, next slices |
| `39-deal-calculator-v1-v2-parity-and-refurb-plan.md` | Deal calculators: v1 parity roadmap, SDLT/bridging/BTL depth, tenant defaults, refurb lines + catalogue, labs gates, contract tests |
| `29-deals-module-strategy.md` | Deals strategy, sourcing, listings data sources, phased build plan |
| `42-property-sourcing-business-basics-uk.md` | UK deal sourcing: ICP, compliance checklist, monetisation (RAG practice guide) |
| `43-property-sourcing-marketing-and-growth.md` | Sourcing business: M.A.R.K.E.T.I.N.G., funnel, metrics, investor rules (RAG) |
| `44-property-sourcing-deal-finding-and-area-due-diligence.md` | Goldmine patch, area metrics, portal workflow, HMO and BRRR heuristics (RAG) |
| `45-property-viewing-and-assessment-uk.md` | Viewing checklist: roof to electrics, damp types, knotweed (RAG) |
| `46-property-sourcing-deal-packaging-and-sales-uk.md` | Packaged deals, offer template, AML, client account, upsells (RAG) |
| `47-example-deal-analysis-brrr-hmo-bedford.md` | Worked BRRR HMO case study with finance and refurb variance (RAG) |
| `48-property-sourcing-social-media-and-content.md` | Reels, on-camera basics, posting and engagement cadence (RAG) |
| `49-property-investment-roi-and-refurb-calculators.md` | Spreadsheet ROI patterns; refurb unit cost table; R2R 50% occupancy rule (RAG) |
| `50-deal-due-diligence-pack-structure.md` | Investor DD pack sections: comps, agents, media, B&M sense-check (RAG) |
| `51-property-sourcing-legal-and-compliance-templates-uk.md` | Reservation agreements, AML policy themes, complaints, privacy, onboarding (RAG) |
| `52-manchester-hmo-licensing-standards-and-conditions.md` | Manchester HMO room sizes, amenity ratios, licence conditions (RAG) |
| `53-introducer-letter-email-templates-sourcing.md` | Email templates: investor to sales agent; investor to landlord (R2R) |
| `54-community-learning-module.md` | Community posts, groups, courses, quizzes, learning paths, mentorship API, badges; Blade `/community`; `BillingModule::CommunityLearning` |
| `55-investors-hub-and-investor-portal-api.md` | Tenant `/investors/*` CRM hub; JSON `/api/investor-portal` (Sanctum) for `InvestorPortalUser` |
| `56-workspace-automation.md` | `workspace_automation_rules` / `runs`, triggers, action runner, `/settings/automation`, Artisan `workspace:automation-*` |
| `57-v1-migration-and-platform-migration-console.md` | `migrate:v1-*` Artisan; `/admin/migration/*` platform UI; feature `v1_data_migration_tools` |
| `58-mentoring-os-tenant-surface.md` | `/mentoring` hub, programmes and cohorts schema, Carina `mentorship`, viCal links (partial Module 11) |
| `59-carina-propreneur-full-codex.md` | **Start here for Carina:** product truth order, BillingModule gates, context rules, links to `60`-`67`, RAG ingest hint |
| `60-artisan-and-scheduler-catalog.md` | Every shipped Artisan command + `routes/console.php` schedule table |
| `61-eloquent-models-and-table-index.md` | Central and tenant Eloquent models mapped to DB tables (explicit and conventions) |
| `62-jobs-and-events-catalog.md` | `app/Jobs` queue jobs and `app/Events` domain events |
| `63-config-php-inventory.md` | `config/*.php` files and env key families (no secrets); use repo `.env.example` |
| `64-api-route-consolidated.md` | HTTP route knowledge **index** (counts, regenerate command, CI note); full tables in `66` and `67` |
| `65-platform-subscription-plans-admin.md` | Central admin subscription plan catalogue CRUD (renumbered from old `38-platform-*`; see `38-remote-access-and-support.md` for the other `38` doc) |
| `66-api-routes-tenant-subdomain.md` | Tenant subdomain routes (`tenant.*`, `tenant.api.*`) from `php artisan route:list --json` |
| `67-api-routes-central-filament-misc.md` | Central platform, Filament, and other routes from `php artisan route:list --json` |
| `68-solution-dependencies-and-production-readiness.md` | External dependencies (Postgres, pgvector, Redis, Meilisearch), bootstrap and migration order, Carina/RAG verification, CI parity, launch definition of done |
| `30-integrations.md` | Third-party integrations API, webhooks, tenant settings hub |
| `31-comms-and-engagement-engine.md` | Module 4 - Communications Hub: property-native sequences, triggers, tokens, phased build plan |
| `31-vcal-booking-module.md` | Module 10 - Booking: viCal (Verlox Integrated Calendar), tenant schema, Comms Hub integration, standalone spin-out |
| `32-contact-intelligence-and-lead-scoring.md` | Contact investment score model, investor profile JSONB, deal quality score, engagement tiers |
| `35-documenting-new-features.md` | Workflow: new shipped feature equals new knowledge file, index, cross-links, memory stage log |
| `36-backup-disaster-recovery.md` | Platform backups and DR: admin hub, Artisan commands, schedules, Carina briefing, restore gating |
| `37-security-posture-and-scout.md` | Security posture summary, SCOUT operations console, disclosure controls, tests |
| `40-tenant-compliance-vault-documents-ui.md` | Compliance show lists property documents; deep link to property `#vault-documents`; Blade tests |
| `05-crm.md` | Contact management (CRM) |
| `06-pipeline.md` | Deal pipeline / kanban board |
| `07-compliance.md` | Compliance tracking (certificates, licences, deadlines) |
| `33-accounting-module.md` | Module 5 - double-entry GL, journals, trial balance, API, Carina `journal_entry` context |
| `34-reporting-analytics-module.md` | Module 12 - Reporting and analytics: JSON API, tenant hub (Chart.js), exports, knowledge links |
| `08-carina.md` | Carina AI assistant - architecture, providers, RAG |
| `15-v2-prompts-business-journey-and-nav-principles.md` | Ten-phase property business journey, nav philosophy, property-native automation rule, viCal-only scheduling, Carina context caveats (from workflow prompt `50-*` in `brain/prompts/`) |
| `16-packed-kb-preamble-and-codebase-alignment.md` | Packed KB: title + **codebase alignment** table (PostgreSQL, context types, shipped vs not shipped) |
| `17-packed-kb-carina-module-prompts-1-through-7.md` | Packed KB: Prompts 1-7 (viewing, calculators, packaging, CRM/investor, compliance, automation, comms) with implementation status notes |
| `18-packed-kb-carina-user-guide-by-portal.md` | Packed KB: Carina user guide (routes, context types, incognito, best practices) |
| `19-carina-2-sections-1-3-identity-environment-read-order.md` | Carina 2.0 build prompt: identity, mission, stack, mandatory read order |
| `20-carina-2-sections-14-15-security-and-incognito.md` | Carina 2.0 build prompt: tenant isolation, roles, cross-tenant anonymisation, incognito rules |
| `21-carina-2-section-17-capability-specifications-cap-01-through-17.md` | Carina 2.0 build prompt: CAP-01 through CAP-17 (learning, brains, maths, deal engine, leads, marketing, ethics, etc.) |
| `22-carina-2-sections-18-19-output-rules-and-baseline-system-prompt.md` | Carina 2.0 build prompt: global output rules + baseline system prompt text |
| `23-carina-2-build-prompt-implementation-sections-index.md` | Index to Sections 4-13 and 20-28 in full build prompt (not duplicated here) |
| `24-carina-capabilities-reference-module-41.md` | Carina 2.0 capability reference (from former `carina2.0/41-carina-capabilities.md`) |
| `25-carina-advanced-capabilities-reference-module-42.md` | Advanced capability layer reference (from former `carina2.0/42-*`) |
| `26-carina-advanced-capabilities-reference-module-43.md` | Advanced capability layer reference (from former `carina2.0/43-*`) |
| `09-auth.md` | Platform vs tenant auth, local dev account restore, password reset, security |
| `10-tenancy.md` | Multi-tenancy system (stancl/tenancy v3.10) |
| `11-database.md` | Database schema, migrations, seeders |
| `12-ui-components.md` | Blade layouts, design tokens, `.card`/forms, Alpine components |
| `13-routes.md` | Route structure, naming conventions, middleware |
| `14-fixes.md` | Bug fixes applied during build (reference log) |
| `15-platform-admin.md` | Platform Admin Panel - User Manager, Settings, Feature Flags |
| `16-global-search-and-ui-runtime.md` | Global search, theme injection, CssVariableService scopes, dark mode, trial guard |
| `17-billing-api.md` | Stripe billing JSON API and feature flag |
| `18-carina-tavily-web-search.md` | Tavily live web search for Carina (config, Platform keys, runtime merge) |
| `19-tenant-workspace-onboarding-invitations-and-admin-api.md` | Onboarding wizard, trial page, invitations, workspace admin JSON API |
| `20-platform-carina-and-public-theme-endpoints.md` | Admin Carina (`/admin/carina`) and public `/theme/{slug}/css` endpoints |
| `21-central-workspace-self-registration.md` | `/platform/register` tenant signup and provisioning notes |
| `22-tenant-route-map.md` | Live `routes/tenant.php` map, billing on tenant, `subscription.feature` |
| `23-ai-runtime-and-provider-registry.md` | `AiRuntimeResolutionService`, `ai_providers`, tenant BYOK, usage logs, `config/ai.php` |
| `24-admin-nav-ux-audit.md` | Platform admin sidebar grouping, labels, icons (UX audit log) |
| `25-tenant-billing-ui-and-translations.md` | Dashboard billing card, checkout flash, `lang/en/billing.php` |
| `26-filament-carina-rag-admin.md` | Filament `/filament` panel, workspace tenancy middleware, RAG + Carina resources |
| `27-role-access-matrix-and-personas.md` | Personas, platform and tenant role bundles, module access matrix, implementation backlog |
| `78-carina-agentic-architecture.md` | Carina agent tool infrastructure, 12 live tools, Phase 3 destructive tools, pricing differentiation |
| `79-propreneur-features-from-ipn-bernadette.md` | Product feature ideas from Bernadette Anderson's IPN talk (development calculator, contractor mgmt, etc.) |
| `80-propreneur-ipn-pain-points-vs-existing.md` | Gap analysis: Bernadette's 9 pain points vs what Propreneur already has |
| `81-property-sourcing-manual-vs-v2-gap-analysis.md` | Sourcing Manual vs Propreneur v2 -- what's built vs what needs building |
| `82-property-sourcing-compliance-setup-detailed.md` | Sourcer business setup: company formation, AML, KYC, insurance, ICO, Credas (step-by-step) |
| `83-property-sourcing-investor-journey-crm.md` | Investor journey, CRM, Know-Like-Trust campaign, VIP £24.99 model |
| `84-property-sourcing-goldmine-research-workflow.md` | Goldmine patch research, PropertyData.co.uk, 5-min DD protocol, deal types |
| `85-property-sourcing-property-inspection-checklist.md` | Walk-through protocol, damp diagnosis, structural issues, fire doors (RAG) |
| `86-property-sourcing-selling-and-upselling.md` | Bespoke sourcing, staging, deal packaging, offer creation, payment flow |
| `87-property-sourcing-area-due-diligence.md` | PropertyData.co.uk area research workflow (professional mentorship) |
| `88-property-sourcing-video-marketing-skills.md` | Video creation for property sourcing (phone-based, delivery, framing) |
| `89-property-sourcing-engagement-skills.md` | Client engagement cadence, KLT campaign, multi-channel strategy |
| `90-property-sourcing-instagram-reels.md` | Instagram Reels creation, posting strategy, algorithm optimisation |
| `91-property-sourcing-social-media-post-strategy.md` | Social media post structure, question strategy, WIIFM, algorithm hack |
| `92-property-sourcing-social-media-branding.md` | Brand consistency across platforms, profile setup, content mix |
| `93-hmo-licensing-practical-compliance-pitfalls.md` | HMO licensing real-world pitfalls: four reports, kitchenette deception, Manchester case (RAG) |
| `94-renters-rights-act-2025-summary.md` | Renters' Rights Act 2025 effective 1 May 2026: s21 abolished, periodic tenancies, pets, rent increases |
| `95-awaabs-law-damp-mould-private-sector.md` | Awaab's Law extension to private sector by 2030: damp/mould investigation timeline |
| `99-tech-stack-comparison.md` | v1 vs v2 stack comparison; separates shipped Blade/Alpine/Tailwind v4 from optional Inertia |
| `107-property-business-journey-and-os-framework.md` | **Architectural.** Ten-phase chronological user journey, module dependency graph, recommended menu/sidebar order, gap analysis. Governs all build priorities and menu organisation. |
| `108-lead-funnel-module.md` | **Module 14 - Lead Funnel.** Marketing intake: Meta/LinkedIn/TikTok ad ingestion, OAuth, webhooks, Carina lead scoring, campaign management, automation rules, CRM sync, GDPR compliance. |

## How Carina uses this

**Two layers (do not confuse them):**

1. **This directory (`brain/knowledge/*.md`):** Canonical prose for developers and operators. **`config/ai.php`** carries the live **Carina persona** and **canonical product inventory** strings; it does not auto-import every markdown file here. The shipped Laravel app **does not** read this tree into `rag_chunks` on boot. Adding or editing a file here updates repo documentation immediately; it is **not** a substitute for tenant document ingestion unless you also mirror content into layer 2.

2. **Vector RAG (tenant DB):** Embeddings live on `rag_chunks` for rows linked to `rag_documents`. Documents are created when a workspace **uploads** a file (Filament `/filament` RAG UI or `POST` tenant RAG API), or when ops run **`php artisan rag:ingest-brain-knowledge`** (copies `brain/knowledge/*.md` into storage, tags `metadata.source = brain_knowledge`, optional `--fresh` to replace prior brain imports, `--sync` to embed inline without a queue worker). Ingestion runs `App\Jobs\Rag\ProcessDocumentJob` (or `BatchEmbeddingJob` for large files). **Pgvector once per tenant DB:** superuser `CREATE EXTENSION vector`, then **`php artisan rag:ensure-embedding-schema --tenant=<slug> --index-pending`** (or `scripts/pgvector-enable-tenant-db.sh '<db name>'`). Re-queue unindexed uploads: `php artisan rag:index-pending` (optional `--tenant=` central id). Rebuild one uploaded doc: `php artisan rag:reindex {documentId}` inside that tenant context (`tenants:run` if you use CLI without web tenancy).

**Runtime retrieval:** `CarinaService` calls `RAGService::retrieveContext()` against tenant chunks only when indexed documents exist. Chunking defaults: `config/carina.php` keys `rag.chunk_size` and `rag.chunk_overlap` (env `CARINA_RAG_CHUNK_SIZE`, `CARINA_RAG_CHUNK_OVERLAP`).
