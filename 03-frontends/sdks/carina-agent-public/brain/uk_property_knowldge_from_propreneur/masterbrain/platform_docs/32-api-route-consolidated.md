# HTTP route knowledge (index)

**Generated:** `scripts/build-route-knowledge.py` (stable for CI `git diff`; no timestamps).

**Purpose:** Point Carina and humans to split route tables so RAG chunks stay smaller and reviews stay focused. **No secrets** belong in these files (URIs and named routes only).

## Regenerate locally

```bash
php artisan route:list --json | python3 scripts/build-route-knowledge.py
```

## Route counts

| Scope | File | Approx. rows |
| --- | --- | --- |
| Tenant subdomain (`tenant.*`, `tenant.api.*`) | `66-api-routes-tenant-subdomain.md` | 588 |
| Central admin, platform auth, Filament, other API | `67-api-routes-central-filament-misc.md` | 384 |
| **Total** | | **972** |

## CI drift check

Pull requests run `.github/workflows/test.yml` which regenerates these three files and fails if `git diff` is non-empty. Commit regenerated markdown whenever routes change.

## Related

- `22-tenant-route-map.md`, `13-routes.md`
- `59-carina-propreneur-full-codex.md`
