# Pre-Work Alignment Report; All Gaps

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-18 (revised from 2026-06-17)
**Purpose:** Flag mismatches between prompts and existing code. Identify what needs updating before coding begins.
**Findings:** 5 prompts need correction. Codebase has advanced significantly since original analysis.
**Reuse rule:** when adopting external features, Carina must keep its own wording. Rewrite copied phrasing, labels, and helper text before implementation.

---

## ALIGNMENT SCORECARD

| # | Prompt | Status | Issues |
|---|--------|--------|--------|
| 1 | Desktop App | WARNING: Minor misalignments | Pre-work notes still valid. Add: LSP client, surfaces registration. |
| 2 | Mobile Depth | WARNING: Update scope | Companion pairing backend now built. Reduce native module count. |
| 3 | Skill Hub | FAILED: Needs rewrite | Backend 90%+ built. Public site is 3 files only. `carina-agent-public/` now exists. |
| 4 | Docker s6-overlay | WARNING: Minor misalignment | Supervisord confirmed. Recommendation: s6-overlay still stands. |
| 5 | Security Gold Standard | WARNING: Counts outdated | 61 files now (was 39). `src/sandbox/` built. `src/certification/` built. |
| 6 | WebUI Upgrade | FAILED: Major redesign happened | `app.carinaai.uk` completely redesigned (commit ca7c33c). Many features now done. |
| 7 | TUI/CLI Upgrade | WARNING: Partial completion | Onboarding CLI started. Shell completion metadata added. |

---

## NEW INFRASTRUCTURE ADDED SINCE ORIGINAL ANALYSIS

These directories and files did not exist when the original prompts were written. They affect multiple gaps:

```
ADDED (affects multiple gaps):

src/sandbox/
  docker-availability.ts; Docker availability check
  docker-runner.ts; Docker-based sandbox runner
  docker-sandbox.ts; Docker sandbox implementation
  openshell-sandbox.ts; OpenShell-based sandbox
  sandbox-factory.ts; Sandbox selector (Docker vs Worker vs OpenShell)
  worker-sandbox.ts; Node.js worker-based sandbox
  [tests for each]
  Affects: Gap 3 (hub security scanner), Gap 5 (RASP/penetration tests/red team)

src/pairing/
  pairing.ts; QR token generation, device linking, revoke
  pairing.test.ts
  (also: infrastructure/device-pairing.ts, infrastructure/device-scopes.ts)
  Affects: Gap 2 (companion pairing native module - backend done), Gap 6 (web pairing UI - backend done)

src/lsp/
  client.ts; Language Server Protocol client
  client.test.ts
  Affects: Gap 1 (desktop app code assistance in chat)

src/certification/
  built-on-carina.ts; "Built on Carina" certification issuance
  built-on-carina.test.ts
  Affects: Gap 5 prompt 11 (enterprise governance)

src/i18n/  (in core.carinaai.uk)
  index.ts; i18n runtime
  locale-path.ts; locale file paths
  i18n.test.ts
  Note: This is CORE i18n. app.carinaai.uk and carinaMobile still need their OWN i18n layers.
  Affects: Gap 6 prompt 03 (i18n); the core locale format is set - use it as the template.

cli/first-run.ts; First-run detection and setup flow
cli/first-run-onboarding.ts; First-run onboarding experience
cli/onboarding-gateway.ts; Gateway-based onboarding
cli/completion-metadata.ts; Shell completion metadata (fish/zsh/bash)
  Affects: Gap 7 (onboarding phase and shell completions already partially built)

carina-agent-public/ (new repo/directory at repo root)
  bin/; CLI entry point
  brain/; property knowledge corpus
  docker/; Docker setup
  docker-compose.yml; Dev stack
  docker-compose.prod.yml; Production stack
  install.sh; Install script
  start.sh; Start script
  templates/; Project templates
  src/; Agent source
  public/; Public assets
  scripts/; Deploy scripts
  README.md; Public-facing README
  README.cli.md; CLI documentation
  CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
  Affects: Gap 3 (hub domain deployment; this is the public Carina distribution packaging)

console.labyrinthscout.com changes:
  src/middleware/plan-gate.ts; Plan-based feature gating
  src/api/account.ts; Account management with plan awareness
  public/pricing.html; Pricing page added
  Affects: Gap 5 prompt 11 (enterprise governance) and Scout billing strategy
```

