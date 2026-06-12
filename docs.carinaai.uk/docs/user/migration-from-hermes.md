# Migrating from Hermes

Carina ships a migration command that imports configuration, credentials, memory, and skills from an existing Hermes installation.

## What migrates

| Item | Status |
|---|---|
| Provider API keys from `config.yaml` | Imported |
| Provider model preferences | Imported |
| `.env` values (merged, not overwritten) | Imported |
| Episodic memory database | Partial; see below |
| Skills / tool definitions | Imported where format is compatible |
| Session history | Not migrated |
| Hermes-specific plugins | Not migrated |

**Partial imports:** Episodic memory requires compatible PostgreSQL schemas. If the Hermes schema differs, memory entries are skipped and listed in the report. Run `carina doctor --repair` after migration to rebuild indexes.

## Prerequisites

- Hermes installed and previously configured at `~/.hermes` (the default location).
- Carina installed: `npm install -g carina-agent`.
- The destination Carina config directory (`~/.carina`) is writable.

## Steps

### 1. Preview the plan

Always preview before applying:

```bash
carina migrate status
```

This scans `~/.hermes` and reports what it found:

```
Migration sources

  hermes         found    /home/you/.hermes (config.yaml, skills)
  openclaw       not found    /home/you/.openclaw
  claude         found    /home/you/.claude
```

Preview the Hermes migration specifically:

```bash
carina migrate hermes --dry-run
```

The report lists every file that would be copied, merged, or skipped.

### 2. Apply the migration

```bash
carina migrate hermes --force
```

Carina creates a timestamped backup of `~/.carina` before writing anything. Confirm the prompt when asked.

The report shows the outcome for each item:

```
Migration report (hermes -> /home/you/.carina)

  ok        config.yaml
  ok        .env (merged)
  ok        skills/my-skill.md
  skipped   episodic-memory.db (schema mismatch)

1 manual step(s):
  - Re-enter credentials that could not be read from config.yaml
```

### 3. Run post-migration checks

```bash
carina doctor --repair
carina secrets audit
```

`doctor --repair` rebuilds indexes and verifies the configuration. `secrets audit` confirms all required API keys are present.

### 4. Test

```bash
carina
```

Type a message. If providers respond, the migration was successful.

## Migrating from a non-default path

If Hermes is installed elsewhere:

```bash
carina migrate hermes --from /path/to/hermes-config --force
```

## What is not migrated

- Session turn history (not preserved across agents).
- Hermes-specific plugin binaries or sidecar services.
- Custom prompt injections or system-prompt files; move these to `~/.carina/system-prompt.md` manually.
- OAuth tokens; log in again with `carina credentials oauth login <provider>`.

## Exporting from Carina (bundle format)

To export your Carina config for transfer to another machine:

```bash
carina migrate export my-backup
```

To import it elsewhere:

```bash
carina migrate import my-backup.tar.gz --dry-run
carina migrate import my-backup.tar.gz --force
```

## Other migration sources

| Source | Command |
|---|---|
| OpenClaw | `carina migrate openclaw --force` |
| Claude Code config | `carina migrate claude --force` |

## Getting help

Run `carina migrate status` at any time to see what sources are available and what would be imported.
