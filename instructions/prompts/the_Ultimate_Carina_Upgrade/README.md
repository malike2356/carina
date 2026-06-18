# The Ultimate Carina Upgrade - Gap Prompts

**Date:** 2026-06-18 (restructured + gap-09 performance parity added 2026-06-18)
**Status:** ALL PROMPTS WRITTEN - Ready for implementation
**Total Gaps:** 9
**Total Prompts:** 69

Reuse rule: Carina keeps its own voice. Treat Hermes, OpenClaw, and Odysseus as behavior references, then rewrite any copied phrasing, labels, comments, and UI copy before implementation.

---

## Agent Reference

| Agent | Best For |
|-------|---------|
| **Cursor** | React/TSX, Tauri Rust, rich component work |
| **Claude Code** | TypeScript systems, architecture, backend wiring |
| **Codex** | Boilerplate, native Android/iOS, config files, shell scripts |

Estimates assume 3 parallel agents + 7-10 hours/day. Collapse "week" to "1-2 days" accordingly.

---

## GAP SUMMARY TABLE

| # | Gap | Delivers | Prompts | Est. Days |
|---|-----|----------|---------|-----------|
| 01 | **Docker** | s6-overlay supervision, health checks, one-command prod deploy | 1 | 0.5 |
| 02 | **CarinaHub** | Skill marketplace: security scanner, reviews, public site, CLI, nginx deploy | 5 | 2-3 |
| 03 | **Mobile** | Background connection, camera/motion, SMS/call relay, companion pairing UI | 4 | 3-4 |
| 04 | **Desktop** | Tauri scaffold, chat engine, composer, pages, native OS integrations, Carina widgets | 6 | 4-6 |
| 05 | **Security** | 72 cyber tools, Scout/Carina architecture, forensics, compliance, migration | 20+ | 8-10 |
| 06 | **Web UI** | PTY bridge, admin pages, i18n (12 languages), canvas, PWA, UX polish, window system | 8 | 4-5 |
| 07 | **TUI/CLI** | Ink chat TUI, approval UI, operator panels, 150+ commands, shell completions, interactive mode, onboarding | 7 | 3-4 |
| 08 | **Enterprise** | SSO/SAML/OIDC, immutable audit (Merkle), data residency, DR, zero-trust, SOC2 Type II | 6 | 4-5 |
| 09 | **Performance Parity** | Prompt cache invariant, auxiliary models, FTS5 search, skin engine, cron enhancements, delegation roles, voice wake, failover, supply chain, PTY bridge, user modeling, ACP IDE adapter | 12 | 3-4 |

**Total estimated days with 3 parallel agents: 13-19 days of focused work.**

---

## PROMPT INVENTORY (complete)

### Gap 01 - Docker (1 prompt)

```
gap-01-docker/
└── prompt.md               479 lines - supervisord vs s6-overlay, HEALTHCHECK, prod stack
```

**Agent:** Cursor (Dockerfile) + Claude Code (compose config)
**Start here:** Most other gaps assume Docker is working.

---

### Gap 02 - CarinaHub (5 prompts)

```
gap-02-carina-hub/
├── 01-security-scanner.md  Wire sandbox-factory into validate.ts
├── 02-reviews-db-api.md    Reviews/ratings DB schema + API
├── 03-public-website.md    Static hub website (HTML/CSS/hub.js)
├── 04-cli-commands.md      carina hub install/search/publish CLI
└── 05-deployment.md        Nginx + Docker deploy for hub server
```

**Agent:** Claude Code (01, 02, 04) / Codex (03, 05)
**Key context:** Hub backend is 90% built. Prompts 01-04 wire and expose it; 03 is a new static site.

---

### Gap 03 - Mobile (4 prompts)

```
gap-03-mobile/
├── README.md
├── 01-background-connection.md    Android foreground service + iOS BGTask
├── 02-camera-motion.md            Camera frame capture + activity recognition
├── 03-sms-notifications.md        SMS/call relay (Android) + notification extension (iOS)
└── 04-companion-pairing.md        QR scanner + pairing API client (frontend only - backend done)
```

**Agent:** Codex (01-03 native) / Cursor (04 React Native)
**Key context:** 121 files exist. Pairing backend (`src/pairing/pairing.ts`) is complete. Prompts 01-02 extend existing RN app. Prompts 03-04 are entirely new screens/native modules.

---

### Gap 04 - Desktop (6 prompts)

```
gap-04-desktop/
├── README.md
├── 01-tauri-scaffold.md       Tauri 2.x + React 19 + Vite + nanostores + gateway-client
├── 02-chat-engine.md          Streaming chat, ThinkingBlock, ToolCallBlock, approval prompts
├── 03-composer.md             Rich input: slash autocomplete, @-mention, voice, file drop, queue
├── 04-pages.md                Agents, Artifacts/Canvas, Sessions, Skills, Settings pages
├── 05-native-integration.md   Tray, notifications, autostart, updater, deep links, LSP code mode
└── 06-carina-features.md      Scout widget, billing panel, workspace switcher, operator panel
```

