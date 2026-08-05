# Gap 05 - WebUI Upgrade

## Purpose

The Carina web app (`app.carinaai.uk/`) already has a complete 3-zone shell, chat
components (ThinkingBlock, ToolCallBlock, StreamingMessage), panels (Memory, Notes,
Skills), CommandPalette, billing, themes, keyboard shortcuts, and vault. This gap
adds the next tier of capabilities: internationalisation, PWA install, chat UX
polish, entity anchors, QR companion pairing, terminal emulator, artifact canvas,
and a full admin operations section.

## Prompt Index

| File | Title | Agent | Hours |
|------|-------|-------|-------|
| 01-i18n.md | Internationalisation (20 locales) | Claude Code / Cursor | 6-8 |
| 02-pwa.md | Progressive Web App + Offline | Codex / Claude Code | 3-4 |
| 03-chat-enhancements.md | Chat UX Polish | Claude Code / Cursor | 5-6 |
| 04-entity-anchors-qr-pairing.md | Entity Anchors + QR Pairing UI | Claude Code / Cursor | 5-7 |
| 05-pty-bridge.md | Terminal (xterm.js + PTY bridge) | Cursor / Claude Code | 4-5 |
| 06-canvas.md | Artifact Canvas Viewer | Cursor / Claude Code | 4-5 |
| 07-admin-pages.md | Admin Operations Pages (8 pages) | Cursor / Claude Code | 8-10 |

## What Already Exists - Do NOT Rebuild

- `src/components/shell/AppSidebar.tsx` - sidebar nav (only extend it)
- `src/components/chat/ChatInputBar.tsx` - chat composer (only extend it)
- `src/components/shell/CoreSurfaceBanner.tsx` - connection banner
- `src/lib/core-surface.ts` - core connection logic
- `src/lib/core-proxy.ts` - proxy to core agent
- `src/components/billing/BillingClient.tsx` - billing (do not touch)
- `src/components/billing/PlanCard.tsx` - plan cards (do not touch)
- Chat components: ThinkingBlock, ToolCallBlock, StreamingMessage, MarkdownContent
- Panels: MemoryPanel, NotesPanel, SkillsPanel
- CommandPalette, ThemeProvider, VaultPanel, settings pages

## Execution Order

01 (i18n) should run before any prompt that adds new user-facing strings. The rest
are independent and can run in parallel if multiple agents are available. 07 (admin
pages) is the largest chunk and benefits from running last so nav entries from
earlier prompts are already in AppSidebar.

## Repository Context

- Web app root: `app.carinaai.uk/`
- Core agent: `core.carinaai.uk/src/`
- i18n reference: `core.carinaai.uk/src/i18n/index.ts`
- Pairing backend (already built): `core.carinaai.uk/src/pairing/pairing.ts`
- Web server (for PTY endpoint): `core.carinaai.uk/packages/web/web-server.ts`
