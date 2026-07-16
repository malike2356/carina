---
source: `brain/prompts/08-carina-2-0-complete.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

## SECTION 1 - IDENTITY & MISSION

You are building **Carina** - the operating intelligence of **Propreneur v2.0**, a property entrepreneur operating system. Carina is not a chatbot feature. Carina is a background orchestration layer woven into every module of the platform. She surfaces insight, automates drudgery, enforces data boundaries, and reduces the cognitive load of running a property business.

**Core build principle:** Every Carina capability must reduce user effort by ≥60% compared to doing the task manually. Minimum input. Maximum output.

You will now implement Carina 2.0 in full. Everything in this prompt must be implemented. Nothing here is a suggestion. Nothing is deferred unless explicitly labelled FUTURE CAPABILITY.

---

## SECTION 2 - WORKING ENVIRONMENT

### Root Application Path

```
./ (this repository root)
```

### Brain Directory Tree

```
brain/
├── Carina_AI_2.0_Master_Specification.md     ← Full architecture reference
│
├── knowledge/                                 ← Platform knowledge modules (READ, don't modify)
│   ├── 00-README.md
│   ├── 01-architecture.md
│   ├── 02-dashboard.md
│   ├── 03-properties.md
│   ├── 04-deals.md
│   ├── 05-crm.md
│   ├── 06-pipeline.md
│   ├── 07-compliance.md
│   ├── 08-carina.md                           ← Primary Carina knowledge
│   ├── 09-auth.md
│   ├── 10-tenancy.md
│   ├── 11-database.md
│   ├── 12-ui-components.md
│   ├── 13-routes.md
│   ├── 14-fixes.md
│   ├── 15-platform-admin.md
│   ├── 16-global-search-and-ui-runtime.md
│   ├── 17-billing-api.md
│   ├── 18-carina-tavily-web-search.md         ← Tavily web search integration
│   ├── 19-tenant-workspace-onboarding-invitations-and-admin-api.md
│   ├── 20-platform-carina-and-public-theme-endpoints.md
│   ├── 21-central-workspace-self-registration.md
│   ├── 22-tenant-route-map.md
│   ├── 23-ai-runtime-and-provider-registry.md ← AI provider / BYOK registry
│   ├── 24-admin-nav-ux-audit.md
│   ├── 25-tenant-billing-ui-and-translations.md
│   ├── 99-tech-stack-comparison.md
│   └── 01-template-knowledge-entry.md
│
├── masterbrain/                               ← Carina's long-term knowledge store
│   ├── accounting/
│   ├── algorithms/
│   ├── Carina_RAG/                            ← RAG vector store and embeddings
│   ├── contacts/
│   ├── deals/
│   ├── document_vault/
│   ├── genius/
│   │   └── brains/                            ← Brain modifier prompt files (CREATE THESE)
│   ├── investor/
│   ├── leads/
│   ├── legal/
│   │   └── ethics-flags.log                   ← Ethics violation log (CREATE IF MISSING)
│   ├── marketing/
│   ├── process_and_workflow/
│   ├── sales/
│   └── verification/
│
└── prompts/                                   ← Build prompt files (READ, don't modify)
    ├── 01-foundation-multitenancy.md
    ├── 02-foundation-authentication.md
    ├── 03-user-manager.md
    ├── 04-feature-flags.md
    ├── 05-system-settings.md
    ├── 06-ai-provider-byok.md
    ├── 07-carina-core.md                      ← Carina Core build spec
    ├── 08-carina-rag.md                       ← RAG Pipeline build spec
    ├── 09-deal-property.md
    ├── 10-deal-calculators.md
    ├── 11-deal-sourcing.md
    ├── 12-crm-contacts.md
    ├── 13-pipeline-kanban.md
    ├── 14-compliance.md
    ├── 15-billing.md
    ├── 16-integrations.md
    ├── 17-community-learning.md
    ├── 18-reporting-analytics.md
    ├── 19-mobile-api.md
    ├── 20-data-migration.md
    ├── 21-backup-disaster-recovery.md
    ├── 22-audit-logging.md
    ├── 23-search-infrastructure.md
    ├── 24-webhook-system.md
    ├── 25-queue-monitoring.md
    ├── 26-api-security.md
    ├── 27-tenant-onboarding.md
    ├── 28-health-monitoring.md
    ├── 29-localization.md
    ├── 30-gdpr-compliance.md
    ├── 31-waitlist-marketing.md
    ├── 32-api-documentation.md
    ├── 33-maintenance-commands.md
    ├── 34-ui-ux-frontend.md
    ├── 35-propbook-booking.md
    ├── 36-document-management.md
    ├── 37-staff-management.md
    ├── 38-investor-portal.md
    ├── 39-theme-presets.md
    ├── 40-repository-setup.md
    └── readme-prompts.md
```

### Tech Stack

**Propreneur v2 application (`propreneur-v2`):** tenant and platform UI currently ship as **Blade + Alpine + Tailwind v4 + design tokens** (see `brain/knowledge/12-ui-components.md`). Treat **Inertia.js + React** below as **Carina 2.0 product vision / optional SPA layer**, not the default MIS frontend today.

| Layer | Technology |
|---|---|
| Backend | Laravel 11+ (`propreneur-v2`: Laravel 12) |
| Admin Panel | Filament 3 |
| Frontend | Blade + Alpine + tokens (shipped MIS); Inertia.js + React (optional / Carina-heavy SPA targets) |
| Mobile | React Native |
| Database | PostgreSQL + pgvector extension |
| Cache / Queue | Redis (tag-based invalidation) |
| AI Providers | Multi-provider BYOK - ref `prompts/06-ai-provider-byok.md` + `knowledge/23-ai-runtime-and-provider-registry.md` |
| Streaming | Server-Sent Events (SSE) |
| Prompt Caching | DeepSeek V4 - 90% token cost reduction on system prompt reuse |
| Web Search | Tavily - ref `knowledge/18-carina-tavily-web-search.md` |
| Image Generation | DALL-E 3 (primary), Stable Diffusion (fallback) |
| Social Scheduling | Zapier / Make webhook → Buffer / Later / native platform APIs |
| Vector Storage | pgvector (PostgreSQL extension - must be enabled before RAG migrations run) |

---

## SECTION 3 - MANDATORY READ ORDER

Read every file in this list before writing a single line of code. Do not skip any. Each file informs the one after it. Confirm you have read each before proceeding.

```
 1. prompts/01-foundation-multitenancy.md
 2. prompts/02-foundation-authentication.md
 3. prompts/03-user-manager.md
 4. prompts/04-feature-flags.md
 5. prompts/05-system-settings.md
 6. prompts/06-ai-provider-byok.md
 7. knowledge/10-tenancy.md
 8. knowledge/09-auth.md
 9. knowledge/15-platform-admin.md
10. knowledge/01-architecture.md
11. knowledge/11-database.md
12. knowledge/13-routes.md
13. knowledge/22-tenant-route-map.md
14. knowledge/23-ai-runtime-and-provider-registry.md
15. knowledge/08-carina.md
16. knowledge/18-carina-tavily-web-search.md
17. prompts/07-carina-core.md
18. prompts/08-carina-rag.md
19. prompts/09-deal-property.md
20. prompts/10-deal-calculators.md
21. prompts/11-deal-sourcing.md
22. prompts/12-crm-contacts.md
23. prompts/22-audit-logging.md
24. prompts/26-api-security.md
25. prompts/30-gdpr-compliance.md
```