---

## GAP 1; DESKTOP APP: Minor Corrections

### What the prompt gets right
- TUI transport reuse: `src/tui/app.ts`, `src/tui/data-provider.ts`
- Gateway protocol: `src/gateway/cli.ts`, `src/gateway/commands.ts`
- Slash command registry: `src/cli/registry.ts` (24KB)
- Session control: `src/gateway/session-control.ts`
- Formatting: `src/gateway/formatting.ts`

### What needs updating

1. The desktop app should call `gateway/cli.ts` endpoints directly; the transport IS the gateway.
2. The slash command registry at `cli/registry.ts` is 24KB. The desktop palette should filter from this registry, not build a new one.
3. `src/surfaces/` now has 3 files: `index.ts`, `session-store.ts`, `surfaces.test.ts`. Desktop app must register as a new surface type ("desktop") by extending `surfaces/index.ts`.
4. NEW: `src/lsp/client.ts` exists. The desktop app can offer inline code assistance in the composer by connecting to the existing LSP client. Add a "code mode" to the composer that activates LSP.
5. NEW: `src/pairing/pairing.ts` exists. The desktop app's settings page should include a QR-based companion pairing screen that calls the existing pairing backend.

### Pre-work checklist
- [ ] Read `cli/registry.ts` (24KB); understand existing command registration
- [ ] Read `surfaces/index.ts`; understand surface routing + how to register "desktop" surface
- [ ] Read `tui/app.ts` (13KB); understand TUI transport
- [ ] Read `gateway/cli.ts` (6.8KB); understand gateway CLI endpoints
- [ ] Read `lsp/client.ts`; understand LSP client for desktop code mode
- [ ] Read `pairing/pairing.ts`; understand companion pairing for desktop settings

---

## GAP 2; MOBILE DEPTH: Companion Pairing Backend Is Built

### What has changed since original analysis

The companion pairing backend now EXISTS:

```
src/pairing/pairing.ts; QR token generation, device link, revoke, list
infrastructure/device-pairing.ts; Device record storage
infrastructure/device-scopes.ts; Scope validation per device
```

This means the mobile "companion pairing" native module (section 7 in the original prompt) only needs:
- A QR scanner native module (Expo already has `expo-barcode-scanner` and `expo-camera`)
- A call to the existing pairing API endpoint
- No new backend work

### What is still missing (native modules)

The native gap is unchanged from PRE-WORK v1:

1. **Persistent WebSocket Background Service**: `useConnectionStatus.ts` exists but no foreground service. Prompt is correct.
2. **Camera Frame Stream**: No continuous capture. Prompt is correct.
3. **SMS/Call Log Handler**: No SMS integration. Prompt is correct.
4. **Activity Recognition**: No motion detection. Prompt is correct.
5. **Notification Listener**: No system notification relay. Prompt is correct.
6. **Companion Pairing UI**: Backend is done. Only need: QR display (using existing `expo-camera` or `react-native-qrcode-svg`), QR scan (using `expo-barcode-scanner`), and call to `POST /api/pairing/tokens` + `POST /api/pairing/link`. This is 2-3 days, not a full week.
7. **Secure Enclave Storage**: `biometric-prefs.ts` exists. May not use hardware keystore. Verify.

### Corrected effort

Week 1: Native ConnectionService (background WebSocket)
Week 2: Native Camera + Motion modules
Week 3: Native SMS + Notification + companion pairing UI (pairing backend done = much faster)

**Reduced from 3 weeks to ~2.5 weeks.** Companion pairing is now a 2-3 day frontend task.

