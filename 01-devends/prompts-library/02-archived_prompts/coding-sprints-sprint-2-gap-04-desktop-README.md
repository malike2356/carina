# Gap 03: Desktop App - Prompt Index

**Status: COMPLETED 2026-06-23**

**What was built:**
- Full Tauri 2 desktop app at `frontends/client-apps/carina-desktop/` (prompts 01-06)
- Offline sync archived separately as prompt 07 in this folder
- Gateway client, chat engine, composer, pages, native integration, Carina widgets (Scout, billing, workspace, operator)
- `desktop` surface registered in `backends/servers/core.carinaai.uk/src/surfaces/index.ts`
- Validation: `npx tsc --noEmit` and `npx vitest run` passed in `carina-desktop`

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Gap number in master index:** 1 (labelled gap-03-desktop-app here because the slot was vacant)
**Status:** COMPLETED 2026-06-23
**Primary agent:** Cursor (Tauri Rust + complex multi-file React state)
**Support agent:** Claude Code (gateway wiring, surfaces registration, Carina-specific features)
**Estimated effort:** 4-5 calendar days with parallel agents at 7-10 hours/day

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Prerequisites

Read these before running any prompt in this set:

- `/opt/lampp/htdocs/verlox/carina/instructions/prompts/the_Ultimate_Carina_Upgrade/00-PRE-WORK-ALIGNMENT.md`
- `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/CLAUDE.md`
- `/opt/lampp/htdocs/verlox/carina/CLAUDE.md`
- Gap 1 original prompt: `../gap-01-desktop-app/prompt.md` (contains reference file lists from hermes-agent and openclaw)

Key existing files the desktop app must integrate with:

| File | Why it matters |
|------|----------------|
| `core.carinaai.uk/src/surfaces/index.ts` | Register "desktop" surface here first |
| `core.carinaai.uk/src/gateway/cli.ts` | Transport pattern to reuse |
| `core.carinaai.uk/src/gateway/commands.ts` | Command dispatch protocol |
| `core.carinaai.uk/src/cli/registry.ts` | 24KB slash command registry - source of completions |
| `core.carinaai.uk/src/tui/app.ts` | 13KB readline TUI - reuse transport patterns, not UI |
| `core.carinaai.uk/src/lsp/client.ts` | LSP client for desktop code mode |
| `core.carinaai.uk/src/pairing/pairing.ts` | Companion pairing backend (already built) |
| `core.carinaai.uk/src/security/exec-approval-levels.ts` | Approval tier definitions |

---

## Prompt Execution Order

Run these prompts in order. Each prompt builds on the previous one. Do not start prompt 02 until the Tauri shell from prompt 01 opens successfully.

| Prompt | Name | Agent | Est. hours | Depends on |
|--------|------|-------|-----------|------------|
| 01 | Tauri Scaffold | Cursor | 6-8 h | nothing |
| 02 | Chat Engine | Cursor | 8-10 h | 01 complete |
| 03 | Composer | Cursor | 6-8 h | 02 complete |
| 04 | Pages | Cursor | 6-8 h | 02 complete (can parallel with 03) |
| 05 | Native Integration | Cursor / Codex | 4-6 h | 01 complete |
| 06 | Carina Features | Claude Code | 6-8 h | 02 + 03 + 04 complete |

Prompts 03, 04, and 05 can run in parallel once prompt 02 is done.

---

## What Gets Built

```
carina-desktop/          NEW - Tauri 2 + React 19 + TypeScript desktop app
  src/
    app/                 Page-level components (chat, agents, artifacts, sessions, skills, settings)
    components/          Shared UI components (chat rendering, scout widget, billing, workspace)
    store/               nanostores atoms (chat, session, connection, composer)
    lib/                 Gateway client, slash commands, notifications, autostart, tray
    hooks/               React hooks (submission, session lifecycle, config sync, gateway health)
  src-tauri/
    src/main.rs          Rust backend: window, tray, shortcuts, single-instance lock
    tauri.conf.json      Window config, CSP, capabilities
```

The desktop app talks to the Carina gateway running on `localhost:3333` via JSON-RPC over HTTP. It does NOT embed the gateway. The gateway must be running separately (`pnpm cli` or `pnpm dev` in `core.carinaai.uk/`).

---

## Done When

The full set is complete when all of these are true:

- [x] `frontends/client-apps/carina-desktop/` exists (canonical desktop app path)
- [x] `pnpm dev` / Tauri dev opens the app without TypeScript errors
- [x] The app connects to a running gateway on `localhost:3333`
- [x] Sending a message streams a response token by token
- [x] Session list shows in the sidebar; switching sessions works
- [x] Slash command autocomplete fires on "/"
- [x] System tray shows with Open, Settings, Quit items
- [x] `Cmd/Ctrl+Shift+C` toggles the main window
- [x] "desktop" is registered in `backends/servers/core.carinaai.uk/src/surfaces/index.ts`
- [x] Settings > Devices tab shows paired devices and a "Link Mobile Device" button

---

## Reference Repos (pre-cloned)

```
/opt/lampp/htdocs/verlox/carina/strategy/agent-study/hermes-agent/
/opt/lampp/htdocs/verlox/carina/strategy/agent-study/openclaw/
/opt/lampp/htdocs/verlox/carina/strategy/agent-study/odysseus/
```

Study hermes-agent's `apps/desktop/` for React patterns and openclaw's `apps/macos/` for native integration patterns. Do not copy their backend logic - only adopt UI and integration patterns.