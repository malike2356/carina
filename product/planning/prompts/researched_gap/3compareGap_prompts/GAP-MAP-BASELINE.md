# Gap Map Baseline (OpenClaw + Hermes + Odysseus vs Carina + Scout)

**Created:** 2026-06-17  
**Purpose:** Single deduped adoption map for prompt pack `3compareGap_prompts/` (prompts 01-09).  
**Constraint:** Carina keeps its kernel, Scout boundary, MIT positioning, and shipped systems. Adopt missing behavior only; do not merge the three source agents into a clone.
**Reuse rule:** keep the behavior, rewrite the voice. No copied prompt, label, comment, or UI string should ship verbatim unless a license, protocol, or API contract requires exact text.

**End state:** Carina filled out where it was thin, not "three agents merged."

## Implementation progress (2026-06-17)

Prompts **06-09** are implemented in `core.carinaai.uk/` (docs + tests). Prompts **01-05** and **02-03** companion/security items remain the main open adoption work.

| Prompt | Outcome (high level) |
|---|---|
| **06** | Messenger `/new`, `/reset`, `/stop`, `/status`, compact `/help`; provider fallback in status; `docs/messaging-gateway.md` |
| **07** | Research list/get + saved metadata; compare provider picker; documents import; `docs/workspace-research-compare.md` |
| **08** | `/scheduled` page + API; email unread/reply; notes deep links; calendar links; `docs/workspace-productivity.md` |
| **09** | TOTP 2FA; theme disk persistence; workspace presets; gallery upload; session pins; `docs/workspace-personalization.md` |

**Still open (recommended next):** 01 onboarding/routing, 04 learning loop UX, 05 TUI/cron depth, 02 voice/canvas/companion, 03 remote-access doc pass (code largely shipped).

| Inherited quality | Primary source | Carina outcome |
|---|---|---|
| Easier start, route, and channel behavior | OpenClaw | Guided onboarding, explicit routing, companion polish |
| Self-improving and operational | Hermes | Learning loop UX, skills, subagents, automation, TUI depth |
| Full workspace product feel | Odysseus | Research, compare, writing, email, notes, calendar, media, themes, auth polish |

**Read alongside:** `instructions/prompts/prompts-archive/agent_research/IMPLEMENTATION-TRACKER.md` (2026-06-16 audit).

---

## Status legend

| Status | Meaning |
|---|---|
| **already in Carina** | Shipped in `core.carinaai.uk/`; do not reimplement |
| **already in Scout** | Scout owns this boundary; Carina integrates via API only |
| **partial** | Core exists; product UX, docs, or wiring still thin |
| **missing** | Not present or not user-facing |
| **not worth adopting** | Redundant, wrong license fit, or conflicts with Carina/Scout model |

---

## Summary counts (deduped features)

| Status | Count |
|---|---:|
| already in Carina | 44 |
| already in Scout | 8 |
| partial | 26 |
| missing | 8 |
| not worth adopting | 11 |

**Real adoption work** concentrates in **partial** and **missing** rows mapped to prompts 01-09 below.

---

## Onboarding and setup

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Guided CLI onboarding wizard | `openclaw onboard` | `hermes setup` | Docker first-login | **partial** | `carina onboard`, `first-run-onboarding.ts`, `setup.ts`; channel/daemon steps less guided than OpenClaw | 01 |
| Install daemon (systemd/launchd) | yes | yes | Docker default | **already in Carina** | `host/daemon.ts`, `host-cli`, `gateway --install-daemon` pattern | - |
| Doctor / health diagnostics | `openclaw doctor` | `hermes doctor` | compose health | **already in Carina** | `doctor` CLI, setup tests | - |
| First-run channel pairing in wizard | strong | via gateway setup | n/a | **partial** | Adapters exist; wizard does not walk every channel end-to-end | 01 |
| Workspace bootstrap files (SOUL, IDENTITY, AGENTS) | yes | context files | n/a | **already in Carina** | `workspace/context-files.ts`, `identity-defaults.ts` | - |
| Docker standalone compose | yes | n/a | yes | **already in Carina** | `docker-compose.standalone.yml`, container bootstrap | - |
| Unified OAuth portal (Nous Portal) | n/a | yes | n/a | **not worth adopting** | Carina multi-provider model is intentional; no lock-in portal | 06 |
| OpenClaw migration path | n/a | `hermes claw migrate` | n/a | **not worth adopting** | Carina has own onboarding; optional doc note only | - |