### Pre-work checklist
- [ ] Read `src/pairing/pairing.ts`; understand existing pairing API
- [ ] Read `infrastructure/device-pairing.ts`; understand device records
- [ ] Read `carinaMobile/src/hooks/useConnectionStatus.ts`; what monitoring exists
- [ ] Check what Expo native modules are already available vs what needs custom native code
- [ ] Read `carinaMobile/src/lib/native-capabilities.ts`; what native detection exists

---

## GAP 3; SKILL HUB: Major Correction Needed

### Reality: Backend is 90%+ built AND public packaging now exists

**What's been built in `src/skills/hub/`:**
```
server.ts; 17KB hub server
hub-client.ts; 10.7KB hub client
marketplace-install.ts; 10.8KB install pipeline
marketplace-builtin.ts; 9.7KB builtin catalog
registry.ts; 8KB registry
marketplace-catalog.ts; 7KB catalog
marketplace-registry.ts; 5.7KB registry API
marketplace-validate.ts; 5.4KB validation
domain-pack-author.ts; 4.8KB pack authoring
build-pack.ts; 3.3KB pack builder
marketplace-store.ts; 3.3KB store
pack-licenses.ts; 3.2KB license system
publish-pack.ts; 3KB publish workflow
validate.ts; 2.4KB validation
shared-skills-store.ts; 2.4KB shared store
marketplace-types.ts; 2.3KB types
ecosystem-metrics.ts; 2.2KB metrics
seed.ts; 1.9KB seed data
migrations.ts; 2KB migrations
billing/; billing subdirectory
migrations/; DB migrations
public/; Frontend (index.html + hub.js + hub.css ONLY)
Tests for: domain-pack-author, ecosystem-metrics, hub-client, marketplace-catalog, marketplace-install, marketplace-validate, pack-licenses, server, shared-skills-store, validate
```

**What `carina-agent-public/` adds:**
This is a new public-distribution repo for the Carina agent. It has docker-compose, install.sh, start.sh, templates, public assets, and public-facing README/CONTRIBUTING/SECURITY docs. This is the vehicle for deploying CarinaHub as a public community installation. The `carina-agent-public/` package should be what gets published to Docker Hub and what the hub domain deployment is based on.

**What's ACTUALLY missing (small scope):**
1. **Public-facing website**: `hub/public/` has `index.html`, `hub.js`, `hub.css` only. No browse, search, skill detail pages, or publisher portal.
2. **Security scanner integration**: `src/sandbox/sandbox-factory.ts` NOW EXISTS and can run skills in isolation. `hub/validate.ts` exists but may not be wired to the sandbox. Wire them together.
3. **Rating/review system**: Not visible in hub files. Needs tables + API + frontend.
4. **`carina hub` CLI commands**: `hub-client.ts` exists but are the commands in `cli/registry.ts`?
5. **Domain deployment**: Use `carina-agent-public/` as the base for the public registry deployment.

### Corrected prompt scope

**DELETE from prompt:** Database schema (migrations/ exists). API endpoints (server.ts 17KB). Install pipeline (marketplace-install.ts). Registry (registry.ts). Builtin catalog. Pack builder. License system. Pack authoring.

**KEEP from prompt:** Public website polish (browse, search, skill pages). Security scanner integration (wire sandbox-factory into validate.ts). Rating/review system (new tables + API + frontend). CLI commands audit. Domain deployment via carina-agent-public.

### Corrected effort
Week 1: Audit `hub/server.ts` endpoints vs prompt. Wire `sandbox-factory.ts` into `hub/validate.ts`. Add rating/review DB tables.
Week 2: Public website (browse, search, skill detail pages, publisher portal).
Week 3: Rating/review UI, `carina hub` CLI commands, domain deployment.

**2-3 weeks total.**

### Pre-work checklist
- [ ] Read `hub/server.ts` (17KB); map all existing API endpoints
- [ ] Read `hub/marketplace-install.ts` (10.8KB); audit install pipeline
- [ ] Read `hub/public/index.html` + `hub.js`; understand current frontend state
- [ ] Read `sandbox/sandbox-factory.ts`; understand sandbox for skill security scanning
- [ ] Read `carina-agent-public/README.md`; understand public distribution packaging
- [ ] Check `cli/registry.ts` for any `hub` subcommands that already exist

