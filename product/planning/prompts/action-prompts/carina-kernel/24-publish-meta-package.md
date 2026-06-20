# Carina Kernel: Publish meta package and update ABBIS pin

## Goal

Bump `packages/meta-carina-agent/` to version `0.2.0`, publish it to npm as
`carina-agent@0.2.0`, and update the ABBIS distro to pin the new version. This closes
the transition from the old monolith `carina-agent@0.1.1` to the new split
`@verlox/carina-core@0.2.0 + carina-agent@0.2.0` architecture.

## Context

The package split (prompt 08) created two packages:
- `packages/@verlox/carina-core/` at version `0.2.0` - the actual kernel code (MIT)
- `packages/meta-carina-agent/` - a thin meta-package that re-exports `@verlox/carina-core`
  so that distros pinning `carina-agent` continue to work without code changes

The meta-package is the backwards-compatible shim. It is what ABBIS imports via
`carina-agent`. Once it is published at `0.2.0`, ABBIS can update its lockfile and get
the new kernel automatically.

## Dependencies

Prompt 23 (all tests passing). Do not publish with failing tests.

## Files to modify

```
core.carinaai.uk/packages/meta-carina-agent/package.json   bump version 0.1.1 -> 0.2.0
abbis/apps/carina/package.json                              bump pin 0.1.1 -> 0.2.0
abbis/pnpm-lock.yaml                                        re-run pnpm install to update
```

## Step-by-step

### 1. Confirm tests pass

```bash
cd core.carinaai.uk
pnpm test
# All 7891 tests must pass before proceeding
```

### 2. Verify the meta-package structure

Read `packages/meta-carina-agent/package.json`. Confirm:
- `"name": "carina-agent"` (no scope; this is what distros install)
- `"version": "0.1.1"` (will be bumped to `0.2.0`)
- `"peerDependencies"` or `"dependencies"` include `"@verlox/carina-core": "0.2.0"`
- `"publishConfig": { "access": "public" }`
- `"main"` and `"exports"` point to the built output that re-exports `@verlox/carina-core`

Read `packages/meta-carina-agent/src/index.ts`. Confirm it is:
```typescript
export * from '@verlox/carina-core';
```
or equivalent. If additional re-exports are needed for the Carina entry points
(`createCarinaAgent`, `startWeb`, `initSandbox`, `initRouter`), add them now:
```typescript
export * from '@verlox/carina-core';
export { createCarinaAgent } from '@verlox/carina-core/agent.js';
```

### 3. Bump meta-package version

Edit `packages/meta-carina-agent/package.json`:
- `"version": "0.2.0"`
- `"dependencies": { "@verlox/carina-core": "0.2.0" }` (exact, no `^`)

### 4. Build the meta-package

```bash
cd core.carinaai.uk/packages/meta-carina-agent
pnpm build
```

Confirm no TypeScript errors. The build must succeed.

### 5. Dry-run publish

```bash
cd core.carinaai.uk/packages/meta-carina-agent
npm publish --dry-run
```

Review the list of files that will be published. Confirm:
- Source TypeScript is NOT included (only `dist/`)
- `package.json` is included
- `.env` is NOT included (it should never be; double-check `.npmignore`)

### 6. Publish to npm

```bash
npm publish --access public
```

Verify the publication:
```bash
npm view carina-agent version
# Should print: 0.2.0
```

### 7. Update ABBIS pin

In the ABBIS repository at `/opt/lampp/htdocs/verlox/abbis/`:

Edit `apps/carina/package.json`:
```json
{
  "dependencies": {
    "carina-agent": "0.2.0"
  }
}
```

No caret, no tilde. Exact version.

Then update the lockfile:
```bash
cd /opt/lampp/htdocs/verlox/abbis
pnpm install
```

Commit both files:
```bash
git add apps/carina/package.json pnpm-lock.yaml
git commit -m "chore(carina): update carina-agent pin to 0.2.0"
```

### 8. Run ABBIS tests

```bash
cd /opt/lampp/htdocs/verlox/abbis
pnpm test
# All 6 distro tests must still pass
```

If any test fails after the version bump, read the error. Common cause: the meta-package
export paths changed, breaking the internal import paths in `apps/carina/src/index.ts`.
If that file uses `import('carina-agent/dist/src/gateway/router.js')` style paths, check
whether the built output structure changed. Update the import paths accordingly.

## Expected outcome

```bash
npm view carina-agent
# name: carina-agent
# version: 0.2.0
# description: Meta-package for Carina AI kernel - install this in your distro
# ...

cat abbis/apps/carina/package.json | grep carina-agent
# "carina-agent": "0.2.0"
```

## Pitfalls

- Only publish after all 7891 kernel tests pass. A broken publish cannot be deleted from
  npm (only unpublished within 72 hours, and that breaks the supply chain for anyone who
  already installed it)
- If `@verlox/carina-core` has not been published at `0.2.0` yet (prompt 08 output), publish it
  first before publishing the meta-package
- The `npm publish` command must be run as a user with publish access to the `carina-agent`
  package. Confirm login with `npm whoami`
- Commit the ABBIS lockfile change. A lockfile without the pin commit means the next
  `pnpm install` on the server could silently diverge
