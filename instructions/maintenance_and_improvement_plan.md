# Carina maintenance and improvement plan

Living guide for continually improving Carina as a product. Use a **tight loop**, not ad hoc edits.

**Priority order:** correctness first, latency second, tone third, feature breadth last.

**Last updated:** 2026-06-10

---

## The loop (weekly rhythm)

```
Real usage / operator feedback
        |
        v
Instrument and bucket failures  -->  Add to eval set (20-100 chats)
        |                                      |
        v                                      v
Narrow fix (prompt / routing / config)    pnpm test + eval run
        |
        v
Ship small (core patch + npm + public repo sync)
        |
        v
Verify on VPS / dogfood --> update this doc
```

---

## 1. Instrument real failures

**Principle:** Log every bad turn with prompt, provider, model, tool calls, latency, and final error. Bucket by type; keep logs queryable.

| Bucket | Examples |
|--------|----------|
| `slow` | Turn > N seconds, timeout |
| `wrong` | Incorrect answer, wrong tool |
| `verbose` | "Feels too ChatGPT", wall of text |
| `wrong_thread` | Replied in wrong session/channel |
| `missing_config` | Provider/key/pack not set |
| `tool_error` | Tool failed or policy blocked |
| `injection` | Scout/prompt guard tripped |

### Already in code

| Area | Location | Notes |
|------|----------|-------|
| Tool call telemetry | `src/security/scout-client.ts` (`reportToolCall`) | Duration, success, params (sanitised); Scout when enabled |
| Complexity routing | `src/brain/task-classifier.ts`, `orchestrator.ts` | `simple` vs `complex`; fast mode |
| Quick replies | `orchestrator.ts` `quickReply()` | Greetings/status without full planner |
| Readiness | `pnpm doctor` (Scout/console) | Config vs implemented |

### Gaps (build next)

- [ ] **Structured turn log** to `data/logs/turns.jsonl` (or Postgres): `sessionId`, `provider`, `model`, `latencyMs`, `toolsUsed`, `errorClass`, `userMessageHash` (not raw PII in prod)
- [ ] **Ops or CLI view**: `carina ops turns --since 24h --bucket slow` (or ops panel tab)
- [ ] **Dashboard counter** on operator dashboard for failure buckets (last 7 days)

---

## 2. Build a small eval set from real usage

**Principle:** 20 to 100 representative chats; run on every routing/prompt change.

### Suggested eval categories

| Category | Count (target) | Purpose |
|----------|----------------|---------|
| Greetings / capability | 5-10 | Fast path, tone |
| Short operator prompts | 10-15 | Latency, no over-planning |
| Single tool use | 10-15 | Correct tool, args |
| Multi-step tasks | 10-15 | Thread integrity, handoff |
| Failure / edge cases | 10-20 | Regressions from production bugs |
| Pack-specific (property-uk, etc.) | 10-20 | RAG + triggers |

### Gaps

- [ ] **`eval/` directory** in `core.carinaai.uk`: JSON fixtures + expected assertions (tool name, max latency, must-not-contain phrases)
- [ ] **`pnpm eval`** script: runs fixtures against orchestrator with mocked LLM or recorded responses
- [ ] **CI optional job**: run eval on PRs that touch `src/agents/`, `src/brain/`, prompts

### When you fix a user-visible bug

Add one eval case that reproduces the **exact shape** of that bug (see section 6).

---

## 3. Treat prompts as code

**Principle:** Version base system prompt, quick-replies, and routing rules separately; narrow changes; test like code.

### Already in code

| Asset | Location |
|-------|----------|
| Pack suffixes | `src/skills/packs/*/prompts/` |
| Injection patterns | `src/security/injection-patterns.json` |
| Quick reply strings | `src/agents/orchestrator.ts` |

### Practices

- [ ] **`prompts/VERSION`** or changelog in repo when system prompt changes
- [ ] **No drive-by prompt edits** in the same PR as provider or gateway changes
- [ ] **Diff review**: prompt PRs require eval run or manual dogfood checklist

---

## 4. Make config the first-class control surface

**Principle:** Credentials, provider, channels, and packs explicit in config; runtime honest about enabled vs implemented.

### Already in code

| Surface | Location |
|---------|----------|
| Wizard | `src/setup/wizard.ts` |
| Env template | `.env.example` |
| Doctor | Scout/console `pnpm doctor` |
| Hosted BYOK | Carina Cloud settings |

### Practices

