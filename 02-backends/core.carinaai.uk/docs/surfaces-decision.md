# Carina Surfaces Decision (Prompt 18)

This document records which user surfaces Carina adopts now, later, or defers. The canonical machine-readable list lives in `src/surfaces/index.ts` as `SURFACE_ADOPTION_DECISIONS`.

## Adopt now

| Surface | Entry | Notes |
|---|---|---|
| CLI | `carina` | Gateway-backed sessions, first-run onboarding, slash commands |
| Operator TUI | `carina tui` | Sessions/tasks/processes/logs/chat; `--simple` fallback without full TTY |
| Web workspace (PWA) | assigned local port / `carina web` | Full workspace; responsive chrome for tablet/phone browsers |
| Mobile companion (PWA) | `/mobile` + `carina pair` | Paired device bearer; reuses gateway sessions via `mobile:{deviceId}` external id |

## Later

| Surface | Rationale |
|---|---|
| Native iOS/Android apps | Pairing API + `/mobile` PWA cover v1; native when push, sensors, or App Store distribution require OS integration |

## Defer

| Surface | Rationale |
|---|---|
| Native desktop (Electron/Tauri/macOS) | Web PWA + CLI/TUI cover daily operator use; revisit for offline-first desktop-only integrations |

## Session state (no wild duplication)

- **Gateway session maps** (Redis or in-memory): one key per agent + surface + external user via `buildSurfaceSessionMapKey()` in `src/surfaces/index.ts`
- **Operator unified mode**: set `CARINA_OPERATOR_SESSION=true` to share one session across CLI, TUI, web, channels, and mobile
- **Last surface session** (CLI/TUI only): `~/.carina/surface-sessions.json` stores last TUI/CLI session ids for resume; web keeps browser `localStorage` for UI state only
- **Mobile**: device bearer token in `localStorage`; gateway external id is `mobile:{deviceId}` so chat history aligns with the paired device, not the browser tab id

## Quick paths

```bash
# Terminal
npm install -g carina-agent
carina                    # CLI chat
carina tui                # operator TUI
carina tui --simple       # line-oriented fallback

# Desktop browser
open the local URL printed by `carina web`

# Phone companion
carina pair token         # on desktop/LAN gateway
open http://<lan-ip>:<gateway-port>/mobile?token=<token>
```

## Env knobs

| Variable | Effect |
|---|---|
| `CARINA_OPERATOR_SESSION=true` | One shared gateway session across all surfaces |
| `CARINA_TUI_SIMPLE=true` | Force simple TUI mode |
