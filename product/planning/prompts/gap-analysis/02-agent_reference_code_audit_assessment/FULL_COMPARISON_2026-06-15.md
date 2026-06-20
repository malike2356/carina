# Carina vs Hermes vs OpenClaw vs Odysseus: Full Comparison

**Date:** 2026-06-15
**Carina figures:** verified against `core.carinaai.uk` codebase (direct file audit)
**Hermes/OpenClaw figures:** from published transcript (see `Herme_OpenClaw_Analysis22-25.txt.md`) + public repos; marked *
**Odysseus figures:** from `ODYSSEUS_ANALYSIS.md` + `ODYSSEUS_2026-06-15.md` (source: odysseusai.homes, GitHub); marked **

---

## 1. Platform Identity (What They Actually Are)

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Core identity** | Agent kernel + hosted SaaS platform | Personal agent with self-improving learning loop | Multi-channel messaging gateway with agent inside | Self-hosted AI workspace for individuals and teams |
| **Design-first for** | Builders who need a commercial-grade, secure, extensible agent | Users who want one agent that learns and compounds over time | Users who need the same agent across 50+ messaging platforms | Users who want a beautiful ChatGPT replacement on their own hardware |
| **Architecture origin** | Agent-first with gateway second | Agent-first | Gateway-first (WhatsApp bridge that became a product) | Workspace-first (chat UI that spawned agents) |
| **Language** | Node.js / TypeScript | Python * | Python / TypeScript * | Python ** |
| **License** | MIT | MIT * | MIT * | AGPL-3.0 ** |
| **Install** | `npm install -g carina-agent` | Bash install script * | Git clone + config * | `git clone` + Docker Compose ** |
| **GitHub stars** | ~0 (pre-launch) | 100,000+ * | 370,000 * | 70,939 in 14 days ** |

---

## 2. Quick Scorecard

Higher is stronger. Scores are relative within each dimension, not absolute quality ratings.

| Dimension | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| Tools depth | 71 registered | 99+ * | Limited * | Moderate ** |
| Channel breadth | 40 adapters (18 verified) | 20+ * | 50+ * | Web only ** |
| Memory quality | Postgres + pgvector + 4 backends | SQLite FTS5 * | Markdown files * | ChromaDB ** |
| Learning / self-improvement | Auto-writer + curator | Mature (7-day cycle) * | Manual file edits * | Skills auto-writer ** |
| Security | Scout (full suite) | Tirith (partial) * | None * | None ** |
| Multi-tenancy | Yes (hosted SaaS) | No * | No * | No (single user) ** |
| Commercial flexibility | MIT: full freedom | MIT * | MIT * | AGPL-3.0: forces open-source * |
| Ecosystem / community | Carina Hub (curated) | Growing * | ClawHub (40K skills) * | Early ** |
| Workspace UI | Full workspace shell | CLI/API first * | CLI/API first * | First-class UI ** |
| Model serving | API keys to providers | API keys * | API keys * | One-click local serving ** |
| SaaS billing | Built-in (Stripe) | None * | None * | None (checkout not live) ** |

---

## 3. Architecture and Install

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Config format** | `.env` + `agents.json` + workspace files + YAML | `config.yaml` * | Markdown workspace files * | Docker Compose + `.env` ** |
| **Scope** | System-wide + named workspaces + hosted SaaS | System-wide personal agent * | System-wide gateway | Single user, self-hosted ** |
| **Named agent workspaces** | Yes (`agents.json`, per-agent CARINA_HOME) | No * | Partial (per-channel routing) * | No ** |
| **Multi-agent routing** | Delegate-task subagents (depth 1) | Sub-agents for task delegation * | Different agents per channel/group * | Subagents for tasks ** |
| **Docker** | Yes (Dockerfile + docker-compose.yml) | Yes * | Yes * | Yes, primary install path ** |
| **Node host + systemd** | Yes (`carina node-host install`, writes systemd unit) | No * | No * | No ** |
| **Device pairing (QR)** | Yes (QR pairing for mobile/remote nodes) | No * | No * | No ** |
| **Profile isolation** | Named profiles with isolated CARINA_HOME | No * | Workspace scoped * | No ** |

---

