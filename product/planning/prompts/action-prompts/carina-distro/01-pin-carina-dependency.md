# Carina Distro Prompt 01: Pin Carina as a locked npm dependency

## Goal

Install `carina-agent` at a specific pinned version into `apps/carina/` and configure it
to run the ABBIS-specific Carina instance with only the `borehole-africa` pack active.

After this prompt, Carina is entirely contained in `node_modules/`. No network call to
`carinaai.uk` is ever needed once installation is complete. The version is frozen in
`pnpm-lock.yaml` until the ABBIS team explicitly chooses to update.

## Context

- Target workspace: `abbis/apps/carina/`
- Carina package: `carina-agent` (current stable)
- Pack: `borehole-africa` - ABBIS-specific domain knowledge pack
- Pack status: during development, the pack directory lives in `core.carinaai.uk/src/skills/packs/borehole-africa/`. Until it is published as `@verlox/pack-borehole-africa`, it is baked into the Docker image at build time.
- Carina runs on port 4500 (internal only; never exposed to the internet)
- `ACTIVE_SKILL_PACKS=borehole-africa` is set at process start

The separation principle: `apps/carina/` is a thin wrapper that:
1. Declares `carina-agent` as a dependency with exact version pinning (`"carina-agent": "0.1.1"`, NOT `"^0.1.1"`)
2. Provides the `.env` for Carina (which pack to activate, which LLM keys to use)
3. Has a single entry point that starts the Carina process

ABBIS never imports Carina TypeScript directly into `apps/api/`. Communication between
the ABBIS API and Carina is over HTTP on the internal Docker network only.

## Dependencies

`00-distro-workspace-scaffold.md`

## Files to create/modify

```
abbis/apps/carina/package.json           (modify - add carina-agent dependency)
abbis/apps/carina/tsconfig.json          (create)
abbis/apps/carina/src/index.ts           (create - process entry point)
abbis/apps/carina/.env.example           (create - Carina-specific env vars)
abbis/docker/carina/Dockerfile           (create - build image from pinned install)
```

## Step-by-step

### 1. Pin the exact Carina version

`abbis/apps/carina/package.json`:
```json
{
  "name": "@abbis/carina",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "carina-agent": "0.1.1"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "@types/node": "^22"
  }
}
```

Use an EXACT version pin (no `^` or `~`). The lockfile also pins it, but the exact
version in `package.json` makes the intent explicit: nobody accidentally bumps this
by running `pnpm update` without noticing.

### 2. Install and lock

```bash
cd abbis
pnpm install
```

Commit `pnpm-lock.yaml` immediately after. That lockfile is the source of truth for
exactly which Carina version runs in production.

### 3. Carina entry point

`abbis/apps/carina/src/index.ts`:
```typescript
import { createCarinaAgent } from 'carina-agent';

const agent = await createCarinaAgent({
  port: Number(process.env.CARINA_PORT ?? 4500),
  activePacks: (process.env.ACTIVE_SKILL_PACKS ?? 'borehole-africa')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
});

await agent.start();

console.log(`Carina agent running on port ${process.env.CARINA_PORT ?? 4500}`);
console.log(`Active packs: ${process.env.ACTIVE_SKILL_PACKS ?? 'borehole-africa'}`);

process.on('SIGTERM', async () => {
  await agent.stop();
  process.exit(0);
});
```

Note: `createCarinaAgent` is the assumed public API of `carina-agent`. Read
`core.carinaai.uk/src/index.ts` and `bin/carina.ts` to confirm the actual exported
function signatures before writing this; adapt accordingly. The pattern (instantiate,
start, graceful stop on SIGTERM) does not change.

### 4. Carina-specific env vars

`abbis/apps/carina/.env.example`:
```bash
# Port Carina listens on (internal only)
CARINA_PORT=4500

# Only ABBIS domain pack is ever active
ACTIVE_SKILL_PACKS=borehole-africa

# LLM providers (Carina uses DeepSeek by default, Claude/OpenAI as fallback)
DEEPSEEK_API_KEY=sk-xxxx
ANTHROPIC_API_KEY=sk-ant-xxxx
OPENAI_API_KEY=sk-xxxx

# Memory database (shared PostgreSQL instance, separate schema)
DATABASE_URL=postgresql://abbis:changeme@postgres:5432/abbis_db

# Redis (for Carina session and queue)
REDIS_URL=redis://redis:6379

# Admin key that ABBIS API uses to authenticate requests to Carina
CARINA_API_KEY=change_this_to_a_random_string

# Labyrinth Scout (optional; set LABYRINTH_ENABLED=false to disable entirely)
LABYRINTH_ENABLED=false
```

### 5. Docker image for Carina

`abbis/docker/carina/Dockerfile`:
```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only the carina workspace
COPY apps/carina/package.json ./apps/carina/package.json

# Install - pnpm uses the lockfile to guarantee exact versions
RUN pnpm install --frozen-lockfile --filter @abbis/carina

# Copy source and build
COPY apps/carina/ ./apps/carina/
RUN pnpm --filter @abbis/carina run build

ENV NODE_ENV=production
ENV CARINA_PORT=4500
ENV ACTIVE_SKILL_PACKS=borehole-africa

EXPOSE 4500

CMD ["node", "apps/carina/dist/index.js"]
```

The `--frozen-lockfile` flag is critical: it fails the build if `pnpm-lock.yaml` and
`package.json` are out of sync. This guarantees the deployed image always runs exactly
the pinned Carina version.

### 6. tsconfig for carina workspace

`abbis/apps/carina/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## Expected behavior

```bash
# After pnpm install in repo root:
ls abbis/node_modules/carina-agent         # directory exists
grep '"carina-agent"' abbis/pnpm-lock.yaml  # exact version locked

# Run locally:
cd abbis/apps/carina
CARINA_PORT=4500 ACTIVE_SKILL_PACKS=borehole-africa pnpm run dev
curl http://localhost:4500/health   # Carina health endpoint returns 200
```

## Test

```bash
cd abbis
pnpm install --frozen-lockfile
pnpm --filter @abbis/carina run build   # TypeScript compiles clean
grep '"version"' node_modules/carina-agent/package.json  # shows pinned version
```

## Pitfalls

- Never use `pnpm update carina-agent` without reading the Carina changelog first. That
  command bumps the installed version and changes `pnpm-lock.yaml`. Only run it
  intentionally as part of a planned Carina update.
- Never import `carina-agent` types or functions from `apps/api/` or `apps/web/`.
  The boundary is: ABBIS API speaks HTTP to Carina. Carina is a service, not a library.
- If the borehole-africa pack does not yet exist in the installed `carina-agent` version,
  the process will fail at startup with an unknown pack error. Confirm the pack is bundled
  before pinning that version. See the transitional Dockerfile note below.

### Transitional approach (borehole-africa not yet published)

Until `@verlox/pack-borehole-africa` is published as a separate npm package, bake the
pack directory into the Docker image at build time:

```dockerfile
# After installing carina-agent, copy the pack into the expected location
COPY borehole-africa/ ./node_modules/carina-agent/src/skills/packs/borehole-africa/
```

This is a temporary workaround. Remove it once prompt 13 (pack extraction) is complete
and `@verlox/pack-borehole-africa` is installable via npm.
