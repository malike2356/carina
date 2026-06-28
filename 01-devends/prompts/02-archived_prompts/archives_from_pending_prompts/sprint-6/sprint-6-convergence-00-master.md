# Sprint 6 Convergence; Master Index (Carina + Propreneur)

**Status: COMPLETED 2026-06-24 (archived)**

**Program closeout:** All checklist sections A (bridge), B (Tier 1 brain parity), and C (Tier 2) shipped. Phase 2 writes (A13) and Carina IMAP poller (A14) closed the sprint. Child prompts 01-06 and the original bridge prompt are archived alongside this index.

**Sprint:** 6; Research App Integration & AI Employee Automation  
**Prompt number:** 00 (index)  
**Name:** Carina-Propreneur convergence master plan  
**Primary agent:** Claude Code (architecture), Codex (wiring)  
**Estimated hours:** 0 (planning only; implement via child prompts)

**Canonical checklist (living):** `01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md`  
**Operator guide:** `01-devends/planning/operations/CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md`

All child prompts archived under `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Philosophy

**Unity is strength. Addition, not replacement.**

- Propreneur Carina keeps the **domain body** (~80 tenant tools, calculators, CRM, compliance).
- Standalone Carina + Aiva keeps the **platform body** (channels, memory, skills, Scout fleet).
- The **bridge** lets each side consume the other's strengths without merging runtimes.
- **Port the brain, not the body** (memory, clarify, scheduling, provider policy, knowledge sync).

---

## Child prompts (all complete)

| # | File | Status |
|---|------|--------|
| 01 | `sprint-6-convergence-01-bridge-phase1-closeout.md` | DONE |
| 02 | `sprint-6-convergence-02-shared-knowledge-sync.md` | DONE |
| 03 | `sprint-6-convergence-03-brain-parity-tier1-propreneur.md` | DONE |
| 04 | `sprint-6-convergence-04-brain-parity-tier2.md` | DONE |
| 05 | `sprint-6-convergence-05-complement-not-replace.md` | DONE |
| 06 | `sprint-6-convergence-06-phase2-writes-review-queue.md` | DONE |

**Original bridge prompt:** `sprint-6-email-ingestion-carina-propreneur-bridge.md` (Phase 1 DONE; archived).

---

## Global constraints

1. Feature flags default **off** in production.
2. Propreneur is **system of record** for tenant mutations.
3. Carina is **system of record** for external channels and Aiva fleet.
4. No second IMAP client on mailboxes already in Propreneur email ingestion.
5. No direct SQL from Carina into Propreneur tenant databases.
6. Scout remains optional (`LABYRINTH_ENABLED=false` must not break either product).

---

## Owner / consumer quick reference

| Capability | Owner | Consumer | Flag |
|------------|-------|----------|------|
| Portfolio / compliance / deals read | Propreneur | Carina Aiva | `aiva_external_bridge` / `PROPREENEUR_BRIDGE_ENABLED` |
| Bridge write proposals | Propreneur (review queue) | Carina Aiva tools | `aiva_bridge_writes` / `PROPREENEUR_BRIDGE_WRITES` |
| Email processing + activity log | Propreneur | Carina (digest only) | bridge + no Carina IMAP on same mailbox |
| Carina-only IMAP (non-PP mailboxes) | Carina | Aiva | `EMAIL_INGESTION_ENABLED` |
| Daily summary delivery | Carina | Telegram/WhatsApp | `AIVA_DAILY_SUMMARY_ENABLED` |
| In-app agent + domain tools | Propreneur | Propreneur UI | `carina_ai` / `carina_agent` |
| Channels + Aiva personas | Carina | External users | `AI_WORKERS_ENABLED` |
| Scout audit / quarantine | Scout | Carina tool-runner | `LABYRINTH_ENABLED` |
| Property knowledge RAG | Shared `brain/` | both ingest pipelines | training / pack flags |

---

## Done When (program level)

- [x] Checklist section A items A1-A14 DONE
- [x] Tier 1 gaps B1-B7 closed (prompt 03)
- [x] Tier 2 gaps C1-C5 closed (prompt 04)
- [x] Knowledge sync documented and scripted (prompt 02)
- [x] Complement guide in ops docs (prompt 05)
- [x] Phase 2 writes behind review queue (prompt 06)
- [x] A14 Carina IMAP background poller (non-Propreneur mailboxes only)

---

## Validation (post-sprint)

```bash
# Propreneur bridge + proposals
cd propreneur/propreneur-v2
php artisan test --filter=AivaBridge
php artisan test --filter=AivaBridgeProposal
php artisan test --filter=Carina

# Carina bridge + email poller
cd carina/02-backends/core.carinaai.uk
pnpm test src/ingestion/email/email-poller.test.ts src/workers/aiva-message-handler.test.ts
```

Pilot onboarding (flags and keys only): `PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md`
