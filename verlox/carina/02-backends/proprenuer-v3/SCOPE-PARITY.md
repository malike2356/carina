# Propreneur v3 Scope Parity: Honest Assessment

**Updated:** 2026-07-04

This document answers: **Will prompts 01-20 deliver the same product as Propreneur v2, on carina-core, governed by Scout?**

**Short answer: No. Not alone.**

Prompts 01-20 deliver the **agent runtime migration spine** (~35-40% of the v3 vision). The **full property OS** comes from the v2 fork unchanged. **Scout, platform Carina, channels, scheduled runs, and Carina UX parity** need prompts 21-30 and a module acceptance matrix.

---

## What "full Propreneur v3" actually means

| Layer | Owner | v3 requirement |
|-------|-------|----------------|
| Property OS (11 shipped modules) | Laravel fork from v2 | Same UI, routes, billing, tenant DBs |
| Tenant agent (61 tools) | Carina kernel + Tool Bridge | Same outcomes, kernel runs loop |
| Platform agent (16 tools) | Carina kernel (central sidecar or shared) | Platform admin Carina preserved |
| Domain brain | property-uk + Hub packs | On kernel |
| Security governance | **Scout (required for BE)** | Tool guard, audit, kill switch on kernel path |
| Channels | Kernel gateways + Laravel adapters | Telegram, WhatsApp, Slack, Email, Webhook, Hub, Remote |
| Proactive agent | Scheduled digest jobs | Compliance, pipeline, contacts |
| Carina UX | Laravel UI + kernel session | Brain modifiers, incognito, limits, floating widget |
| Federation | Aiva bridge | Unchanged |

**Not in v2 today (do not promise in v3 launch):** Project Management module, HR and Payroll module (both marked not started in v2 CLAUDE.md).

---

## Coverage matrix

Legend: **Carried** = v2 fork, no rebuild | **Prompts** = explicit build work | **Gap** = missing from prompts 01-20

### Property OS modules (Laravel)

| Module | v2 status | v3 delivery | Prompts 01-20 |
|--------|-----------|-------------|---------------|
| Deal Engine | Shipped | Carried | Carried |
| CRM | Shipped | Carried | Carried |
| Pipeline | Shipped | Carried | Carried |
| Communications Hub | Shipped | Carried | Carried |
| Accounting | Shipped | Carried | Carried |
| Compliance | Shipped | Carried | Carried |
| Document Vault | Shipped | Carried | Carried |
| viCal | Partial | Carried | Carried |
| Mentoring OS | Shipped | Carried | Carried |
| Reporting | Shipped | Carried | Carried |
| Project Management | Not started | Out of scope | N/A |
| HR and Payroll | Not started | Out of scope | N/A |

**Module regression:** Prompt 28 executes [docs/V3-MODULE-ACCEPTANCE.md](./docs/V3-MODULE-ACCEPTANCE.md); not in 01-20.

### Carina tenant agent

| Capability | v2 | Prompts 01-20 | Gap |
|------------|-----|---------------|-----|
| 61 tenant tools | PHP registry | Tool Bridge batches 10-14 | Partial (batched, not all verified per module) |
| Agent loop | CarinaAgentService | Sidecar | Prompts 04-18 |
| Confirmation gates | PHP | Bridge prompt 13 | Covered |
| Tenant RAG | pgvector | RAG bridge prompt 09 | Covered |
| Hub skills | compile-skills | Sidecar sync prompt 08 | Covered |
| Brain modifiers | PHP metadata | **Gap** | Prompt 27 |
| Incognito mode | PHP | **Gap** | Prompt 27 |
| Usage limits | PHP | **Gap** | Prompt 27 |
| Floating widget | Blade UI | Dispatcher prompt 17 | Partial (runtime only) |
| Scheduled proactive runs | artisan schedule | **Gap** | Prompt 26 |
| Multi-provider BYOK | config/ai.php | Kernel default chain | Prompt 21 notes |

### Platform Carina (central)

