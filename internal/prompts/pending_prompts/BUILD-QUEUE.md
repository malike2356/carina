# BUILD QUEUE

**Updated:** 2026-06-21 (codebase-verified)
**Rule:** Work top to bottom. Within each gap, build prompts in numbered order.
Prompts marked `[parallel]` can run in different agents simultaneously.
Prompts with no marker must finish before the next one starts.

---

## How to use this file

1. Find the first item not marked DONE.
2. Open the prompt file. Read its README first.
3. When finished, follow POST-BUILD-CHECKLIST.md, then come back and update the status.

---

## What was verified against the codebase (2026-06-21)

The following gap-XX directories in sprint-2 are already implemented in source.
They have been moved to `_superseded/` and are NOT in this queue:

| Directory | Key proof |
|-----------|-----------|
| gap-09-performance-parity (11/12 prompts) | prompt-cache.ts, auxiliary-client.ts, session-fts-search.ts, skin-store.ts, cron-context-chain.ts (context_from/no_agent), provider-pool.ts, user-model.ts, acp-server.ts all exist in src/ |
| gap-22-sandbox-isolation | sandbox-factory.ts wired to code.ts; docker-sandbox.ts, worker-sandbox.ts, openshell-sandbox.ts all present |

One item from gap-09 is NOT yet built: **Porcupine hardware wake word on iOS/Android**
(gap-09 prompt 07). This belongs in gap-03-mobile, not performance-parity. It is
listed in Block 11 (large product gaps) under gap-03-mobile.

The 11 old-numbered directories (02-web-ui-remaining through 12-voice-agent) were also
verified built and are in `_superseded/`. Their gap-XX equivalents supersede them.

---

## QUEUE

### BLOCK 0: Infrastructure and portability (no dependencies, build first)

These give everything else a clean foundation: auto-deploy and machine-portable paths.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 0.1 | `sprint-2/gap-14-deploy-pipeline/01-github-actions-deploy.md` | Claude Code | DONE |
| 0.2 | `sprint-2/gap-14-deploy-pipeline/02-server-bootstrap.md` [parallel with 0.1] | Claude Code | DONE |
| 0.3 | `sprint-2/gap-14-deploy-pipeline/03-dev-env-alignment.md` [parallel with 0.1] | Claude Code | DONE |
| 0.4 | `sprint-2/gap-15-portability/01-nginx-static-volume.md` | Claude Code | DONE |
| 0.5 | `sprint-2/gap-15-portability/02-ops-path-resolution.md` [parallel with 0.4] | Claude Code | DONE |
| 0.6 | `sprint-2/gap-15-portability/03-deploy-parametrize.md` [after 0.4] | Claude Code | DONE |
| 0.7 | `sprint-2/gap-13b-docker-vps-cutover/04-cutover.md` (VPS SSH manual step, not code) | manual | pending |
| 0.8 | `sprint-2/gap-13b-docker-vps-cutover/05-cleanup.md` (VPS SSH manual step, not code) | manual | pending |

---

### BLOCK 1: Ops server panel (standalone, no product dependencies)

01 creates server-panel.ts and server-fs.ts. Both 02 and 03 extend those files,
so 01 must merge before 02 or 03 starts.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 1.1 | `sprint-2/gap-31-ops-server-panel/01-file-browser.md` | Cursor | DONE |
| 1.2 | `sprint-2/gap-31-ops-server-panel/02-service-control.md` [after 1.1] | Cursor | DONE |
| 1.3 | `sprint-2/gap-31-ops-server-panel/03-log-streamer.md` [after 1.1] | Cursor | DONE |

---

### BLOCK 2: Truth in advertising (build before any UI that shows capability claims)

Prompt 01 creates the central capability-contract module referenced by all other
prompts in this gap. Ship 01 first. Prompts 02, 03, 04, 05 can run in parallel
once 01 is merged.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 2.1 | `sprint-2/gap-13-truth-in-advertising/01-surface-capability-contract.md` | Claude Code | DONE |
| 2.2 | `sprint-2/gap-13-truth-in-advertising/02-channel-aware-quick-replies.md` [after 2.1] | Claude Code | DONE |
| 2.3 | `sprint-2/gap-13-truth-in-advertising/03-cloud-chat-identity.md` [parallel with 2.2] | Claude Code | DONE |
| 2.4 | `sprint-2/gap-13-truth-in-advertising/04-secret-refusal-output-guard.md` [parallel with 2.2] | Claude Code | DONE |
| 2.5 | `sprint-2/gap-13-truth-in-advertising/05-memory-and-tool-honesty.md` [parallel with 2.2] | Claude Code | DONE |
| 2.6 | `sprint-2/gap-13-truth-in-advertising/06-cloud-ui-capability-badges.md` [after 2.3] | Cursor | DONE |
| 2.7 | `sprint-2/gap-13-truth-in-advertising/07-writing-style-all-surfaces.md` [after 2.2] | Claude Code | DONE |
| 2.8 | `sprint-2/gap-13-truth-in-advertising/08-capability-inventory-ci-guard.md` [after 2.1-2.7] | Claude Code | DONE |