- [ ] Every new feature flag documented in `.env.example` and [configuration docs](https://carinaai.uk/docs/user/configuration)
- [ ] CLI `carina config check` (or extend doctor): lists missing keys for **enabled** features only
- [ ] UI/CLI message pattern: `"X is implemented but not configured: set Y in ~/.carina/.env"`

Reference: `CONFIGURATION_READINESS.md` (implemented vs activation required).

---

## 5. Keep the fast path fast

**Principle:** Greetings, capability questions, and status checks skip full planner; hard latency budgets on LLM and tools.

### Already in code

| Mechanism | File |
|-----------|------|
| `quickReply()` | `orchestrator.ts` |
| `classifyComplexity` + `setFastMode` | `task-classifier.ts`, `carina.ts` |
| Tool result cache TTL | `tool-runner.ts` |
| Stale duplicate tool skip | `carina.ts` turn loop |

### Targets (set and measure)

| Path | Budget (target) |
|------|-----------------|
| Quick reply | < 50 ms (no LLM) |
| Simple turn (fast mode) | < 8 s end-to-end |
| Complex multi-step | < 60 s per step alert |
| Single tool call | < 30 s (configurable per tool) |

### Gaps

- [ ] Log `fastMode` and `complexity` on each turn (for eval)
- [ ] Expand quick-reply coverage (status, "what can you do", "which provider")
- [ ] Alert in ops when p95 latency exceeds budget

---

## 6. Use tests for behavior, not just syntax

**Principle:** Test routing, tone boundaries, thread persistence, provider fallback, no-op modes. Every production bug fix gets a regression test.

### Already in code

- **5,369+ Vitest tests** (`pnpm test`)
- `orchestrator.test.ts`, `task-classifier.test.ts`, gateway and tool tests

### Practices

| When | Add |
|------|-----|
| Wrong thread / session bleed | Test in gateway router or session store |
| Quick reply regression | `orchestrator.test.ts` case |
| Provider fallback | `brain/` provider tests |
| Config missing | Wizard or health endpoint test |
| Tone ("too ChatGPT") | Eval fixture with `maxLength` or banned phrases |

Run before every release:

```bash
cd core.carinaai.uk && pnpm test && pnpm build
```

---

## 7. Close the loop with operator feedback

**Principle:** Turn subjective feedback into acceptance criteria.

| Feedback | Acceptance criteria example |
|----------|----------------------------|
| "Too ChatGPT" | First reply < 120 words unless user asked for detail |
| "Too slow" | Simple prompt p95 < 8 s in eval |
| "Wrong thread" | Session ID in logs matches channel peer; test added |
| "Didn't use my pack" | `ACTIVE_SKILL_PACKS` logged; RAG chunk in trace |

### Where to capture

- GitHub Issues on [carina-agent](https://github.com/malike2356/carina-agent) (bugs)
- Private ops notes / `instructions/` for VERLOX dogfood
- Discussions for community tone and pack ideas (not production SLOs)

---

## 8. Ship smaller

**Principle:** Frequent narrow deploys; do not batch prompt + routing + UI + provider in one release unless necessary.

### Release checklist (core)

1. Change in `core.carinaai.uk` on private monorepo `main`
2. `pnpm test && pnpm build`
3. Bump patch in `package.json` if shipping to users
4. `bash scripts/publish-carina-agent.sh` (npm)
5. `bash scripts/export-carina-core-public.sh` + push `carina-agent` public repo
6. `bash scripts/deploy-carina.sh` (VPS) if runtime change affects production
7. Note in CHANGELOG or release notes (GitHub Release optional)

**Do not mix** in one deploy: npm major behavior change + marketing copy + Scout + on-chain trust activation.

---

## Improvement backlog (prioritised)

| P | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Structured turn logging (`turns.jsonl`) | Core | Not started |
| 2 | `eval/` fixtures + `pnpm eval` | Core | Not started |
| 3 | Expand quick-reply + fast path metrics | Core | Partial |
| 4 | `carina config check` command | CLI | Not started |
| 5 | Prompt version changelog | Docs/prompts | Not started |
| 6 | Ops latency dashboard (p95 by path) | Ops | Not started |
| 7 | Community good-first issues (#1-#5) | Community | Open on GitHub |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `CONFIGURATION_READINESS.md` | Shipped vs needs activation |
| `TRUST_BUILD_CHECKLIST.md` | Scout + on-chain trust |
| `PUBLIC_REPOSITORY.md` | Public/private repo split |
| `build-plan/COMPARISON.md` | Verified metrics for marketing |
| `instructions/README.md` | Workspace index |

---

## One-line summary

**Measure real turns, eval before you prompt, config before you feature, ship small, test the bug you fixed.**