## 4. LLM Providers and Model Support

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Registered providers** | 23 (OpenAI, Anthropic, DeepSeek, Gemini, Groq, Ollama, LM Studio, OpenRouter, Mistral, Cohere, and 13 more) | 20+ * | Via OpenRouter * | All via UI selector ** |
| **Local models** | Ollama + LM Studio (via provider registry) | Ollama * | Ollama * | First-class: Cookbook + llama.cpp + vLLM ** |
| **Model serving / management** | None (connect to existing endpoints) | None * | None * | Killer feature: hardware detection, VRAM estimation, 270+ models, one-click download and serve ** |
| **Provider fallback routing** | Yes (configurable chain, e.g. DeepSeek -> Anthropic -> OpenAI) | Partial * | No * | No ** |
| **Task classifier routing** | Yes (routes tasks to cheapest capable model) | No * | No * | No ** |
| **BYOK (bring your own key)** | Yes (hosted SaaS BYOK vault) | N/A * | N/A * | N/A (self-hosted) ** |

**Verdict:** Odysseus wins on local model UX. Carina wins on provider breadth and routing intelligence.

---

## 5. Tools

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Registered tools** | 71 (TOOLSET_MAP) | 99+ * | Limited * | Moderate ** |
| **Terminal** | Full shell + PTY + background processes | Full shell * | Basic * | Yes ** |
| **Browser automation** | 9 Playwright tools + computer-use | Full automation * | None * | Yes ** |
| **File system** | Read, write, patch, search-files | Yes * | Yes * | Yes ** |
| **Code execution** | execute-code + Docker sandbox + worker_threads | Yes * | No * | Yes ** |
| **Web search** | Brave + Tavily (configurable) | Yes * | Yes * | SearXNG (self-hosted) ** |
| **Cron / scheduling** | cronjob tool + workflow engine + scheduler | Yes * | Heartbeat * | Yes (notes-integrated) ** |
| **Memory tool** | Yes (add, list, search, clear) | Yes * | File-based * | Yes ** |
| **Email tools** | send (Resend + SMTP) + list (IMAP) | No * | No * | Full email assistant (IMAP/SMTP, triage, draft) ** |
| **Subagent delegation** | delegate-task + orchestrator | 3 parallel * | No * | Yes ** |
| **Image generation** | Yes (image-generation tool) | No * | No * | Yes (gallery + edit + remove-bg + inpaint) ** |
| **Text-to-speech** | Yes | No * | No * | No ** |
| **Contacts tool** | Yes (per-agent contact directory) | No * | No * | No ** |
| **MCP support** | Yes (client + server) | Partial * | Partial * | Yes ** |
| **Kanban** | Yes (kanban tool + granular tools) | No * | No * | No ** |

**Verdict:** Hermes leads on raw tool count. Carina leads on commercial tooling (billing, kanban, contacts). Odysseus wins on email and image UX.

---

## 6. Channels and Messaging

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Shipped adapter files** | 40 (18 verified production-ready; 22 newly built) | 20+ * | 50+ * | 0 (web UI only) ** |
| **Architecture** | Channel registry with uniform IChannelAdapter interface | Integrated * | Gateway-first (core architecture) * | Web / PWA only ** |
| **Telegram** | Yes | Yes * | Yes * | No ** |
| **WhatsApp (Baileys)** | Yes (Baileys + self-chat mode) | Yes * | Yes * | No ** |
| **Discord** | Yes | Yes * | Yes * | No ** |
| **Slack** | Yes | Yes * | Yes * | No ** |
| **Signal** | Yes | Yes * | Yes * | No ** |
| **Matrix / Element** | Yes | No * | Yes * | No ** |
| **Teams** | Yes | No * | No * | No ** |
| **iMessage** | Yes | No * | Yes * | No ** |
| **Line / WeChat / Viber** | Yes | No * | Yes * | No ** |
| **Email channel** | Yes | No * | Yes * | Full assistant ** |
| **Multi-agent per channel** | No (one agent, different workspaces) | No (one agent) * | Yes (different personalities per channel) * | No ** |
| **Webhook channel** | Yes | No * | No * | No ** |

**Verdict:** OpenClaw wins on channel breadth and multi-agent routing. Carina second. Odysseus has no channel adapters -- it is web only.

---

