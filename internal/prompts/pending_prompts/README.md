# The Ultimate Carina Upgrade - Gap Prompts

**Date:** 2026-06-21 (gap-14 deploy pipeline added 2026-06-21)
**Status:** ALL PROMPTS WRITTEN - Ready for implementation
**Total Gaps:** 14
**Total Prompts:** 85

**Infrastructure note (2026-06-21):** The stack is now fully Dockerised. gap-13-docker-migration
prompts 01-03 are COMPLETED. Prompts 04 (VPS cutover) and 05 (cleanup) are pending manual
execution on the VPS. gap-01-docker is SUPERSEDED. sprint-2/01-deployment-and-docker is FULLY
BUILT. Any prompt that referenced bare-metal supervisor or host-binding nginx ports has been
updated to reflect the Docker architecture.

Reuse rule: Carina keeps its own voice. Treat Hermes, OpenClaw, and Odysseus as behavior references, then rewrite any copied phrasing, labels, comments, and UI copy before implementation.

---

## Agent workflow: pending vs archived

- **Active work only:** `pending_prompts/` holds prompts that are not yet COMPLETED. Do not re-implement prompts that already live under `archived_prompts/pending_prompts/`.
- **After you finish a prompt:** Follow `POST-BUILD-CHECKLIST.md` in this directory. Mark the file COMPLETED, move it to `archived_prompts/pending_prompts/` (same relative path), and commit.
- **Before you start:** Check `archived_prompts/pending_prompts/`, gap `ADDENDUM-BUILD-STATUS.md` files, and `AUDIT-STATE-2026-06-20.md` so you do not duplicate shipped work.

**Already archived (2026-06-21):** `sprint-2/01-deployment-and-docker/`, `sprint-2/gap-01-docker/`, `sprint-2/gap-17-ops-user-management/`, and `sprint-2/gap-13-docker-migration/` prompts 01-03.

**Also archived (2026-06-22):** `sprint-2/gap-03-mobile/` (all 4 prompts; native mobile layer complete).

**Also active (2026-06-22):** `sprint-3/` white-label prompt pack for reseller, branding, billing, deploy, and tenant isolation work.

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
| 01 | **Docker** | SUPERSEDED by gap-13-docker-migration | 1 | DONE |
| 02 | **CarinaHub** | Skill marketplace: security scanner, reviews, public site, CLI, nginx deploy | 5 | 2-3 |
| 03 | **Mobile** | Background connection, camera/motion, SMS/call relay, companion pairing UI | 4 | 3-4 |
| 04 | **Desktop** | Tauri scaffold, chat engine, composer, pages, native OS integrations, Carina widgets | 6 | 4-6 |
| 05 | **Security** | 72 cyber tools, Scout/Carina architecture, forensics, compliance, migration | 20+ | 8-10 |
| 06 | **Web UI** | PTY bridge, admin pages, i18n (12 languages), canvas, PWA, UX polish, window system | 8 | 4-5 |
| 07 | **TUI/CLI** | Ink chat TUI, approval UI, operator panels, 150+ commands, shell completions, interactive mode, onboarding | 7 | 3-4 |
| 08 | **Enterprise** | SSO/SAML/OIDC, immutable audit (Merkle), data residency, DR, zero-trust, SOC2 Type II | 6 | 4-5 |
| 09 | **Performance Parity** | Prompt cache invariant, auxiliary models, FTS5 search, skin engine, cron enhancements, delegation roles, voice wake, failover, supply chain, PTY bridge, user modeling, ACP IDE adapter | 12 | 3-4 |
| 10 | **Incident Blog** | Dual-control blog: admin UI + Carina conversation. Automated research via check-in. Newsletter via Resend. Static page generator | 5 | 3-4 |
| 11 | *(reserved)* | | | |
| 12 | **Scout Product** | Scanning engine, Scout Score, dashboard, alerting, API, onboarding, CLI | 9 | 15-20 |
| 13 | **Truth in Advertising** | Per-surface capability contract, channel-honest quick replies, cloud identity, secret refusal guard, CI smoke tests | 8 | 1-2 |
| 14 | **Deploy Pipeline** | GitHub Actions auto-deploy, one-script server bootstrap (VPS or AWS EC2), dev-to-prod guide | 3 | 0.5 |

**Total estimated days with 3 parallel agents: 18-27 days of focused work.**

---

## PROMPT INVENTORY (complete)

### Gap 01 - Docker (SUPERSEDED)

DONE. Superseded by gap-13-docker-migration. The full Docker stack (Carina + Scout + nginx)
is implemented. See `gap-13-docker-migration/` for implementation prompts and status.

See also: `sprint-2/01-deployment-and-docker/` (FULLY BUILT 2026-06-20).

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

### Gap 03 - Mobile (4 prompts) - COMPLETED 2026-06-22

Archived at `archived_prompts/pending_prompts/sprint-2/gap-03-mobile/`. All four prompts shipped in `frontends/client-apps/carinaMobile/` (background connection, camera/motion, SMS/call/notification relay, companion pairing UI).

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

### Gap 10 - Incident Blog (5 prompts)

