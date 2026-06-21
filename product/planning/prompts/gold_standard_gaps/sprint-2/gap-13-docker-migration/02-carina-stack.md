# Gap 13 - Prompt 02: Fix and Finalise the Carina Compose Stack

**Gap:** 13 Docker Migration
**Prompt number:** 02 of 05
**Name:** Carina Stack - Fix Hub Crash, Activate Cloud and Ops, Remove Port Bindings
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompt 01 (proxy network defined, nginx configs written)

---

## Read First

1. `/home/malike/apps/core.carinaai.uk/docker-compose.prod.yml` - IN FULL
2. `/home/malike/apps/core.carinaai.uk/docker/postgres/init.sql` - what databases does it create?
3. `/home/malike/apps/core.carinaai.uk/docker/Dockerfile.carina` - the shared image
4. Supervisor configs to understand current env vars being passed:
   - `/etc/supervisor/conf.d/carina-core.conf`
   - `/etc/supervisor/conf.d/carina-ops.conf`
   - `/etc/supervisor/conf.d/carina-cloud.conf`
5. `/home/malike/apps/core.carinaai.uk/.env.runtime` (if it exists) - do not print secrets,
   just check which keys are set so you know what the compose env_file will provide

All reads on the VPS via SSH.

---

## Context

The `docker-compose.prod.yml` already defines the full Carina stack. Most services are
correctly structured. Three problems need fixing:

**Problem A: carina-hub is crash-looping.**
The hub runs `node dist/src/skills/hub/server.js` and requires a database named
`carina_skills_hub`. If `init.sql` only creates the `carina` database, the hub crashes
on startup because the database does not exist. Fix: add `carina_skills_hub` to init.sql,
OR change the hub's `SKILLS_HUB_DATABASE_URL` to use the existing `carina` database with a
schema prefix, whichever matches the hub's actual migration logic. Read the hub server code
to confirm which option is correct before changing anything.

**Problem B: carina-ops and carina-cloud use relative build contexts.**
The compose file references:
```
context: ${CARINA_OPS_CONTEXT:-../../admin/ops.carinaai.uk}
context: ${CARINA_CLOUD_CONTEXT:-../../external/client-apps/app.carinaai.uk}
```
These relative paths work from the developer's machine but not from the VPS deploy path
(`/home/malike/apps/core.carinaai.uk/`). The env vars `CARINA_OPS_CONTEXT` and
`CARINA_CLOUD_CONTEXT` must be set in the runtime env file to absolute VPS paths:
```
CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
```
Add these to `.env.runtime` on the VPS (or to `.env.example` in the repo as documentation).

**Problem C: Carina services publish ports to the host.**
In the target architecture, only nginx publishes ports. Carina services should communicate
via the Docker `carina` network. The host port bindings are needed now because bare-metal
nginx reaches them via 127.0.0.1:PORT. After cutover, Docker nginx reaches them by service
name. Remove host port bindings from these services:
- carina-web: remove `- "127.0.0.1:3300:3000"` -> leave as `expose: ["3000"]`
- carina-hub: remove `- "127.0.0.1:3001:3001"` -> leave as `expose: ["3001"]`
- carina-ops: remove `- "127.0.0.1:4001:4001"` -> leave as `expose: ["4001"]`
- carina-cloud: remove `- "127.0.0.1:4100:4100"` -> leave as `expose: ["4100"]`

Only nginx keeps `ports: ["80:80", "443:443"]`.

NOTE: Do not remove the port bindings until the cutover prompt (04). During testing,
having the ports accessible from the host is useful for debugging. The prompt 04 will
instruct removing them. For now, just add a comment in the compose file:
```yaml
# TODO (prompt 04 cutover): remove host port binding after nginx container is live
ports:
  - "127.0.0.1:3300:3000"
```

---

## Step 1: Fix the hub database issue

SSH to VPS and read the hub server startup code:
```bash
grep -r "carina_skills_hub\|database\|DB_URL\|DATABASE_URL" \
  /home/malike/apps/core.carinaai.uk/dist/src/skills/hub/ 2>/dev/null | head -30
```