---

## Gateway, channels, and routing

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Multi-channel gateway (Telegram, Discord, Slack, WhatsApp, Signal, etc.) | 20+ channels | 6+ channels | n/a | **already in Carina** | 40 adapter files; catalog complete per IMPLEMENTATION-TRACKER | 06 |
| DM pairing / allowlist for untrusted inbound | yes | yes | n/a | **already in Carina** | Channel approval UI, inbound guards | 03 |
| Agent routing by channel/account/peer/workspace | yes | home channel | n/a | **partial** | `inbound-routing.ts`, `agent-routing`; rules exist but not always obvious to operators | 01 |
| Block streaming to messengers | yes | n/a | n/a | **already in Carina** | `block-stream-assembler.ts` | - |
| Messaging slash commands (/model, /new, /stop) | yes | yes | n/a | **partial** | Core commands shipped (06); per-adapter parity may still vary | 06 |
| Cross-surface session continuity | yes | yes | web sessions | **partial** | Session binding exists; phone/CLI thread UX still thin | 06 |
| Remote gateway exposure runbook | strong docs | docs | HTTPS setup | **partial** | Security code exists; operator-facing exposure guidance thinner than OpenClaw | 01, 03 |
| Home Assistant / IoT channel | yes | yes | n/a | **already in Carina** | `homeassistant-channel-adapter.ts` | - |
| IRC, Nostr, Synology, Feishu parity | OpenClaw emphasis | n/a | n/a | **already in Carina** | Stub adapters promoted to live | - |

---

## CLI and TUI

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| CLI command registry + completions | yes | yes | n/a | **already in Carina** | 49 commands, `completion-metadata.ts` | - |
| Full Ink-scale TUI (multiline, slash autocomplete, history) | minimal | 200+ files | n/a | **partial** | `src/tui/` (~11 files); "simple TUI" vs Hermes Desktop depth | 05 |
| Interrupt, redirect, retry, undo flows | n/a | `/retry`, `/undo`, Ctrl+C | n/a | **partial** | Turn discipline shipped; TUI discoverability weak | 05 |
| Terminal backends (Docker, SSH, Modal, Daytona) | node mode | 6 backends | n/a | **partial** | Sandbox/ops exist; Hermes-style remote terminal backend matrix not complete | 05 |
| Provider switch mid-session (`/provider`, `/model`) | yes | yes | UI picker | **already in Carina** | TUI + web provider APIs | 06 |
| Cron / scheduled task CLI | n/a | `hermes cron` | scheduled agents | **partial** | `cron-scheduler.ts` backend; management UX thin | 05 |

---

## Web UI and workspace surfaces

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Core chat + ops dashboard | control UI | Hermes Desktop | full workspace | **already in Carina** | `packages/web/`, route matrix | - |
| Sessions, skills, models, config, logs pages | partial | desktop app | yes | **partial** | Core pages exist; depth vs Hermes/Odysseus uneven (UCG-03) | 05, 09 |
| Deep Research UI + saved reports | n/a | research-ready | yes | **partial** | Productized in 07 (history, cite, continue); cookbook depth still thin | 07 |
| Model Compare (blind side-by-side) | n/a | n/a | yes | **partial** | Workspace flow polished in 07; blind UX may still differ from Odysseus | 07 |
| Writing-first document editor | canvas | n/a | yes | **partial** | Import from research in 07; structured editor UX still backend-heavy | 07 |
| Email inbox (IMAP triage, drafts, tags) | n/a | email channel | yes | **partial** | Triage UI improved in 08 (unread, reply); not full Odysseus parity | 08 |
| Notes | n/a | n/a | yes | **partial** | Deep links, sort, reminder shortcut in 08 | 08 |
| Calendar + CalDAV | n/a | n/a | yes | **partial** | Note links + reminder entry in 08; CalDAV still optional | 08 |
| Taskflows / scheduled workspace actions | n/a | cron delivery | todos + calendar | **partial** | `/scheduled` surface in 08; create/edit flows still CLI-first | 08 |
| Gallery / image editor | n/a | image gen | yes | **partial** | Upload + gallery in 09; no full Odysseus-level editor | 09 |
| Themes + presets | n/a | personalities | yes | **partial** | Disk persistence, presets API, pins in 09 | 09 |
| Cookbook / local model serving | n/a | n/a | yes | **partial** | `/cookbook` route; hardware-aware recommendations thinner than Odysseus | 07 |
| PWA / mobile web polish | companion | n/a | mobile editor | **partial** | `mobile.html`, service worker; HOC-06 partial | 02 |
| i18n (10-20 locales) | strong | docs | n/a | **partial** | en + es backend; not OpenClaw/Hermes scale (DGR-I02) | - |

