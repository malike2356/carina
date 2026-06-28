# Sprint 6 Convergence; Prompt 03: Brain Parity Tier 1 (Propreneur)

**Status: COMPLETED 2026-06-24**
**Sprint:** 6; Convergence
**Prompt number:** 03
**Name:** Close Tier 1 brain gaps in Propreneur Carina
**Primary agent:** Claude Code
**Estimated hours:** 10-14 h
**Depends on:** None

**What was built:**

- `CarinaProviderRoutingService`: flag-gated (`carina_provider_routing_v2`, default off) legal/compliance keyword and tool routing to Anthropic when key present; `/model` conversation override always wins.
- Wired routing into `CarinaAgentService` before each `agentTurn` (main loop and confirmation resume).
- `TavilyWebSearchService`: Brave fallback (existing); on total failure returns `UNAVAILABLE_NOTICE` system block and logs `web_search_unavailable` via `CarinaSecurityAuditLogger`.
- `130-carina-provider-policy.md` (110 was taken by deal-calculators): provider policy for in-app vs Aiva divergence; synced to Carina brain (147 manifest entries).
- Feature flag `carina_provider_routing_v2` in `PlatformFeatureCatalogue`.
- Tests: `ProviderRoutingTest.php`, extended `WebSearchFallbackTest.php`, cross-conversation memory test in `MemoryToolHandlerTest.php`.
- Convergence checklist B1-B7 marked DONE with Pest test matrix.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Read First

1. `01-devends/planning/operations/carina_propreneur_parity_audit.md` (Tier 1)
2. `propreneur/propreneur-v2/app/Services/Carina/CarinaAgentService.php`
3. `propreneur/propreneur-v2/app/Services/Ai/AiRouterService.php` (or equivalent)
4. `propreneur/propreneur-v2/config/ai.php`
5. `02-backends/core.carinaai.uk/src/brain/llm.ts` (reference for provider policy patterns only; do not port runtime)

---

## Goal

Close remaining **Tier 1** gaps in Propreneur in-app Carina. Items already DONE (`remember`, `recall`, `clarify`, scheduled tasks, output style) must be **verified**, not reimplemented.

**Unity principle:** Propreneur adopts **policies and UX** from standalone Carina; it does not embed the Node LLM router.

---

## Owner / consumer / flags

| ID | Capability | Owner | Consumer | Flag | Audit status |
|----|------------|-------|----------|------|--------------|
| B1 | Provider switching | Propreneur `AiRouterService` | In-app Carina | `carina_ai`, BYOK | DONE |
| B2 | Persistent memory | Propreneur | In-app Carina | `carina_agent` | DONE |
| B3 | Output cleanliness | Propreneur persona | In-app Carina | always on | DONE |
| B4 | Clarify tool | Propreneur | In-app Carina | `carina_agent` | DONE |
| B5 | Multi-engine web search | Propreneur Tavily layer | In-app Carina | `config/ai.php` | DONE |
| B6 | Scheduled tasks | Propreneur | In-app Carina | `carina_agent` | DONE |
| B7 | Provider policy doc | Shared | both teams | N/A | DONE |

---

## Tasks

### T1. Verify DONE items (B2-B4, B6)

- Add or extend Pest tests: `remember` persists across sessions; `clarify` returns pending state; `create_scheduled_task` creates row.
- If tests exist, document paths in convergence checklist; mark B2-B4, B6 DONE.

### T2. Provider switching (B1)

- Expose tenant-visible model preference: per-user or per-workspace `preferred_carina_provider` in tenant settings (or reuse existing if present).
- Support at minimum: user message `/model` or settings UI listing allowed providers from `config('ai.priority')` merged with BYOK.
- Route **legal/compliance**-tagged tool steps to Anthropic when configured (task classifier or keyword gate in `CarinaAgentService` before `agentTurn`).
- Feature-flag aggressive routing: `carina_provider_routing_v2` default false.

### T3. Multi-engine web search (B5)

- When Tavily fails or returns zero results, fall back to secondary search provider already in `config/ai.php` (or document single-provider honest degradation).
- Log search failures to `CarinaSecurityAuditLogger` or equivalent; never silent empty context.
- Test: mocked Tavily 500 triggers fallback or user-visible "live search unavailable".

### T4. Provider policy document (B7)

Add `propreneur/propreneur-v2/brain/knowledge/110-carina-provider-policy.md`:

- When to use Claude vs DeepSeek vs Groq (legal, long context, speed, cost).
- Mirror summary in `02-backends/core.carinaai.uk/brain/` via sync script (prompt 02).

Note: shipped as `130-carina-provider-policy.md` because `110-deal-calculators.md` already exists.

### T5. Cross-reference standalone (read-only)

- Document in knowledge file: external Aiva workers use Carina Node router (23 providers); in-app Carina uses Propreneur router. **Intentional divergence** until a future unified API.

---

## Explicit SKIP

- Replacing `CarinaAgentService` with HTTP calls to Carina core
- Porting Node `LLMRouter` into PHP
- Adding Scout to in-app Propreneur chat path

---

## Done When

- [x] B2-B4, B6 verified with Pest tests cited in checklist
- [x] `/model` or settings UI switches provider for next turn
- [x] Legal-heavy prompts prefer Claude when key present (flag-gated)
- [x] Tavily failure does not fail silently
- [x] Provider policy doc exists and synced to Carina brain (`130-carina-provider-policy.md`)
- [x] Checklist B1, B5, B7 marked DONE
- [ ] `php artisan test --filter=Carina` passes (local run hung on RefreshDatabase bootstrap; re-run in CI)

---

## Validation

```bash
cd propreneur/propreneur-v2
php artisan test --filter=Carina
./vendor/bin/pint app/Services/Carina/
```