## 7. Memory and Knowledge

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Backends** | Postgres + pgvector, SQLite, builtin (JSON), Mem0, Honcho (5 options) | SQLite FTS5 * | Markdown files in workspace * | ChromaDB + fastembed (ONNX) ** |
| **RAG** | pgvector RAG (768-dim Gemini embeddings; OpenAI fallback) | Varies * | Workspace re-read * | Vector + keyword hybrid ** |
| **Session search** | Full-text search (session-search tool) | Full-text across all past conversations * | Vector search over memory files * | Yes ** |
| **REM cycle** | Yes (DREAMS.md promotion queue, nightly promotion) | No * | REM file-based * | No ** |
| **Persistent profiles** | Yes (cross-channel, cross-session) | Memory tool * | MEMORY.md per workspace * | Yes ** |
| **Human-readable memory** | Yes (markdown + CLI/API) | Partial * | Yes (markdown is the format) * | Yes ** |
| **Memory injection** | Semantic + keyword injection at session start | Yes * | Re-read workspace files * | Yes ** |
| **Operator profile bootstrap** | Yes (CARINA_OPERATOR_NAME, CARINA_OPERATOR_CONTEXT auto-seed) | No * | No * | No ** |

---

## 8. Learning and Self-Improvement

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Skill auto-writer** | Yes (evaluates after tasks, writes skills when patterns detected) | Yes (writes after every complex task) * | No (manual file edits) * | Yes (skills self-evolve) ** |
| **Autonomous curator** | Yes (curator tool + learning-ops) -- schedule not yet set | Yes: 7-day cycle, consolidates overlapping skills, removes unused * | No * | Partial ** |
| **Cross-agent skill sharing** | Yes (propagate skills across named agents) | No * | No * | No ** |
| **Domain packs** | Yes: 18 vertical packs (property-uk, healthcare, finance, devops, legal-uk, sales-crm, borehole-africa, etc.) | No * | No * | No ** |
| **Session learner** | Yes (learns from each session turn) | Yes * | No * | No ** |
| **Correction detection** | Yes (isUserCorrection, writes skill from correction) | Yes * | No * | No ** |
| **Skill eval harness** | Yes (eval runner + report store shipped in kernel) | No * | No * | No ** |
| **Compounding benchmark** | Not yet published | "40% faster after 20 self-skills" * | Not applicable * | Not published ** |
| **Skill Hub / marketplace** | Carina Hub (catalog, install, publish, ecosystem) | Smaller ecosystem * | ClawHub: 40,000 community skills * | Early ** |

**Verdict:** Hermes leads on learning loop maturity (7-day curator is the gold standard). Carina has the mechanism but the curator isn't on a schedule yet. Carina leads on domain pack organisation. OpenClaw has the largest community ecosystem by far.

---

## 9. Security

This is the widest gap between Carina and all three competitors.

| | Carina (Scout) | Hermes (Tirith) | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Prompt injection shield** | 3-layer: patterns, ML classifier, Scout remote scan | Partial * | None | None ** |
| **Kill switch** | Yes (Scout pub/sub, forensic snapshot on trigger) | No * | No | No ** |
| **Audit logging** | Full (turn log, ops audit CLI, Scout audit) | Basic * | Partial | No ** |
| **Egress filtering (DLP)** | Yes (egress-filter.ts, domain allowlist) | No * | No | No ** |
| **Honeypots / deception** | Yes (deception-client.ts, deception augmentation in system prompt) | No * | No | No ** |
| **Exec approval policy** | Yes (fine-grained rules by tool, tier, profile, TTL grants, audit) | No * | No | No ** |
| **Role-based tool access** | Yes (evaluateToolRbac, viewer/editor/admin gates) | No * | No | No ** |
| **Sandbox isolation** | Docker container + worker_threads fallback | No * | No | No ** |
| **JIT credentials** | Yes (credentials issued just-in-time per tool call) | No * | No | No ** |
| **Blockchain trust** | ERC-8004 identity + ERC-8126 verification on Base Sepolia (live) | No * | No | No ** |
| **Multi-tenant isolation** | Yes (per-org data isolation in hosted mode) | No * | No | No (single-user) ** |
| **Compliance report** | SOC2, ISO27001, EU AI Act templates (Scout) | No * | No | No ** |

**Verdict:** Carina is the only one you can put in front of an enterprise security review. This is Carina's structural moat. None of the three competitors can bolt this on quickly -- Scout requires rearchitecting the tool pipeline.

---

