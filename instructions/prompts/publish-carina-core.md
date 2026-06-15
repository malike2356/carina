# Publish @verlox/carina-core to npm

**Working directory:** `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk`
**Monorepo publish script:** `/opt/lampp/htdocs/verlox/carina/scripts/publish-carina-agent.sh`
**Package:** `@verlox/carina-core` (v0.2.0)
**Goal:** Publish the Carina kernel to npm as `@verlox/carina-core` without requiring unpublished workspace packages at install time.

---

## Background

`@verlox/carina-core` is the root package in `core.carinaai.uk/package.json`. It is the Carina kernel: tools, memory, model routing, channels, and CLI. MIT licensed. Node `>=22`.

### pnpm workspace layout

`core.carinaai.uk/pnpm-workspace.yaml` defines:

| Package | Path | Publish? |
|---|---|---|
| `@verlox/carina-core` | `.` (workspace root) | Yes |
| `@verlox/carina-web` | `packages/web/` | Yes (optional add-on) |
| `@verlox/carina-scout` | `packages/scout-client/` | Yes (client SDK only) |
| `carina-agent` | `packages/meta-carina-agent/` | Yes (meta shim) |
| `@verlox/pack-property` | `packages/packs/property-uk/` | Yes (domain pack) |
| `@verlox/pack-health` | `packages/packs/healthcare/` | Yes (domain pack) |
| `@verlox/pack-borehole-africa` | `packages/packs/borehole-africa/` | No (`"private": true`) |

The kernel source lives at `core.carinaai.uk/src/` and `core.carinaai.uk/bin/`. There is no `packages/core/` directory.

### npm status (2026-06-15)

| Package | Registry status |
|---|---|
| `carina-agent` | Live at `0.1.1` (legacy monolith tarball) |
| `@verlox/carina-core` | Not published yet |
| `@verlox/carina-web` | Not published yet |
| `@verlox/carina-scout` | Not published yet |

The split targets `@verlox/carina-core@0.2.0` plus `carina-agent@0.2.0` as a thin meta-package shim. See `instructions/action-prompts/carina-kernel/24-publish-meta-package.md` for the meta-package follow-up.

### Why publish is blocked today

The root `build` script still chains workspace package builds:

```
"build": "... && node scripts/sync-public-api-dist.mjs && pnpm --filter @verlox/carina-web build && pnpm --filter @verlox/carina-scout build && pnpm --filter @verlox/pack-property build && pnpm --filter @verlox/pack-health build && pnpm --filter @verlox/pack-borehole-africa build"
```

Those packages are not on npm yet. Consumers of `@verlox/carina-core` must not need them at install time.

Runtime integration is already optional:

- `@verlox/carina-scout` and `@verlox/carina-web` are `peerDependencies` with `peerDependenciesMeta.optional: true`
- Scout and web load via dynamic import in `src/security/load-scout-package.ts` and `src/gateway/load-web-package.ts`
- Domain packs install separately via `carina pack install`

`devDependencies` still reference workspace packages for monorepo development and tests. They are not included in the npm tarball, but `pnpm test` and `prepublishOnly` fail if those packages are missing from the checkout.

---

## What To Do

### Step 1: Fix the build script

Open `core.carinaai.uk/package.json`.

**Change `build` to remove all `pnpm --filter @carina/*` lines.** The kernel build must compile without building sibling workspace packages:

```
"build": "node_modules/.bin/tsc && mkdir -p dist/src/security dist/src/web dist/src/skills/hub dist/src/platform && cp src/security/injection-patterns.json dist/src/security/ && cp -r src/web/pricing dist/src/web/ && cp -r src/skills/hub/public dist/src/skills/hub/ && cp src/platform/platform-knowledge.md dist/src/platform/ && node scripts/sync-public-api-dist.mjs"
```

**Keep `prepublishOnly` as-is.** It currently runs:

```
pnpm build && pnpm boundary-check && pnpm test && pnpm test:smoke && node scripts/prune-pack-dist.mjs
```

- `boundary-check` (`scripts/check-kernel-boundaries.ts`) scans kernel source for forbidden imports of Ops or Scout server code. It does not require workspace packages. Keep it.
- `prune-pack-dist.mjs` strips bundled pack sources and web UI assets from `dist/` before the tarball is created. Keep it.

### Step 2: Keep workspace devDependencies for monorepo dev

The `devDependencies` block currently has:

```json
"@verlox/carina-scout": "workspace:*",
"@verlox/carina-web": "workspace:*",
"@verlox/pack-property": "workspace:*",
"@verlox/pack-health": "workspace:*",
"@verlox/pack-borehole-africa": "workspace:*"
```

**Do not move these to `optionalDependencies`.** They are dev-only and never ship in the npm tarball. Keep them for local monorepo development.

For tests that hard-import workspace packages when unavailable, gate them instead of deleting them:

| Test file | Workspace import | Action |
|---|---|---|
| `src/tools/domain-lookup.test.ts` | `@verlox/pack-property` | Gate behind try/catch or skip when pack unavailable |
| `src/cli/commands/serve-web.test.ts` | mocks `@verlox/carina-web` | Already mocked; no change needed |
| `src/security/load-scout-package.test.ts` | tests optional `@verlox/carina-scout` | Already tests disabled path; no change needed |

