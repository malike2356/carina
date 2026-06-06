# Tenant Business Page / Micro-Site CMS

Business Edition workspaces can publish a public landing page at `{slug}.propreneur.co.uk/site` (local: `{slug}.propreneur.test/site`) without a separate website builder.

## Data model

- **Table:** `business_page_settings` (tenant DB, single row per workspace)
- **Model:** `App\Models\Tenant\BusinessPageSettings`
- **Service:** `App\Services\BusinessPage\BusinessPageService`

## Routes

| Method | Path | Name | Auth |
|--------|------|------|------|
| GET | `/site` | `tenant.business-page.show` | Public |
| GET | `/settings/business-page` | `tenant.settings.business-page.edit` | Workspace admin |
| PUT | `/settings/business-page` | `tenant.settings.business-page.update` | Workspace admin |
| POST | `/settings/business-page/publish` | `tenant.settings.business-page.publish` | Workspace admin |
| POST | `/settings/business-page/unpublish` | `tenant.settings.business-page.unpublish` | Workspace admin |
| GET | `/settings/business-page/preview` | `tenant.settings.business-page.preview` | Workspace admin |

## Sections (public page)

Rendered only when content is non-empty: hero (headline, subheading, CTA, logo), about (`about_html`), services (JSON array, max 12), contact (email, phone, address), social links (LinkedIn, Instagram, YouTube, Facebook). Footer: Powered by Propreneur; legal links `/legal/privacy_policy` and `/legal/terms_of_service`.

## Admin UI

- **Settings sidebar:** Business Page (badge "Not published" when `published` is false)
- **Dashboard callout:** Shown to workspace admins until first publish (`published_at` is null)
- **Editor:** `resources/views/tenant/settings/business-page/edit.blade.php` (Alpine.js services repeater)

## Feature gating

- **Edition:** `business_page_cms` in `config/edition.php` `business_edition_modules`
- **Feature flag:** `business_page_cms` in `PlatformFeatureCatalogue`
- **Billing module:** `BillingModule::BusinessPageCms` (`business_page_cms`)

## Tests

`tests/Feature/BusinessPage/BusinessPageTest.php` - public `/site`, admin CRUD, publish/unpublish, preview, non-admin 403, services JSON, legal footer links.

## Prompt

Spec: `brain/prompts/140-tenant-business-page-cms.md`
