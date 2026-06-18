# Carina Web UI Upgrade; Master Plan (Revised)

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date revised:** 2026-06-18
**Purpose:** Adopt all missing web UI features from Hermes, OpenClaw, and Odysseus into Carina's existing Next.js web dashboard
**Existing code:** `app.carinaai.uk/src/`; ~120 TS/TSX files (significantly more than original estimate of 156), Next.js App Router
**Reference agents:** Hermes Agent (97 files React), OpenClaw (408 files Lit), Odysseus (3 files vanilla JS)

> The web app was completely redesigned in commit ca7c33c ("3-zone shell, rich chat, panels"). Read `00-PRE-WORK-ALIGNMENT.md` Gap 6 section for a full inventory of what the redesign added. Many features from the original prompt list are now done.

---

## WHAT THE REDESIGN COMPLETED

The following features from the original 21-feature list are now done:

```
Done:  3-zone shell (sidebar + chat + panels)
Done:  Command palette (CommandPalette.tsx)
Done:  Rich chat: ThinkingBlock, ToolCallBlock, StreamingMessage
Done:  Model selector popover (per-session)
Done:  Keyboard shortcuts (GlobalShortcuts.tsx, ShortcutsPanel.tsx)
Done:  Dark/light/system theme (ThemeProvider, ThemeSelector)
Done:  Attachment panel (AttachPanel.tsx)
Done:  Context chips (ContextChips.tsx)
Done:  Session header with title + model (SessionHeader.tsx)
Done:  Memory panel (MemoryPanel.tsx)
Done:  Notes panel (NotesPanel.tsx)
Done:  Skills panel (SkillsPanel.tsx)
Done:  Billing page with plan cards and usage meter
Done:  API key vault (Add/Delete/Row components)
Done:  Appearance settings (ThemeSelector, AppearanceSettings)
Done:  Core surface connection banner (CoreSurfaceBanner.tsx)
Done:  Per-message copy button (CopyButton.tsx; partial message export)
Done:  Chat error display with retry (ChatErrorMessage.tsx)
Done:  Brain settings integration (brain-settings.ts, brain-extract.ts)
```

---

## MISSING FEATURES; UPDATED LIST

### From Hermes (still missing)
1. PTY Bridge; embed terminal UI in web dashboard
2. Cron/Jobs management page
3. Webhook management page
4. MCP server management page
5. Analytics dashboard
6. Logs viewer page
7. File browser page
8. Environment variables page
9. Profile/switcher management

### From OpenClaw (partially done, still missing)
10. Internationalization; 20-language support (core has i18n format; app still needs it)
11. Canvas/artifact rendering
12. Heartbeat status display (CoreSurfaceBanner exists; live heartbeat widget missing)
13. Context warnings/notices (no context-limit approaching banner)
14. Composer persistence (draft not saved across reloads)
15. Message export (per-message CopyButton done; session-level export missing)
16. Deleted message handling

