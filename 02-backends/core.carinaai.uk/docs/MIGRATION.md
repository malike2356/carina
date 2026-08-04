# Migration guide

Moving to Carina from OpenClaw, Hermes, or another agent stack.

## From OpenClaw workspace

```bash
carina migrate openclaw --source /path/to/openclaw/workspace
```

Selective export flags:

- `--only-memories` / `--only-skills` / `--only-config` limit bundle contents.
- Review output under `$CARINA_HOME/migrations/`.

**Status:** complete for workspace MD and memory import paths.

## From Hermes

```bash
carina migrate hermes --source /path/to/hermes/export.json
```

**Status:** partial; validate imported sessions before deleting source data.

## Profile migration

1. Create profile: `carina profile create dev`.
2. Switch: `carina profile use dev`.
3. Copy `.env` secrets into `~/.carina/profiles/dev/.env` (do not symlink production secrets).
4. Run `carina doctor --deep` on the new profile.

## Secrets and rollback

1. `carina secrets audit`
2. `carina secrets plan create`
3. Apply: `carina secrets plan apply <plan-id>`
4. Rollback: `carina secrets plan rollback <plan-id>`

Snapshots live in `$CARINA_HOME/secrets-snapshots/`.

## Hosted tenant migration

1. Export tenant config: `GET /api/ops/tenant-config/:tenantId`
2. Import on target with `PUT` to same endpoint.
3. Sync skill packs via `PUT /api/ops/skill-packs`.

## Verification checklist

- [ ] `carina doctor --deep` passes
- [ ] `carina secrets audit` has zero fail findings
- [ ] Gateway responds on `/api/health`
- [ ] ACP health OK when IDE integration required
- [ ] Mobile pair test: `carina pair token`