**Agent:** Cursor (all 6 - React + Rust)
**Key context:** `carina-desktop/` does not yet exist. Build from scratch. Longest gap - start early, run in parallel with others.

---

### Gap 05 - Security (20+ prompts + extras)

```
gap-05-security/
├── 01-plan-mode-allowlist.md        through 13-cyber-security-tools.md
├── SCOUT-CARINA-ARCHITECTURE.md     Full Scout+Carina design with pricing
├── OBSIDIAN-INTEGRATION.md          Investigation vault auto-generation
├── MIGRATION-STRATEGY.md            Competitive positioning (Hermes/OpenClaw)
├── MIGRATION-IMPLEMENTATION.md      Import tools, free Scout, community bridge
├── CROSS-AGENT-SKILL-CONSUMPTION.md Runtime skill loading from other hubs
├── de-reference-competitor-names.md
├── cyber-tools/                     72 individual tool prompts (54 files + README)
└── cross-agent-consumption/
```

**Agent:** Claude Code (architecture) / Codex (individual tool implementations)
**Key context:** Security grew from 39 to 61 files already. Sandbox is built. Prompts wire sandbox to RASP, shield report, and 72 tool implementations.

---

### Gap 06 - Web UI (8 prompts)

```
gap-06-webui/
├── README.md
├── 01-hermes-pty-bridge.md      PTY terminal stream via WebSocket
├── 02-hermes-admin-pages.md     Admin panel pages (ops.carinaai.uk)
├── 03-openclaw-i18n.md          12-language i18n layer (app.carinaai.uk)
├── 04-openclaw-canvas.md        Artifact canvas viewer
├── 05-openclaw-chat-enhancements.md  ThinkingBlock, ToolCallBlock, approval UI
├── 06-odysseus-pwa.md           PWA manifest, service worker, offline
├── 07-odysseus-ux.md            Command palette, keyboard shortcuts, themes
└── 08-odysseus-window-system.md Multi-window layout manager
```

**Agent:** Cursor (React components) / Claude Code (01, 02 server-side)
**Key context:** app.carinaai.uk redesign (commit ca7c33c) already added many components. These prompts fill the remaining gaps identified post-redesign.

---

### Gap 07 - TUI/CLI (7 prompts)

```
gap-07-tui-cli/
├── GOLD-STANDARD-TUI-CLI.md            Hermes-level spec reference
├── GOLD-STANDARD-ONBOARDING-AESTHETICS.md  Odysseus-quality target
├── 01-ink-chat-tui.md              Ink 5 streaming chat TUI (446 lines)
├── 02-tui-approval-subagent.md     Tiered approval UI + subagent overlay (Ctrl+A)
├── 03-tui-operator-enhancements.md F-key panels (Scout/Memory/Skills/Logs) for readline TUI
├── 04-cli-command-expansion.md     150+ commands in 15 groups with --json + aliases
├── 05-cli-shell-completions.md     bash/zsh/fish/powershell completions with dynamic values
├── 06-cli-interactive-mode.md      Gradient banner, fuzzy slash menu, Ctrl+R history, markdown, multi-line
└── 07-cli-onboarding-polish.md     Animated typing, QR in terminal, 6-step wizard unifying first-run files
```

**Agent:** Claude Code (01-03, 06-07) / Codex (04, 05)
**Key context:** Readline TUI (14 files, 42KB) stays for operator mode. Ink TUI is new for chat mode. first-run.ts, onboarding-gateway.ts, provider-bootstrap.ts all exist and need to be unified by 07.

---

### Gap 08 - Enterprise Security (6 prompts)

```
gap-08-enterprise-security/
├── README.md
├── 01-sso-identity-federation.md     SAML 2.0 + OIDC + SCIM provisioning
├── 02-immutable-audit.md             Merkle tree audit log + blockchain anchoring
├── 03-data-residency-geo-fencing.md  Per-tenant region locking + key isolation
├── 04-disaster-recovery.md           RPO/RTO targets + automated failover
├── 05-zero-trust-network.md          mTLS, SPIFFE/SPIRE, per-request auth
└── 06-soc2-evidence-automation.md    Automated SOC2 Type II evidence collection
```

**Agent:** Claude Code (01, 02, 05) / Codex (03, 04, 06)
**Key context:** For Team/Enterprise plan customers. Build after the core product is stable (gaps 01-07 done).

---

### Gap 09 - Performance Parity (12 prompts)