## 10. Workspace and UI Surfaces

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Primary interface** | Web chat + workspace shell | Chat (web/API) * | Messaging platforms + web * | Beautiful web workspace ** |
| **Workspace hub** | `/workspace` (shared sidebar, teal/Inter, light+dark) | No * | No * | Yes (polished) ** |
| **Notes and tasks** | `/notes` (notes-api + todo/cronjob) | No * | No * | First-class ** |
| **Documents editor** | `/documents` (doc-api + AI assist) | No * | No * | First-class (markdown/HTML/CSV, tabs) ** |
| **Image gallery** | `/images` (generate, inpaint, remove-bg) | No * | No * | First-class ** |
| **Email triage UI** | `/email` (urgency, archive, spam) | No * | No * | First-class (IMAP/SMTP + AI) ** |
| **Calendar** | `/calendar` (reminder month view from notes; no CalDAV yet) | No * | No * | CalDAV sync (Radicale, Nextcloud, Apple, Fastmail) ** |
| **Memory UI** | `/memory` (semantic search, platform depth) | No * | No * | Yes ** |
| **Model compare** | `/compare` (blind mode) | No * | No * | First-class ** |
| **Deep research** | `carina research` / `/research` (available; not named feature) | No * | No * | First-class named feature ** |
| **Model playbook** | `carina playbook` | No * | No * | Hardware-aware, 270+ models, one-click serve ** |
| **Mobile / PWA** | React Native companion app (separate) | No * | Telegram etc. * | PWA, responsive, touch gestures ** |
| **Themes** | Light/dark (no custom theme authoring) | No * | No * | Customizable, agent-authored themes ** |
| **Control dashboard** | `/control` (agents, channels, devices, ops) | No * | No * | No ** |

**Verdict:** Odysseus wins on workspace polish and named features. Carina now has most surfaces but they were built to close the gap -- Odysseus had them first and they feel more native. Carina wins on control (agents, channels, ops) which Odysseus doesn't have.

---

## 11. Scheduling and Automation

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Cron tool** | Yes (cronjob tool: add, list, delete, status, run-now) | Yes * | Heartbeat / partial * | Yes (notes-integrated) ** |
| **Cron workflow engine** | Yes (multi-step JSON workflows: parseWorkflowJson + executeWorkflow) | No * | No * | No ** |
| **Background scheduler** | Yes (loadAndRegisterAllJobs, cron-scheduler.ts) | Yes * | Partial * | No ** |
| **Commitments (inferred follow-ups)** | Yes (opt-in: CARINA_COMMITMENTS_ENABLED) | No * | Partial * | No ** |
| **Proactive check-in** | Yes (opt-in) | No * | No * | No ** |
| **Cross-channel delivery** | Yes (cron jobs can fire across channels) | No * | Yes (gateway) * | No ** |

---

## 12. Infrastructure and Ops

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Sandboxed code exec** | Docker (primary) + worker_threads (fallback) | No * | No * | Yes (Docker) ** |
| **Node host + remote exec** | Yes (`carina node-host`: daemon, WS hub, file transfer, pairing) | No * | No * | No ** |
| **Systemd integration** | Yes (writes systemd user unit on `node-host install`) | No * | No * | No ** |
| **Debug proxy** | Yes (HTTP traffic inspection, request/response log, LLM provider inference) | No * | No * | No ** |
| **DNS helpers** | Yes (Tailscale peer listing, DNS A/AAAA/CNAME/TXT resolution) | No * | No * | No ** |
| **Backup and restore** | Yes (config, sessions, profiles, packs, secrets export bundle) | No * | No * | No ** |
| **State migration / export** | Yes (interop bundle: selective export with session/memory/workspace filters) | No * | No * | No ** |
| **Health monitoring** | Yes (health-check + health-deep-scan + `carina doctor`) | No * | No * | No ** |
| **Ops CLI** | Yes (`carina ops`: sandbox, DNS, proxy, backup, secrets-audit, reset, status) | No * | No * | No ** |
| **Observability** | Yes (turn log, usage metrics API, observability routes) | Partial * | No * | No ** |

---

## 13. Deployment and Commercial Model

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **Self-hosted** | Yes | Yes * | Yes * | Yes (primary model) ** |
| **Hosted SaaS** | Yes (workspace.propreneur.uk pattern; hosted.ts) | No * | No * | Planned (checkout not live) ** |
| **Multi-tenancy** | Yes (per-org isolation, subdomain tenants) | No * | No * | No (single user) ** |
| **Stripe billing** | Yes (credit ledger, rate cards, plan gates) | No * | No * | No ** |
| **BYOK encryption** | Yes (vault service, org-scoped keys) | No * | No * | No ** |
| **License** | MIT | MIT * | MIT * | AGPL-3.0 ** |
| **Commercial SaaS use** | Full freedom | Full freedom * | Full freedom * | Must open-source entire product ** |
| **Enterprise support model** | MIT kernel + paid Scout (Red Hat pattern) | No * | No * | Not possible under AGPL * |
| **npm package** | Yes (`npm install -g carina-agent` on npm) | No (bash script) * | No * | No ** |
| **Certification** | Built on Carina evaluation report (cert/built-on-carina.ts) | No * | No * | No ** |

