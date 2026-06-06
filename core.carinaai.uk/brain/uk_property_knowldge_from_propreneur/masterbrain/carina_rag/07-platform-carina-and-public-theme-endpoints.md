# Platform Carina (admin) and public theme endpoints

**Updated:** 2026-04-30

## Purpose

Two surfaces that are easy to miss in module docs: **platform users chatting with Carina** from the central admin host, and **unauthenticated theme asset URLs** used for caching or embeds.

## Platform admin Carina

- **Routes:** `routes/web.php` inside `admin` prefix, middleware `feature:carina_ai` and `platform.grant:use-platform-carina`.
- **Prefix / names:** `admin.carina.*`
- **Controller:** `App\Http\Controllers\Central\Admin\PlatformCarinaController`
- **Model:** `App\Models\Central\PlatformCarinaConversation` (central DB; scoped to `platform_user_id`).
- **Service:** Reuses `App\Services\Carina\CarinaService` for message handling (same provider chain as tenant Carina; see `brain/knowledge/08-carina.md`).
- **UI:** `resources/views/central/admin/carina/*` (list, thread, forms).

## Public theme CSS and variables (central domain)

**Controller:** `App\Http\Controllers\ThemeCssController`  
**Registration:** `routes/web.php` **outside** the `admin` auth group (no session required).

| Method | Path | Name | Response |
|--------|------|------|----------|
| GET | `/theme/{tenantSlug}/css` | `theme.public.css` | `text/css` - `:root` CSS block for the tenant resolved by **central** `tenants.slug` |
| GET | `/theme/{tenantSlug}/variables` | `theme.public.variables` | JSON `{ "variables": { ... } }` |

- **Slug constraint:** `[a-z0-9]+(?:-[a-z0-9]+)*` (see route `where`).
- **Implementation:** `App\Services\Theme\Contracts\TenantThemeServiceInterface` (`getCssBlockForTenant`, `getCssVariablesForTenant`). Used for CDN-friendly caching (`Cache-Control: public, max-age=300` on CSS).

## Related

- `brain/knowledge/08-carina.md` - tenant Carina and providers.
- `brain/knowledge/15-platform-admin.md` - admin URL map.
- `brain/knowledge/16-global-search-and-ui-runtime.md` - theme injection in layouts.
