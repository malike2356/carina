# Carina Mobile completion prompts

## Active series: Aiva / workspace feature parity

**Status: SERIES COMPLETE** (2026-07-11)

Bring remaining Aiva/Carina web workspace power into this Expo app, one tested slice at a time.

**Library:** `01-devends/prompts-library/pending/carina-mobile-aiva-parity/` (README only; prompts archived)  
**Completed:** `01`-`08` archived under `archived/carina-mobile-aiva-parity--0*.md`  
**Validation:** `pnpm typecheck` + `pnpm test` (185 passed at series close)

Related web phone overhaul (separate): see `01-devends/prompts-library/archived/aiva-mobile-first-workspace-overhaul.md` if present, or pending copy under prompts-library.

---

## Prior pack: companion bootstrap (00-09)

**Status:** PACK COMPLETE (2026-07-04)

All sequential prompts (00-09) are implemented. Canonical copies are archived in the workspace prompt library.

**Archived index:** `01-devends/prompts-library/archived/carina-mobile--README.md`  
**Archived prompts:** `01-devends/prompts-library/archived/carina-mobile--*.md`

## Build sequence (00-09)

| # | File | Topic | Status |
|---|---|---|---|
| 00 | `carina-mobile--00-bootstrap-env.md` | Bootstrap env, docs, build prerequisites | COMPLETED |
| 01 | `carina-mobile--01-auth-session.md` | Auth and session alignment with core backend | COMPLETED |
| 02 | `carina-mobile--02-feature-parity.md` | Feature parity for existing screens | COMPLETED |
| 03 | `carina-mobile--03-native-eas.md` | Push, voice, widget, EAS device builds | COMPLETED |
| 04 | `carina-mobile--04-production-polish.md` | Production polish | COMPLETED |
| 05 | `carina-mobile--05-device-qa.md` | Device QA matrix and release checklist | COMPLETED |
| 06 | `carina-mobile--06-repo-docs.md` | Sync repo-root docs | COMPLETED |
| 07 | `carina-mobile--07-spec-missing-endpoints.md` | Missing API endpoints | COMPLETED |
| 08 | `carina-mobile--08-spec-phase10-ondevice.md` | On-device inference (phase 10) | COMPLETED |
| 09 | `carina-mobile--09-spec-phase11-history-sync.md` | Cross-platform message history sync | COMPLETED |

## In-app docs

| Doc | Purpose |
|---|---|
| `ARCHITECTURE.md` | Layers, APIs, product boundaries |
| `DEPLOY.md` | EAS profiles, push credentials, store submit |
| `DEVICE_QA.md` | Manual device matrix; sign-off before release |
| `CLAUDE.md` | Agent rules for this package |

## Validation

```bash
cd carina/03-frontends/client-apps/carinaMobile
npx tsc --noEmit && npx vitest run
```
