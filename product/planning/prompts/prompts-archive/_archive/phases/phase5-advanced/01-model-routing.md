# Action: Tiered Cloud Model Routing + Real Cost Tracking - Extend the Existing Router, Skip Ollama (Standalone Carina)

## Goal
Extend Carina's already-working multi-provider `LLMRouter` (DeepSeek -> Claude -> OpenAI fallback chain, plus an existing `cheap()`/`chatCheap()` tier) with task-complexity-aware routing across its EXISTING cloud providers, and build genuine per-request/per-session/per-month cost tracking on top of the token counts it already captures. Do not build local-model (Ollama) infrastructure - it directly contradicts a documented architecture decision.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **The third time this exact collision has come up in this batch - take it as confirmed, not debatable**: `04-datascience-mlops-research.md` and `06-domain-pack-system.md` both independently found and cited the same fact: Carina's `CLAUDE.md` documents "DeepSeek first for all LLM calls... Python stubs are in archive/" as a deliberate "use hosted APIs, no local model infrastructure" decision. This spec's entire premise - "Task Classifier routes between local Ollama models and cloud models," "ship Carina with a bundled fine-tuned property model," "Ollama runs as a local service," "Model files stored in ~/.ollama/models/" - is the opposite architecture. **Do not build Ollama detection, model pulling, GGUF bundling, or any of the local-model machinery this spec describes.** State this plainly in your completion summary, citing the same architectural decision the other two prompts cited - this is now a consistent, three-times-confirmed pattern, not a one-off judgment call.
- **Carina already has almost the entire useful skeleton of "route by complexity" - read `src/brain/llm.ts` in full before writing anything**:
  - `LLMRouter` already maintains a configured fallback chain: `fallbackOrder()` returns `['deepseek', 'anthropic', 'openai']` filtered to configured providers, and `chat()` already tries each in order, catching and logging failures, only throwing when all fail. **This IS the spec's "fallback chain" section, already built and working.**
  - `cheap()`/`chatCheap()` already exist: a deliberately-ordered "cheapest capable provider" selection (`['deepseek', 'openai', 'anthropic']`), already used for "meta-calls" - skill auto-write evaluation (`auto-writer.ts`) and task decomposition (`orchestrator.ts`'s `decompose()`). **This IS the spec's "simple queries -> cheap/fast model" idea, already built, already in production use, just not yet generalised to ordinary user-facing chat.**
  - `CarinaResponse` already carries `tokensUsed` (combined input+output) on every response from every provider (`anthropic`/`deepseek`/`openai` paths all populate it). **The hard part of cost tracking - actually capturing token counts - is already done.** What's missing is persistence and aggregation, not instrumentation.
- **What's genuinely missing, and worth building**:
  1. A lightweight task classifier that decides "is this simple enough for `cheap()`, or does it need `current()`'s full-capability provider" for ordinary user turns (today, `chatCheap` is reserved for internal meta-calls; ordinary chat always uses the configured primary). This is the one piece of real, new routing logic.
  2. Persisted, aggregable cost tracking: per-request (model, tokens, estimated cost), rolled up per-session and per-month, with a "you used X tokens via DeepSeek and Y via Claude this month, here's the estimated cost" report. None of this is captured anywhere today (`grep -rln 'tokensUsed' src/` shows it's read but never persisted/aggregated).
  3. Budget caps with warn-at-80%/block-at-100% - genuinely useful for a product where the operator pays per-token across multiple providers.
- **Reinterpret the spec's classification categories onto real provider choices, not real-vs-fake local models**:
  - "simple" -> route to `cheap()` (DeepSeek, already the configured cheap tier)
  - "domain-specific" -> spec assumed a fine-tuned local model; Carina's actual domain-specificity comes from skill packs + RAG (`property-uk`, `searchRag`/`insertRagChunk` in `store.ts`) layered on top of whichever cloud provider is active - there is no separate "domain model" to route to. Drop this category as a routing dimension; domain knowledge is a context-injection concern (see `04-unique-features-marketplace.md`'s domain-knowledge-layer discussion), not a model-selection one.
  - "complex reasoning" -> route to `current()` (the configured primary, e.g. Claude)
  - "vision" -> Carina already configures a specific provider/model per task type via `config`); check whether vision requests already route to a vision-capable provider, or whether this is a real gap to close
  - "code" -> no special handling needed beyond "complex reasoning" routing, unless there's evidence DeepSeek/Claude differ meaningfully on code tasks for this product's actual usage (don't invent a distinction the data doesn't support)

