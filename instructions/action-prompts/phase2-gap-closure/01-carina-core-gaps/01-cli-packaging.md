# Action: Carina CLI Packaging (npm install -g carina)

## Goal
Turn the existing `carina` binary inside the `carina-agent` monorepo package into a standalone, installable CLI package that fulfils every "npm install -g carina", "runs locally", and "carina chat / carina serve / carina config" claim on carinaai.uk.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/01-carina-core-gaps/01-cli-packaging.md`
- Project root: `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`
- This is NOT a greenfield build. A CLI entry point already exists:
  - `core.carinaai.uk/bin/carina.ts` (87 lines) — read this first, it is the current entry point
  - `core.carinaai.uk/src/gateway/cli.ts` (149 lines) — REPL/session loop used by the CLI
  - `core.carinaai.uk/src/gateway/commands.ts` (75 lines) — slash-command handler (`/provider`, `/help`, etc — NOT `/exit`, `/clear`, `/model` yet)
  - `core.carinaai.uk/src/gateway/web.ts` (223 lines) — local HTTP/web server (candidate base for `carina serve`)
  - `core.carinaai.uk/src/setup/` — directory exists; check whether a `carina setup` wizard is already implemented or stubbed
  - `core.carinaai.uk/src/config/index.ts` — current config loader (env-var based, NOT `~/.carina/config.yaml` based)
  - `package.json` — package is named `carina-agent`, `bin: { carina: "./dist/bin/carina.js" }`, already has a `carina` script via `tsx bin/carina.ts`
- The gap: today `carina` only runs from inside this monorepo via `pnpm carina` / `tsx bin/carina.ts`. There is no separate npm-installable package, no `~/.carina/config.yaml`, no `carina setup` wizard, no SQLite local-mode database, and `/model` (provider switching) is not wired into the CLI command set.
- Conventions: TypeScript strict mode, Node.js 18+ (package.json currently requires `>=22.0.0` — keep that constraint, do not lower it), no emojis, no em-dashes.

## Files to create
```
core.carinaai.uk/src/cli/
  config/
    loader.ts              — Reads/writes ~/.carina/config.yaml (yaml parse/stringify)
    defaults.ts            — Default configuration values (provider, model, paths)
    env.ts                 — Loads ~/.carina/.env for API keys (dotenv-style, never logs values)
  local/
    db.ts                  — SQLite (better-sqlite3) driver matching the Postgres schema in src/memory/migrations.ts
    session.ts             — File-based local session manager (no Redis dependency)
  commands/
    setup.ts               — `carina setup` guided wizard (provider choice, API key, test connection)
    serve.ts               — `carina serve` thin wrapper around src/gateway/web.ts for local-only mode
  output/
    formatter.ts           — Terminal colour/table formatting (use `picocolors` or existing chalk-like dep if present in package.json)
templates/
  config.default.yaml      — Shipped default config
  .env.example             — Example env file (placeholder values only, never real keys)
