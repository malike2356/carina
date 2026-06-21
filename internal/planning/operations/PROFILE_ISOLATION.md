# Profile isolation

Carina profiles are isolated operator environments under `~/.carina/profiles/<name>/`. Each profile owns its config, credentials, extensions, skill packs, checkpoints, and runtime metadata. The active profile pointer lives in the global home (`~/.carina/active-profile`).

## What is scoped per profile

| Resource | Location / scope |
|----------|------------------|
| Config | `<profile>/config.yaml`, `<profile>/.env` |
| Credentials | `<profile>/credentials.json` (`CARINA_CREDENTIALS_FILE`) |
| Toolsets | `<profile>/toolsets.yaml` |
| Extensions | `<profile>/extensions/` |
| Skill packs (local) | `<profile>/packs/` |
| Checkpoints | `<profile>/data/checkpoints/` |
| Operator packs file | `<profile>/operator-packs.json` |
| Cron jobs | `scheduled_tasks.profile_name` column |
| Memory (operator) | `profile:<name>:*`, `op:<name>`, legacy unprefixed for `default` only |
| Kanban (CLI) | `op:<profile>` session scope |

## Commands

```bash
carina profile list
carina profile create work
carina profile use work      # switches with history stack
carina profile current       # active profile + full scope JSON
carina profile back          # revert to previous profile
carina profile scope [name]
carina status                # includes active profile
```

## Switching profiles

`carina profile use <name>` writes the active pointer, binds environment variables (`CARINA_HOME`, extensions dir, operator session scope, etc.), clears in-process runtime caches (operator pack selection), and pushes the previous profile onto `~/.carina/profile-switch-stack.json` for `carina profile back`.

Long-running processes (gateway, cron scheduler) load the active profile at startup. Restart the gateway after switching profiles so cron registration and web context reflect the new home.

## Verifying isolation

1. `carina profile current` or `carina status` shows the active profile.
2. Web chat header shows `profile: <name>` in operator mode.
3. Workspace sidebar footer shows profile and `CARINA_HOME`.
4. `carina profile scope` lists scoped paths vs global paths.

## Memory session prefixes

New operator-scoped sessions can use `profile:<name>:<id>` via `wrapSessionForProfile()`. The `default` profile also sees legacy sessions without a `profile:` prefix for backward compatibility.

## Tests

`src/profiles/profile-isolation.test.ts` covers env binding, memory scope SQL, switch/back stack, and per-profile directory layout.
