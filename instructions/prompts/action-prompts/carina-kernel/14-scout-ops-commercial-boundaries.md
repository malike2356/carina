# Carina Kernel Phase 2: Scout and Ops commercial package boundaries

## Goal

Document and enforce package boundaries so `@verlox/carina-core` (MIT) never bundles Scout server or Carina Ops; optional `@verlox/carina-scout` client SDK remains the only integration surface.

## Context

- Scout server: `console.labyrinthscout.com/` (private/commercial product)
- Scout client in core: `core.carinaai.uk/src/security/scout-client.ts`
- Labyrinth Scout SDK: `labyrinth-scout-sdk/` (if exists in monorepo)
- Carina Ops: `core.carinaai.uk/src/hosted/`, `src/gateway/web/ops/`, `src/api/carina-ops-routes.ts`
- Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
- Target naming: `@verlox/carina-scout` (client), `@carina/ops` (hosted modules, not necessarily public npm)

## Dependencies

`00-lock-brand-and-boundaries.md`, `08-split-carina-core-package.md`

## Files to create

- `core.carinaai.uk/packages/scout-client/package.json` (`@verlox/carina-scout`, MIT SDK wrapping scout-client)
- `core.carinaai.uk/docs/kernel/COMMERCIAL_BOUNDARIES.md`
- `core.carinaai.uk/scripts/check-kernel-boundaries.ts` (CI guard)

## Files to modify

- `core.carinaai.uk/src/security/scout-client.ts` (move to `@verlox/carina-scout` or re-export)
- `core.carinaai.uk/package.json` / `@verlox/carina-core` (optional dependency `@verlox/carina-scout`)
- `.github/workflows/ci.yml` or local CI script (run boundary check)
- `PUBLIC_REPOSITORY.md` export ignore list (confirm Scout server excluded)

## Step-by-step

1. Write `COMMERCIAL_BOUNDARIES.md`:

   | Artifact | Package | Public npm? | License |
   |----------|---------|-------------|---------|
   | Agent kernel | `@verlox/carina-core` | Yes | MIT |
   | Scout client SDK | `@verlox/carina-scout` | Yes | MIT |
   | Scout server | `console.labyrinthscout.com` | No (Docker commercial) | Commercial |
   | Carina Ops API/UI | core hosted modules | No (SaaS) | Commercial |
   | VERLOX ops panel | `ops.carinaai.uk` | Never | Private |

2. Extract scout-client into `@verlox/carina-scout`:
   - `@verlox/carina-core` imports `@verlox/carina-scout` only when `LABYRINTH_ENABLED=true`
   - Default install of `@verlox/carina-core` does not require `@verlox/carina-scout`

3. Implement `check-kernel-boundaries.ts`:
   - Fail if `@verlox/carina-core` source imports from `ops.carinaai.uk` or `console.labyrinthscout.com`
   - Fail if `@verlox/carina-core` npm `files` includes Scout server or ops EJS views
   - Allow dynamic import of `@verlox/carina-scout`

4. CLI command stub (optional):

   ```bash
   carina scout enable   # prints: Install Scout server separately; see labyrinthscout.com
   ```

   Do NOT embed Scout server installer in core.

5. Update `03-pricing-boundary` docs to reference `COMMERCIAL_BOUNDARIES.md`.

6. Export script verification step in `scripts/export-carina-core-public.sh`:
   - Run boundary check before push

## Expected behavior

- Public kernel tarball contains zero Scout server code
- Scout integration is opt-in via env + optional `@verlox/carina-scout` package
- CI blocks boundary violations on PR

## Test

```bash
cd core.carinaai.uk
pnpm tsx scripts/check-kernel-boundaries.ts
pnpm test
grep -r "ops.carinaai.uk" packages/core/src && exit 1 || true
```

## Pitfalls

- Kill-switch listener in core is client-side; stays in `@verlox/carina-scout` or core behind flag; document clearly
- Do not open-source Scout server in this prompt
