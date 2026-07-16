# Carina Tavily web search

**Updated:** 2026-04-30

## Purpose

Optional **live web context** for Carina (tenant chat and deal narrative paths). Implemented by `App\Services\Carina\TavilyWebSearchService`; consumed from `App\Services\Carina\CarinaService`. API reference: https://docs.tavily.com

## Configuration layers

1. **Central `platform_settings` (preferred for secrets)** - AI group keys written from **Admin → Platform keys → AI and Carina**:
   - `tavily_api_key` (encrypted)
   - `carina_tavily_enabled` (boolean)
   - `carina_tavily_trigger` - `keywords` or `every_message`
   - `tavily_search_depth` - `basic` or `advanced`
   - `tavily_max_results` - integer 1 to 10
2. **`config/ai.php` `tavily` array** - defaults and fallbacks (`CARINA_TAVILY_*`, `TAVILY_*` env vars). Used when DB rows are missing or for keyword list / timeouts / char limits not yet exposed in the admin form.
3. **Runtime merge** - `App\Providers\AppServiceProvider` overwrites `config('ai.tavily.*')` from loaded `PlatformSetting` rows when the central table exists (see private `tavily*` helpers there).

## Behaviour

- If `ai.tavily.enabled` is false or no API key resolves, Tavily is skipped.
- **Trigger `keywords`:** search runs when the user message matches configured keyword triggers, a calendar year pattern, or a URL-like token (see `TavilyWebSearchService`).
- **Trigger `every_message`:** higher Tavily usage; use with care.

## Tests

- Feature: `tests/Feature/PlatformSettingsTavilyTest.php` (persist from platform keys form).
- Unit: `tests/Unit/Services/Carina/TavilyWebSearchServiceTest.php`.

## Related

- `brain/knowledge/08-carina.md` - Carina overview.
- `brain/knowledge/15-platform-admin.md` - Platform keys UI and `platform_settings` key list.