README.cli.md              — Install/setup/chat/serve/config usage docs (do not overwrite the existing top-level README.md; this is CLI-specific)
```

## Files to modify
- `core.carinaai.uk/bin/carina.ts` — add command routing for `setup`, `serve`, `config`, `--version`; keep `chat` as default when no subcommand given
- `core.carinaai.uk/src/gateway/commands.ts` — add `/exit`, `/clear`, and `/model` (alias to the existing `/provider` handler — do not duplicate provider-switching logic; that is built in spec 01-carina-core-gaps/02-provider-switching.md)
- `core.carinaai.uk/src/config/index.ts` — add a `loadFromYaml()` path that is used when `~/.carina/config.yaml` exists, falling back to the current env-var loader (do not break existing env-var based deploys on the VPS)
- `package.json` — confirm `bin` field and `files` array include the new `dist/src/cli/` output; add `js-yaml` (or existing yaml dep) and `better-sqlite3` to dependencies if not already present (check first with `grep -E "js-yaml|better-sqlite3|yaml" package.json`)

## Step-by-step
1. Read `bin/carina.ts`, `src/gateway/cli.ts`, `src/gateway/commands.ts`, `src/gateway/web.ts`, and `src/config/index.ts` in full to understand the current command flow before writing anything.
2. Run `grep -n "dependencies" -A 40 package.json` to see what packaging/CLI helper libraries already exist (e.g. yargs, commander, chalk, picocolors). Reuse what's there; do not add a competing CLI framework.
3. Create `src/cli/config/defaults.ts` with the default shape: `{ provider: 'deepseek', model: 'deepseek-chat', dataDir: '~/.carina' }`.
4. Create `src/cli/config/loader.ts`: reads `~/.carina/config.yaml`, validates against the defaults shape, merges with env-var overrides from `src/config/index.ts`, writes back on `carina config set`.
5. Create `src/cli/config/env.ts`: loads `~/.carina/.env`, never echoes values to stdout or logs.
6. Create `src/cli/local/db.ts`: open a `better-sqlite3` database at `~/.carina/carina.db`, applying the same table definitions used in `src/memory/migrations.ts` translated to SQLite syntax (no `gen_random_uuid()`, no `JSONB` — use `TEXT` with JSON.stringify/parse).
7. Create `src/cli/local/session.ts`: file-based session manager storing active conversation state under `~/.carina/sessions/<id>.json`, replacing the Redis-backed session store for single-user local mode.
8. Create `src/cli/commands/setup.ts`: interactive wizard (use the existing prompt library if `src/setup/` already provides one — read it first) that asks for provider, API key, default model, writes `~/.carina/config.yaml` and `~/.carina/.env`, and performs one test API call before confirming success.
9. Create `src/cli/commands/serve.ts`: thin wrapper that calls into `src/gateway/web.ts` with `localMode: true`, binds to `localhost:3000`, and prints the banner shown in the spec (`Carina API running on http://localhost:3000` etc).
10. Create `src/cli/output/formatter.ts`: colour helpers and a streaming-token renderer for the chat REPL.
11. Modify `bin/carina.ts` to route `carina setup`, `carina serve`, `carina config <get|set|list>`, `carina --version`, defaulting to `chat` (the existing `cli.ts` REPL).
12. Modify `src/gateway/commands.ts`: add `/exit` (terminate REPL), `/clear` (clear local conversation context), `/model` (delegate to the `/provider` handler — confirm the handler signature first by reading the existing `/provider` block at line ~42).
13. Write `templates/config.default.yaml` and `templates/.env.example` with placeholder values only (e.g. `api_key: "YOUR_KEY_HERE"`).
14. Write `README.cli.md` documenting install, setup, chat, serve, config with real command examples.
15. Run `php -l` is not applicable here (TypeScript project) — instead run `pnpm exec tsc --noEmit` from `core.carinaai.uk/` to confirm the new files type-check.

## Expected behavior
- `carina --version` prints the version from `package.json`
- `carina setup` creates `~/.carina/config.yaml` and `~/.carina/.env` interactively and tests the API connection before saving
- `carina chat` starts the existing REPL (via `cli.ts`) but now also recognises `/exit`, `/clear`, `/model`
- `carina serve` starts a local HTTP server on port 3000 serving `/api/chat/send`, `/api/config`, `/api/health`, and a minimal web UI
- `carina config set providers.deepseek.api_key "***"` / `carina config get providers` / `carina config list` read and write `~/.carina/config.yaml`
- All of the above work from a global `npm install -g carina` without requiring the user to be inside the monorepo

## Test
- `pnpm exec tsc --noEmit` passes with no new errors
- Add `core.carinaai.uk/src/cli/config/loader.test.ts` (Vitest, matching the existing `*.test.ts` convention in `src/security/` and `src/skills/`): test that `loadFromYaml` merges defaults correctly and that `config set` round-trips through `config get`
- Add `core.carinaai.uk/src/cli/local/db.test.ts`: test that the SQLite schema creation runs without error and basic insert/select works
- Manually verify: `pnpm build && npm link && carina --version && carina setup && carina chat` from a directory outside the monorepo

## Dependencies
- Read and understand `bin/carina.ts`, `src/gateway/cli.ts`, `src/gateway/commands.ts` before writing any code (Step 1)
- `better-sqlite3` (add to package.json if absent — check with grep first)
- A YAML library (`js-yaml` or equivalent — check package.json first, do not add a duplicate)
- Spec 01-carina-core-gaps/02-provider-switching.md must land first if `/model` is to do more than alias `/provider` (for this prompt, aliasing is sufficient — do not duplicate the richer mid-session switching logic)
