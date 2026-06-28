# FEAT 001 (Part A): Cyber tools API endpoint - Carina backend

**Status: COMPLETED 2026-06-26**

**What was built:**
- `02-backends/core.carinaai.uk/src/api/cyber-tools-api.ts`: `GET /cyber` and `GET /cyber/health` with `x-internal-key` auth
- `02-backends/core.carinaai.uk/packages/web/src/web-server.ts`: mounted at `/api/tools`
- Live catalogue from `CYBER_TOOLS` registry (77 tools as of completion date)

**Sprint:** Security tooling
**Prompt number:** 001-A
**Name:** Expose the 72 cyber tool definitions and binary health via an internal REST endpoint
**Primary agent:** Cursor
**Estimated hours:** 1 h
**Depends on:** Nothing

**Part B (frontend):** `feat-002-cyber-tools-cheatsheet-frontend.md` (COMPLETED 2026-06-26)

---

## Context

Carina has 72 security tools registered in `src/tools/cyber-tools-registry.ts` (as
`CYBER_TOOLS: CyberToolDef[]`). They cover 11 phases: reconnaissance, vulnerability
scanning, exploitation, web app testing, wireless, forensics, traffic analysis, privacy,
reverse engineering, blue team, and reporting.

Today there is no API endpoint that lists these tools or checks whether the underlying
binaries are installed on the host. The frontend cheatsheet page (Part B) needs two
endpoints:

1. `GET /api/tools/cyber` - return the full tool catalogue with tier metadata
2. `GET /api/tools/cyber/health` - run `which <binary>` for each tool and return
   installed/missing status

Both endpoints are internal-only: they require the same `x-internal-key` header already
used by `internalTransactionalApiRouter` in `src/api/internal-transactional-api.ts`.

---

## Files to create or edit

| Action | File |
|--------|------|
| Create | `src/api/cyber-tools-api.ts` |
| Edit | `packages/web/src/web-server.ts` |

---

## File 1 - create `src/api/cyber-tools-api.ts`

```typescript
import { execSync } from 'node:child_process';
import { Router, type Request, type Response } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { CYBER_TOOLS } from '../tools/cyber-tools-registry.js';

export const cyberToolsApiRouter = Router();

function resolveInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

function isAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const expected = resolveInternalKey();
  if (!expected) return false;
  return String(req.headers['x-internal-key'] ?? '').trim() === expected;
}

cyberToolsApiRouter.use((req: Request, res: Response, next) => {
  if (isAuthorized(req)) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
});

cyberToolsApiRouter.get('/cyber', (_req: Request, res: Response) => {
  const tools = CYBER_TOOLS.map((t) => ({
    name: t.name,
    category: t.category,
    requiredTier: t.requiredTier,
    binary: t.binary,
    description: t.description,
    triggers: t.triggers,
    upgradeNote: t.upgradeNote ?? null,
  }));
  res.json({ tools, total: tools.length });
});

cyberToolsApiRouter.get('/cyber/health', (_req: Request, res: Response) => {
  const health = CYBER_TOOLS.map((t) => {
    let installed = false;
    try {
      execSync(`which ${t.binary}`, { stdio: 'ignore', timeout: 3000 });
      installed = true;
    } catch {
      installed = false;
    }
    return { name: t.name, binary: t.binary, installed };
  });

  const installedCount = health.filter((h) => h.installed).length;
  res.json({ health, installedCount, total: health.length });
});
```

---

## File 2 - edit `packages/web/src/web-server.ts`

**Step 1 - add import** near the other API router imports (search for `import.*researchApiRouter` and add
after it):

```typescript
import { cyberToolsApiRouter } from '../../src/api/cyber-tools-api.js';
```

**Step 2 - mount the router** immediately after the line `app.use('/api/research', researchApiRouter);`:

```typescript
app.use('/api/tools', cyberToolsApiRouter);
```

That is the only change to `web-server.ts`. Do not move or touch anything else.

---

## Acceptance criteria

- [ ] `GET /api/tools/cyber` with a valid `x-internal-key` header returns
      `{ tools: [...], total: 72 }` (or the count in `CYBER_TOOLS` - confirm by running
      `listCyberToolNames().length` in a test or just count the array)
- [ ] Each tool object has: `name`, `category`, `requiredTier`, `binary`, `description`,
      `triggers` (array), `upgradeNote` (string or null)
- [ ] `GET /api/tools/cyber/health` returns `{ health: [{ name, binary, installed }], installedCount, total }`
- [ ] Both routes return `401` with no `x-internal-key` header
- [ ] Both routes return `401` with a wrong key
- [ ] Health check completes within 10 seconds (3 s per binary timeout, Node runs them
      sequentially but fast)
- [ ] TypeScript compiles cleanly: `pnpm build` passes

## Do not touch

- `src/tools/cyber-tools-registry.ts` - read only, do not modify
- `src/tools/tiers.ts` - read only
- Any existing API route files
- Any test files
- Env files
