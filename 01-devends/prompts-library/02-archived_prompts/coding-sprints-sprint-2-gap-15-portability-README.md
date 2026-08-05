# Gap 15 - Portability: Run Anywhere Without Breaking

**Status: COMPLETED 2026-06-21**

**Gap:** 15 Location Portability
**Sprint:** 2
**Goal:** Make the full Carina + Scout stack run on any machine - local dev laptop, VM, new VPS,
AWS EC2 - without touching source code and without knowing the VPS username or path layout.

**Primary agent:** Claude Code
**Estimated total hours:** 3-5 h across 3 prompts
**Risk level:** Low. Additive changes only. All fixes are backward compatible.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Audit findings (2026-06-21)

A full grep of the codebase found the following portability issues. Some have already been
patched; the remainder are addressed by the prompts in this gap.

### Already fixed (this session)

| File | Issue | Fix |
|------|-------|-----|
| `console.labyrinthscout.com/docker-compose.prod.yml:10` | Build context defaulted to `/home/malike/apps`; Docker build fails on any other server | Changed to `context: .` |
| `core.carinaai.uk/docker-compose.prod.yml` carina-ops | No env vars passed for path resolution; ops falls back to `/home/malike/apps` paths inside container | Added `CARINA_CORE_ENV_PATH`, `SCOUT_CONSOLE_PUBLIC_DIR`, `CARINA_WORKSPACE_ROOT` as passthrough env vars |

### Remaining issues (addressed by prompts below)

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `core.carinaai.uk/docker-compose.prod.yml` nginx volume | `LABYRINTHSCOUT_STATIC` defaults to `/home/malike/apps/labyrinthscout.com-static`; nginx fails to start on any server where that dir does not exist | HIGH |
| 2 | `ops.carinaai.uk/lib/core-env.ts` | Sibling path check resolves to `internal/admin/core.carinaai.uk` which does not exist; fallback is `/home/malike/apps/...` | MEDIUM |
| 3 | `ops.carinaai.uk/routes/settings.ts` | `SCOUT_HTPASSWD_USER = 'malike'` is hard-coded; breaks htpasswd management on any machine where the username is not `malike` | MEDIUM |
| 4 | `scripts/deploy-carina.sh` SSH heredoc | Hard-codes `/home/malike/apps/` inside the remote SSH block; fails if VPS user or app path differs | MEDIUM |
| 5 | `deployment/nginx/` configs | `listen 80.190.81.208:443` hard-coded VPS IP; stale bare-metal configs - should be deprecated | LOW |
| 6 | `ops.carinaai.uk/.env.example` | Missing `CARINA_CORE_ENV_PATH`, `SCOUT_CONSOLE_PUBLIC_DIR`, `CARINA_WORKSPACE_ROOT` | LOW |

### NOT issues (intentional product behaviour)

| Pattern | Why it is fine |
|---------|----------------|
| `carinaai.uk` / `labyrinthscout.com` URLs in blog/marketing code | These are product URLs embedded in generated pages, not server config |
| `process.env.CARINA_OPERATOR_HOSTS ?? core.${DOMAIN},localhost` | Correct: requires explicit set when deployed on a different domain |
| `${VPS_HOST:-80.190.81.208}` in deploy scripts | Already overridable via env var |
| `localhost:5432` / `localhost:6379` defaults in config | Correct: used for local dev; Docker compose overrides these via env vars |
| `/etc/carina/ssl` default SSL path | Already overridable via `CARINA_SSL_DIR` |

---

## Prompt inventory

```
gap-15-portability/
├── README.md                   (this file - audit findings)
├── 01-nginx-static-volume.md   Fix LABYRINTHSCOUT_STATIC; add docker-compose.local.yml
├── 02-ops-path-resolution.md   Fix core-env.ts sibling path; SCOUT_HTPASSWD_USER env var
└── 03-deploy-parametrize.md    Parametrize deploy SSH heredoc; deprecate deployment/nginx/
```

---

## Local dev guide (short version)

To run everything locally without Docker today:

```bash
# 1. Start postgres and redis via Docker (services only)
docker compose up -d postgres redis   # from core.carinaai.uk/

# 2. Start Carina core
cd internal/servers/core.carinaai.uk
cp .env.example .env                  # fill DATABASE_URL, REDIS_URL, at least one LLM key
pnpm install && pnpm dev              # port 3333

# 3. Start Scout console (separate terminal)
cd internal/servers/console.labyrinthscout.com
cp .env.example .env                  # fill SCOUT_DB_PASSWORD, SCOUT_API_KEY, SCOUT_SESSION_SECRET
pnpm install && pnpm dev              # port 4444

# 4. Start ops panel (optional, separate terminal)
cd internal/admin/ops.carinaai.uk
cp .env.example .env                  # add CARINA_CORE_ENV_PATH=../../servers/core.carinaai.uk/.env
pnpm install && pnpm dev              # port 4001
```

The ops panel cannot reach the Carina PTY bridge in this setup because they are separate
processes. Set `CARINA_CORE_ROOT=../../servers/core.carinaai.uk` in the ops .env to enable it.

---

## Running on a VM or new server

Use `scripts/bootstrap-server.sh` (gap-14 prompt 02). After bootstrapping:
1. Copy `.env` files to the server
2. Run `bash scripts/deploy-carina.sh VPS_HOST=<new-ip> VPS_USER=<user> APPS_ROOT=<path>`
   (once gap-15 prompt 03 is done, these override the defaults)
3. The Docker stacks come up without any path or username assumptions
