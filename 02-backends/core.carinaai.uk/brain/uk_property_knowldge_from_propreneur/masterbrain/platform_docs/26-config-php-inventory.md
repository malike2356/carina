# Config PHP inventory (`config/*.php`)

**Last updated:** 2026-05-14 (added: `lead_funnel`, `edition`, `calculators`, `accounting_*`, `platform_scheduler`, `prop_ai_market_intelligence`, `carina_ui_help`, `workspace_automation`, `vcal`, `remote_access`, `scout`, `reporting`, `community_learning`, `permission`, `platform_permissions`, `theme_tokens`, `listings`, `v1_migration`, `market_intelligence`)  
**Purpose:** Map configuration files to product areas so Carina and operators know where toggles live. **Do not** paste secret values from `.env` into tickets; this list names keys only.

**Local template:** copy **`.env.example`** to `.env` and set values; generate `APP_KEY` with `php artisan key:generate`.

| File | Topics |
| --- | --- |
| `app.php` | App name, env, URL, timezone, service providers |
| `ai.php` | Default provider, `AI_PRIORITY`, embedding model, `AI_EMBEDDING_PROVIDER_PRIORITY`, per-provider keys (`ANTHROPIC_*`, `OPENAI_*`, `GROQ_*`, `DEEPSEEK_*`, `OPENROUTER_*`, `GOOGLE_AI_*`), Tavily block (`TAVILY_*`, `CARINA_TAVILY_*`), `carina_persona`, `carina_product_inventory` |
| `auth.php` | Guards `web` / `platform`, password brokers |
| `backup.php` | Retention, encryption, Slack webhook (`BACKUP_SLACK_WEBHOOK_URL`), destinations |
| `billing.php` | Stripe keys (`STRIPE_*` / `STRIPE_BILLING_*`), price IDs, module sets (`starter`, `operator`, `mentor`, `trial_expanded`), checkout paths, trial banner, `plans` catalogue rows |
| `cache.php`, `session.php`, `queue.php`, `horizon.php` | Infra |
| `calculators.php` | Deal calculator defaults, SDLT rates, HMO room factors, refurb cost bands |
| `carina.php` | `CARINA_RATE_*`, RAG chunk size and overlap (`CARINA_RAG_*`), max documents, hybrid score, embedding dimensions, conversation retention, `masterbrain_path`, training options (OCR, ClamAV, ZIP limits, PDF fallback) |
| `carina_ui_help.php` | Inline help text strings for Carina UI pages |
| `community_learning.php` | Community module toggles, course/quiz defaults |
| `database.php` | `central` and `tenant` connections |
| `edition.php` | `PROPRENEUR_EDITION` (`community` / `business`), edition labels, business edition module ownership list, upgrade message |
| `filesystems.php` | Disks (local, s3, etc.) |
| `integrations.php` | Provider registry, sync behaviour, webhook event catalogue |
| `lead_funnel.php` | `META_*`, `LINKEDIN_*`, `TIKTOK_*` app credentials, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `oauth_state_ttl_seconds`, hot/dead lead score thresholds |
| `listings.php` | Listing import drivers (`url` / `partner` / `chain`), partner auth (`LISTINGS_PARTNER_AUTH_SCHEME`), licensed **batch** ingestion (`LISTINGS_FEED_*`), commercial programme placeholders (`LISTINGS_RIGHTMOVE_RTDF_*`, `LISTINGS_ZOOPLA_PARTNER_*`, `LISTINGS_OTM_*`, aggregator), webhook signing, listing automation (watch scheduler, delay, max URLs) |
| `logging.php` | Log channels |
| `mail.php` | Mailer |
| `market_intelligence.php` | PropertyData research hub tool cards, workspace shortcuts, research site URL |
| `permission.php` | Spatie table names and column names (tenant vs platform separation) |
| `platform_permissions.php` | Central admin permission catalogue |
| `platform_scheduler.php` | Platform job scheduler DB connection settings |
| `prop_ai_market_intelligence.php` | Prop AI market intelligence provider config |
| `remote_access.php` | SCOUT remote access session TTLs and rules |
| `reporting.php` | Reporting module defaults, digest recipients, Chart.js themes |
| `scout.php` | SCOUT security scanner settings, patch scan, SAST configuration |
| `services.php` | Third-party service roots |
| `tenancy.php` | Central connection, tenant database naming, domain middleware |
| `theme_tokens.php` | Design token numerics for UI runtime (spacing, border-radius, font sizes) |
| `v1_migration.php` | Legacy MySQL connection and safety toggles, chunk sizes |
| `vcal.php` | viCal booking defaults (duration, lead time, cancellation window, reminder timing) |
| `workspace_automation.php` | Stale stage days and caps, trigger catalog |
| `accounting_external_ledgers.php` | External accounting integration provider registry (Xero, QuickBooks, FreeAgent, Sage, Zoho) |
| `accounting_oauth_ui.php` | Accounting OAuth UI configuration |

## Runtime merge

Some AI keys merge from **central DB** (`platform_settings`, `ai_providers`, tenant BYOK) over env. See `23-ai-runtime-and-provider-registry.md`.

## Related
- `59-carina-propreneur-full-codex.md` - product truth and BillingModule links
- `23-ai-runtime-and-provider-registry.md` - AI provider resolution
- `01-architecture.md` - stack overview
