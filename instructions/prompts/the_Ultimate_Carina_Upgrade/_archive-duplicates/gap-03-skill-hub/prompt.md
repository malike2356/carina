# Gap 3: Public Skill Marketplace (CarinaHub); Revised Build Prompt

**Date revised:** 2026-06-18
**Status:** Backend 90% built. Public website is 3 files. Deployment packaging exists.
**Reference agent:** OpenClaw ClawHub (`clawhub.ai`)
**Existing code:** `src/skills/hub/`; 20+ files, ~70KB. Backend almost complete.
**New asset:** `carina-agent-public/`; public Carina distribution with docker, install.sh, README, CONTRIBUTING, SECURITY.

> Read `00-PRE-WORK-ALIGNMENT.md` Gap 3 section before starting. Most of the original prompt is already built.

---

## WHAT ALREADY EXISTS (DO NOT REBUILD)

```
src/skills/hub/
  server.ts; 17KB hub server - COMPLETE
  hub-client.ts; 10.7KB hub client - COMPLETE
  marketplace-install.ts; 10.8KB install pipeline - COMPLETE
  marketplace-builtin.ts; 9.7KB builtin catalog - COMPLETE
  registry.ts; 8KB registry - COMPLETE
  marketplace-catalog.ts; 7KB catalog - COMPLETE
  marketplace-registry.ts; 5.7KB registry API - COMPLETE
  marketplace-validate.ts; 5.4KB validation - COMPLETE
  domain-pack-author.ts; 4.8KB pack authoring - COMPLETE
  build-pack.ts; 3.3KB pack builder - COMPLETE
  marketplace-store.ts; 3.3KB store - COMPLETE
  pack-licenses.ts; 3.2KB license system - COMPLETE
  publish-pack.ts; 3KB publish workflow - COMPLETE
  validate.ts; 2.4KB core validation - PARTIALLY COMPLETE (no sandbox wiring)
  shared-skills-store.ts; 2.4KB shared store - COMPLETE
  marketplace-types.ts; 2.3KB types - COMPLETE
  ecosystem-metrics.ts; 2.2KB metrics - COMPLETE
  seed.ts; 1.9KB seed data - COMPLETE
  migrations.ts; 2KB migrations - COMPLETE
  billing/; billing subdirectory - COMPLETE
  migrations/; DB migrations - COMPLETE
  public/; Frontend:
    index.html; SKELETON ONLY
    hub.js; SKELETON ONLY
    hub.css; SKELETON ONLY

src/sandbox/
  sandbox-factory.ts; Sandbox selector (Docker vs Worker vs OpenShell) - BUILT
  docker-runner.ts; Docker sandbox - BUILT
  worker-sandbox.ts; Node.js worker sandbox - BUILT
  openshell-sandbox.ts; OpenShell sandbox - BUILT

carina-agent-public/; Public Carina distribution - EXISTS
  docker-compose.yml; Dev stack
  docker-compose.prod.yml; Production
  install.sh; Install script
  start.sh; Start script
  README.md; Public README
  CONTRIBUTING.md; Contribution guide
  SECURITY.md; Security policy
```

---

## WHAT NEEDS BUILDING (SMALL SCOPE)

### 1. Security Scanner Integration (Week 1)

Wire `src/sandbox/sandbox-factory.ts` into `hub/validate.ts` so submitted skills are executed in isolation before publication.

The sandbox already exists. This is plumbing work only:

```typescript
// In hub/validate.ts, add sandbox execution step:

import { createSandbox } from '../../sandbox/sandbox-factory.js';

async function validateWithExecution(skillContent: string): Promise<ValidationResult> {
  const sandbox = await createSandbox({ type: 'worker' });
  // Run skill in sandbox, observe tool calls, check for:
  //   - Exfiltration patterns (curl to unknown hosts)
  //   - Shell command injection
  //   - File operations outside workspace
  //   - Hardcoded credentials
  //   - Prompt injection patterns
  await sandbox.destroy();
  return result;
}
```

**Automated checks to wire in:**
- No shell commands that download external scripts
- No network requests to non-whitelisted hosts
- No hardcoded credentials (secrets scan patterns from `security/injection-patterns.json`)
- No prompt injection in skill body (use `security/prompt-guard.ts`)
- All file operations scoped to workspace (`security/node-file-policy.ts` patterns)
- Tool usage matches declared tools in frontmatter

### 2. Rating and Review System (Week 1)

**Database migration (add to `hub/migrations/`):**
```sql
-- Reviews table
CREATE TABLE IF NOT EXISTS hub_skill_reviews (
  id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL REFERENCES hub_skills(name),
  author_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(skill_name, author_id)
);

-- Update hub_skills to track rating_avg
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS rating_avg REAL DEFAULT 0;
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
```

**API endpoints to add to `hub/server.ts`:**
```
POST /api/v1/skills/:name/reviews; submit review (auth required)
GET  /api/v1/skills/:name/reviews; list reviews
```

