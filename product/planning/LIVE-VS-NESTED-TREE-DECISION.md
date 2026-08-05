# Live vs nested Carina tree: decision sheet

**Date:** 2026-07-28  
**Status:** MERGED (2026-07-28)

## Short answer

There is now **one** platform tree under `/opt/lampp/htdocs/verlox/carina/`.

The former nested authoritative copy at `carina/verlox/carina/` was promoted into top-level `02-backends/` and `03-frontends/` via `git mv`, live-only files were merged back with `--ignore-existing`, and the leftover nested folder was archived (not hard-deleted).

## What changed

| Item | Result |
|---|---|
| Platform source of truth | Top-level `02-backends/` and `03-frontends/` |
| Deploy `PLATFORM_ROOT` | `scripts/deploy-carina.sh` uses `${REPO_ROOT}` (carina root) |
| Marketing carinaai.uk / labyrinthscout | Still from `shared/marketing-sites/` (unchanged) |
| Google Recorder Path A | Present at `02-backends/core.carinaai.uk/src/ingestion/google-recorder/` |
| Live-only core brain skills | Preserved |
| Nested leftover | `/opt/lampp/htdocs/verlox/archive/carina-nested-merge-20260728/` |

## Archive layout

```text
archive/carina-nested-merge-20260728/
  premerge-top-level/     # thin top-level trees moved aside before git mv
  leftover-verlox-tree/   # remaining nested slice after promote
  logs/merge.log
```

Do not delete that archive until at least one successful production deploy from the new paths.

## Canonical paths (post-merge)

```text
carina/
  01-devends/
  02-backends/core.carinaai.uk/
  02-backends/admin/ops.carinaai.uk/
  02-backends/console.labyrinthscout.com/
  02-backends/scout-engine/
  03-frontends/client-apps/app.carinaai.uk/
  03-frontends/client-apps/admin.carinaai.uk/
  03-frontends/marketing/docs.carinaai.uk/
  03-frontends/marketing/hireaiva/
  brain/                    # top-level RAG (unchanged)
  product/planning/
  scripts/deploy-carina.sh
```

## Next validation

1. Optional: dry-run or full `bash scripts/deploy-carina.sh` when ready.
2. Rebuild app `.next` before relying on local standalone (old build still embeds former nested paths in generated files).
3. After a good deploy, optionally delete `archive/carina-nested-merge-20260728/`.

## Recurrence mitigations (2026-07-28)

| Risk | Mitigation |
|---|---|
| Agent recreates nest from docs | Updated boundary + always-on Cursor rule + AGENTS hard rule |
| Stale gitignore un-ignores nest | `carina/.gitignore` now ignores `/verlox/` with no exceptions |
| Deploy from wrong tree | `guard-forbidden-carina-nests.sh` in deploy-preflight and deploy-carina |
| Accidental nest in Propreneur | Archived to `archive/propreneur-v2-nested-verlox-carina-20260728/`; registry forbidden |
| Quiet drift | `workspace-audit.py` fails if forbidden paths exist |

Run anytime:

```bash
bash /opt/lampp/htdocs/verlox/scripts/guard-forbidden-carina-nests.sh
```
