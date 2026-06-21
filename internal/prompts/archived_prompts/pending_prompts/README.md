# Archived pending prompts

Completed or superseded implementation prompts moved out of `pending_prompts/`.

Agents must not re-run prompts marked **COMPLETED** or **SUPERSEDED** here. Check this folder before starting work in `pending_prompts/`.

## Layout

Paths mirror `pending_prompts/` exactly. Example:

```
archived_prompts/pending_prompts/sprint-2/gap-17-ops-user-management/01-build.md
```

## Archived gaps (2026-06-21)

| Path | Status |
|------|--------|
| `sprint-2/01-deployment-and-docker/` | FULLY BUILT |
| `sprint-2/gap-01-docker/` | SUPERSEDED (see gap-13-docker-migration) |
| `sprint-2/gap-17-ops-user-management/` | COMPLETED |
| `sprint-2/gap-13-docker-migration/01-nginx-container.md` | COMPLETED |
| `sprint-2/gap-13-docker-migration/02-carina-stack.md` | COMPLETED |
| `sprint-2/gap-13-docker-migration/03-scout-stack.md` | COMPLETED |

Gap 13 prompts 04 and 05 remain in `pending_prompts/sprint-2/gap-13-docker-migration/` until executed.

## Adding new archives

When you finish a prompt, follow `pending_prompts/POST-BUILD-CHECKLIST.md`.