---

### BLOCK 3: Thinking architecture and OpenAI-compatible API (backend, no UI deps)

These are independent of each other and can run in parallel.

gap-21: tiered thinking levels (off/low/medium/max) and per-session token spend
tracking. ThinkingBlock.tsx exists in the TUI already; this gap adds the
budget controls and trajectory recording wired into the brain layer.

gap-23: expose HTTP /v1/chat/completions, /v1/models, /v1/embeddings so any
OpenAI-compatible client can use Carina as a backend. The provider client adapter
(openai-compatible-provider.ts) already exists; this gap adds the server-side routes.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 3.1 | `sprint-2/gap-21-thinking-architecture/01-thinking-levels.md` | Claude Code | DONE |
| 3.2 | `sprint-2/gap-21-thinking-architecture/02-token-tracking.md` [after 3.1] | Claude Code | DONE |
| 3.3 | `sprint-2/gap-21-thinking-architecture/03-trajectory-bundles.md` [after 3.1] | Claude Code | DONE |
| 3.4 | `sprint-2/gap-23-openai-compatible-api/01-chat-completions.md` [parallel with 3.1] | Claude Code | DONE |
| 3.5 | `sprint-2/gap-23-openai-compatible-api/02-responses-embeddings.md` [after 3.4] | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`.

---

### BLOCK 4: Command and event backend (backend before its UI)

Queue core (01) must exist before session coordination (02) and queue modes (03)
can reference its types. Standing orders core (01) before commands/UI (02).
Find-act schema (01) before pipeline (02), modal UI (03), resolve API (04), etc.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 4.1 | `sprint-2/gap-24-command-queue/01-queue-core.md` | Claude Code | DONE |
| 4.2 | `sprint-2/gap-24-command-queue/02-session-coordination.md` [after 4.1] | Claude Code | DONE |
| 4.3 | `sprint-2/gap-24-command-queue/03-queue-modes-slash.md` [after 4.1] | Claude Code | DONE |
| 4.4 | `sprint-2/gap-18-standing-orders/01-standing-orders-core.md` | Claude Code | DONE |
| 4.5 | `sprint-2/gap-18-standing-orders/02-commands-and-ui.md` [after 4.4] | Claude Code | DONE |
| 4.6 | `sprint-2/gap-11-find-act-security-response/01-event-action-schema.md` | Claude Code | DONE |
| 4.7 | `sprint-2/gap-11-find-act-security-response/02-auto-response-pipeline.md` [after 4.6] | Claude Code | DONE |
| 4.8 | `sprint-2/gap-11-find-act-security-response/03-human-action-modal-ui.md` [after 4.6] | Cursor | DONE |
| 4.9 | `sprint-2/gap-11-find-act-security-response/04-resolve-api-endpoints.md` [after 4.7] | Claude Code | DONE |
| 4.10 | `sprint-2/gap-11-find-act-security-response/05-telegram-action-guidance.md` [after 4.9] | Claude Code | DONE |
| 4.11 | `sprint-2/gap-11-find-act-security-response/06-action-audit-dashboard.md` [after 4.9] | Cursor | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`.

---

### BLOCK 5: Identity, sessions, channel docking

Identity links (01) creates the link model. Shared sessions (02) and channel
docking (03) both reference it.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 5.1 | `sprint-2/gap-19-identity-links-channel-docking/01-identity-links.md` | Claude Code | DONE |
| 5.2 | `sprint-2/gap-19-identity-links-channel-docking/02-shared-sessions.md` [after 5.1] | Claude Code | DONE |
| 5.3 | `sprint-2/gap-19-identity-links-channel-docking/03-channel-docking.md` [after 5.1] | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`.

---

### BLOCK 6: Node system (protocol before everything that renders it)

Node protocol (01) defines the message format that canvas host (02) renders and
camera/device prompts (03, 04) extend.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 6.1 | `sprint-2/gap-20-node-system/01-node-protocol.md` | Claude Code | DONE |
| 6.2 | `sprint-2/gap-20-node-system/02-canvas-host.md` [after 6.1] | Cursor | DONE |
| 6.3 | `sprint-2/gap-20-node-system/03-camera-screen-location.md` [after 6.1] | Codex | DONE |
| 6.4 | `sprint-2/gap-20-node-system/04-device-trust.md` [after 6.1] | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`. Mobile Canvas/native capability clients are follow-up work outside this server block.

