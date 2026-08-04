# Propreneur v3 Implementation Plan

**Goal:** Full Propreneur v2 product on **carina-core** with **Scout governance**; Laravel remains the property operating system.

**Updated:** 2026-07-04  
**Estimated duration:** 16 to 24 months total (see [SCOPE-PARITY.md](./SCOPE-PARITY.md))

| Phase block | Prompts | Duration | Delivers |
|-------------|---------|----------|----------|
| A Kernel spine | 01-20 | 9-15 mo | Agent loop on sidecar; Tool Bridge; strangler |
| B Scout + core | 21-23 | 2-3 mo | Scout required on kernel path; carina-core alignment |
| C Platform + channels | 24-25 | 2-3 mo | Platform Carina + all remote adapters |
| D UX + proactive | 26-27 | 1-2 mo | Modifiers, incognito, scheduled agent |
| E Full ship gate | 28-32 | 2-3 mo | Module matrix, deploy, golden prompts, production sign-off |

**Important:** Prompts 01-20 alone do **not** deliver full v2 parity. They deliver the runtime migration foundation (~40% of the v3 vision). The property OS modules are **carried by fork**, not rebuilt. See [SCOPE-PARITY.md](./SCOPE-PARITY.md).

---

## Executive summary

Propreneur v3 is **not** a greenfield rewrite of the property MIS. It is:

1. **Propreneur v2 Laravel codebase** (modules, UI, tenant DBs, billing) carried forward
2. **Carina kernel sidecar** (pinned `@verlox/carina-core` or interim `carina-agent`; internal Docker only; **Scout required** for Business Edition)
3. **property-uk + propreneur-workspace packs** for domain skills and RAG
4. **Propreneur Tool Bridge**: kernel calls Laravel internal APIs that wrap existing `CarinaToolRegistry` services
5. **Strangler migration**: Remote API and Hub first, in-app chat last; PHP `CarinaAgentService` retired when parity proven

The user-facing promise: **"Propreneur, powered by Carina"** with one agent brain (kernel) and one business system (Laravel).

---

## What v3 is NOT

| Misconception | Reality |
|---------------|---------|
| property-uk pack replaces Propreneur OS | Pack is brain; Laravel keeps calculators, CRM, pipeline |
| Rewrite 61 tools in TypeScript | Tools stay in PHP; exposed via HTTP bridge to kernel |
| Big-bang cutover | Feature flags per channel; rollback to PHP agent |
| Replace stancl tenancy or PostgreSQL | Unchanged |
| Merge Aiva standalone into Propreneur | Federation bridge stays for cross-product use |

---

## Current state (v2 baseline)

| Asset | Location | v3 role |
|-------|----------|---------|
| Laravel property OS | `propreneur/propreneur-v2/` | Fork to `propreneur-v3/`; data plane |
| PHP agent loop | `CarinaAgentService.php` | Strangled; eventually read-only fallback |
| 61 tenant tools | `app/Services/Carina/Tools/` | Stay; called via Tool Bridge |
| Remote API | `app/Services/Carina/Remote/` | Retarget to sidecar |
| Federation bridge | `core.carinaai.uk/src/bridges/propreneur-bridge.ts` | Unchanged for Aiva |
| property-uk pack | `core.carinaai.uk/packages/packs/property-uk/` | Active on sidecar |
| propreneur-workspace pack | Hub + core skills | Active on sidecar |
| Distro pattern docs | `prompts-library/archived/carina-distro-*` | Reference for sidecar install |

---

## Target architecture (one sentence)

**Laravel handles HTTP, auth, modules, and tool execution; Carina sidecar handles the agent loop, skills, memory, channels, and LLM routing; they talk over an internal network with signed tenant JWT.**

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams.

---

## Phases

### Phase 0: Foundation (weeks 1-4) - Difficulty 5/10

**Outcome:** `propreneur-v3` repo exists; Carina sidecar runs beside Laravel in Docker; no user-facing change.

| Deliverable | Prompt |
|-------------|--------|
| Fork v2 to v3, add `apps/carina/` | 01 |
| Pin exact `carina-agent` version | 02 |
| Docker Compose internal network | 03 |

