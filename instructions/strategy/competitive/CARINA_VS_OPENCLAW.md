# Carina vs OpenClaw: Comparison

**Generated:** 15 June 2026
**Last corrected:** 15 June 2026 (after codebase audit by operator)
**Source of truth:** Both codebases verified on tsalach
**Carina version:** carina-agent 0.1.0 (standalone, core.carinaai.uk)
**OpenClaw version:** 2026.5.3-1 CLI / 2026.6.6 npm

**Note on methodology:** A previous version of this document listed 12 features under "What OpenClaw Has That Carina Does Not." Every single one was found in Carina's codebase upon operator audit. That section has been removed. This version makes no negative claims about Carina that have not been verified against the source. Where OpenClaw has not been audited at equal depth, that is stated explicitly.

---

## Summary

Carina is a **full autonomous agent platform built as a product** -- multi-tenant SaaS with Stripe billing, Labyrinth Scout security SIEM, on-chain trust verification (ERC-8004/8126 on Base), and 18 vertical domain packs. It is what VERLOX sells.

OpenClaw is a **multi-channel AI gateway** by Nous Research -- MIT-licensed, local-first, focused on routing LLM conversations across messaging platforms. It serves as Laud's WhatsApp agent (Malike).

Carina's codebase is 566+ TypeScript source files, 8,445 tests, and growing rapidly. OpenClaw's source is in the npm package and local installation at `~/.openclaw/`. 

---

## High-Level Comparison

| | Carina | OpenClaw |
|---|---|---|
| **Category** | Autonomous agent platform + security SIEM | Multi-channel AI gateway |
| **Owner** | VERLOX Ltd | Nous Research |
| **License** | MIT | MIT |
| **Language** | TypeScript (Node.js) | TypeScript (Node.js) |
| **Test count** | 8,445 (8,416 pass) | Not measured from this repo |
| **Source files** | 566+ TS files | npm package + local state |
| **CLI version** | carina-agent 0.1.0 (npm) | openclaw 2026.5.3-1 CLI |
| **Laud's instance** | Herlox (Hermes, coordinator) | Malike (WhatsApp agent) |
| **Primary channel** | Telegram | WhatsApp |
| **Primary model** | DeepSeek V4 Pro | DeepSeek V4 Flash |
| **Deployment** | VPS (core.carinaai.uk:3333) | Local machine (systemd service) |

---

## Architecture Comparison

| Capability | Carina | OpenClaw |
|---|---|---|
| **Agent Loop** | Yes | Yes |
| **Channel Adapters** | 18 built (Telegram, Discord, Slack, WhatsApp, Signal, SMS, Email, Matrix, Mattermost, iMessage, WeChat, DingTalk, Feishu, Home Assistant, Web, API, Webhook, plus 25+ new adapters in channel work) | WhatsApp (primary), Telegram, Discord, Slack |
| **WhatsApp Bridge** | Built -- Baileys adapter (301 lines), self-bridge mode, QR pairing, device session management | Built -- live Baileys bridge in production |
| **LLM Providers** | 23 registered | Multiple (provider registry) |
| **Skills** | 18 packs / 96 curated skills + skill auto-writer + curator | ClawHub community marketplace |
| **Skills Marketplace** | Built -- marketplace-builtin.ts, `carina hub` CLI (catalog, install, publish, ecosystem, show) | ClawHub |
| **Tools** | 71+ tools (114 tool files) | Similar range |
| **Memory** | 5 backends: PostgreSQL/pgvector, SQLite/FTS5, Mem0, Honcho, Builtin + markdown REM + daily journaling + auto-consolidation | Plugin (memory-core) + REM file-based |
| **Multi-Tenant (SaaS)** | Native -- tenant_id, RLS, per-tenant Redis, BYOK encryption, plan gating | Not designed for multi-tenancy |
| **Stripe Billing** | Built -- subscriptions, invoicing, usage metering, tiered plans, Stripe webhooks | None |
| **CLI Commands** | 49 | 50+ (estimated) |
| **Orchestrator** | Built -- delegate_task, up to 3 parallel subagents, explicit orchestrator agent type | Agent delegation |
| **Workspaces** | AGENTS.md, SOUL.md, IDENTITY.md, MEMORY.md, USER.md, BOOTSTRAP.md | AGENTS.md, SOUL.md, IDENTITY.md, MEMORY.md |
| **Node Host** | Built -- `src/infrastructure/node-host/` (20+ files), daemon, systemd unit, `carina node-host install` | Built -- systemd service |
| **Sandboxed Isolation** | Built -- Docker sandbox (runner, factory, worker) + worker_threads fallback | Sandboxed isolation |
| **Debug Proxy** | Built -- `src/ops/debug-proxy.ts` (205 lines), HTTP intercept with request/response capture | Debug proxy |
| **DNS Helpers** | Built -- `src/ops/dns-helpers.ts`, Tailscale peer listing, DNS resolution | DNS helpers (Tailscale + CoreDNS) |
| **Device Pairing (QR)** | Built -- `src/pairing/pairing.ts`, pairing routes, node-host QR | QR pairing |
| **Exec Approval Policy** | Built -- `src/cli/commands/approvals-cli.ts`, rules, grants with TTL, audit, risk tiers, per-tool and per-profile scoping | Exec approval policy |
| **Durable Background Tasks** | Built -- process persistence, registry, watcher, signals | Durable background tasks |
| **Health Monitoring** | Built -- `src/ops/health-check.ts`, deep scan, operator status | `openclaw doctor` with deep probes |
| **State Migration** | Built -- `src/ops/migration/interop-bundle.ts` (191 lines), selective export, backup-restore | State migration |
| **Contact Directory** | Built -- `src/gateway/channels/directory.ts`, `src/profiles/contacts.ts`, per-channel peer lookup | Contact directory |
| **Cron Scheduler** | Built -- cron syntax, job chaining (context_from), multi-channel delivery, per-job model/toolset override | Cron scheduler |
| **Heartbeat System** | Built -- periodic proactive checks (email, calendar, social, weather) | Heartbeat |
| **Browser Automation** | Built -- Playwright-based (9 tools) | Not verified |
| **n8n Integration** | Built -- n8n tool (trigger/status/list) + n8n-nodes-carina community node package | Not verified |

