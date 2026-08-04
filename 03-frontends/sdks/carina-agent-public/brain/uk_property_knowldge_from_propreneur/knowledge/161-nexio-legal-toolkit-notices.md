# Nexio Legal Toolkit - Notices (Phase 3b)

Builds on `160-nexio-shared-bills-engine.md`. Implements RRA 2025-aware possession and tenancy notices.

## RRA 2025 constraints (enforced in code)

| Rule | Implementation |
|------|----------------|
| Section 21 / Form 6A abolished for new tenancies | `draftForm6A()` guard vs `config('nexio.rra_2025_implementation_date')` |
| Section 8 + mandatory grounds primary route | `draftSection8()` with grounds catalogue |
| Ground 1A for occupation / sale | `draftGround1A()` |
| Periodic tenancies only in AST template | `AstTemplateService` - no fixed term |
| One Section 13 increase per 12 months | `assertSection13Allowed()` |

Form 6A UI labelled **Legacy - pre-RRA 2025 tenancies only** (red warning).

## Data model

Table `legal_notices`: property, room, tenancy, type, status, delivery audit fields, `grounds` jsonb, `arrears_amount`, `content_snapshot`, PDF path + SHA-256 hash.

## Services

**`LegalNoticeService`:** draft/issue/deliver all notice types; `calculateGround8Arrears()` sums unpaid rent across joint tenancy group (same room or `occupants_count` > 1).

**`AstTemplateService`:** RRA 2025 periodic AST snapshot content.

PDFs: DomPDF via `resources/views/tenant/legal/templates/*`.

## Routes (authenticated)

Under `tenant.legal.notices.*` and `tenant.legal.ast-templates.index` - registered **before** public `legal/{slug}` pages.

- `/legal/notices` - index
- `/legal/notices/create/{type}` - wizard
- `/legal/ast-templates` - AST guidance

## Config

`config/nexio.php` → `rra_2025_implementation_date` (env `RRA_2025_IMPLEMENTATION_DATE`, default `2025-10-01`).

## Tests

- `tests/Feature/Legal/Section8NoticeTest.php`
- `tests/Feature/Legal/Form6ALegacyGuardTest.php`
- `tests/Feature/Legal/Section13RateLimitTest.php`