| Capability | v2 | Prompts 01-20 |
|------------|-----|---------------|
| PlatformCarinaAgentService | PHP loop | **Gap** |
| 16 platform tools | PlatformCarinaToolRegistry | **Gap** |
| Platform conversations | central routes | **Gap** |

**Prompt 24** covers platform sidecar.

### Scout (Labyrinth)

| Capability | v2 | Prompts 01-20 |
|------------|-----|---------------|
| Tool call validation | LabyrinthScoutService before execute | **Gap** (optional LABYRINTH_ENABLED only) |
| Kill switch | CarinaAgentService check | **Gap** on sidecar path |
| Audit events to Scout | HTTP to api.labyrinthscout.com | **Gap** on sidecar path |
| Tenant settings UI | /settings/labyrinth-scout | Carried |
| Feature gating | BillingModule | Carried |

**Prompts 22-23** make Scout **required** on kernel tool path, not optional.

### Remote channels

| Channel | v2 adapter | Prompts 01-20 |
|---------|------------|---------------|
| HTTP Remote API | CarinaRemoteGateway | Prompt 15 |
| CarinaHub | CarinaHubChannelAdapter | Prompt 16 |
| Telegram | TelegramChannelAdapter | **Gap** |
| WhatsApp Web | WhatsAppWebChannelAdapter | **Gap** |
| WhatsApp Cloud | WhatsAppCloudChannelAdapter | **Gap** |
| Slack | SlackChannelAdapter | **Gap** |
| Email inbound | EmailChannelAdapter | **Gap** |
| Generic webhook | GenericWebhookChannelAdapter | **Gap** |

**Prompt 25** routes all channels through sidecar dispatcher.

### Kernel packaging

| Item | User expectation | Prompts 01-20 |
|------|------------------|---------------|
| `@verlox/carina-core` | Explicit dependency | Uses `carina-agent` pin only |
| Scout commercial layer | Governed agent | Optional flag |

**Prompt 21** aligns with carina-core split when published; documents interim pin.

### Integrations

| Integration | Prompts 01-20 |
|-------------|---------------|
| Aiva federation bridge | Carried (Remote API) |
| Propreneur mobile API | **Gap** | Prompt 29 |
| Stripe billing gates | Carried | Prompt 29 tests |
| CE vs BE edition | Carried | Prompt 28 |

---

## Revised effort estimate

| Workstream | Prompts | Calendar | % of v3 vision |
|------------|---------|----------|----------------|
| Agent spine (01-20) | 01-20 | 9-15 mo | ~40% |
| Scout + carina-core (21-23) | 21-23 | +2-3 mo | +15% |
| Platform + channels (24-25) | 24-25 | +2-3 mo | +15% |
| UX + scheduled (26-27) | 26-27 | +1-2 mo | +10% |
| Full acceptance (28-30) | 28-30 | +2-3 mo | +20% |

**Total realistic: 16-24 months** for true v2 parity on kernel + Scout, not 9-15.

---

## Definition of done (full v3)

v3 is shippable when **all** are true:

1. Every **shipped v2 module** passes regression matrix (prompt 28)
2. All **61 tenant tools** + **16 platform tools** work via kernel path
3. **Scout tool guard** blocks on sidecar path same as v2 PHP path
4. **All 7 remote channel adapters** dispatch to kernel when runtime=kernel
5. **Scheduled agent** jobs produce same digests as v2
6. **Brain modifiers, incognito, usage limits** behave as v2
7. **Mobile API** contract tests pass unchanged
8. **Aiva federation** Remote API unchanged for external callers
9. Golden prompt set: sidecar >= PHP agent on 50+ scenarios
10. Rollback to PHP runtime still works one release

Prompt 30 is the full ship gate; prompt 20 is agent spine gate only.

---

## Recommendation

Treat prompts **01-20** as **Phase A: Kernel spine**.

Execute **21-30** before calling v3 production-ready.

Do not market "Propreneur v3" externally until prompt 30 passes; use "kernel pilot" for 01-20.