**Verdict:** Carina is the only commercial-viable platform for building SaaS products. AGPL-3.0 makes Odysseus a poison pill for any paid product. Hermes and OpenClaw have no billing infrastructure. Carina's Red Hat-style model (MIT kernel + paid Scout layer) is the only one with a clear revenue path.

---

## 14. Ecosystem and Community

| | Carina | Hermes | OpenClaw | Odysseus |
|---|---|---|---|---|
| **GitHub stars** | ~0 (pre-launch) | 100,000+ (7 weeks) * | 370,000 * | 70,939 (14 days, ~5K/day) ** |
| **Community skills** | 96 curated (Carina Hub) | Growing * | 40,000 on ClawHub * | Early ** |
| **Development pace** | Steady | v0.1 to v0.8 in 2 months, 209 PRs * | Slower * | 1,150 commits in 14 days ** |
| **Domain pack library** | 18 vertical packs (unique) | No * | No * | No ** |
| **Partner ecosystem** | Propreneur, Fleetz, COMPASS, COMPASS | None * | None * | None (AGPL prevents it) ** |
| **Tests** | 5,369 Vitest (125 test files) | Unknown * | Unknown * | Unknown ** |

---

## 15. Head-to-Head Winner Matrix

One winner per dimension. Ties noted.

| Dimension | Winner | Runner-up | Notes |
|---|---|---|---|
| Channel breadth | OpenClaw | Carina | OpenClaw 50+, Carina 40 adapters (18 verified), Hermes 20+, Odysseus 0 |
| Multi-agent routing (per channel) | OpenClaw | Carina | Carina does workspaces, not per-channel personalities |
| Tool depth | Hermes | Carina | Hermes 99+, Carina 71 |
| Self-improving learning | Hermes | Carina | Hermes curator is on a 7-day schedule; Carina's isn't yet |
| Domain packs / verticals | Carina | None | Unique to Carina: 18 vertical packs |
| Security | Carina | None | 3-layer injection shield, kill switch, egress, blockchain trust; others have none |
| SaaS billing | Carina | None | Only platform with built-in Stripe + multi-tenancy |
| Commercial licensing | Carina/Hermes/OpenClaw (tie) | Odysseus | All MIT except Odysseus (AGPL-3.0) |
| Workspace polish / UX | Odysseus | Carina | Odysseus's UI is best-in-class; Carina's workspace is functional |
| Local model serving | Odysseus | None | Cookbook is unique; others just connect to APIs |
| Deep Research (named feature) | Odysseus | Carina | Carina has the capability; Odysseus has the product |
| Memory quality | Carina | Odysseus | 5 backends + pgvector vs ChromaDB |
| Ops / infrastructure | Carina | None | Node host, debug proxy, DNS, backup, state export unique to Carina |
| LLM provider breadth | Carina | Hermes | 23 providers + fallback routing + task classifier |
| npm distribution | Carina | None | `npm install -g carina-agent`; others require git clone or bash |
| Enterprise trust / audit | Carina | None | ERC-8004 + ERC-8126 on-chain; compliance reports; no equivalent |
| Community / ecosystem | OpenClaw | Hermes | 370K stars vs 100K; Carina and Odysseus are pre-community |
| Development velocity | Odysseus | Hermes | 1,150 commits in 14 days (Odysseus); 209 PRs in 2 months (Hermes) |
| Scheduling depth | Carina | Hermes | Carina: workflow engine + commitments; others: basic cron |

**Summary count:**
- Carina: 9 wins
- Hermes: 2 wins
- OpenClaw: 2 wins
- Odysseus: 3 wins
- Ties: 3

Carina wins the most dimensions but is losing on the most visible ones (community, UI polish, learning maturity) -- the dimensions users feel first.

---

## 16. Positioning Triangle

Each platform has a distinct primary user:

| Platform | Primary user | Primary value | Moat |
|---|---|---|---|
| Carina | Builders and enterprises | Deploy AI in production with security and billing | Scout + MIT + multi-tenancy |
| Hermes | Power users with recurring workflows | One agent that compounds over time | Self-improving learning loop |
| OpenClaw | Users needing multi-platform coordination | One agent, everywhere, with community skills | Channel breadth + ClawHub ecosystem |
| Odysseus | Individuals wanting a private AI workspace | Beautiful self-hosted ChatGPT alternative | UI polish + local model serving + AGPL keeps community close |

