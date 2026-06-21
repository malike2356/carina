# Carina Mobile - Prompt 06: Sync repo-root docs (optional)

## What you are building

Update top-level Carina repo docs so `carinaMobile` status and commands are discoverable from the monorepo root.

**Working directory:** `/opt/lampp/htdocs/verlox/carina`

Keep changes minimal. Touch only docs that already mention Carina products or commands.

---

## Goal

- Developers landing in the repo root know mobile exists, its status, and where to start
- No duplication of full mobile architecture (link to `carinaMobile/ARCHITECTURE.md` instead)

---

## Files to update

```
carina/CLAUDE.md
carina/AGENTS.md
carina/ARCHITECTURE.md   (if a mobile section exists or is appropriate)
carinaMobile/CLAUDE.md   (add link to prompts/README.md)
```

---

## Content to add

### Carina Mobile subsection

Include:

| Item | Value |
|---|---|
| Path | `carinaMobile/` |
| Status | Internal QA / device testing until `DEVICE_QA.md` sign-off |
| Commands | `cd carinaMobile && pnpm start`, `pnpm test`, `pnpm build:preview` |
| Product boundary | General agent; no `property-uk` (Propreneur only) |
| Completion prompts | `carinaMobile/prompts/README.md` |
| Deploy | `carinaMobile/DEPLOY.md` |
| Device QA | `carinaMobile/DEVICE_QA.md` (after Prompt 05) |

### AGENTS.md commands block

Ensure the mobile commands match:

```bash
cd carinaMobile && pnpm start
cd carinaMobile && pnpm test
cd carinaMobile && pnpm build:preview
```

---

## Tasks

1. Add Carina Mobile subsection to `carina/CLAUDE.md` directory map or "Where to start"
2. Confirm `carina/AGENTS.md` run commands use `carinaMobile` (not `mobile`)
3. Add `prompts/README.md` link to `carinaMobile/CLAUDE.md` under Key files
4. Do not claim production-ready until DEVICE_QA sign-off exists

---

## Acceptance criteria

- Repo root docs mention `carinaMobile` with accurate status
- No em dashes, no emojis
- Links point to existing files (create DEVICE_QA.md reference only after Prompt 05)
- No unrelated doc rewrites

---

## Validation

Manual review only. No test command required for doc-only changes.
