# COMPARISON.md; Carina vs Hermes vs OpenClaw

Last verified: **2026-06-11** against `core.carinaai.uk` (repo metrics) and production trust API (`GET https://console.labyrinthscout.com/api/public/trust`).

## Verified Carina metrics (repo source of truth)

| Metric | Count | Notes |
|---|---:|---|
| Vitest tests | 5,369 | 125 test files |
| LLM providers | 23 | `PROVIDER_DEFINITIONS` (includes Ollama, LM Studio) |
| Channel adapters | 18 | Registered; enablement depends on env/credentials |
| Shipped skill packs | 16 | Under `src/skills/packs/` |
| Curated pack skills | 96 | Sum of skills in pack `skills.ts` files |
| Tool surface | 71 | Unique tools in `TOOLSET_MAP` |
| CLI commands | 49 | `buildCommandList()` |

Hermes and OpenClaw figures below marked * are from their public documentation and are **not audited in this repository**.

## Architecture

| | Hermes * | OpenClaw * | Carina (shipped) |
|---|---|---|---|
| Type | Full autonomous agent | Workspace-scoped agent | Full autonomous agent |
| Scope | System-wide | Per workspace folder | System-wide + named agent workspaces |
| Config | config.yaml | Markdown workspace files | `.env` + `agents.json` + workspace files |
| License | MIT | MIT | MIT (`carina-agent` on npm) |
| Install | CLI binary | Git clone + markdown | `npm install -g carina-agent` + Docker |

## Tools and channels

| | Hermes * | OpenClaw * | Carina (shipped) |
|---|---|---|---|
| Tools | 99+ | Limited | 71 registered tool surface |
| Terminal | Full shell (fg, bg, PTY) | Basic | Full shell + process tool |
| Browser | Full automation | None | Playwright (9 tools) + computer-use |
| Subagents | 3 parallel | None | delegate-task + orchestrator (depth 1) |
| Cron | Scheduled + chaining | Heartbeat | cronjob tool + scheduler + commitments delivery |
| Messaging | 15+ platforms * | Several * | 18 channel adapters (config-dependent) |

## Memory

| | Hermes * | OpenClaw * | Carina (shipped) |
|---|---|---|---|
| Persistent | SQLite FTS5 | Markdown in workspace | Postgres, SQLite, builtin, Mem0 + markdown |
| RAG | Varies | Workspace re-read | pgvector RAG when Postgres configured |
| REM / promotion | No | REM file-based * | REM + `DREAMS.md` promotion queue |
| Long-term | memory tool | MEMORY.md | memory tool + MEMORY.md + persistent profiles |
| Human-readable | Partial | Yes | Yes (markdown + CLI/API) |

## Learning and proactivity

| | Hermes * | OpenClaw * | Carina (shipped) |
|---|---|---|---|
| Skills | 115+ * | ClawHub | 16 packs / 96 curated skills + hub + auto-writer |
| Domain packs | No | No | 16 optional vertical packs |
| Self-improvement | skill_manage | Workspace edits | Auto skill writer + curator |
| Scheduled | cronjob | Heartbeat | cronjob + proactive check-in (opt-in) |
| Inferred follow-ups | No | Commitments * | Commitments (opt-in, `CARINA_COMMITMENTS_ENABLED`) |
| Background processes | Yes | No | shell background + process notifications |

## Security (Carina + Scout)

| | Hermes * | OpenClaw * | Carina (shipped) |
|---|---|---|---|
| Prompt injection | Partial (Tirith) | Limited | Scout 3-layer shield |
| Kill switch | No | No | Scout kill switch |
| Audit logging | Basic | Partial | Scout full audit + ops audit CLI |
| Egress filtering | No | No | Scout DLP |
| Honeypots | No | No | Scout deception layer |
| Multi-tenant isolation | No | No | Native (hosted SaaS) |
| Stripe billing | No | No | Built (hosted) |

## Trust / verification (Carina + Scout)

Production snapshot (2026-06-11, Base Sepolia): `risk_score` 20 (low), `identity.status` live (agent `6981`, slug `carina-reference`), ERC-8126 verification txs on-chain, `chain.erc8004_status` and `chain.erc8126_status` both `live`, `data_freshness.stale` false. Dashboard: [carinaai.uk/trust](https://carinaai.uk/trust).

| Capability | Status |
|---|---|
| Public trust API (`carinaai.uk/trust`) | **Live** (polls Scout; WAV/WV + unified risk score) |
| ERC-8004 agent identity | **Live** on Base Sepolia (registry + register tx in API `identity` block) |
| ERC-8126 verification (WAV + WV) | **Live** on Base Sepolia (`verification.on_chain` explorer links) |
| Weekly `labyrinth-scout.v1` security attestation | Scheduled; first on-chain post pending scheduled job |
| Base mainnet registration | Operator step (`pnpm trust:register:mainnet`); testnet is live today |

### vs Hermes *

| | Hermes * | Carina (production) |
|---|---|---|
| Verifiable security posture | No public trust layer | Scout + public trust API |
| On-chain agent identity (ERC-8004) | No | Live on Base Sepolia |
| On-chain verification (ERC-8126) | No | Live on Base Sepolia |
| Battle-tested agent usage | Strong | Early (0 paying pilots) |

Trust is Carina's clearest product differentiator. Hermes wins on procedural skills and production scars; Carina wins on auditable security proof.

## Carina-only (shipped or opt-in)

| Feature | Status |
|---|---|
| Agent workspaces + routing | Shipped |
| Host service + device pairing | Shipped |
| Control dashboard (`/control`) | Shipped |
| Ops layer (`carina ops`) | Shipped (sandbox, DNS, proxy, backup, secrets, audit) |
| Local model routing | Optional (Ollama/LM Studio + task classifier) |
| Tool result caching (TTL) | Shipped |
| npm package (`carina-agent`) | v0.1.0 live on [npm](https://www.npmjs.com/package/carina-agent) |

## When to use which

- **Hermes**: maximum channel breadth and mature Python ecosystem today *
- **OpenClaw**: personal workspace assistant with markdown-native memory *
- **Carina**: production SaaS, Scout security, optional vertical packs, billing, trust layer

## Marketing accuracy rules

1. Do not quote Carina counts lower than the verified table above.
2. Use `npm install -g carina-agent` in public install copy. State ERC-8004 identity and ERC-8126 verification as **live on Base Sepolia** (link [carinaai.uk/trust](https://carinaai.uk/trust)). Say **Base mainnet** only after `pnpm trust:register:mainnet` completes. Do not claim on-chain trust prevents runtime compromise.
3. Do not claim Hermes lacks self-writing skills or memory transparency; both are incorrect (*).
4. Competitor numbers require a footnote that they are not audited in this repo.
5. Distinguish **skills war stories** (Hermes procedural skills) from **domain packs** (Carina vertical packs); do not compare raw skill counts without that caveat.
