# Legal pages CMS (platform and workspace)

**Shipped:** 2026-05-17 (prompt `139-legal-pages-cms.md`)

## Purpose

Public privacy policy, terms, cookie policy, acceptable use, and subscription refund pages for GDPR and Stripe go-live. Separate from the **Help Center** (`HelpArticle` / `/help`), which is product documentation synced from `resources/docs/help/`.

## Platform (central)

- **Tables:** `legal_documents`, `legal_document_acceptances` (central connection).
- **Public URLs** (central domains only): `/legal`, `/legal/{slug}`; redirects `/privacy`, `/terms`, `/cookies`, `/acceptable-use`, `/refunds`.
- **Admin CMS:** `/admin/legal` - create, edit, publish, unpublish; HTML in a plain textarea (no WYSIWYG).
- **Seeder:** `Database\Seeders\Central\LegalDocumentSeeder` - five placeholder slugs, `published = false` until legal team pastes real content.
- **Models:** `App\Models\Central\LegalDocument`, `LegalDocumentAcceptance`; helper `requiresAcceptanceBy()` for version tracking (middleware enforcement deferred).

## Workspace (tenant)

- **Tables:** `legal_documents`, `legal_document_acceptances` (tenant DB).
- **Public URLs:** `{slug}.{tenant_base_domain}/legal`, `/legal/{slug}`.
- **Admin:** Settings → **Legal** (`/settings/legal`) for workspace admins.
- **Models:** `App\Models\Tenant\TenantLegalDocument`, `TenantLegalDocumentAcceptance`.

## UI

- Platform sidebar: Configuration → **Legal**.
- Tenant sidebar: Settings → **Legal**.
- Login footers (platform and tenant): Privacy | Terms | Cookies via `partials/legal-footer-links`.

## Tests

`tests/Feature/Legal/LegalPagesTest.php` - public routes, redirects, platform admin CRUD, tenant admin publish, tenant public index.

## Operator notes

1. Run central migration and `php artisan db:seed --class=Database\\Seeders\\Central\\LegalDocumentSeeder`.
2. Run `php artisan tenants:migrate` so existing workspaces get tenant legal tables.
3. Publish each document from platform admin when copy is ready; unpublished docs return 404 to the public.
