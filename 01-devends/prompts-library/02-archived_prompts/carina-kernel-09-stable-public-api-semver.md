# Carina Kernel Phase 2: Stable public API with semver

## Goal

Define, document, and version the stable extension interfaces for domain pack authors so packs do not break on minor Carina updates.

## Context

- Interfaces to stabilize per `CARINA_AS_LINUX.md`:
  - Tool registration API
  - Skill pack manifest format (`pack.json`)
  - Channel adapter interface
  - Memory backend interface
  - Provider registration API
- Existing code:
  - Tools: `src/tools/index.ts`, tool registry
  - Packs: `src/skills/pack-loader.ts` (`PackManifest`)
  - Channels: `src/gateway/channels/`
  - Memory: `src/memory/` backends
  - Providers: `src/brain/provider-registry.ts`
- Package split from prompt `08`: public API exports from `@verlox/carina-core`

## Dependencies

`08-split-carina-core-package.md`

## Files to create

- `core.carinaai.uk/packages/core/src/public-api/index.ts` (or `src/public-api/index.ts` if not yet split)
- `core.carinaai.uk/docs/kernel/STABLE_API.md`
- `docs.carinaai.uk/docs/developer/stable-api.md`
- `core.carinaai.uk/src/public-api/compatibility.test.ts`

## Files to modify

- `core.carinaai.uk/package.json` (or `@verlox/carina-core`) `exports` field with explicit public entrypoints
- `docs.carinaai.uk/sidebars.ts`

## Step-by-step

1. Create `STABLE_API.md` documenting semver policy:

   - **Major**: breaking changes to exported interfaces below
   - **Minor**: new tools, new optional manifest fields, new channel types
   - **Patch**: bug fixes only

2. Define explicit TypeScript exports in `public-api/index.ts`:

   ```typescript
   export type { PackManifest } from '../skills/pack-loader.js';
   export { validatePackManifest } from '../skills/pack-loader.js';
   export type { ToolDefinition } from '../types/tools.js'; // adjust to real type path
   export { registerTool } from '../tools/registry.js'; // adjust to real registry API
   export type { ChannelAdapter } from '../gateway/channels/types.js';
   export type { MemoryBackend } from '../memory/backends/types.js';
   export { registerProvider } from '../brain/provider-registry.js';
   ```

   Read actual files and export only symbols that exist; add thin adapter wrappers if current APIs are internal.

3. Add `exports` in package.json:

   ```json
   "exports": {
     ".": "./dist/public-api/index.js",
     "./pack": "./dist/public-api/pack.js",
     "./tool": "./dist/public-api/tool.js",
     "./channel": "./dist/public-api/channel.js",
     "./memory": "./dist/public-api/memory.js",
     "./provider": "./dist/public-api/provider.js"
   }
   ```

4. Document each interface in `docs.carinaai.uk/docs/developer/stable-api.md` with:
   - Interface signature
   - Example minimal implementation
   - Version introduced (0.2.0)
   - Deprecation policy

5. Add `compatibility.test.ts` that:
   - Loads a fixture `pack.json` and validates against `validatePackManifest`
   - Registers a dummy tool and asserts schema round-trip
   - Fails CI if manifest required fields change without major version bump (snapshot test on manifest schema)

6. Add CHANGELOG entry template section "Public API" in `core.carinaai.uk/CHANGELOG.md` (create if missing).

7. Internal rule comment in `public-api/index.ts`:

   ```typescript
   // STABLE API: changes require semver major bump and STABLE_API.md update.
   ```

## Expected behavior

- Pack authors import from `@verlox/carina-core/pack` instead of deep `src/` paths
- Documented guarantee: minor versions do not break pack manifests or tool registration shape

## Test

```bash
cd core.carinaai.uk && pnpm test src/public-api/compatibility.test.ts
pnpm build
node -e "import('@verlox/carina-core/pack').then(m => console.log(Object.keys(m)))"
```

## Pitfalls

- Do not export entire `src/` tree; only documented entrypoints
- Channel and memory interfaces may need adapter types created if currently implicit
