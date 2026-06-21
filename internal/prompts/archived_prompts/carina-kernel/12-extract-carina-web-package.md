# Carina Kernel Phase 2: Extract @verlox/carina-web package

## Goal

Extract the web gateway and dashboard into an optional `@verlox/carina-web` package installable separately from `@verlox/carina-core`.

## Context

- Target from `CARINA_AS_LINUX.md`: `@verlox/carina-web` = web gateway + dashboard
- Current locations:
  - `core.carinaai.uk/src/gateway/web.ts`
  - `core.carinaai.uk/src/gateway/web/` (static assets)
  - `core.carinaai.uk/public/dashboard/`
  - Ops customer UI `src/gateway/web/ops/` stays coupled to hosted product; may remain in core behind feature flag OR move to separate `@carina/ops-ui` later (out of scope except note)
- Build copies web assets in `package.json` `build` script

## Dependencies

`08-split-carina-core-package.md`

## Files to create

- `core.carinaai.uk/packages/web/package.json` (`name: @verlox/carina-web`)
- `core.carinaai.uk/packages/web/src/index.ts` (exports `createWebGateway()` or similar)

## Files to modify

- `core.carinaai.uk/pnpm-workspace.yaml`
- `core.carinaai.uk/packages/core/package.json` (optional peer dependency `@verlox/carina-web`)
- `bin/carina.ts` `serve` subcommand: load `@verlox/carina-web` if installed, else print install hint
- Root/build scripts

## Step-by-step

1. Move or reference (via TypeScript project references):
   - `src/gateway/web.ts` and `src/gateway/web/` static tree into `packages/web/`
   - `public/dashboard/` into `packages/web/public/`

2. `@verlox/carina-web` exports:

   ```typescript
   export function createWebServer(options: WebGatewayOptions): ExpressApp;
   export const WEB_ASSET_DIR: string;
   ```

3. `@verlox/carina-core` must start without `@verlox/carina-web` installed:
   - `carina chat` works
   - `carina serve` checks for `@verlox/carina-web`; if missing:

     ```text
     Web UI not installed. Run: npm install @verlox/carina-web
     ```

4. `@verlox/carina-web` depends on `@verlox/carina-core` for session/agent wiring (peer dependency).

5. Update `docker-compose.prod.yml` image to install both packages for full stack deployments.

6. Document in README:

   ```bash
   npm install -g @verlox/carina-core @verlox/carina-web
   carina serve
   ```

7. Vitest: core-only mode does not import web package (dynamic import test).

## Expected behavior

- Minimal kernel install has no web UI tarball bloat
- Full install matches today's behavior

## Test

```bash
cd core.carinaai.uk/packages/core && pnpm test
pnpm carina serve   # with @verlox/carina-web linked
```

- `npm pack @verlox/carina-core` size decreases vs pre-split baseline (record in PR description)

## Pitfalls

- Build script asset copying must move to `@verlox/carina-web` package build
- Do not break hosted mode on app.carinaai.uk; integration test hosted web entry