---

### BLOCK 7: Scout product engine

Scout engine core (01) is a prerequisite for scoring (02) and everything else.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 7.1 | `sprint-2/gap-12-scout-product/01-scout-engine-core.md` | Claude Code | DONE |
| 7.2 | `sprint-2/gap-12-scout-product/02-scout-score-engine.md` [after 7.1] | Claude Code | DONE |
| 7.3 | `sprint-2/gap-12-scout-product/03-09-scout-dashboard-alerting-monitoring-reporting-api-onboarding-cli.md` [after 7.2] | Claude Code + Cursor | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`. Block 7 closed timezone bug, API auth/OpenAPI, onboarding wizard, and CLI product subcommands.

---

### BLOCK 8: Launcher redesign (UI - after backend blocks above are stable)

Primary state (01) must exist before sidebar (02) and expanded (03). Desktop (04),
mobile (05), TUI (06) launchers are independent of each other. Data wiring (07)
requires all surfaces.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 8.1 | `sprint-2/gap-16-launcher/01-web-launcher-primary-state.md` | Cursor | DONE |
| 8.2 | `sprint-2/gap-16-launcher/02-web-launcher-sidebar-state.md` [after 8.1] | Cursor | DONE |
| 8.3 | `sprint-2/gap-16-launcher/03-web-launcher-expanded-state.md` [after 8.1] | Cursor | DONE |
| 8.4 | `sprint-2/gap-16-launcher/04-desktop-launcher.md` [parallel with 8.1] | Cursor | DONE |
| 8.5 | `sprint-2/gap-16-launcher/05-mobile-launcher.md` [parallel with 8.1] | Codex | DONE |
| 8.6 | `sprint-2/gap-16-launcher/06-tui-launcher.md` [parallel with 8.1] | Claude Code | DONE |
| 8.7 | `sprint-2/gap-16-launcher/07-data-wiring.md` [after 8.1-8.6] | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`. Web launcher uses primary/sidebar/expanded state machine; desktop cold-starts at `/launcher`; mobile skips launcher when active session; TUI loads real entrance data.

---

### BLOCK 9: App navigation and wayfinding (UI - app.carinaai.uk)

16 of 23 app routes are not in the sidebar. These prompts fix that. Sequential
within the gap.

