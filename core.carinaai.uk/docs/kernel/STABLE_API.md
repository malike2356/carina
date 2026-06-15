# Stable public API (semver)

`@verlox/carina-core` exposes a documented, semver-governed surface for domain pack authors and extension developers.

**Introduced:** 0.2.0 (June 2026)

## Policy

| Bump | When |
|------|------|
| **Major** | Breaking change to any stable export listed below |
| **Minor** | New optional fields, new tools, new channel types, new provider hooks |
| **Patch** | Bug fixes only; no shape changes |

Breaking changes require:

1. Major version bump in `package.json`
2. Accepted RFC in `docs/rfc/` (see [RFC process](https://carinaai.uk/docs/developer/rfc-process))
3. Update this file and `CHANGELOG.md` Public API section
4. Migration notes in `docs.carinaai.uk/docs/developer/stable-api.md`

## Entrypoints

Import only from documented paths. Deep imports from `dist/src/` are not supported.

| Import path | Purpose |
|-------------|---------|
| `@verlox/carina-core` | Barrel re-export |
| `@verlox/carina-core/pack` | `pack.json` manifest, validation, pack resolution |
| `@verlox/carina-core/tool` | Tool registration and `Tool` type |
| `@verlox/carina-core/channel` | `ChannelAdapter` (`IChannelAdapter`) interface |
| `@verlox/carina-core/memory` | `MemoryBackend` interface and backend selection |
| `@verlox/carina-core/provider` | LLM `ProviderDefinition` and registration |

CLI users continue to use the `carina` binary; programmatic extensions use the paths above.

## Stable interfaces

### 1. Domain pack manifest (`@verlox/carina-core/pack`)

Required `pack.json` fields (validated by `validatePackManifest`):

- `name` (string)
- `version` (string)
- `description` (string)
- `author` (string)
- `skillCount` (number)

Optional: `optional` (boolean, default true), `category` (string).

### 2. Tool registration (`@verlox/carina-core/tool`)

`Tool` shape:

- `name`, `description`, `parameters` (JSON Schema object)
- `execute(params) => Promise<unknown>`
- Optional: `requiresConfirmation`, `dangerous`, `needsConfirmation`

Use `registerTool(tool)` or `ToolRegistry.register()`.

### 3. Channel adapter (`@verlox/carina-core/channel`)

`ChannelAdapter` (`IChannelAdapter`):

- `name`, `enabled`
- `parseInbound(raw)`, `sendMessage(...)`, `formatForChannel(text)`
- Optional: `validateWebhook`, `createRouter`, `start`

See `src/gateway/channels/adapters/irc-adapter.ts` for a minimal stub.

### 4. Memory backend (`@verlox/carina-core/memory`)

`MemoryBackend`:

- `name`, `displayName`, `description`
- `isConfigured()`, `requiredEnv()`
- `saveMemory`, `searchMemory`, `getSessionHistory`, `clearSession`

Built-in backends are selected via env/config; custom backends are not yet pluggable via npm.

### 5. Provider registration (`@verlox/carina-core/provider`)

`ProviderDefinition` fields used by plugins:

- `name`, `displayName`, `kind`, `apiKeyEnv`, `defaultModel`, `status`, `capabilities`, `tags`

Use `registerProvider(def)` or `registerProviders(defs)`.

## Compatibility tests

CI runs `src/public-api/compatibility.test.ts`:

- Fixture `pack.json` validation
- Snapshot of required manifest fields
- Tool schema round-trip (Anthropic + OpenAI formats)

## Deprecation

Deprecated APIs remain for at least one minor release with console warnings before removal in the next major.
