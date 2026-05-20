# GitHub Actions (CI)

## Symptom: every push emails “Run failed at startup”

Two separate problems were found on **2026-05-20**:

### 1. Ghost workflow (`BuildFailed`)

The first `test.yml` used unquoted `on:` (YAML 1.1 treats that as boolean `true`). GitHub registered workflow id **274831299** with `path: "BuildFailed"`. **Pushes still trigger that ghost**, even after the file was renamed or removed.

- Commits with **no** files under `.github/workflows/` do **not** trigger a run (no email).
- Any commit that **adds** a workflow file may trigger the ghost again on `push`.

Clearing the ghost fully may require GitHub support, or time after the broken workflow is gone from the default branch.

### 2. Account / billing block (real `pest.yml` workflow)

Manual runs of workflow **CI** (`pest.yml`, id **280523311**) also end in **startup_failure** with **0 jobs** — the workflow file is valid (actionlint passes), but GitHub never starts a runner.

For **private** repos, this usually means:

- **Actions minutes used up** for the billing cycle, and/or  
- **No valid payment method** on the account ([billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions))

Check: [https://github.com/settings/billing](https://github.com/settings/billing) → Actions usage / payment method.

**Until billing is fixed:** `pest.yml` is **`workflow_dispatch` only** (no `push`/`pull_request`) to avoid extra failed push notifications. Run manually when ready:

```bash
gh workflow run CI --repo malike2356/propreneur-v2 --ref main
```

After billing works, re-enable in `pest.yml`:

```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
  workflow_dispatch:
```

### Workflow file

**`.github/workflows/pest.yml`** (workflow name: **CI**).

## Local parity

```bash
# Same Postgres + pgvector assumptions as CI
php artisan test
```

See `CLAUDE.md` and `phpunit.xml` for the local testing database.
