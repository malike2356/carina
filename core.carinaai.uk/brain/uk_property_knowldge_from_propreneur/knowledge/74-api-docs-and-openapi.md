# API documentation and OpenAPI

## Overview

Propreneur v2 exposes a machine-readable OpenAPI 3.1 spec generated from registered Laravel routes (no controller annotations).

**Who may use the API:** Operator plan and above only (not Investor). See `brain/knowledge/103-workspace-api-access-policy.md` and `config/billing.php` → `api_access`.

| Item | Location |
|------|----------|
| Contract + mobile status map | `config/api_docs.php` |
| Living mobile contract | `brain/prompts/19-mobile-api.md` |
| Generator command | `php artisan api:docs:build` |
| CI drift check | `php artisan api:docs:build --check` |
| Generated artifact | `storage/app/api-docs/openapi.json` (gitignored) |
| Swagger UI (platform admin) | `/admin/api-docs` |
| Raw JSON | `/admin/api-docs/openapi.json` |

## Regenerate locally

```bash
php artisan api:docs:build
php artisan api:docs:build --check   # fails if new /api/v1/mobile/* routes lack config/api_docs.php rows
```

## Three-way sync

When adding a mobile endpoint:

1. Register route in `routes/tenant/mobile_*.php`
2. Add row to `brain/prompts/19-mobile-api.md` with `[mobile: pending]` or `[mobile: done]`
3. Add `METHOD:/uri` key to `config/api_docs.php` `mobile_status`

## Services

- `App\Services\ApiDocs\RouteCollector` - filters routes by name/URI prefixes
- `App\Services\ApiDocs\OperationBuilder` - builds operations + `x-mobile-status`
- `App\Services\ApiDocs\SchemaInferrer` - best-effort FormRequest to JSON Schema
- `App\Services\ApiDocs\OpenApiSpec` - assembles and writes the document

## Tests

`tests/Feature/ApiDocs/ApiDocsGeneratorTest.php`