They are not substitutes. Hermes + OpenClaw can run together (transcript's recommended pairing). Carina can sit beside either as the secure execution layer. Odysseus targets end users; the others target builders/operators.

---

## 17. What Carina Should Do Differently

### Immediate (Carina is behind and it shows)

| Gap | Carina state | What to do |
|---|---|---|
| Curator schedule | Auto-writer exists, curator is not on a timed cycle | Schedule 7-day curator cycle (match Hermes; this is one config change + cron job) |
| `carina playbook` | `pnpm` 23 providers exist but no model discovery UI | Build hardware-detect + model-recommend + one-click Ollama serve command |
| Landing page | Spec-list page | Convert to feature GIFs with `carinaai.uk` redesign; show, don't tell |
| Named features | Research, compare, deep research all exist | Package and name them explicitly ("Deep Research", "Model Compare") |

### Short-term (structural advantage not yet communicated)

| Gap | Action |
|---|---|
| Security story not leading | Every demo must start with Scout injection block demo; not a footnote |
| No compounding benchmark | Run and publish "Carina with 20 skills vs fresh instance" benchmark |
| CalDAV | Wire `/calendar` to a CalDAV backend (close last Odysseus workspace gap) |
| Multi-agent per channel | Assign agent workspace per incoming channel (partial match to OpenClaw routing) |

### Do NOT chase

| Temptation | Why to ignore |
|---|---|
| 50+ raw channel adapters | 40 adapters is sufficient; depth of integration matters more than count |
| 40,000 community skills | Build the platform; let the community fill it (ClawHub did this organically) |
| GitHub star count | Paying enterprise customers over vanity stars; Carina's moat is Scout, not stars |
| AGPL-style community lock-in | MIT is the right choice; AGPL prevents the partner ecosystem that is Carina's second moat |

---

## 18. The Honest Summary

**OpenClaw** is the undisputed winner on channel breadth and community ecosystem. 370,000 stars, 40,000 community skills, multi-agent routing. If you need your agent on 50 platforms with different personalities, nothing else comes close. Its weakness: no security, no learning, no billing, explicit-file-only workflow.

**Hermes** is the winner on intelligence maturity. The 7-day autonomous curator and 40% compounding performance claim are real differentiators. If you want one agent that learns from your work and gets measurably faster over time, Hermes is the benchmark. Its weakness: no security, no billing, no multi-tenancy.

**Odysseus** is the winner on UI polish and end-user appeal. 70,000 stars in 14 days speaks for itself. The Cookbook (hardware-aware local model serving) and the named workspace features (Deep Research, Compare, CalDAV) are genuinely ahead. Its weakness: AGPL license makes commercial use impossible, zero security layer, web-only (no channel adapters), single-user only. Built for users, not builders.

**Carina** wins on security, commercial viability, and infrastructure depth. Scout is a structural moat that none of the three can replicate quickly -- it requires rearchitecting the tool execution pipeline. MIT license, Stripe billing, multi-tenancy, and the Red Hat commercial model make Carina the only platform you can build a paid SaaS product on. Its weakness: pre-community, weaker UI polish than Odysseus, curator not yet scheduled, no model serving story.

**The positioning that holds:**

> OpenClaw if you need multi-platform messaging coordination.
> Hermes if you want one agent that learns and compounds.
> Odysseus if you want a beautiful private workspace for yourself.
> Carina if you are building a commercial AI product and need it to pass a security review.

The first three are for users. Carina is for builders.

---

## 19. Accuracy Notes

- Carina metrics are sourced directly from the `core.carinaai.uk` codebase (file counts, adapter counts, test counts, security module inventory). These are authoritative.
- Hermes metrics are from the published video transcript (`Herme_OpenClaw_Analysis22-25.txt.md`). Not executed or audited in this repo.
- OpenClaw metrics are from the same transcript and public community claims. Not audited.
- Odysseus metrics are from `ODYSSEUS_ANALYSIS.md` and `ODYSSEUS_2026-06-15.md`, sourced from `odysseusai.homes` and the public GitHub repo as of 2026-06-14/15. Not audited.
- Channel adapter count for Carina: 40 adapter files exist in `src/gateway/channels/adapters/`; 18 were production-verified in COMPARISON.md (2026-06-11); 22 additional adapters were implemented after that date. All 40 may not be fully tested.
- Skill pack count: 18 directories in `src/skills/packs/`; COMPARISON.md (2026-06-11) listed 16. Two packs added since.