---

## Mobile and native companion

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| iOS / Android native app | yes | n/a | responsive web | **partial** | `carinaMobile/` Expo companion; not OpenClaw native depth | 02 |
| Voice wake / push-to-talk on device | yes | voice memos | n/a | **missing** | `transcribe-upload.ts` exists; no productized wake/PTT flow | 02 |
| Live Canvas / visual workspace | yes | n/a | n/a | **missing** | No OpenClaw-style live canvas surface | 02 |
| macOS menu bar / Windows Hub | yes | Electron desktop | n/a | **partial** | `native/desktop/README.md` scaffold only; Hermes has full Electron app in source tree | 02, 05 |
| TTS read-aloud in companion | yes | yes | n/a | **partial** | Provider-level TTS possible; not wired as default companion behavior | 02 |

---

## Memory, learning, and skills

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Episodic + semantic memory (pgvector) | MEMORY.md | curated memory | memory | **already in Carina** | Postgres/SQLite/Mem0/Honcho backends | - |
| Learning loop (post-task skill extraction) | skills | closed loop | skills | **partial** | `learning-loop.ts`, `curator.ts`; opt-in and not always user-visible | 04 |
| Autonomous skill create/improve | ClawHub | self-improving skills | skills | **partial** | `workshop-store.ts`, auto-writer opt-in; DGR-SK02 partial | 04 |
| FTS5 cross-session conversation search | n/a | yes + LLM summary | n/a | **partial** | Semantic recall strong; Hermes-style session FTS UX not first-class | 04 |
| Honcho dialectic user modeling | n/a | yes | n/a | **partial** | Honcho backend supported; not default product story | 04 |
| Memory dreaming / nightly consolidation | yes | nudges | n/a | **already in Carina** | `rem-promotion.ts`, `dreams.ts`, `rem-scheduler.ts` | - |
| Skills Hub + marketplace | ClawHub | Skills Hub | n/a | **partial** | Hub sync shipped; ClawHub-scale marketplace partial (DGR-SK03) | 04 |
| Skill security scanning | n/a | n/a | n/a | **already in Carina** | `skill-security.ts` | - |
| Cross-agent skill promotion | n/a | n/a | n/a | **already in Carina** | `cross-agent-learning.ts`, env toggle | - |

---

## Automation, subagents, and delegation

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Subagent spawn + parallel work | subagents | isolated subagents | agents | **already in Carina** | `sub-agent.ts`, push wake, minimal prompt mode | 05 |
| Push-based subagent completion wake | yes | n/a | n/a | **already in Carina** | `subagent-push-wake.ts` | - |
| Cron scheduler + delivery to channels | cron | yes | scheduled tasks | **partial** | Backend complete; create/inspect/manage UI thin | 05 |
| Python tool RPC scripts | n/a | yes | n/a | **not worth adopting** | Carina is TypeScript-native; different collapse pattern | - |
| TaskFlows | n/a | n/a | taskflows | **already in Carina** | TaskFlow engine shipped; surface in 08 | 08 |
| Batch trajectory / training export | n/a | research | n/a | **not worth adopting** | Research niche; not core Carina product | - |

---

## Research, compare, and writing

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Multi-step deep research + SSE progress | n/a | n/a | yes | **already in Carina** | `deep-research.ts`, `research-progress.ts` | 07 |
| Research quality gate + teacher escalation | n/a | n/a | n/a | **already in Carina** | `research-quality-gate.ts`, `teacher-escalation.ts` | - |
| Saved research reopen + cite | n/a | n/a | yes | **partial** | API exists; revisit/citation UX vs Odysseus | 07 |
| Blind model compare + synthesis | n/a | n/a | yes | **partial** | Compare API + page; workspace workflow polish needed | 07 |
| Structured writing editor (suggestions, formats) | canvas | n/a | yes | **partial** | Documents route; editor experience still backend-heavy | 07 |
| Web search (Tavily, SearXNG) | tools | Tool Gateway | yes | **already in Carina** | Tavily default, SearXNG optional | - |

