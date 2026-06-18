# Gap 6: TUI/CLI Gold Standard

**Date:** 2026-06-18
**Purpose:** Make Carina's TUI and CLI the new gold standard, absorbing the best patterns from Hermes (202 TUI files), OpenClaw (37 TUI + 265 CLI files), and Odysseus.
**Existing code:** `src/tui/` (14 files, 42KB readline-based); `src/cli/` (10+ files, 91KB+)
**Target:** Production-grade Ink-based chat TUI, 150+ CLI commands, shell completions, polished interactive REPL, and a unified onboarding wizard.

---

## What Is Already Built (Do Not Rebuild)

```
src/tui/app.ts                    readline operator TUI (keep, enhance in 03)
src/tui/commands.ts               operator commands
src/tui/slash-commands.ts         slash handling
src/tui/data-provider.ts          data bridging
src/tui/task-actions.ts           task operations
src/tui/terminal.ts               terminal management
src/tui/layout.ts                 layout helpers
src/tui/views.ts                  view helpers
src/tui/log-buffer.ts             log buffering
src/cli/registry.ts               75+ commands (expand to 150+ in 04)
src/cli/entrance.ts               CLI entry point (enhance in 06)
src/cli/first-run.ts              first-run detection
src/cli/first-run-onboarding.ts   onboarding flow
src/cli/onboarding-gateway.ts     gateway onboarding
src/cli/completion-metadata.ts    shell completion scaffold (wire up in 05)
src/cli/provider-bootstrap.ts     provider setup
src/cli/router.ts                 command router
src/cli/types.ts                  shared types
src/cli/help.ts                   help formatter
src/cli/commands/                 command modules
src/cli/config/                   config sub-commands
src/cli/local/                    local mode commands
src/cli/output/                   output formatters
src/gateway/cli.ts                gateway JSON-RPC protocol
```

---

## Architecture Decision: Two TUI Modes

```
carina tui              New Ink-based chat TUI (full streaming, markdown, overlays)
carina tui --operator   Existing readline operator dashboard (enhanced, not replaced)

carina                  Interactive REPL with rich formatting and fuzzy autocomplete
carina <command>        Command-tree mode (existing registry, expanded to 150+)
```

These two modes coexist. The readline operator TUI is kept for power users who need a dashboarded overview of running sessions, Scout status, logs, and memory. The Ink TUI is the consumer-facing chat experience.

---

## Prompt Files

| # | File | Scope | Agent (primary) | Agent (fallback) | Effort |
|---|------|-------|-----------------|------------------|--------|
| 01 | `01-ink-chat-tui.md` | New Ink/React chat TUI | Cursor | Claude Code | 2 days |
| 02 | `02-tui-approval-subagent.md` | Approval + clarify + sudo + subagent overlays | Cursor | Claude Code | 1 day |
| 03 | `03-tui-operator-enhancements.md` | Enhance existing readline operator TUI | Claude Code | Cursor | 1 day |
| 04 | `04-cli-command-expansion.md` | Expand to 150+ commands, JSON/quiet modes | Claude Code | Codex | 2 days |
| 05 | `05-cli-shell-completions.md` | Fish/zsh/bash/PS completion scripts | Codex | Claude Code | 1 day |
| 06 | `06-cli-interactive-mode.md` | Rich bare `carina` REPL with banner and fuzzy autocomplete | Cursor | Claude Code | 1 day |
| 07 | `07-cli-onboarding-polish.md` | Animated first-run wizard unifying existing pieces | Claude Code | Codex | 1 day |

**Total: 7 prompts. 9 days with parallel agents. 4-5 calendar days running 2-3 agents simultaneously.**

---

## Build Order

```
Phase 1: TUI core (days 1-2, run 01 and 03 in parallel)
  01-ink-chat-tui.md          Build the new Ink TUI from scratch
  03-tui-operator-enhancements.md   Enhance existing readline TUI

Phase 2: TUI interactions (day 3, run 02 in parallel with 04)
  02-tui-approval-subagent.md   Add approval/clarify/sudo/subagent overlays to Ink TUI
  04-cli-command-expansion.md   Expand CLI command tree

Phase 3: CLI surface (days 4-5, run 05+06+07 in parallel)
  05-cli-shell-completions.md   Wire completion-metadata.ts into real shell scripts
  06-cli-interactive-mode.md    Polish the bare `carina` REPL
  07-cli-onboarding-polish.md   Animate and unify the first-run wizard
```

---

## Dependencies Between Prompts

```
01 (Ink TUI core) must complete before 02 (overlays are mounted inside 01's app.tsx)
04 (expanded commands) should complete before or alongside 05 (completions need command list)
03 (operator enhancements) is independent of 01/02
06 and 07 are both CLI and are independent of each other and of 01-03
```

---

## Reference Files to Study Before Starting

```
Hermes TUI (pattern source):
  strategy/agent-study/hermes-agent/ui-tui/src/components/messageLine.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/components/streamingAssistant.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/components/streamingMarkdown.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/components/thinking.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/components/modelPicker.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/components/agentsOverlay.tsx
  strategy/agent-study/hermes-agent/ui-tui/src/gatewayClient.ts

OpenClaw TUI (pattern source):
  strategy/agent-study/openclaw/src/tui/tui.ts
  strategy/agent-study/openclaw/src/tui/gateway-chat.ts
  strategy/agent-study/openclaw/src/tui/tui-stream-assembler.ts
  strategy/agent-study/openclaw/src/tui/components/tool-execution.ts

OpenClaw CLI (pattern source):
  strategy/agent-study/openclaw/src/cli/json-output-mode.ts
  strategy/agent-study/openclaw/src/cli/program/core-command-descriptors.ts

Carina existing (read before modifying):
  core.carinaai.uk/src/tui/app.ts
  core.carinaai.uk/src/cli/registry.ts
  core.carinaai.uk/src/cli/entrance.ts
  core.carinaai.uk/src/gateway/cli.ts
  core.carinaai.uk/src/cli/first-run.ts
  core.carinaai.uk/src/cli/completion-metadata.ts
```

---

## Packages to Add (core.carinaai.uk)

```
ink@5                   Ink React-for-terminal framework
react@19                Peer dep for Ink 5
@types/react            TypeScript types
ink-markdown            Markdown rendering in terminal
gradient-string         ASCII art gradient coloring for banners
qrcode-terminal         QR code display for mobile pairing
@inquirer/prompts       Already used - check if present before adding
```

Run `pnpm add` inside `core.carinaai.uk/`. Do not modify root package.json.