```
gap-09-performance-parity/
├── README.md                              Full context + execution order for this gap
├── 01-prompt-caching-invariant.md         Freeze system prompt per session, defer invalidations
├── 02-auxiliary-model-routing.md          Per-task LLM overrides (curator/title/search/vision)
├── 03-fts5-session-search.md              SQLite FTS5 full-text cross-session recall + LLM summary
├── 04-skin-theme-engine.md                Data-driven CLI theming via YAML, /skin command
├── 05-cron-enhancements.md                Script injection, context_from chaining, no-agent mode
├── 06-delegation-leaf-enforcement.md      Leaf vs orchestrator roles, max_spawn_depth=2
├── 07-voice-wake.md                       Porcupine wake word on iOS/Android + voice capture
├── 08-model-failover.md                   Provider pool with cooldown and auto-rotation
├── 09-supply-chain-pinning.md             Upper-bound pinning, SHA-pinned Actions, dependabot
├── 10-dashboard-pty-bridge.md             xterm.js + WebSocket PTY: real TUI in browser
├── 11-honcho-user-modeling.md             Post-conversation user fact extraction + profile injection
└── 12-acp-ide-adapter.md                  ACP WebSocket + VS Code extension for IDE integration
```

**Agent:** Claude Code (01-06, 08-12) / Codex+Cursor (07, 09)
**Priority:** 01 > 02 > 08 > 03 > 06 > 09 > 11 > 04 > 05 > 10 > 07 > 12
**Source:** Deep research into Hermes (Nous Research) and OpenClaw codebases

---

## EXECUTION ORDER

The gap numbers are execution order. Build in this sequence:

```
Day 1 (all 3 agents):
  Agent A: Gap 01 (Docker) → unblocks everything
  Agent B: Gap 02 (Hub) prompts 01-03
  Agent C: Gap 04 (Desktop) prompt 01-02

Day 2-3:
  Agent A: Gap 03 (Mobile) - prompts 01-02 (native modules)
  Agent B: Gap 02 (Hub) prompts 04-05
  Agent C: Gap 04 (Desktop) prompts 03-04

Day 3-4:
  Agent A: Gap 03 (Mobile) - prompts 03-04
  Agent B: Gap 07 (TUI/CLI) prompts 01-04
  Agent C: Gap 04 (Desktop) prompts 05-06

Day 4-5:
  Agent A: Gap 06 (Web UI) prompts 01-04
  Agent B: Gap 07 (TUI/CLI) prompts 05-07
  Agent C: Gap 08 (Enterprise) prompts 01-03

Day 5-6:
  Agent A: Gap 06 (Web UI) prompts 05-08
  Agent B: Gap 08 (Enterprise) prompts 04-06
  Agent C: Gap 05 (Security) cyber-tools (parallel batches of 10)

Day 6-10:
  All 3 agents: Gap 05 (Security) cyber-tools and integration

Day 10-11 (after core is stable):
  Agent A: Gap 09 prompts 01-02-06 (prompt cache + auxiliary models + delegation)
  Agent B: Gap 09 prompts 03-05-08 (FTS5 + cron + failover)
  Agent C: Gap 09 prompts 09-04-11 (supply chain + skin + user modeling)

Day 12-13:
  Agent A: Gap 09 prompts 10-12 (PTY bridge + ACP adapter)
  Agent B+C: Gap 09 prompt 07 (voice wake - mobile native)
```

---

## ARCHIVE

Duplicate and weaker versions of prompts are in `_archive-duplicates/`. Safe to delete.

| Archived | Replaced By |
|----------|------------|
| gap-01-desktop-app | gap-04-desktop (6 prompts vs 1) |
| gap-01-docker-supervision | gap-01-docker/prompt.md (479 lines vs 245) |
| gap-02-native-mobile | gap-03-mobile (4 prompts with README) |
| gap-03-skill-hub | gap-02-carina-hub (5 detailed prompts) |
| gap-05-webui-upgrade | gap-06-webui (8 prompts vs stub) |
| gap-06-tui-cli | gap-07-tui-cli (7 prompts, merged Ink prompt in) |

---

## KEY REFERENCE FILES

```
gap-05-security/SCOUT-CARINA-ARCHITECTURE.md     Full Scout+Carina pricing and architecture
gap-05-security/cyber-tools/README.md             All 72 cyber tool prompts index
gap-05-security/MIGRATION-IMPLEMENTATION.md       Hermes/OpenClaw user migration plan
gap-07-tui-cli/GOLD-STANDARD-TUI-CLI.md           Hermes-level CLI benchmark spec
gap-07-tui-cli/GOLD-STANDARD-ONBOARDING-AESTHETICS.md  Odysseus onboarding quality target
00-PRE-WORK-ALIGNMENT.md                           Full codebase audit before starting
```
