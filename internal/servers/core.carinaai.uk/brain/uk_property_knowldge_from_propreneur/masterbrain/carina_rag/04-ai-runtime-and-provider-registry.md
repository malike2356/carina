# AI runtime, provider registry, and usage

**Updated:** 2026-05-01

## Purpose

Carina and other AI features resolve **which API keys, models, and fallback order** to use through a layered system: `config/ai.php`, an optional **central `ai_providers` table**, and per-tenant **BYOK** rows. This file complements **`08-carina.md`** (user-facing Carina) and **`18-carina-tavily-web-search.md`** (Tavily).

## Config: `config/ai.php`

- **`default_provider`**, **`providers`**, **`priority`**: Baseline env-driven definitions. Default priority string includes `google` at the end (see `env('AI_PRIORITY', 'anthropic,groq,deepseek,openrouter,openai,google')`).
- **`google` provider** - `GOOGLE_AI_API_KEY`, OpenAI-compatible base URL at Google (`generativelanguage.googleapis.com` v1beta openai style), default model `gemini-2.0-flash`. **Carina** calls it via `callOpenAiCompat` (same as Groq, OpenAI, DeepSeek, OpenRouter); only **Anthropic** uses a separate HTTP shape.
- **`pricing_usd_per_million`**: Rough USD rates per provider (`_default` fallback) for **usage cost estimates** in dashboards, not for billing customers directly.
- **`tavily`**: See `18-carina-tavily-web-search.md`.

## Runtime resolution: `App\Services\Ai\AiRuntimeResolutionService`

`resolve(?string $tenantId)` returns an **`AiRuntimeBundle`** (providers map + ordered priority list).

1. **Base** - All keys from `config('ai.providers')` (must include a slug for every provider you intend to use, e.g. `google`).
2. **Registry overlay** - If the central table **`ai_providers`** exists, each **enabled** row with a `slug` that exists in the base map **merges** optional DB key, `default_model`, `api_base_url`, and JSON `config` (e.g. `max_tokens`, `pro_model`, `reasoner_model` for DeepSeek). Seeded slugs: `anthropic`, `openai`, `groq`, `deepseek`, `openrouter`, `google` (migration `2026_05_01_150000_create_ai_byok_tables.php`). **Platform default** provider: `is_platform_default` (seed sets Anthropic) can be changed in admin; resolution prepends that slug to priority when set.
3. **Tenant BYOK** - If `TenantByok::isEnabled($tenantId)` and a **`tenant_ai_settings`** row exists, `provider_overrides` JSON can patch per-slug keys (masked placeholders ignored). `default_ai_provider_id` can reorder priority to put the tenant’s default first.

**Priority list** is filtered to slugs that exist in the merged provider map, then optional platform-default and tenant-default prepends are applied (see `resolvePriority` in the service class).

## Central database (migration `2026_05_01_150000_create_ai_byok_tables.php`)

| Table | Role |
|-------|------|
| `ai_providers` | Registry: `slug`, `name`, `is_enabled`, `is_platform_default`, keys/URLs/models, `config` JSON |
| `tenant_ai_settings` | One row per `tenant_id`: `default_ai_provider_id`, `provider_overrides` (text/JSON) |
| `ai_usage_logs` | Telemetry: `provider_slug`, `tenant_id`, `user_id` / `platform_user_id`, tokens, `cost`, `duration_ms`, `meta` JSON |

## Platform admin UI

- **Prefix:** `/admin/ai` - names `admin.ai.*`, middleware `platform.grant:manage-platform-ai-keys` and `feature:central_platform_ai_keys_ui`.
- **Providers:** CRUD, test connection, set platform default.
- **Usage:** `GET /admin/ai/usage`, export - backed by `ai_usage_logs` / `App\Http\Controllers\Central\Admin\AiUsageController`.

## Carina execution

- **`App\Services\Carina\CarinaService`** obtains a bundle from **`AiRuntimeResolutionService`**, then walks **`priority`** until a provider with a non-empty `api_key` returns a successful completion.
- **Logging:** Invocations are recorded (tokens, model, cost estimate from `pricing_usd_per_million` where implemented) for usage views.

## Related

- `brain/knowledge/08-carina.md` - Carina product behaviour and routes.
- `brain/knowledge/11-database.md` - central schema pointers.
- `brain/knowledge/15-platform-admin.md` - `/admin/ai/*` and controllers.
- Legacy **Platform keys** UI still writes **`platform_settings`** for some keys; the registry and BYOK tables are the long-term control plane for provider identity and defaults.