---

## Security and sandbox

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Prompt injection guard | yes | yes | plan mode | **already in Carina** | `prompt-guard.ts` | - |
| Exec approval levels + interactive approval | yes | command approval | plan allowlist | **already in Carina** | `exec-approval-levels.ts`, channel approval UI | 03 |
| Security doctor + advisories feed | yes | docs | setup notes | **already in Carina** | `security-doctor.ts`, advisories CLI | 03 |
| Sandbox defaults for shell/tools | yes | container isolation | local tools warning | **already in Carina** | Ops sandbox layer | 03 |
| Rate limiting on inbound/auth | yes | yes | auth required | **already in Carina** | Gateway + auth rate limits | - |
| Production monitoring + kill switch | n/a | n/a | n/a | **already in Scout** | Scout trust API, Redis control channel; Carina reports via `scout-client.ts` | - |
| Billing / tenant isolation / Stripe | n/a | n/a | n/a | **already in Scout** (billing) / **already in Carina** (hosted) | Scout independence (SCI-*) is Scout work, not Carina adoption | - |
| On-chain trust / attestation | n/a | n/a | n/a | **already in Scout** | ERC-8004/8126 when wallet configured | - |
| Duplicate security stack | n/a | n/a | n/a | **not worth adopting** | Do not add parallel approval system | 03 |

---

## Auth, personalization, and polish

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| Local auth + hosted JWT sessions | gateway token | n/a | 2FA | **already in Carina** | Hosted mode auth, web-auth | - |
| Two-factor authentication (TOTP) | n/a | n/a | yes | **already in Carina** | Web TOTP after password login (09); env or `carina security totp` | 09 |
| Agent-authored themes | n/a | personalities | yes | **already in Carina** | `theme-api.ts` + `themes.json` persistence (09) | 09 |
| Session presets + organization | sessions | sessions | presets | **partial** | Presets API + pins in 09; not full Odysseus preset model | 09 |
| Session anchor links in UI | yes | n/a | n/a | **already in Carina** | `session-anchors.ts` | - |

---

## Observability and ops (mostly covered)

| Feature | OpenClaw | Hermes | Odysseus | Status | Notes | Prompt |
|---|---|---|---|---|---|---|
| OpenTelemetry export | n/a | n/a | n/a | **already in Carina** | DGR-O01 done | - |
| Channel health monitor | n/a | n/a | n/a | **already in Carina** | DGR-O04 | - |
| Usage metrics UI | n/a | n/a | n/a | **already in Carina** | ops telemetry pages | - |
| Provider quota polling | n/a | n/a | n/a | **already in Carina** | DGR-C05 | - |

---

## Scout boundary (do not reimplement in Carina)

These are **already in Scout** or tracked as Scout independence work (SCI-*). Later Carina prompts must not duplicate them.

| Capability | Owner | Carina role |
|---|---|---|
| Security event ingestion + dashboard | Scout | Sanitized telemetry via API |
| Kill switch / throttle control | Scout | Listen on Redis; never block agent on Scout failure |
| Trust dashboard + on-chain attestation | Scout | Optional integration |
| Scout-native checkout, billing, provisioning | Scout | SCI-02..08 commercial blocker |
| `@labyrinthscout/core` npm SDK | Scout | SCI-12 |
| Scout marketing/docs canonical site | Scout | SCI-06, SCI-08 |

---

## Not worth adopting (explicit non-goals)

| Item | Reason |
|---|---|
| AGPL Odysseus license posture | Carina stays MIT |
| Hermes Nous Portal / unified Tool Gateway | Conflicts with bring-your-own-key positioning |
| OpenClaw as runtime identity | Adopt patterns, not branding or CLI parity for its own sake |
| Hermes Python RPC tool collapse | TypeScript-native tool model is intentional |
| Full ClawHub marketplace clone | Skills Hub + partial marketplace sufficient; avoid scope explosion |
| Three separate gateway stacks | One Carina gateway; extend adapters only |
| Scout billing in Carina prompts | SCI tracker owns that workstream |
| 10-20 locale web UI in this pack | Lower priority than workspace gaps (DGR-I02) |
| Research trajectory export for training | Niche Hermes research feature |

---

## Gaps grouped by surface (actionable)