---

## GAP 4; DOCKER: Minor Correction

### Reality: Supervisord is already used

`docker/supervisor/` exists with at minimum `carina-hub.conf` for the hub process. This confirms supervisord (not s6-overlay) is the current process manager.

**What exists:**
```
docker/Dockerfile.carina; multi-stage build (exists)
docker/docker-entrypoint.sh; entrypoint (exists)
docker/nginx/; nginx configs (exist)
docker/postgres/; postgres init (exists)
docker/supervisor/; supervisord configs
  carina-hub.conf; hub supervisor config (exists)
  carina-core.conf; MISSING
  carina-gateway.conf; MISSING
  carina-web.conf; MISSING
```

**What's missing:**
- Supervisor configs for core/gateway/web (only hub has one)
- Docker HEALTHCHECK directive
- `docker-compose.yml` exists at repo root for dev stack (postgres + redis). Production version `docker-compose.prod.yml` also exists. These need review and testing.

**Also exists at repo root:**
- `docker-compose.yml`; postgres + redis dev stack
- `docker-compose.prod.yml`; production stack
- `docker-compose.verlox.yml`; VERLOX personal full stack (admin + scout)

### Decision: Supervisord vs s6-overlay

Original recommendation was s6-overlay. Given that supervisord is already wired and working for the hub, the practical path is:

**Option A (Recommended):** Add supervisor configs for core/gateway/web. Add HEALTHCHECK. Faster; less disruption.
**Option B:** Full s6-overlay migration. Follow prompt 04 as written. More work but cleaner long-term.

Decide before starting. Both options are valid. If shipping within 1 week, choose Option A.

### Pre-work checklist
- [ ] Read `docker/Dockerfile.carina`; audit existing multi-stage build
- [ ] Read `docker/docker-entrypoint.sh`; understand init sequence
- [ ] Read `docker/supervisor/carina-hub.conf`; use as template for core/gateway/web
- [ ] Check `docker-compose.yml` and `docker-compose.prod.yml`; confirm service definitions
- [ ] Decide: supervisord extension vs s6-overlay migration

---

## GAP 5; SECURITY GOLD STANDARD: Sandbox and Certification Already Built

### Updated security file count

The security directory has grown from 39 to 61 files. Notable additions:

```
ADDED to src/security/ since original count:
  admin-tool-policy.ts; admin tool access policy
  agent-guard-adapter.ts; agent guard integration
  gateway-exposure.ts; gateway security exposure
  runtime-isolation.ts; runtime process isolation
  sandbox-policy.ts; sandbox security policy
  security-guardrails.ts; LLM guardrails
  tool-execution-context.ts; tool execution context tracking
  tool-runner-security.ts; tool runner security layer
  (plus new test files)

ADDED as new infrastructure:
  src/sandbox/; complete sandbox factory (reduces Gap 5 Phase 1-2 effort)
  src/certification/built-on-carina.ts; certification system (reduces Gap 5 Phase 4 effort)
```

### Impact on Gap 5 prompts

**Prompt 09 (RASP engine):** The sandbox is largely built. `sandbox-factory.ts` selects between docker-runner, worker-sandbox, and openshell-sandbox. The RASP engine should integrate with this rather than build a new sandbox. Reduce effort estimate from 4 weeks to 2-3 weeks.

**Prompt 11 (Enterprise governance):** `certification/built-on-carina.ts` exists. This is the "Built on Carina" certification issuance. Wire it into the governance framework rather than building from scratch. Reduce by ~1 week.

**Prompt 08 (Compliance automation):** `trust-compliance-report.ts` exists. `security-audit.ts` and `security-doctor.ts` exist. These feed directly into SOC2/ISO27001/GDPR automation. Less to build from scratch.

**Prompt 03 (Automated security review):** `hub/validate.ts` exists (5.4KB). Wire `sandbox-factory.ts` into it. The scanner is partially built.

### Updated security posture