**Rating calculation trigger:** After each review insert, update `rating_avg` and `review_count` on the parent skill row.

### 3. Public-Facing Website (Week 2)

The current `hub/public/` is a skeleton (index.html + hub.js + hub.css). Build a full browse/discover/publish site.

**Architecture:** Static HTML + vanilla JS calling the hub API. No framework dependency. Follow the Odysseus pattern (minimal, fast, keyboard-friendly).

**Pages:**
```
hub/public/
  index.html; Homepage: search bar, featured skills, stats (total skills, installs, authors)
  browse.html; Browse skills: filter by category, tag, verified, sort by installs/rating/date
  skill.html; Skill detail: metadata, install count, rating, reviews, versions, install command
  publish.html; Publish form: name, description, category, tags, paste skill content
  author.html; Author page: skills by this author, install counts, ratings
  docs.html; Publisher guide: skill format, security policy, review process
```

**Key interactions:**
- `GET /api/v1/skills?q=<query>&category=<cat>&sort=installs` → populate browse page
- `GET /api/v1/skills/:name` → populate skill detail page
- `GET /api/v1/skills/:name/reviews` → populate review section
- `POST /api/v1/skills` → submit new skill (from publish form)
- `POST /api/v1/skills/:name/reviews` → submit review
- `GET /api/v1/stats` → homepage stats

**UI patterns to include:**
- Star ratings (1-5 stars, read-only display + writable form)
- "Verified by Carina" badge for skills that passed security review
- Install command copy button: `carina hub install <name>`
- Category badges
- "Trending this week" section (by install delta)
- Author avatar + link

### 4. `carina hub` CLI Commands (Week 2-3)

Check `cli/registry.ts` for existing hub commands. If missing, add:

```
carina hub search <query>; search CarinaHub
carina hub info <name>; skill detail + reviews
carina hub install <name>; install from CarinaHub
carina hub install <url>; install from URL
carina hub install --file <archive>; install from local file
carina hub update <name>; update installed skill
carina hub uninstall <name>; remove skill
carina hub publish <path>; publish skill to CarinaHub
carina hub list; list installed hub skills
carina hub outdated; check which installed skills have updates
carina hub login; authenticate with CarinaHub (generate token)
carina hub logout; revoke token
```

These should call `hub-client.ts` methods which already exist at 10.7KB. The CLI commands are mostly thin wrappers.

### 5. Domain Deployment (Week 3)

Use `carina-agent-public/` as the base for deploying the public hub:

```bash
# CarinaHub deployment uses the public distribution:
cd carina-agent-public/
docker-compose -f docker-compose.prod.yml up -d

# Or single-command install for community users:
bash install.sh
```

**DNS target:** `hub.carinaai.uk` pointing to the VPS. Nginx config for hub already exists in `docker/nginx/`. Add a `hub.carinaai.uk.conf` server block that:
- Proxies `/api/` to hub server (port from `hub/server.ts`)
- Serves `hub/public/` as static files
- Adds appropriate cache headers for static assets

---

## IMPLEMENTATION PHASES

### Phase 1 (Week 1); Security Scanner + Reviews
```
Day 1-2: Wire sandbox-factory into hub/validate.ts for sandboxed execution
Day 2-3: Add automated security checks (injection, exfiltration, credentials)
Day 4-5: Add hub_skill_reviews table, reviews API endpoints, rating_avg updates
Day 6-7: Test: publish skill → sandbox run → pass/fail verdict → rating flow
```

### Phase 2 (Week 2); Public Website
```
Day 1-2: Homepage + browse page (search, filters, skill cards)
Day 3-4: Skill detail page (metadata, reviews, versions, install command)
Day 5-6: Publish form + author page
Day 7: Docs page + publisher guide
```

### Phase 3 (Week 3); CLI Commands + Deployment
```
Day 1-2: Audit cli/registry.ts for existing hub commands. Add missing ones.
Day 3-4: Wire CLI commands to hub-client.ts methods
Day 5-6: Nginx config for hub.carinaai.uk, point DNS
Day 7: End-to-end test: publish skill via CLI → visible on website → install via CLI
```

---

## REFERENCE FILES TO READ (BEFORE STARTING)

```
src/skills/hub/server.ts; Map all existing endpoints before adding new ones
src/skills/hub/hub-client.ts; All existing client methods
src/skills/hub/validate.ts; Understand current validation before wiring sandbox
src/skills/hub/public/index.html; Understand current skeleton
src/sandbox/sandbox-factory.ts; Understand sandbox selection logic
src/security/prompt-guard.ts; For skill content injection check
src/security/injection-patterns.json; Pattern list for skill content scanning
src/cli/registry.ts; Check for existing hub commands
carina-agent-public/README.md; Understand public distribution for deployment

openclaw/src/skills/security/scanner.ts; Reference: OpenClaw security scanner
openclaw/src/skills/lifecycle/clawhub.ts; Reference: ClawHub integration
```