### From Odysseus (partially done, still missing)
17. PWA support (service worker, offline, install prompt)
18. Entity anchors (clickable #session-x, #document-y links)
19. QR code generation
20. Companion pairing UI (backend built in `src/pairing/`; just needs frontend)
21. Navigation efficiency improvements (CommandPalette done; session-creation friction remains)

---

## PROMPT FILES

| # | File | Source | Feature | Revised Effort |
|---|------|--------|---------|----------------|
| 01 | `01-hermes-pty-bridge.md` | Hermes | PTY bridge for embedded terminal | 2 weeks |
| 02 | `02-hermes-admin-pages.md` | Hermes | Cron, Webhooks, MCP, Analytics, Logs, Files, Env, Profiles | 4 weeks |
| 03 | `03-openclaw-i18n.md` | OpenClaw | 20-language internationalization | 3 weeks |
| 04 | `04-openclaw-canvas.md` | OpenClaw | Canvas/artifact rendering | 2 weeks |
| 05 | `05-openclaw-chat-enhancements.md` | OpenClaw | Heartbeat, context warnings, composer persistence, full export, deleted | 1 week |
| 06 | `06-odysseus-pwa.md` | Odysseus | PWA, service worker, offline, install prompt | 1 week |
| 07 | `07-odysseus-ux.md` | Odysseus | Entity anchors, QR, pairing UI, navigation efficiency | 1 week |

**Total: 16 missing features across 7 prompts. Estimated 14 weeks sequential, ~11 weeks parallelized.**

Down from 21 features / 16 weeks. Redesign completed 5 features and reduced scope of 4 others.

---

## BUILD ORDER (REVISED)

```
Phase 1; Foundation (Weeks 1-3)
  03-openclaw-i18n.md          → i18n infrastructure first (touches every page)
  06-odysseus-pwa.md           → PWA support (independent; service worker + manifest)

Phase 2; Chat Polish (Weeks 4-5)
  05-openclaw-chat-enhancements.md → Heartbeat widget, context warnings, composer persistence, session export, deleted messages
  07-odysseus-ux.md                → Entity anchors, QR codes, companion pairing UI (backend done - fast), nav polish

Phase 3; Power Tools (Weeks 6-7)
  01-hermes-pty-bridge.md      → Embedded terminal (xterm.js + PTY bridge)
  04-openclaw-canvas.md        → Artifact/canvas rendering

Phase 4; Admin (Weeks 8-11)
  02-hermes-admin-pages.md     → Cron, Webhooks, MCP, Analytics, Logs, Files, Env, Profiles
```

---

## INTEGRATION NOTES

### Existing code to extend (NOT replace)

```
app.carinaai.uk/src/
├── app/(workspace)/           → ADD new pages: cron, webhooks, mcp, analytics, logs, files, env, profiles
├── components/chat/ChatInputBar.tsx → ENHANCE: composer persistence (localStorage draft), context limit warning
├── components/shell/AppSidebar.tsx  → ENHANCE: profile switcher, language switcher
├── components/shell/CoreSurfaceBanner.tsx → ENHANCE: add live heartbeat display
├── lib/                       → ADD: i18n system, PWA registration, canvas renderer
├── components/ui/             → ADD: heartbeat widget, context warning banner, canvas viewer, QR display
└── middleware.ts               → ENHANCE: PWA headers, i18n detection, locale redirect
```

### Backend endpoints to integrate with

```
src/pairing/pairing.ts         → Companion pairing UI: POST /api/pairing/tokens, POST /api/pairing/link
src/i18n/index.ts              → Use core i18n locale format as template for app i18n
packages/web/web-server.ts     → PTY bridge server endpoint
```

### Key constraint for prompt 07 (pairing UI)

The pairing backend is fully built in `src/pairing/pairing.ts`. The web UI only needs:
1. A "Link Device" settings page that calls `POST /api/pairing/tokens` to generate a QR token
2. A QR code display using `qrcode` npm package (already widely used in Node.js ecosystem)
3. A device list page showing paired devices with revoke buttons
4. An API route in `app.carinaai.uk/src/app/api/` that proxies to the core pairing endpoints

This is 2-3 days of work, not a full week.

### Key constraint for prompt 03 (i18n)

Use the locale format already established in `src/i18n/index.ts` (core). The app layer should:
1. Use the same locale key naming convention
2. Use the same locale file structure
3. Import translations from a shared location where possible
4. Add `next-intl` or equivalent for Next.js SSR locale routing

---

## Reference Code

```
/opt/lampp/htdocs/verlox/carina/strategy/agent-study/
├── hermes-agent/web/src/      → Hermes web dashboard (23 pages); reference for admin pages and PTY
├── openclaw/ui/src/ui/        → OpenClaw web UI (408 files); reference for canvas, i18n, chat enhancements
├── openclaw/ui/src/i18n/      → OpenClaw i18n (20 languages); use as locale template
└── odysseus/static/           → Odysseus web UI (3 files); reference for entity anchors, QR, efficiency

app.carinaai.uk/src/components/shell/CommandPalette.tsx → Study this pattern for adding slash-command navigation
app.carinaai.uk/src/lib/core-surface.ts → Understand core connection before adding heartbeat/PTY
```