**Exit criteria:**
- `docker compose up` starts Laravel + sidecar + Postgres + Redis
- Sidecar reachable at `http://carina:4500` from Laravel container only
- `GET /api/health/carina` returns 200

---

### Phase 1: Gateway and tenant context (weeks 5-8) - Difficulty 6/10

**Outcome:** Laravel can send a chat turn to the sidecar with tenant/user identity; graceful fallback if sidecar down.

| Deliverable | Prompt |
|-------------|--------|
| `CarinaSidecarGateway` HTTP client | 04 |
| Short-lived JWT (tenant_id, user_id, abilities) | 05 |
| Degraded mode + health checks | 06 |

**Exit criteria:**
- Pest test: gateway posts message, receives reply JSON
- JWT rejected without valid signature
- Sidecar stop does not 500 the Laravel health endpoint

---

### Phase 2: Packs and knowledge (weeks 9-12) - Difficulty 6/10

**Outcome:** Sidecar runs with property domain skills; tenant RAG available to agent.

| Deliverable | Prompt |
|-------------|--------|
| `ACTIVE_SKILL_PACKS=property-uk,propreneur-workspace` | 07 |
| Hub sync into sidecar compiled skills | 08 |
| RAG bridge (tenant pgvector via Laravel proxy) | 09 |

**Exit criteria:**
- Sidecar system prompt includes property-uk suffix
- Hub packs appear in sidecar skill manifest
- Agent turn can retrieve RAG chunks for tenant (audit logged)

---

### Phase 3: Tool bridge (weeks 13-28) - Difficulty 8/10

**Outcome:** Kernel agent can call Propreneur domain operations without PHP agent loop.

This is the **largest phase**. v2 has **61 tools** across CRM, calculators, pipeline, compliance, accounting, mentoring, viCal, HMO, BTL, SA, agency, etc.

**Strategy:** Do not reimplement tools in TypeScript. Generate OpenAPI from `CarinaToolRegistry`, expose `POST /api/internal/carina/tools/{name}`, register HTTP tools in sidecar.

| Batch | Tools (examples) | Prompt |
|-------|------------------|--------|
| Manifest | All tool names, schemas, confirmation flags | 10 |
| Read 1 | portfolio, contacts, compliance, properties | 11 |
| Read 2 | calculators, pipeline, deals, reporting | 12 |
| Writes | create/update, sequences, deal packs + confirmation | 13 |
| Registration | `@verlox/propreneur-tools` or sidecar plugin | 14 |

**Exit criteria:**
- Sidecar agent completes scripted flows using bridge tools only (Pest + Vitest)
- Confirmation gate pauses write tools; resume via Laravel confirm endpoint
- Tool audit events match v2 `CarinaSecurityAuditLogger` fields

---

### Phase 4: Channel strangler (weeks 29-36) - Difficulty 7/10

**Outcome:** Production traffic uses sidecar; PHP agent is fallback only.

| Channel | Prompt | Rollback |
|---------|--------|----------|
| Remote API (`/api/remote/carina/chat`) | 15 | `CARINA_AGENT_RUNTIME=php` |
| Hub inbound (`carina-hub`) | 16 | Same flag |
| In-app floating chat | 17 | Per-tenant feature flag |
| Retire PHP loop | 18 | Keep read-only for 1 release |

**Exit criteria:**
- xelox tenant E2E on sidecar for 2 weeks staging
- Production flag `carina_runtime=kernel` for pilot tenants
- No regression on confirmation flows or audit chain

---

### Phase 5: Migration and ship (weeks 37-40+) - Difficulty 6/10

**Outcome:** v2 tenants migrated or upgraded; runbooks and env docs complete.

| Deliverable | Prompt |
|-------------|--------|
| Tenant migration (DB unchanged; config + flags) | 19 |
| E2E + env checklist | 20 |

**Exit criteria:**
- Migration runbook tested on copy of production tenant
- ENV-CHECKLIST passes on staging and one pilot production tenant
- `CarinaAgentService` marked deprecated in code and docs

