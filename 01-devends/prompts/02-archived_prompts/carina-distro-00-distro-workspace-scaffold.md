# Carina Distro Prompt 00: ABBIS monorepo scaffold

## Goal

Create the ABBIS application monorepo using pnpm workspaces. This is the container for
everything ABBIS: the Node.js API, the React web dashboard, the Carina sidecar workspace,
the shared database schema, and shared TypeScript types.

No application code is written in this prompt. Only the skeleton, tooling config, and
root-level files are created. Every subsequent prompt adds code inside this structure.

## Context

- ABBIS repo location: `/opt/lampp/htdocs/verlox/abbis/`
- IP: Laud Paul-Gablah / abbis360.com
- Built by: VERLOX (verlox.uk)
- Runtime: Node.js 22 LTS, pnpm 9, TypeScript 5
- Database: PostgreSQL 16 + TimescaleDB extension
- Queue: Redis 7 + BullMQ
- Carina kernel: MIT (VERLOX); installed as npm dependency, not forked

ABBIS is a pnpm monorepo with four workspaces:

```
abbis/
  apps/
    api/          Node.js/TypeScript REST API (Express) - core business logic
    web/          React + Vite dashboard
    carina/       Carina kernel process (pinned npm install; NOT source code)
  packages/
    db/           Drizzle ORM schema shared by api and carina
    shared/       TypeScript types, constants, validation schemas (Zod)
  docker/
    postgres/     init.sql (TimescaleDB extension + schema bootstrap)
    nginx/        reverse proxy config
  .env.example
  docker-compose.yml
  docker-compose.dev.yml
  pnpm-workspace.yaml
  package.json     (root - scripts only, no dependencies)
  tsconfig.base.json
```

## Dependencies

None. This is the first prompt.

## Files to create

```
abbis/package.json
abbis/pnpm-workspace.yaml
abbis/tsconfig.base.json
abbis/.env.example
abbis/.gitignore
abbis/apps/api/package.json
abbis/apps/api/tsconfig.json
abbis/apps/api/src/index.ts
abbis/apps/web/package.json
abbis/apps/web/tsconfig.json
abbis/apps/web/vite.config.ts
abbis/apps/web/index.html
abbis/apps/web/src/main.tsx
abbis/apps/carina/package.json
abbis/apps/carina/tsconfig.json
abbis/apps/carina/src/index.ts
abbis/packages/db/package.json
abbis/packages/db/tsconfig.json
abbis/packages/db/src/index.ts
abbis/packages/shared/package.json
abbis/packages/shared/tsconfig.json
abbis/packages/shared/src/index.ts
abbis/docker/postgres/init.sql
abbis/.gitignore
```

## Step-by-step

### 1. Root workspace config

`abbis/package.json`:
```json
{
  "name": "abbis",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "db:generate": "pnpm --filter @abbis/db run generate",
    "db:migrate": "pnpm --filter @abbis/db run migrate"
  },
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  }
}
```

`abbis/pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`abbis/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

### 2. Environment template

`abbis/.env.example` - document every required variable:
```bash
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://abbis:changeme@localhost:5432/abbis_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── ABBIS API ─────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
JWT_SECRET=change_this_to_a_long_random_string
SESSION_SECRET=change_this_to_another_long_random_string

# ── Carina sidecar ────────────────────────────────────────────────────────────
# Internal URL of the Carina service (never exposed externally)
CARINA_INTERNAL_URL=http://carina:4500
# Pack to activate; ABBIS always runs borehole-africa only
ACTIVE_SKILL_PACKS=borehole-africa
# Carina admin/API key set when starting the Carina process
CARINA_API_KEY=change_this_to_a_random_string

# ── Paystack (GHS billing) ────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY=sk_live_xxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxx

# ── Meta Cloud API (WhatsApp) ─────────────────────────────────────────────────
META_WHATSAPP_TOKEN=xxxx
META_WHATSAPP_PHONE_NUMBER_ID=xxxx
META_WHATSAPP_VERIFY_TOKEN=change_this

# ── Cloudflare R2 (file storage) ─────────────────────────────────────────────
R2_ACCOUNT_ID=xxxx
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET_NAME=abbis-documents

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxx
EMAIL_FROM=no-reply@abbis360.com
```

### 3. API workspace

`abbis/apps/api/package.json`:
```json
{
  "name": "@abbis/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "@abbis/db": "workspace:*",
    "@abbis/shared": "workspace:*",
    "bullmq": "^5",
    "express": "^4",
    "zod": "^3",
    "jsonwebtoken": "^9",
    "bcryptjs": "^2",
    "ioredis": "^5",
    "semver": "^7"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^1",
    "@types/express": "^4",
    "@types/node": "^22",
    "@types/jsonwebtoken": "^9",
    "@types/bcryptjs": "^2",
    "@types/semver": "^7"
  }
}
```

`abbis/apps/api/src/index.ts` (skeleton only):
```typescript
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'abbis-api', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`ABBIS API listening on port ${port}`);
});
```

### 4. Web workspace

`abbis/apps/web/package.json`:
```json
{
  "name": "@abbis/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "@abbis/shared": "workspace:*",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "vite": "^5",
    "vitest": "^1"
  }
}
```

`abbis/apps/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

### 5. Carina workspace (placeholder - prompt 01 fills this out)

`abbis/apps/carina/package.json`:
```json
{
  "name": "@abbis/carina",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node -e \"import('carina-agent').then(m => m.start())\""
  },
  "dependencies": {}
}
```

Note: dependencies are added in prompt 01.

### 6. Shared packages

`abbis/packages/db/package.json`:
```json
{
  "name": "@abbis/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "build": "tsc"
  },
  "dependencies": {
    "drizzle-orm": "^0.31",
    "postgres": "^3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.22",
    "typescript": "^5"
  }
}
```

`abbis/packages/db/src/index.ts` (skeleton):
```typescript
export * from './client.js';
export * from './schema/index.js';
```

`abbis/packages/shared/package.json`:
```json
{
  "name": "@abbis/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "build": "tsc" },
  "dependencies": { "zod": "^3" },
  "devDependencies": { "typescript": "^5" }
}
```

### 7. Database bootstrap

`abbis/docker/postgres/init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 8. .gitignore

```
node_modules/
dist/
.env
*.env.local
.DS_Store
*.log
pnpm-lock.yaml.bak
```

Do NOT gitignore `pnpm-lock.yaml` - it must be committed to ensure reproducible installs.

## Expected behavior

```bash
cd /opt/lampp/htdocs/verlox/abbis
pnpm install           # installs all workspaces
pnpm --filter @abbis/api run dev   # API starts on port 3000
curl http://localhost:3000/api/health  # returns { status: 'ok' }
```

## Test

- `pnpm install` completes without errors
- `pnpm build` compiles all workspaces
- `curl /api/health` returns 200

## Pitfalls

- Do not add dependencies to the workspace root `package.json`; only scripts go there
- `pnpm-lock.yaml` must be committed; treat it as source code
- Each workspace has its own `tsconfig.json` that extends `../../tsconfig.base.json`
- The `apps/carina/` workspace is intentionally a thin wrapper; Carina source is never edited here