| Order | File | Agent | Status |
|-------|------|-------|--------|
| 9.1 | `sprint-2/gap-32-navigation-and-wayfinding/01-navigation-config.md` | Cursor | DONE |
| 9.2 | `sprint-2/gap-32-navigation-and-wayfinding/02-breadcrumb-and-page-header.md` [after 9.1] | Cursor | DONE |
| 9.3 | `sprint-2/gap-32-navigation-and-wayfinding/03-sidebar-nav-groups.md` [after 9.1] | Cursor | DONE |
| 9.4 | `sprint-2/gap-32-navigation-and-wayfinding/04-command-palette-and-settings-hub.md` [after 9.1-9.3] | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`. Full route inventory in workspace-nav.ts; sidebar nav groups, breadcrumbs, command palette, and settings back links.

---

### BLOCK 10: Documentation (fully independent, run any time in parallel with other blocks)

| Order | Gap | Agent | Status |
|-------|-----|-------|--------|
| D1 | `sprint-2/gap-25-install-onboarding-docs/` (all prompts in numbered order) | Claude Code | DONE |
| D2 | `sprint-2/gap-26-channel-docs/` | Claude Code | DONE |
| D3 | `sprint-2/gap-27-architecture-docs/` | Claude Code | DONE |
| D4 | `sprint-2/gap-28-plugin-automation-docs/` | Claude Code | DONE |
| D5 | `sprint-2/gap-29-operations-health-docs/` | Claude Code | DONE |
| D6 | `sprint-2/gap-30-model-providers-security-docs/` | Claude Code | DONE |

Note: archived under `internal/prompts/archived_prompts/pending_prompts/sprint-2/`. 27 new doc pages in `frontends/marketing/docs.carinaai.uk/`; sidebar expanded for install, gateways, architecture, plugins, ops, and security.

---

### BLOCK 11: Large product gaps (long-running, internal ordering only)

Each gap is internally ordered (01 before 02, etc.) but gaps do not block each
other. Run in parallel across agents.

Note on gap-03-mobile: FULLY BUILT 2026-06-22. All four prompts archived. Native layer in `frontends/client-apps/carinaMobile/` (background WS, camera/motion, SMS/call/notification relay, companion pairing). Porcupine voice wake shipped separately via `withVoiceWake.js`.

| Gap | Internal order | Agent | Status |
|-----|----------------|-------|--------|
| `sprint-2/gap-02-carina-hub/` | 01 then 02 then 03, then 04+05 parallel | Cursor + Claude Code | DONE (verified built) |
| `sprint-2/gap-03-mobile/` | 01-04 | Codex + Cursor | DONE (archived 2026-06-22) |
| `sprint-2/gap-04-desktop/` | 01 through 06 sequential | Cursor | DONE (offline sync shipped 2026-06-21; see 07-offline-sync.md) |
| `sprint-2/gap-05-security/` | see gap-05-security/README.md | Claude Code + Codex | DONE (verified built; archived 2026-06-21) |
| `sprint-2/gap-06-webui/` | 01+02 done; start at 03 (i18n), then 04-08 | Cursor + Claude Code | partial (08 window system DONE; archive other built prompts) |
| `sprint-2/gap-07-tui-cli/` | shell completions only (rest built) - start at 05 | Codex | DONE (verified built) |
| `sprint-2/gap-08-enterprise-security/` | 01 then 02-06 in pairs | Claude Code + Codex | DONE (archived 2026-06-21) |
| `sprint-1/gap-10-incident-blog/` | 01 then 03 parallel, then 02+04, then 05 | Claude Code | partial (core store/tools/ops API built; verify dual-interface + newsletter) |

Note on gap-06-webui: prompts 01 (PTY bridge), 02 (admin pages), 03 (i18n),
04 (canvas), 05 (chat enhancements), 06 (PWA), 07 (Odysseus UX), and 08 (window
system) are built in `frontends/client-apps/app.carinaai.uk/`. Remaining prompt
files in pending may still need archival. Future phases from prompt 08 (background
effects, host status panel, Ctrl+1-9 focus) are optional follow-ups.

Note on gap-07-tui-cli: Ink TUI, approval flow, operator enhancements, CLI
commands, interactive mode, and shell completions (`src/cli/completions/`,
`carina completion <shell>`) are all built.

Note on gap-05-security: all 13 core modules, 72 cyber tools, tiered gating,
Scout SOC visibility, and de-referencing are built under
`backends/servers/core.carinaai.uk/src/security/` and related paths. Prompt
folder archived to `internal/prompts/archived_prompts/pending_prompts/sprint-2/gap-05-security/`.
Optional follow-ups from cyber-tools README: blue-team/SOC tool batch (~20-25 prompts).

Note on gap-08-enterprise-security: operational layer shipped in
`backends/servers/core.carinaai.uk/src/enterprise/security/` (SSO federation,
immutable audit, residency, DR, zero-trust, SOC2 packager). Prompt folder archived.

Block 11 session (2026-06-21): shipped web UI i18n (`src/i18n/`, 12 locales,
`LanguageSwitcher`, sidebar/chat/settings wired, RTL for Arabic).

---

## Dependency summary

```
BLOCK 0 (infra) - no deps, start first
BLOCK 1 (ops panel) - standalone, start any time
BLOCK 2/01 (capability contract) - must land before 2/02-08
BLOCK 3 (thinking + openai compat) - standalone backend
BLOCK 4/01 (queue core) - before 4/02-03
BLOCK 4/06 (event schema) - before 4/07-11
BLOCK 5/01 (identity links) - before 5/02-03
BLOCK 6/01 (node protocol) - before 6/02-04
BLOCK 7/01 (scout engine) - before 7/02-03
BLOCK 8/01 (launcher primary) - before 8/02-03; 8/07 needs all 8/01-06
BLOCK 9/01 (nav primary) - before 9/02-04
BLOCKS 10-11 - independent, run any time
```

---

## Superseded (do not build from these)

`sprint-2/_superseded/` contains:
- 11 old numbered sprint-2 directories (02 through 12) - all features present in codebase
- gap-09-performance-parity - 11/12 prompts verified built; one item (Porcupine wake word) moved to gap-03-mobile scope
- gap-22-sandbox-isolation - Docker/worker/OpenShell sandbox factory wired to tool calls; SSH backend absent but gap goal is met
- gap-15-workspace-project - planning docs only, no buildable prompts