### Onboarding
- **partial:** End-to-end wizard through channels, daemon, and routing rules (prompt 01)
- **partial:** Remote exposure runbook visibility (prompts 01, 03)

### Gateway
- **partial:** Explicit, testable routing rules surfaced to operators (prompt 01)
- **partial:** Messenger slash-command parity and cross-surface continuity (prompt 06)

### CLI / TUI
- **partial:** Hermes-grade TUI (multiline, autocomplete, history, interrupt) (prompt 05)
- **partial:** Cron/automation management from terminal (prompt 05)

### Web UI
- **partial:** Research, compare, documents as product workflows not tech demos (prompt 07; improved, not Odysseus parity)
- **partial:** Email triage, notes revisit, calendar discoverability (prompt 08; improved)
- **partial:** Gallery, themes, presets, session organization (prompt 09; improved; editor still thin)
- **partial:** Ops-adjacent pages depth (sessions, skills, logs) (prompts 05, 09)

### Mobile / companion
- **missing:** Voice wake / PTT as visible product path (prompt 02)
- **missing:** Live canvas / visual workspace (prompt 02)
- **partial:** Native desktop (Electron) and mobile companion depth (prompt 02)

### Memory / skills
- **partial:** User-visible learning loop and skill workshop (prompt 04)
- **partial:** Session search UX comparable to Hermes FTS workflow (prompt 04)

### Security
- **partial:** Operator-facing remote access guidance only; code largely shipped (prompt 03)

### Auth
- ~~**missing:** 2FA/TOTP for hosted/self-hosted auth (prompt 09)~~ **Done (09):** optional web TOTP after password login

---

## Prompt cross-reference

| Prompt | Primary gaps closed | Status focus |
|---|---|---|
| [01-openclaw-onboarding-gateway-and-routing.md](./01-openclaw-onboarding-gateway-and-routing.md) | Onboarding wizard depth, routing rules, remote docs | partial |
| [02-openclaw-voice-canvas-and-companion-surfaces.md](./02-openclaw-voice-canvas-and-companion-surfaces.md) | Voice, canvas, native companion | missing + partial |
| [03-openclaw-security-sandbox-and-remote-access.md](./03-openclaw-security-sandbox-and-remote-access.md) | Exposure runbook, operator guidance | partial (code mostly done) |
| [04-hermes-learning-loop-memory-and-skills.md](./04-hermes-learning-loop-memory-and-skills.md) | Learning loop UX, skill workshop, session search | partial |
| [05-hermes-automation-subagents-and-tui.md](./05-hermes-automation-subagents-and-tui.md) | TUI depth, cron UI, delegation UX | partial |
| [06-hermes-messaging-gateway-and-provider-choice.md](./06-hermes-messaging-gateway-and-provider-choice.md) | Channel entry, model UX, continuity | **done** (2026-06-17) |
| [07-odysseus-research-compare-and-writing-workspace.md](./07-odysseus-research-compare-and-writing-workspace.md) | Research/compare/doc editor productization | **done** (2026-06-17) |
| [08-odysseus-email-notes-calendar-and-taskflows.md](./08-odysseus-email-notes-calendar-and-taskflows.md) | Daily productivity surfaces | **done** (2026-06-17) |
| [09-odysseus-media-themes-presets-and-auth.md](./09-odysseus-media-themes-presets-and-auth.md) | Media, presets, 2FA | **done** (2026-06-17) |

Every prompt above maps to at least one **partial** or **missing** row. No prompt targets **already in Carina** or **already in Scout** rows for reimplementation.

---

## Verification checklist (prompt 00 acceptance)

- [x] Single deduped gap map for OpenClaw, Hermes, and Odysseus
- [x] Each later prompt (01-09) points back to real gaps
- [x] Shipped Carina features (gateway adapters, memory, subagents, security core, research backend) excluded from reimplementation
- [x] Scout-owned boundaries called out explicitly
- [x] End state framed as "Carina filled out," not "three agents merged"

---

## Recommended execution order

1. **01** onboarding/routing (unblocks channel users)
2. **04** learning loop UX (differentiator vs static agents)
3. **05 + 06** operational terminal + gateway polish
4. **07 + 08** workspace productivity surfaces
5. **02 + 09** companion polish and auth
6. **03** last-mile security docs (code largely present)

Scout independence (SCI-*) runs on a separate track; it is not part of this adoption pack.
