# CLAUDE.md - Carina Mobile

Expo/React Native companion for Carina Cloud and self-hosted agents.

## Rules

- **General-purpose default.** Never pre-install or default to `property-uk`; that vertical is Propreneur-only (`src/config/product-boundaries.ts`).
- **Reuse existing APIs.** Chat, auth, and trust data come from `core.carinaai.uk` and `console.labyrinthscout.com`; do not duplicate agent logic in mobile.
- **Trust is visible.** Scout status chip on chat header; full trust tab for risk score and events.
- **Match carinaai.uk palette.** Use `src/theme/tokens.ts`, not the green web-gateway accent.

## Commands

```bash
pnpm install
pnpm start
pnpm typecheck
pnpm test
pnpm build:preview   # EAS preview for device QA (see DEPLOY.md)
pnpm build:ios       # EAS production (see DEPLOY.md)
```

Push notifications require an EAS dev/production build; see `DEPLOY.md` for TestFlight and Play internal track setup.

## Key files

| Path | Purpose |
|---|---|
| `ARCHITECTURE.md` | Layers, routing, API boundaries |
| `DEPLOY.md` | EAS build and store submit |
| `DEVICE_QA.md` | Device test matrix and sign-off |
| `prompts/README.md` | Completion prompt index |
| `app/(tabs)/_layout.tsx` | Bottom tab navigator |
| `src/api/carina-client.ts` | REST client for gateway |
| `src/api/chat-stream.ts` | SSE streaming |
| `src/config/defaults.ts` | General suggested prompts |
| `src/config/product-boundaries.ts` | Propreneur pack exclusions |

Read `ARCHITECTURE.md` before adding screens or new API modules.

## CRITICAL: Local-first workflow

**Never edit files directly on a device or CI server.** All changes must be made locally, committed to git, and built via EAS or the documented build pipeline. Direct server edits diverge from git and cannot be reviewed.

## Completion prompts

Sequential build prompts to finish mobile for device QA and store release: `prompts/README.md`