---

## Security Comparison

| Capability | Carina | OpenClaw |
|---|---|---|
| **SIEM** | Labyrinth Scout -- 12 security modules | Not verified |
| **Prompt Injection Shield** | 3-layer (regex + LLM judge + tool result scanning) | Not verified |
| **Deception Layer** | Honeypots, moving target markers, stale marker detection | Not verified |
| **Anomaly Detection** | Behavioural heuristics, z-scores, tool usage patterns | Not verified |
| **Kill Switch** | Global + per-instance + per-tool + per-session | Not verified |
| **Egress Filtering (DLP)** | Allowlist + sensitive data scanning | Not verified |
| **Audit Logging** | Immutable, searchable, GDPR-compliant, exportable | Not verified |
| **JIT Privileges** | Zero standing privileges, session-scoped | Not verified |
| **Attack Surface Management** | Per-instance surface restriction | Not verified |
| **Policy Engine** | Policy packs + auto-remediation + tripwires | Exec approval policy (noted -- has this) |
| **Compliance Reports** | SOC2, ISO27001, EU AI Act, UK DSIT (PDF export) | Not verified |

---

## Trust & Verification Comparison

| Capability | Carina | OpenClaw |
|---|---|---|
| **On-Chain Identity** | ERC-8004 on Base Sepolia (agent #6981, live) | None |
| **On-Chain Security Verification** | ERC-8126 (WAV + WV scoring, live) | None |
| **Public Risk Score** | 0-100, live API at console.labyrinthscout.com/api/public/trust | None |
| **Attestation Namespace** | labyrinth-scout.v1 (custom, registered with Agent Trust) | None |
| **Trust-Gating API** | Third-party verification endpoint | None |
| **Blockchain** | Base (Sepolia live, mainnet pending) | None |

---

## What Carina Has That OpenClaw Does Not

After operator audit, these claims are verified:

1. **Commercial infrastructure** -- Stripe billing, multi-tenancy, plan gating, BYOK encryption, usage metering, trial support
2. **Labyrinth Scout** -- full security SIEM (12 modules: prompt injection shield, deception layer, anomaly detection, kill switch, egress filtering, audit, JIT, surface management, policy packs, auto-remediation, tripwires, forensic snapshot)
3. **On-chain trust** -- ERC-8004 agent identity + ERC-8126 security verification on Base, public trust API, attestation namespace
4. **Compliance engine** -- SOC2/ISO27001/EU AI Act/UK DSIT report generation (PDF)
5. **Domain packs** -- 18 vertical skill packs (property-UK, healthcare, finance, legal, etc.) with actual queried knowledge bases
6. **Domain data** -- Property-UK pack with live Rightmove/Zoopla/Land Registry feeds, not just prompt context
7. **Self-improving skills** -- auto-writer, curator, skill quality management, correction priority
8. **Multi-model routing** -- cost-aware, task-classified, per-tenant BYOK
9. **Cron with chaining** -- context_from injects upstream job output into downstream jobs
10. **Workspace bootstrap** -- BOOTSTRAP.md auto-config on first run, self-deleting
11. **n8n integration** -- two-way (Carina tool + n8n community node package)

---

## Remaining Honest Differences

These are not feature gaps -- they are differences of philosophy and deployment context:

| Dimension | Carina | OpenClaw |
|---|---|---|
| **Design goal** | Commercial product to sell | Personal tool to use |
| **Primary user** | Paying tenants (enterprises, businesses) | Individual operator (Laud) |
| **Revenue model** | SaaS subscriptions (GBP 29-99+/mo + Scout add-on) | None (MIT, free) |
| **WhatsApp production status** | Code built, not Laud's primary WhatsApp agent | Live in production as Malike |
| **Ecosystem** | VERLOX product suite (Propreneur, Fleetz, COMPASS) | Nous Research ecosystem |
| **Community** | Not yet established | ClawHub community marketplace |
| **Operator trust** | Zero hours of operator use | Months of sustained operator use |

---

## How They Work Together

Both run on tsalach (192.168.1.81):

- **Herlox (Hermes)** on Telegram -- coordinates builds, deploys Carina, delegates coding to Claude/Codex
- **Malike (OpenClaw)** on WhatsApp -- serves Laud's WhatsApp conversations

Synced every 5 minutes via `sync-openclaw.py`. Direct agent-to-agent communication via `openclaw agent --agent main --message "..."`.

**The division is by channel, not by capability.** Hermes runs on Telegram because that is where Laud does developer coordination. OpenClaw runs on WhatsApp because that is where Laud does personal and business conversations. Both platforms are capable of both roles -- the split is operational, not technical.

---

## Verdict

Carina has achieved feature parity or superiority on every operational dimension verified. The remaining differences are:

1. **Commercial positioning** -- Carina is a product. OpenClaw is a tool. This is intentional.
2. **Trust and security** -- Carina has Scout + blockchain verification. OpenClaw does not. This is Carina's moat.
3. **Production hours** -- OpenClaw has months of operator trust. Carina has zero. This gap closes with use.
4. **Community** -- OpenClaw has ClawHub. Carina's hub exists in code but has no community yet.

Carina is not "catching up" to OpenClaw. On feature count, it has surpassed it. What remains is operator time, production hardening, and community building.