---

## Difficulty summary

| Phase | Effort | Risk |
|-------|--------|------|
| 0 Foundation | Low | Low |
| 1 Gateway | Medium | Medium (auth) |
| 2 Packs/RAG | Medium | Medium (RAG latency) |
| 3 Tool bridge | **High** | **High** (61 tools, confirmations) |
| 4 Strangler | Medium | Medium (production cutover) |
| 5 Ship | Medium | Low |

**Overall: 7.5/10** for full convergence. **Phase 3 dominates calendar time.**

---

## Team and skills

| Role | Focus |
|------|-------|
| Laravel engineer | Tool Bridge internal API, JWT, strangler flags, Pest |
| Carina/TypeScript engineer | Sidecar config, tool registration, Vitest |
| DevOps | Docker, deploy scripts, secrets, per-tenant sidecar scaling (later) |
| Product | Pilot tenant selection, confirmation UX, "powered by Carina" copy |

Minimum viable team: **1 full-stack (Laravel + TS) + founder review on cutover**.

---

## Phase B-E (prompts 21-30): Full product parity

See [SCOPE-PARITY.md](./SCOPE-PARITY.md) for the honest gap analysis.

| Phase | Prompts | Outcome |
|-------|---------|---------|
| B Scout + core | 21-23 | carina-core pin; Scout tool guard on every bridge call; kill switch |
| C Platform + channels | 24-25 | Platform Carina (16 tools); Telegram, WhatsApp, Slack, Email, Webhook on kernel |
| D UX + proactive | 26-27 | Brain modifiers, incognito, usage limits; scheduled compliance/pipeline digests |
| E Ship gate | 28-30 | All 11 shipped v2 modules regression; mobile API; full E2E sign-off |

---

## Key technical decisions (locked)

1. **Install-and-own sidecar** (not SaaS call to core.carinaai.uk per tenant)
2. **Exact pin** of `@verlox/carina-core` when published; interim `carina-agent` pin until kernel split ships
3. **Tools stay in PHP** until a tool is proven stable enough to port (optional future)
4. **property-uk on sidecar only** for Propreneur; mobile product boundary unchanged
5. **No `migrate:fresh`** on dev DBs; v3 fork inherits v2 DatabaseWipeGuard
6. **Scout required** on Business Edition kernel path; Community Edition may run without Scout per edition policy
7. **Full v3 ship** requires prompt 30, not prompt 20

---

## Dependencies on Carina kernel roadmap

| Kernel item | v3 impact | Blocker? |
|-------------|-----------|----------|
| `@verlox/carina-core` split | Cleaner sidecar dependency | No (use `carina-agent` pin now) |
| Stable tool registration API | Sidecar plugin for Propreneur tools | Partial (HTTP bridge works without) |
| Hub at hub.carinaai.uk | Skills sync | No (already live) |

---

## Success metrics

| Metric | Target |
|--------|--------|
| Agent response quality | Sidecar >= PHP agent on golden test set (20 prompts) |
| Tool success rate | >= 99% on read tools; writes with confirmation unchanged |
| Latency p95 | <= 120% of v2 PHP agent (acceptable for kernel features gained) |
| Incidents | Zero cross-tenant data leaks in JWT/tool bridge audit |
| Ops | Single `deploy-to-production.sh` deploys Laravel + sidecar image |

---

## Prompt execution order

Run prompts **01 through 20** sequentially. Phase 3 prompts (10-14) may parallelize by tool batch after prompt 10 lands.

After each prompt:
1. Run validation commands in the prompt
2. Mark COMPLETED with date
3. Deploy to staging before starting next phase boundary

---

## Related documents

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [MIGRATION-FROM-V2.md](./MIGRATION-FROM-V2.md)
- [prompts/00-overview.md](./prompts/00-overview.md)
- Archived federation: `carina/01-devends/prompts-library/archived/propreneur-integration--00-overview.md`
- Distro reference: `carina/01-devends/prompts-library/archived/carina-distro-README.md`
