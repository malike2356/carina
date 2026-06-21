# Gap 15 - Prompt 03: Parametrize deploy script; deprecate stale bare-metal nginx configs

**Gap:** 15 Portability
**Prompt number:** 03 of 03
**Name:** Make APPS_ROOT overridable in deploy-carina.sh; delete deployment/nginx/ bare-metal configs
**Primary agent:** Claude Code
**Estimated hours:** 1 h
**Depends on:** Nothing; independent fix

---

## Problem 1: SSH heredoc has hard-coded /home/malike/apps paths

File: `scripts/deploy-carina.sh`

The rsync lines (lines 32-52) correctly use `${VPS_USER}@${VPS_HOST}` which are already
overridable. But the SSH heredoc (lines 55-89) contains bare strings like
`/home/malike/apps/core.carinaai.uk` that cannot be overridden without editing the script.

This means the script only works on the Contabo VPS where the path layout is
`/home/malike/apps/`. Deploying to a new server with a different user or apps directory
requires manually editing the script - a maintenance burden and a source of error.

### Fix

Add an `APPS_ROOT` variable near the top of the script (alongside `VPS_HOST` and
`VPS_USER`) and pass it into the SSH heredoc via bash's `-s` positional parameter
trick, which is the only reliable way to inject a variable into a single-quoted heredoc.

**Step 1:** After line 20 in `scripts/deploy-carina.sh`, add:

```bash
APPS_ROOT="${APPS_ROOT:-/home/malike/apps}"
```

**Step 2:** Change the SSH invocation on line 55 from:

```bash
ssh "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE'
```

to:

```bash
ssh "${VPS_USER}@${VPS_HOST}" bash -s -- "${APPS_ROOT}" <<'REMOTE'
APPS_ROOT="$1"; shift
```

**Step 3:** Replace every occurrence of `/home/malike/apps/` inside the heredoc (lines
56-88) with `"$APPS_ROOT/"`. The paths to change are:

```bash
# Line 62 - was:
cd /home/malike/apps/core.carinaai.uk
# becomes:
cd "$APPS_ROOT/core.carinaai.uk"

# Lines 63-64 - export context paths:
export CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
export CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
# become:
export CARINA_OPS_CONTEXT="$APPS_ROOT/ops.carinaai.uk"
export CARINA_CLOUD_CONTEXT="$APPS_ROOT/app.carinaai.uk"

# Lines 69-70 - .env file copies:
test -f .env.docker.runtime || cp .env .env.docker.runtime 2>/dev/null || cp /home/malike/.carina/.env .env.docker.runtime 2>/dev/null || true
test -f /home/malike/apps/ops.carinaai.uk/.env && cp /home/malike/apps/ops.carinaai.uk/.env .env.ops.runtime || true
test -f /home/malike/apps/app.carinaai.uk/.env && cp /home/malike/apps/app.carinaai.uk/.env .env.cloud.runtime || true
# become:
test -f .env.docker.runtime || cp .env .env.docker.runtime 2>/dev/null || true
test -f "$APPS_ROOT/ops.carinaai.uk/.env" && cp "$APPS_ROOT/ops.carinaai.uk/.env" .env.ops.runtime || true
test -f "$APPS_ROOT/app.carinaai.uk/.env" && cp "$APPS_ROOT/app.carinaai.uk/.env" .env.cloud.runtime || true

# Lines 72-74 - secrets dir fallback (remove or parametrize):
# The /home/malike/secrets/ path is a VPS-specific convention. Keep it as a
# best-effort fallback using a SECRETS_DIR env var with the old path as default:
SECRETS_DIR="${SECRETS_DIR:-$APPS_ROOT/../secrets}"
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  grep -E '^(DATABASE_URL|VAULT_SECRET|BETTER_AUTH|STRIPE_|CARINA_|NEXT_PUBLIC_)' \
    "$SECRETS_DIR/app.carinaai.uk.env" >> .env.cloud.runtime 2>/dev/null || true
fi

# Line 83 - Scout stack cd:
cd /home/malike/apps/console.labyrinthscout.com
# becomes:
cd "$APPS_ROOT/console.labyrinthscout.com"

# Lines 84-85 - Scout engine context and secrets:
export SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
test -f .env || cp /home/malike/secrets/scout.env .env 2>/dev/null || true
# become:
export SCOUT_ENGINE_CONTEXT="$APPS_ROOT/scout-engine"
test -f .env || cp "$SECRETS_DIR/scout.env" .env 2>/dev/null || true
```

**Result:** deploying to a new server with a different user and layout:

```bash
VPS_HOST=new-server.example.com \
VPS_USER=ubuntu \
APPS_ROOT=/opt/apps \
bash scripts/deploy-carina.sh
```

No script edits needed.

---

## Problem 2: Stale bare-metal nginx configs with hard-coded VPS IP

Files:
- `internal/servers/core.carinaai.uk/deployment/nginx/core.carinaai.uk.conf`
- `internal/servers/core.carinaai.uk/deployment/nginx/app.carinaai.uk.conf`

Both contain:
```nginx
listen 80.190.81.208:443 ssl;
```

These are bare-metal nginx vhost configs written for the pre-Docker architecture where
nginx ran on the host and SSL terminated directly on the VPS IP. They have been
superseded by the Docker nginx container (`docker/nginx/carina-prod.conf`).

Keeping them in the repo is misleading: a developer deploying to a new server might
follow these instead of the Docker path, then hit IP-specific `listen` directives that
only work on the Contabo VPS.

### Fix

Delete the entire `deployment/nginx/` directory:

```bash
git rm -r internal/servers/core.carinaai.uk/deployment/nginx/
```

If the `deployment/` directory becomes empty after the deletion, remove it too:

```bash
git rm -r internal/servers/core.carinaai.uk/deployment/
```

If `deployment/` contains other subdirectories that are still valid (e.g. SSL setup
scripts), keep those and only remove `nginx/`.

---

## Verification checklist

- [ ] `APPS_ROOT` variable added to `scripts/deploy-carina.sh` with `/home/malike/apps` default
- [ ] SSH heredoc uses `bash -s -- "$APPS_ROOT"` and reads `APPS_ROOT="$1"` inside
- [ ] All `/home/malike/apps/` references inside the heredoc replaced with `"$APPS_ROOT/"`
- [ ] Dry run: `VPS_HOST=... VPS_USER=... APPS_ROOT=/opt/apps bash scripts/deploy-carina.sh` completes rsync and SSH without path errors
- [ ] `internal/servers/core.carinaai.uk/deployment/nginx/` directory deleted from git
- [ ] `git status` shows no leftover stale nginx configs tracked
