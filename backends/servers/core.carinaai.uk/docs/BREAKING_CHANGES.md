# Breaking change policy

## When we ship breaking changes

Breaking changes are allowed only on **MAJOR** releases (or documented MINOR pre-1.0). Each breaking change must include:

1. Entry in `CHANGELOG.md` under a `Breaking` section.
2. Migration steps in `docs/MIGRATION.md` when user action is required.
3. Deprecation warning for at least one MINOR release when feasible.

## Categories

| Category | Example | Policy |
|----------|---------|--------|
| CLI flags removed | `--old-flag` dropped | MAJOR + migration note |
| HTTP API shape | `/api/ops/foo` renamed | MAJOR; keep old route one MINOR with deprecation header |
| Env vars renamed | `OLD_VAR` to `NEW_VAR` | Accept both for one MINOR; doctor warns on old name |
| Config schema | `config.yaml` key removed | `carina doctor --repair` or migrate command |
| Skill pack format | manifest field required | Document in skill-packs docs; lint in `carina hub lint` |

## Deprecation process

1. Log warning at runtime (once per process) or in `carina doctor`.
2. Update docs with replacement.
3. Remove in next MAJOR (or next MINOR if pre-1.0 and documented).

## Operator communication

- Security-breaking changes: patch release with clear advisory.
- Hosted (Carina Cloud): email or in-app notice before enforcement date.

## Exceptions

Emergency security fixes may break compatibility without a MAJOR if no safe alternative exists; document in changelog same day.