```
CURRENT (2026-06-18): 61 files, ~200KB+.
  Prevention: prompt-guard, tool-policy, exec-approval-levels, egress-filter, sandbox-policy, runtime-isolation, gateway-exposure, channel-security-defaults
  Detection: tool-sequence-guard, honeypot-client, deception-client, trust-state, kill-switch-listener
  Response: shield-report, trust-compliance-report, jit-credentials
  New: admin-tool-policy, agent-guard-adapter, tool-execution-context, tool-runner-security, security-guardrails
  Sandbox: sandbox-factory, docker-runner, worker-sandbox, openshell-sandbox
  Certification: built-on-carina.ts

TARGET: 100+ files, 500KB+. All phases of Gap 5 completed.
```

### Pre-work checklist
- [ ] Read `sandbox/sandbox-factory.ts`; understand sandbox selection logic
- [ ] Read `sandbox/docker-runner.ts`; understand Docker sandbox
- [ ] Read `security/sandbox-policy.ts`; understand sandbox security rules
- [ ] Read `security/runtime-isolation.ts`; understand process isolation
- [ ] Read `certification/built-on-carina.ts`; understand certification for governance
- [ ] Audit each Gap 5 prompt against what sandbox + certification already cover

---

## GAP 6; WEBUI UPGRADE: Major Redesign Completed

### What the redesign (commit ca7c33c) delivered

The commit "feat(app.carinaai.uk): complete UI redesign - 3-zone shell, rich chat, panels" covered:

```
DONE by redesign:

Shell:
  components/shell/AppSidebar.tsx; Left sidebar nav
  components/shell/CommandPalette.tsx; Keyboard-first command search
  components/shell/GlobalShortcuts.tsx; Keyboard shortcut bindings
  components/shell/ShortcutsPanel.tsx; Shortcuts reference panel
  components/shell/ThemeProvider.tsx; Dark/light/system theme
  components/shell/CoreSurfaceBanner.tsx; Core surface connection banner
  components/shell/KeysBanner.tsx; API keys missing banner
  components/shell/PanelProvider.tsx; Right panel state management

Chat:
  components/chat/ThinkingBlock.tsx; Reasoning/thinking block display
  components/chat/ToolCallBlock.tsx; Tool call + result display
  components/chat/StreamingMessage.tsx; Token-by-token streaming
  components/chat/AssistantMessage.tsx; Full assistant message with metadata
  components/chat/UserMessage.tsx; User message with edit support
  components/chat/MarkdownContent.tsx; Markdown with code highlighting
  components/chat/ChatInputBar.tsx; Multi-line composer with attachments
  components/chat/AttachPanel.tsx; File/URL attach panel
  components/chat/ContextChips.tsx; Context pins shown as chips
  components/chat/ModelSelectorPopover.tsx; Per-session model selector
  components/chat/SessionHeader.tsx; Session title + model header
  components/chat/CopyButton.tsx; Message copy-as-markdown
  components/chat/ChatErrorMessage.tsx; Error display with retry
  components/chat/ChatView.tsx; Full session page
  components/chat/ChatPanel.tsx; Chat zone container
  lib/chat-errors.ts; Error classification and messages

Panels:
  components/panels/MemoryPanel.tsx; Right-side memory panel
  components/panels/NotesPanel.tsx; Right-side notes panel
  components/panels/SkillsPanel.tsx; Right-side skills browser panel

Billing:
  components/billing/BillingClient.tsx; Full billing management page
  components/billing/UsageMeter.tsx; Usage metrics with quota bar
  components/billing/PlanCard.tsx; Plan comparison cards

Settings:
  components/settings/AppearanceSettings.tsx; Theme + font + density
  components/settings/ThemeSelector.tsx; Theme picker

Vault:
  components/vault/AddKeyDialog.tsx; Add API key dialog
  components/vault/DeleteKeyButton.tsx; Delete key with confirm
  components/vault/KeyRow.tsx; Key row with masked display

Brain settings:
  lib/brain-settings.ts; Brain/config property injection
  lib/brain-settings-types.ts; Types for brain settings
  lib/brain-extract.ts; Brain property extraction

Core surface:
  lib/core-surface.ts; Connection to core Carina agent
  lib/core-proxy.ts; Proxy requests to core
```

