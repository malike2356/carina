# GitHub Actions (CI)

## Symptom: every push emails “Run failed at startup”

If Actions show **startup_failure** in **0 seconds** with **no job logs**, check the run in the API or UI:

- **Bad:** `path: "BuildFailed"` — ghost workflow from an old broken `.github/workflows/test.yml` (usually unquoted `on:` parsed as YAML boolean `true`).
- **Good:** `path: ".github/workflows/pest.yml"` — current workflow.

The active workflow file is **`.github/workflows/pest.yml`** (name: **CI**).

### Fix applied (2026-05-20)

1. Removed `ci.yml` (rename did not stop the ghost hook).
2. Added fresh `pest.yml` with valid `on:` triggers and `workflow_dispatch`.
3. If emails still reference **BuildFailed**, open **Actions** → select the broken workflow → **⋯** → delete/disable, or ignore until GitHub clears the stale registration.

### Billing (private repo)

`malike2356/propreneur-v2` is **private**. Free accounts include **2,000 Actions minutes/month**. If minutes are exhausted and no payment method is on file, runs can fail before jobs start. Check: [GitHub billing → Actions](https://github.com/settings/billing).

## Local parity

```bash
# Same Postgres + pgvector assumptions as CI
php artisan test
```

See `CLAUDE.md` and `phpunit.xml` for the local testing database.
