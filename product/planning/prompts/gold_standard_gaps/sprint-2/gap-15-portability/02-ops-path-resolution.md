# Gap 15 - Prompt 02: Fix Ops Panel Path Resolution

**Gap:** 15 Portability
**Prompt number:** 02 of 03
**Name:** Fix core-env.ts sibling path; SCOUT_HTPASSWD_USER env var; update .env.example
**Primary agent:** Claude Code
**Estimated hours:** 1 h
**Depends on:** Nothing; independent fix

---

## Problem 1: core-env.ts resolves the wrong sibling path

File: `internal/admin/ops.carinaai.uk/lib/core-env.ts`

Current code (line 15):
```typescript
const sibling = path.resolve(__opsDir, '../core.carinaai.uk/.env');
```

`__opsDir` is the ops panel root: `internal/admin/ops.carinaai.uk/`.
One level up from ops root is `internal/admin/`.
So `sibling` resolves to `internal/admin/core.carinaai.uk/.env` - which does not exist.

The correct relative path from the ops root to core is `../../servers/core.carinaai.uk/`.

On a fresh clone or a local dev machine, this causes `coreEnvReadable()` to always return
false, `CARINA_CORE_ENV_PATH` to fall through to the hardcoded VPS path, and the Settings
page to show "Core .env not found" even when the developer has a valid local .env.

### Fix

In `internal/admin/ops.carinaai.uk/lib/core-env.ts`, change line 15:

Before:
```typescript
const sibling = path.resolve(__opsDir, '../core.carinaai.uk/.env');
```

After:
```typescript
const sibling = path.resolve(__opsDir, '../../servers/core.carinaai.uk/.env');
```

No other changes to that function are needed. The env var check on line 12 already gives
operators a full override, and the VPS fallback on line 17 remains as a last resort.

---

## Problem 2: SCOUT_HTPASSWD_USER hard-coded to 'malike'

File: `internal/admin/ops.carinaai.uk/routes/settings.ts`

Current code (line 14):
```typescript
const SCOUT_HTPASSWD_USER = 'malike';
```

This is the username written into Scout's `.htpasswd` file when the operator changes the
Scout console password via the Ops panel. On any server where the operator username is not
`malike`, the htpasswd entry is created with the wrong username, and Scout's basic-auth
gate rejects all login attempts.

There is already an env var for the htpasswd file path (`SCOUT_HTPASSWD_FILE`) but not
for the username. The fix mirrors that pattern.

### Fix

In `internal/admin/ops.carinaai.uk/routes/settings.ts`, change line 14:

Before:
```typescript
const SCOUT_HTPASSWD_USER = 'malike';
```

After:
```typescript
const SCOUT_HTPASSWD_USER = process.env.SCOUT_HTPASSWD_USER ?? 'admin';
```

Default changed from `'malike'` to `'admin'` because `'admin'` is the username that the
Scout bootstrap script creates. Any existing VPS using `'malike'` must set
`SCOUT_HTPASSWD_USER=malike` in their ops `.env` to preserve the existing htpasswd entry.

---

## Problem 3: .env.example missing new variables

File: `internal/admin/ops.carinaai.uk/.env.example`

The file currently has `CARINA_CORE_ENV_PATH` and `CARINA_CORE_ROOT` commented out but
does not document `SCOUT_HTPASSWD_USER`, `SCOUT_HTPASSWD_FILE`, `CARINA_CORE_ENV_PATH`
in a way that explains when to set them, and `CARINA_WORKSPACE_ROOT` is entirely absent.

### Fix

Add the following block to `.env.example` after the `SCOUT_API_KEY=` line:

```bash
# Username written to Scout's .htpasswd when changing the console password via Ops.
# Default is 'admin' (the username the Scout bootstrap script creates).
# If your Scout setup uses a different username (e.g. the VPS login), set it here.
SCOUT_HTPASSWD_USER=admin
# Path to Scout's .htpasswd file on the host. Defaults shown below.
# On Docker: set to the path inside the nginx container or the bind-mount source.
SCOUT_HTPASSWD_FILE=/etc/carina/scout/.htpasswd
```

Also ensure the `CARINA_CORE_ENV_PATH` comment block (currently at line 13) is updated
to explain the Docker use case:

```bash
# Path to core.carinaai.uk's .env on this host (for one-click Connect in Settings).
# On local dev: leave unset; ops auto-discovers ../../../servers/core.carinaai.uk/.env
# In Docker: set to the host path or leave unset if core .env is not accessible.
CARINA_CORE_ENV_PATH=
```

Add below `CARINA_CORE_ROOT`:

```bash
# Workspace root for PTY sessions. Defaults to /tmp/carina-workspaces in Docker.
# On bare-metal set to a persistent path, e.g. /home/youruser/carina-workspaces
CARINA_WORKSPACE_ROOT=
```

---

## Verification checklist

- [ ] `core-env.ts` line 15: sibling path changed to `../../servers/core.carinaai.uk/.env`
- [ ] On local dev, after the fix: `coreEnvReadable()` returns true when core .env exists
- [ ] `settings.ts` line 14: `SCOUT_HTPASSWD_USER` reads from env with `'admin'` default
- [ ] `.env.example` documents `SCOUT_HTPASSWD_USER`, `SCOUT_HTPASSWD_FILE`, `CARINA_WORKSPACE_ROOT`
- [ ] TypeScript build passes: `pnpm build` in `internal/admin/ops.carinaai.uk/`