```
gap-10-incident-blog/
├── README.md                              Dual-control architecture, what exists, execution order
├── 01-db-schema-and-carina-tools.md       DB schema (incidents + subscribers), store, CLI commands, tool defs
├── 02-dual-interface.md                   Admin UI (Express/EJS) + Carina conversation interface
├── 03-research-pipeline.md                Carina check-in slot + manual triggers from both interfaces
├── 04-subscribe-and-newsletter.md         Carina API endpoints + newsletter send from both sides
└── 05-page-generator-and-integration.md   Static HTML generator + publish hooks
```

**Agent:** Claude Code (all prompts)
**Key context:** Incidents page already exists at labyrinthscout.com/incidents/. Carina check-in system, API surface, Resend sender, and admin panel all exist. Blog store shared by both interfaces. Full dual control -- human and AI can both manage everything.
**Strategic value:** Positions Scout as the authoritative publication on AI agent incidents. Weekly automated research. Dual-control moderation. Newsletter subscriber growth. Fear driver fed automatically.

---

### Gap 13 - Truth in Advertising (8 prompts)

```
gap-13-truth-in-advertising/
├── README.md                              Gap audit, build order, done-when criteria
├── 01-surface-capability-contract.md      Canonical per-surface capability truth module
├── 02-channel-aware-quick-replies.md      Fix Telegram "what can you do?" web nav bug
├── 03-cloud-chat-identity.md              Replace property-only Carina Cloud system prompt
├── 04-secret-refusal-output-guard.md      Mechanical "No." for .env/credential requests
├── 05-memory-and-tool-honesty.md          Runtime-gated memory and tool claims
├── 06-cloud-ui-capability-badges.md       Gate cloud sidebar on BYOK vs core-proxy
├── 07-writing-style-all-surfaces.md       sanitizeCarinaProse on all outbound paths
└── 08-capability-inventory-ci-guard.md    Identity smoke tests + inventory CI check
```

**Agent:** Claude Code (01-05, 07-08) / Cursor (06)
**Key context:** Verified on Telegram 2026-06-19: voice works; capability list and cloud identity still lie. Scout marketing truth remains in Gap 12.
**Priority:** Run 01 then 02+03 in parallel; ship before next public demo.

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

Day 13-14:
  Agent A: Gap 10 prompt 01 (DB schema + Carina tools)
  Agent B: Gap 10 prompt 03 (research pipeline)

Day 14-15:
  Agent A: Gap 10 prompt 02 (dual interface -- admin UI + Carina conversation)
  Agent B: Gap 10 prompt 04 (subscribe API + newsletter)

Day 15-16:
  Agent A: Gap 10 prompt 05 (page generator + integration)
  Both: end-to-end testing, both interfaces, all trigger paths
```

---

## ARCHIVE

Completed implementation prompts live under `archived_prompts/pending_prompts/` (see that README for the index). When you finish a prompt, follow `POST-BUILD-CHECKLIST.md`; do not leave COMPLETED files in this tree.

Duplicate and weaker versions of prompts are in `archived_prompts/old_duplicates/`. Safe to delete.

| Archived | Replaced By |
|----------|------------|
| gap-01-desktop-app | gap-04-desktop (6 prompts vs 1) |
| gap-01-docker-supervision | gap-01-docker/prompt.md (479 lines vs 245) |
| gap-02-native-mobile | gap-03-mobile (4 prompts with README) |
| gap-03-skill-hub | gap-02-carina-hub (5 detailed prompts) |
| gap-05-webui-upgrade | gap-06-webui (8 prompts vs stub) |
| gap-06-tui-cli | gap-07-tui-cli (7 prompts, merged Ink prompt in) |

---

### Gap 14 - Deploy Pipeline (3 prompts)

```
sprint-2/gap-14-deploy-pipeline/
├── README.md                    (start here - current state + dev-to-prod flow)
├── 01-github-actions-deploy.md  Add .github/workflows/deploy.yml (auto-deploy on CI pass)
├── 02-server-bootstrap.md       bootstrap-server.sh + bootstrap-aws-ec2.md
└── 03-dev-env-alignment.md      docs/dev-setup.md - port map, .env vars, deploy path
```

**Agent:** Claude Code
**Priority:** Run 01 first (CI deploy), then 02 and 03 in parallel.
**Key context:** Stack is fully Dockerised. deploy-carina.sh already works manually. This gap
automates it via GitHub Actions and makes server migration a 5-minute operation.

---

## KEY REFERENCE FILES

```
gap-05-security/SCOUT-CARINA-ARCHITECTURE.md     Full Scout+Carina pricing and architecture
gap-05-security/cyber-tools/README.md             All 72 cyber tool prompts index
gap-05-security/MIGRATION-IMPLEMENTATION.md       Hermes/OpenClaw user migration plan
gap-07-tui-cli/GOLD-STANDARD-TUI-CLI.md           Hermes-level CLI benchmark spec
gap-07-tui-cli/GOLD-STANDARD-ONBOARDING-AESTHETICS.md  Odysseus onboarding quality target
00-PRE-WORK-ALIGNMENT.md                           Full codebase audit before starting
gap-10-incident-blog/README.md                     Incident blog architecture and context
gap-10-incident-blog/01-db-schema-and-carina-tools.md  Blog data layer and CLI specification
gap-13-docker-migration/README.md                  Full Docker migration status (01-03 done, 04-05 pending)
gap-14-deploy-pipeline/README.md                   CI/CD pipeline alignment and AWS portability
internal/servers/core.carinaai.uk/docker/DEPLOY.md  Authoritative deploy runbook (always up to date)
```