## Files to create
- `src/brain/task-classifier.ts` - `classifyComplexity(messages: Message[]): 'simple' | 'complex'` (binary is enough; the spec's five-way split collapses to "cheap-tier-eligible or not" once domain/vision/code are reframed as above)
- `src/brain/cost-tracker.ts` - `recordUsage(sessionId, provider, tokensUsed)`, `getSessionCost(sessionId)`, `getMonthlyReport()`, budget-cap checking
- `src/brain/cost-tracker.test.ts`, `src/brain/task-classifier.test.ts`

## Files to modify
- `src/brain/llm.ts` - add a `chatRouted(messages, tools, classification?)` method (or extend `chat()` with an optional routing hint) that picks `cheap()` vs `current()` based on `classifyComplexity` - **additive**, do not change `chat()`'s existing default behaviour or break `chatCheap()`'s existing internal-meta-call usages
- `src/memory/migrations.ts` - add a `model_usage` table: `(id, session_id, provider, model, tokens_used, estimated_cost, created_at)`
- Wherever ordinary user-turn LLM calls happen (`orchestrator.ts`/`carina.ts` - trace the actual call site) - route through the new classification-aware path and call `recordUsage` after each response

## Step-by-step

1. Read `src/brain/llm.ts` in full (it's ~360 lines but the relevant structure - `fallbackOrder`, `cheap`, `chatCheap`, the per-provider `chat` implementations and their `tokensUsed` population - is what you're extending). Confirm your mental model of "this already does 80% of what the spec calls a fallback chain and a cost tier" against the real code before writing anything.

2. Implement `classifyComplexity`: a cheap, fast heuristic - message length, presence of attachments/images (-> route to whatever already handles vision), keyword/structure signals for "analyze this document"/"compare strategies"-style complex asks vs. "what's my portfolio summary"-style simple lookups. **Do not spin up a whole second LLM call just to classify** (the spec's "task classifier uses a small local model for classification itself" - again, local-model infrastructure this product doesn't have); a fast heuristic that's right 90% of the time, with the fallback chain catching the rest, is the pragmatic, idiomatic-for-this-codebase choice (mirror `orchestrator.ts`'s own `heuristicPlan` fallback-after-LLM-classification pattern, but skip the LLM step entirely here since the cost of a wrong classification is low - worst case, a simple query gets the capable model).

3. Add the routed-chat path to `LLMRouter`, reusing `cheap()`/`current()` exactly as they exist - this should be a small, additive method, not a restructuring of the provider-selection logic that's already correct and tested.

4. Implement `cost-tracker.ts`:
   - Per-provider cost-per-token estimates (DeepSeek/Claude/OpenAI list prices - store as a small config map, not hardcoded magic numbers scattered through code; note these will drift and need periodic updates, document that plainly rather than pretending they're permanently accurate)
   - `recordUsage`: insert a row per response into `model_usage`
   - `getSessionCost`/`getMonthlyReport`: aggregate queries (`SUM(tokens_used)`, `SUM(estimated_cost)`, grouped by provider) - this is the data behind the spec's "you saved $X by routing Y% locally" report, reframed as "you spent $X this month, here's the provider breakdown" (there's no "local" to compare against, so the savings framing doesn't apply - report what's real: cost and provider mix)
   - Budget cap: read a configured monthly limit, compare against `getMonthlyReport()`'s running total, return a warning at 80% and a hard block (refuse new requests with a clear message) at 100% - the block must be graceful and explain itself, never a silent failure

5. Wire `recordUsage` into the actual user-turn call site (trace it - likely in `orchestrator.ts` or `carina.ts` wherever `llm.chat`/`chatRouted` gets called for a real user message, NOT the `chatCheap` meta-call sites which are internal bookkeeping, not billable user interactions worth reporting on... though confirm whether the operator would actually want those costs tracked too, since they're real spend regardless of whether a user sees them).

6. Write both test files:
   - `task-classifier.test.ts`: representative simple/complex inputs classify correctly; ambiguous ones lean toward whichever side is cheaper to get wrong (a misclassified-as-complex simple query costs more; a misclassified-as-simple complex query produces a worse answer - decide which failure mode is worse for this product and bias the heuristic that direction, and document the choice)
   - `cost-tracker.test.ts`: usage recording persists correctly, aggregation produces correct sums across providers and date ranges, budget-cap warning fires at 80% and blocking fires at 100%, with clean messages at both thresholds

## Expected behavior
- "What's my portfolio summary?" routes to the cheap tier (DeepSeek); "Analyze this 50-page deal pack and compare three exit strategies" routes to the capable tier (Claude/current) - both transparently, with no change to the user-visible interaction beyond (optionally) a brief note on which tier handled it.
- `carina usage --month` (or whatever the actual CLI surface is - check `bin/carina.ts`/`gateway/commands.ts` for where a new command would belong) produces a real report: tokens and estimated cost per provider, running total against any configured budget.
- A configured monthly budget produces a warning at 80% spend and a graceful refusal at 100%, never a silent overspend or a silent failure.
- No Ollama detection code, no local model files, no GGUF anything - exists anywhere in the diff.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/brain/task-classifier.test.ts src/brain/cost-tracker.test.ts
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: ask a simple lookup question, then a complex analysis question, and confirm (via logs/a debug flag) they route to different tiers; then run the usage-report command and confirm real numbers appear.
```

## Dependencies
- None beyond the existing `LLMRouter`/`CarinaResponse`/provider infrastructure - this is explicitly an extension, not a new system
- Accurate, periodically-updated per-provider cost-per-token figures (a small maintenance burden to document, not automate away with invented precision)