### What is STILL missing (what prompts 01-07 need to build)

```
MISSING (still needed from gap-06 prompts):

From prompt 01 (PTY bridge):
  No /terminal page
  No xterm.js embed
  No PTY backend bridge

From prompt 02 (Admin pages):
  No /cron page (cron job management)
  No /webhooks page (webhook management)
  No /mcp page (MCP server management)
  No /analytics page
  No /logs page
  No /files page (file browser)
  No /env page (environment variables)
  No /profiles page (profile switcher)
  No /system page

From prompt 03 (i18n):
  No i18n system in app.carinaai.uk
  No language switcher
  No translated strings
  NOTE: core.carinaai.uk has src/i18n/. Use its format as the template.

From prompt 04 (canvas):
  No canvas/artifact renderer
  No artifact viewer component
  No multi-window support

From prompt 05 (chat enhancements):
  Heartbeat status display: MISSING (CoreSurfaceBanner exists for connection but no live heartbeat widget)
  Context warnings: MISSING (context limits approaching - no warning banner)
  Composer persistence: MISSING (draft not saved across reloads)
  Message export: PARTIAL (CopyButton exists for per-message copy; no session-level export)
  Deleted message handling: MISSING

From prompt 06 (PWA):
  No service worker
  No web app manifest
  No offline queue
  No install prompt

From prompt 07 (Odysseus UX):
  Entity anchors: MISSING (no clickable #session-x, #document-y links)
  QR code generation: MISSING
  Companion pairing UI: MISSING (backend built in src/pairing/, only needs frontend)
  Navigation efficiency: PARTIAL (CommandPalette done; session creation friction still exists)
```

### Revised effort per prompt

| Prompt | Original | Revised | Reason |
|--------|----------|---------|--------|
| 01 PTY bridge | 2 weeks | 2 weeks | No change; entirely missing |
| 02 Admin pages | 4 weeks | 4 weeks | No change; entirely missing |
| 03 i18n | 3 weeks | 3 weeks | Core i18n format helps; app still needs full treatment |
| 04 Canvas | 2 weeks | 2 weeks | No change |
| 05 Chat enhancements | 2 weeks | 1 week | CopyButton done; heartbeat, context warnings, persistence, export remain |
| 06 PWA | 1 week | 1 week | No change |
| 07 Odysseus UX | 2 weeks | 1 week | CommandPalette done; entity anchors, QR, pairing UI (backend done), nav efficiency remain |

**Total revised: 14 weeks (down from 16). Parallelization: ~11 weeks.**

### Updated build order

```
Phase 1; Foundation (Weeks 1-3)
  03-openclaw-i18n.md; i18n infrastructure (touches every page)
  06-odysseus-pwa.md; PWA (independent)

Phase 2; Chat (Weeks 4-5)
  05-openclaw-chat-enhancements.md; Heartbeat, persistence, context warnings, export
  07-odysseus-ux.md; Entity anchors, QR, pairing UI (backend done), nav polish

Phase 3; Power Tools (Weeks 6-7)
  01-hermes-pty-bridge.md; Embedded terminal
  04-openclaw-canvas.md; Artifact rendering

Phase 4; Admin (Weeks 8-11)
  02-hermes-admin-pages.md; Cron, Webhooks, MCP, Analytics, Logs, Files, Env, Profiles
```

### Pre-work checklist
- [ ] Read all files in `app.carinaai.uk/src/components/` to understand what redesign built
- [ ] Read `app.carinaai.uk/src/lib/core-surface.ts`; understand core connection
- [ ] Read `src/pairing/pairing.ts`; understand pairing backend before building pairing UI
- [ ] Read `src/i18n/index.ts` in core; use format as template for app i18n
- [ ] Check `app.carinaai.uk/src/app/(workspace)/` for existing routes to avoid collisions