### Step 3: Verify the build works standalone

From a full monorepo checkout (workspace packages present for devDeps):

```bash
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
rm -rf dist/
pnpm install
pnpm build
```

The build must succeed without invoking `pnpm --filter` for sibling packages. If `tsc` fails on a static import of a workspace package in kernel source (not tests), gate that import behind dynamic import or remove the hard dependency.

### Step 4: Verify tests pass

```bash
pnpm test
pnpm test:smoke
pnpm test:pack-contents
```

- `pnpm test` runs Vitest across the kernel (5,000+ tests as of 2026-06-10)
- `pnpm test:smoke` runs `scripts/smoke-install.sh`: builds, `npm pack`s `@verlox/carina-core`, installs the tarball in a temp dir, runs `carina --version`, `setup`, `help`, `tui`, and `doctor`
- `pnpm test:pack-contents` runs `scripts/test-pack-contents.sh`: confirms the tarball does not contain `skills/packs/`

### Step 5: Dry-run pack contents

```bash
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
pnpm build
node scripts/prune-pack-dist.mjs
npm pack --dry-run
```

Review the file list. Confirm:

- No `dist/src/skills/packs/` (removed by `prune-pack-dist.mjs`)
- No `dist/src/gateway/web/` or `dist/public/dashboard/` (also pruned)
- No Scout server code (`console.labyrinthscout.com/`)
- No Ops panel code (`ops.carinaai.uk/`)
- `dist/public-api/` IS included (stable export surface; re-exports from `dist/src/public-api/`)
- `dist/bin/carina.js` IS included (CLI entry)
- `dist/src/tools/` IS included (built-in tools)
- `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/kernel/` included per `files` array

### Step 6: Publish

**Option A: Kernel only**

```bash
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
pnpm publish --access public --no-git-checks
```

`prepublishOnly` runs build, boundary-check, test, smoke, and prune automatically.

**Option B: Full scoped split (recommended for 0.2.0 launch)**

From the monorepo root, after npm login or `NPM_TOKEN` is set:

```bash
bash /opt/lampp/htdocs/verlox/carina/scripts/publish-carina-agent.sh
```

That script builds and tests `@verlox/carina-core`, then publishes in order:

1. `@verlox/carina-core`
2. `@verlox/carina-web`
3. `@verlox/carina-scout`
4. `carina-agent` (meta-package at `packages/meta-carina-agent/`)

It does not publish `@verlox/pack-borehole-africa` (private). Publish domain packs separately when ready.

### Step 7: Verify on npm

```bash
npm view @verlox/carina-core version
npm view @verlox/carina-core dist-tags
```

Confirm `0.2.0` is live. If using the full script, also verify:

```bash
npm view carina-agent version
npm view @verlox/carina-web version
npm view @verlox/carina-scout version
```

---

## Public GitHub repo (separate from npm publish)

The public GitHub mirror is not the same directory as the meta-package.

- **Meta-package (npm shim):** `core.carinaai.uk/packages/meta-carina-agent/`
- **Public repo export target:** `../carina-agent-public/` (sibling of the monorepo), created by `bash scripts/export-carina-core-public.sh`

See `instructions/strategy/PUBLIC_REPOSITORY.md` for the export checklist. Export runs boundary-check and prune before rsync. Do not confuse the export directory with the meta-package.

---

## Rules

- Do NOT change the package name. It stays `@verlox/carina-core`.
- Do NOT change the version. It stays `0.2.0` for this publish pass.
- Do NOT modify Carina runtime behavior. The kernel must work identically after these changes.
- Do NOT remove existing tests. Gate workspace-dependent tests; do not delete them.
- The `carina-agent` meta-package at `packages/meta-carina-agent/` must continue to work after `@verlox/carina-core` is published. Publish `@verlox/carina-core` before `carina-agent@0.2.0`.
- Do NOT publish `@verlox/pack-borehole-africa` (marked `"private": true`).
- No emojis. No em-dashes. Plain ASCII.
- TypeScript strict mode. `tsc` runs as part of `pnpm build`.

---

## Files To Inspect First

- `core.carinaai.uk/package.json` - build script, `files`, `exports`, `prepublishOnly`
- `core.carinaai.uk/pnpm-workspace.yaml` - workspace package list
- `core.carinaai.uk/scripts/sync-public-api-dist.mjs` - writes `dist/public-api/*.js` re-exports
- `core.carinaai.uk/scripts/smoke-install.sh` - clean install smoke test
- `core.carinaai.uk/scripts/test-pack-contents.sh` - tarball must exclude `skills/packs/`
- `core.carinaai.uk/scripts/check-kernel-boundaries.ts` - commercial boundary guard
- `core.carinaai.uk/scripts/prune-pack-dist.mjs` - strips packs and web UI from dist before publish
- `carina/scripts/publish-carina-agent.sh` - full multi-package publish flow
- `carina/scripts/export-carina-core-public.sh` - public GitHub repo export
- `core.carinaai.uk/packages/meta-carina-agent/package.json` - `carina-agent` meta shim
- `core.carinaai.uk/src/public-api/` - stable kernel API surface
- `core.carinaai.uk/src/tools/domain-lookup.test.ts` - test that imports `@verlox/pack-property`