Also read:
```bash
cat /home/malike/apps/core.carinaai.uk/docker/postgres/init.sql
```

If `init.sql` creates only `carina`:
Add to `init.sql`:
```sql
CREATE DATABASE carina_skills_hub;
GRANT ALL PRIVILEGES ON DATABASE carina_skills_hub TO carina;
```

If the hub is designed to use the main `carina` database with its own schema, update the
compose env instead:
```yaml
SKILLS_HUB_DATABASE_URL: postgresql://carina:${DB_PASSWORD:-secret}@postgres:5432/carina
```

Read the hub code before deciding. The crash logs will also help:
```bash
docker logs corecarinaaiuk-carina-hub-1 --tail 50
```

---

## Step 2: Verify carina-ops Dockerfile exists

```bash
ls /home/malike/apps/ops.carinaai.uk/docker/
```

Expected: `Dockerfile` and `Dockerfile.runtime`. The compose references `Dockerfile.runtime`.
If `Dockerfile.runtime` exists and produces a working image, no change needed.

If the previous FATAL for carina-ops was due to a missing `dist/server.js`, check:
```bash
ls /home/malike/apps/ops.carinaai.uk/dist/
```

If `dist/` is missing or empty, the app was never built. The Docker build will handle this
(the Dockerfile runs the build during image creation). Confirm the Dockerfile has a build step.
If it is a runtime-only Dockerfile that expects `dist/` to already exist, you need to
either: add a build stage to the Dockerfile, or build the app manually on the VPS first.
Read `ops.carinaai.uk/docker/Dockerfile.runtime` to determine which case applies.

---

## Step 3: Verify carina-cloud Dockerfile

```bash
cat /home/malike/apps/app.carinaai.uk/docker/Dockerfile
```

The Dockerfile at this path is a multi-stage Next.js build (deps, build, runner stages).
It should already be correct. Confirm:
- It outputs a standalone Next.js server
- The final stage exposes port 4100
- It has a CMD to start the server

The compose service uses `docker/Dockerfile.runtime` (not `docker/Dockerfile`). Check
if `Dockerfile.runtime` exists and if it is a standalone runtime image (no build step).
If `Dockerfile.runtime` is missing but `Dockerfile` is correct, change the compose to
reference `docker/Dockerfile` instead:
```yaml
carina-cloud:
  build:
    context: ${CARINA_CLOUD_CONTEXT:-../../external/client-apps/app.carinaai.uk}
    dockerfile: docker/Dockerfile   # changed from Dockerfile.runtime if .runtime is missing
```

---

## Step 4: Confirm proxy network added to carina services

From Prompt 01, the nginx service now has both `carina` and `proxy` networks. The carina
application services (carina-web, carina-hub, carina-ops, carina-cloud) only need to be
on the `carina` network because nginx reaches them via the `carina` network (nginx is also on it).

Do NOT add `proxy` to the application services. Only nginx needs `proxy` so it can reach
Scout containers.

Verify the compose networks section after Prompt 01 changes:
```yaml
networks:
  carina:
    driver: bridge
  proxy:
    external: true
    name: proxy
```

And verify nginx is the only service with:
```yaml
networks:
  - carina
  - proxy
```

---

## Step 5: Add env file documentation

In the repo (not on the VPS), update `core.carinaai.uk/.env.example` to include the
build context overrides needed for VPS deployment. Add a section:

```
# --- VPS deploy overrides ---
# Set these on the VPS in .env.runtime to point to absolute paths
CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
```

---

## Step 6: Test the compose config parses correctly

On the VPS (after changes are synced via git pull or rsync):

```bash
cd /home/malike/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml config 2>&1 | head -30
```

Look only for YAML/config errors. Any errors about missing networks or unreachable upstreams
are expected at this stage (the `proxy` network does not exist yet).

---

## Verification checklist

- [ ] `docker logs corecarinaaiuk-carina-hub-1 --tail 30` shows no crash on fresh start
      after fixing the database issue
- [ ] `docker compose -f docker-compose.prod.yml config` exits with no errors
- [ ] `.env.example` documents the VPS context overrides
- [ ] Compose file has `# TODO (prompt 04 cutover)` comments on services with host ports