---

## GAP 7; TUI/CLI UPGRADE: Partial Completion

### What has been added to CLI since original analysis

```
cli/first-run.ts; First-run detection + setup prompt
cli/first-run-onboarding.ts; Onboarding flow (interactive)
cli/onboarding-gateway.ts; Gateway-based onboarding (VERLOX mode)
cli/completion-metadata.ts; Shell completion metadata for fish/zsh/bash
cli/completion-metadata.test.ts
```

This reduces the onboarding phase (second half of Gap 7) by approximately 2 weeks. The basic first-run flow and shell completion metadata are scaffolded.

### What is still missing from Gap 7

From the GOLD-STANDARD-TUI-CLI.md:

```
TUI Chat Mode (from Hermes):
  Full Ink-based React TUI; NOT YET STARTED
  The existing tui/ uses readline (src/tui/app.ts uses readline-based layout)
  Streaming markdown in terminal: MISSING
  Tool call display in terminal: MISSING
  Approval prompts in terminal: MISSING
  Model picker in terminal: MISSING

CLI Interactive Mode:
  Enhanced @inquirer/prompts usage: PARTIAL (entrance.ts has some)
  Fuzzy autocomplete for slash commands: MISSING
  Gradient/boxen startup screen: MISSING
  Session history with fuzzy search: MISSING

CLI Command Mode:
  commands/config: EXISTS
  commands/local: EXISTS
  Expand registry from 75 to 150+ commands: PARTIAL
  Shell completions (fish/zsh/bash): PARTIAL (completion-metadata.ts exists)
  JSON output mode --json: MISSING

Onboarding:
  First-run detection: DONE (first-run.ts)
  Interactive onboarding: DONE (first-run-onboarding.ts)
  Gateway onboarding: DONE (onboarding-gateway.ts)
  Provider bootstrap: EXISTS (provider-bootstrap.ts)
  Multi-step setup wizard: MISSING (only individual pieces)
  Animated typing effect on first run: MISSING
  ASCII art branding: MISSING
```

### Corrected effort
Part 1 (TUI + CLI enhancement): 12 weeks (down from 14)
Part 2 (Onboarding): 8 weeks (down from 12; first-run + gateway done)

**Total: ~20-22 weeks with parallelization.**

### Pre-work checklist
- [ ] Read `cli/first-run.ts`; understand what onboarding already exists
- [ ] Read `cli/onboarding-gateway.ts`; understand gateway onboarding flow
- [ ] Read `cli/completion-metadata.ts`; understand completion scaffold
- [ ] Read `tui/app.ts` (13KB); understand existing readline-based TUI
- [ ] Read `cli/registry.ts` (24KB); understand existing 75+ commands
- [ ] Decide: enhance existing readline TUI vs rewrite with Ink (recommendation: Ink for new chat mode, keep readline for operator mode)

---

## SUMMARY: CORRECTED EFFORT ESTIMATES

Delivery model: 3 parallel AI agents (Cursor + Claude Code + Codex), 7-10h/day. Estimates in DAYS.

| # | Gap | Days (parallel agents) | Agent assignment | Main change from original |
|---|-----|------------------------|-----------------|---------------------------|
| 1 | Desktop App | 4-5 days | Cursor primary | Pre-work: LSP + pairing backend now exist |
| 2 | Mobile Depth | 2-3 days | Codex primary | Pairing backend done; companion = hours not a day |
| 3 | Skill Hub | 1-2 days | Claude Code primary | Backend 90%+ done; carina-agent-public exists |
| 4 | Docker | 1 day | Codex | Option A (extend supervisord) = 4-6 hours |
| 5 | Security | 10-14 days | Claude Code primary | Sandbox built; certification built; 61 files |
| 6 | WebUI | 5-7 days | Cursor primary | Redesign did chat+shell+billing; 16 features remain |
| 7 | TUI/CLI | 8-10 days | Cursor + Codex | Onboarding started; completions scaffolded |

**Total with 3 parallel agents at 7-10h/day: ~12-16 calendar days.**