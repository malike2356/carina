# Sprint 2 - Category 02: Web UI Remaining

## What Exists

- `apps/cloud/src/pages/` - React pages: BillingPage, LoginPage, ScoutPage, AgentPage
- `packages/web/assets/web/` - Calendar, compare, documents, email HTML/JS pages
- `core.carinaai.uk/src/gateway/` - WebSocket gateway, channel adapters
- Basic workspace shell with chat interface
- ops.carinaai.uk admin panel (EJS) with security, memories, skills, RAG tabs

## What Is Missing

- PTY terminal bridge (run shell commands from web UI)
- MCP server management UI
- Integrated file browser
- Environment variable editor UI
- i18n system (20 languages target)
- Window/panel docking system (split panes, float panels)
- Capability contract badges (show what each tier unlocks)
- Writing style consistency enforcement
- CI capability guard (no false claims in marketing vs actual features)

## Prompts in This Category

- `01-pty-bridge.md` - PTY terminal in web UI
- `02-mcp-management.md` - MCP server CRUD UI
- `03-file-browser.md` - File browser panel
- `04-env-vars-editor.md` - Env var editor in settings
- `05-i18n-20-languages.md` - i18n system with 20 languages
- `06-window-docking.md` - Split panes and dockable panels
- `07-capability-badges.md` - Tier-gated feature badges
- `08-writing-style-consistency.md` - Enforce writing style rules in UI
- `09-ci-capability-guard.md` - CI check that blocks false claims

## Original Reference

`sprint-2/gap-06-webui/`
