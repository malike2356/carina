# Action: delegate-task Tool - Verify-and-Expose the Existing Orchestrator (Standalone Carina)

## Goal
Confirm that Carina's existing sub-agent orchestration (`CarinaOrchestrator` + `SubAgent` hierarchy) already delivers what the spec calls `delegate_task`, then expose it as a directly-callable tool with the parameters the spec describes (parallel batch mode, `toolsets` allowlisting, leaf-role constraints) - rather than building a second agent-spawning system next to a working one.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **This is the second prompt in this batch (after `06-scout-integration.md` in phase1) where the spec describes building something that already exists in substantial form.** Read these in full - they are short:
  - `src/agents/sub-agent.ts` (41 lines) - `abstract class SubAgent`: fresh `CarinaAgent` instance, restricted `allowedTools`, `systemPromptSuffix`, `requiresConfirmation`, `maxTurns = 10`, `persistMemory: false`. This IS the spec's "leaf role, default... fresh context, no memory of parent conversation, fresh terminal."
  - `src/agents/orchestrator.ts` (311 lines) - `CarinaOrchestrator`: `decompose()` turns a task into a `TaskPlan` of steps with `dependsOn` arrays, runs independent steps via `Promise.all` (= the spec's "batch/parallel mode, up to N concurrent"), synthesises a final response, and the parent's context only ever receives `stepOutputs` summaries - exactly the spec's "intermediate results never enter the parent's context window."
  - The four concrete sub-agents: `coding-agent.ts`, `communication-agent.ts`, `file-agent.ts`, `research-agent.ts` - each presumably declares its own `allowedTools`/`systemPromptSuffix` (read at least one in full, e.g. `research-agent.ts`, to confirm the pattern, then skim the others for `allowedTools` lists to compare against the spec's `toolsets` vocabulary: `terminal, file, web, browser, search, skills, session_search, vision`)
- **The gap**: today, sub-agent spawning happens INSIDE `CarinaOrchestrator.turn()` automatically (the LLM never explicitly chooses to delegate - the orchestrator's `decompose()` step decides for it). The spec wants `delegate_task` exposed as a tool the LLM calls directly and deliberately ("spawn parallel subagents... single task mode... batch/parallel mode"). These are two different control flows over the same underlying machinery - the fix is to expose the machinery as a callable tool, not to rebuild it.
- Read `src/types/index.ts` for `SubAgentType`, `TaskPlan`, `TaskPlanStep` - the existing type vocabulary you'll extend.
- Conventions: functions under ~20 lines, classes under ~200 lines, Vitest, no em dashes/emojis.

## Files to create
- `src/tools/delegate-task.ts` - the `delegate-task` `Tool` definition, a thin wrapper that constructs and runs `SubAgent`/`CarinaOrchestrator` instances
- `src/tools/delegate-task.test.ts`

## Files to modify
- `src/agents/sub-agent.ts` - if `toolsets` (the spec's vocabulary: `terminal, file, web, browser, search, skills, session_search, vision`) doesn't map cleanly onto the existing `allowedTools` (which is presumably actual tool names like `'shell-exec'`, `'file-read'`), add a small `resolveToolset(name: string): string[]` mapping layer - do not rename existing tools to match the spec's vocabulary, that would be a much larger, riskier change for cosmetic alignment
- `src/types/index.ts` - extend `SubAgentType`/add a generic subagent type if the spec's free-form `goal`/`context`/`toolsets` shape needs one beyond the four fixed types (`research|coding|communication|file`)

## Step-by-step

1. Read all four concrete sub-agent files and `carina.ts` (`CarinaAgent`, since `SubAgent.createAgent()` constructs one) to map exactly how `allowedTools`/`systemPromptSuffix`/`maxTurns`/`forceConfirm` flow through. Confirm `persistMemory: false` and the `requiresConfirmation` plumbing genuinely produce "fresh context: no memory of parent conversation" and "subagent cannot interact with user (no clarify tool)" - these are safety-relevant claims in the spec and should be verified, not assumed, before you build a tool that exposes this machinery more broadly.

2. Design `delegate-task`'s parameter schema to match the spec while mapping onto what exists:
   ```ts
   parameters: {
     goal?: string,           // single-task mode
     context?: string,
     toolsets?: string[],     // mapped via resolveToolset() to allowedTools
     tasks?: Array<{ goal: string; context?: string; toolsets?: string[] }>,  // batch mode
   }
   ```
   In `execute`, branch on `goal` (single) vs. `tasks` (batch). For single-task mode, this can likely be a one-line call into a generic `SubAgent` subclass parameterised by `toolsets`/`goal` rather than the four fixed types - check whether `CarinaOrchestrator` already has (or can cheaply gain) a "run one ad-hoc subagent with a custom toolset" path, vs. needing to force every delegated task through the fixed `research|coding|communication|file` decomposition. If the fixed four don't cover "ad-hoc goal with arbitrary toolset," that is the one piece of genuinely new code this prompt needs - a `GenericSubAgent extends SubAgent` whose `allowedTools`/`systemPromptSuffix` are constructor parameters rather than hardcoded.

3. Implement batch/parallel mode as `Promise.all` over up to 3 concurrent `SubAgent.run()` calls (the spec's stated cap), with a configurable concurrency limit (use a small semaphore/queue if more than 3 tasks are submitted - do not just `Promise.all` an unbounded array, which would defeat the "up to 3 concurrent" constraint the moment a 4th task is queued). Check whether a concurrency-limiting utility already exists in dependencies (`p-limit` or similar) before writing one from scratch.

4. Enforce the spec's leaf-role constraints explicitly in the tool definition, not just by convention:
   - `delegate-task` must NOT appear in the `allowedTools` list passed to any spawned `SubAgent` (prevents recursive delegation beyond the configured max depth)
   - Similarly exclude `clarify`, `memory`/`memory-add` (if `08-memory-session.md` is built), `send_message`/`email-send`, `execute_code`/`code-exec` from the default leaf toolset, per the spec's "CANNOT use" list
   - Add a `maxSpawnDepth` constant (default 1, per the spec) - track delegation depth via a field threaded through `SubAgent`'s constructor or session context, and refuse to spawn beyond it with a clear error rather than silently ignoring the request

5. Implement the "synchronous, cancel-on-interrupt" requirement: confirm that if the parent turn is interrupted (check how `CarinaAgent.turn()`/`router.handle()` currently handle cancellation - `AbortController`? a cancellation flag?), in-flight subagent calls are also aborted rather than continuing to burn tokens/tool calls in the background. If no cancellation mechanism exists at all in the parent, that is a pre-existing gap worth noting, not one to silently work around inside this tool.

6. Write `src/tools/delegate-task.test.ts` (Vitest, mock `SubAgent`/`CarinaAgent`):
   - Single-task mode: correct `goal`/`context`/`toolsets` flow into the spawned agent, only the final summary is returned (not intermediate tool-call chatter)
   - Batch mode: up to 3 tasks run concurrently; a 4th queues rather than running immediately; all results return together
   - Leaf constraints: spawned agents never receive `delegate-task`/`clarify`/etc. in their tool list, regardless of what the caller requests in `toolsets`
   - Depth limit: a delegated task that itself tries to delegate is refused with a clear error
   - Cancellation: an interrupted parent turn cancels in-flight subagent work (if a cancellation mechanism exists; otherwise, write the test as a documented `it.todo(...)` referencing the gap found in step 5)

## Expected behavior
- The LLM can call `delegate_task({ goal: "...", toolsets: [...] })` and receive a clean final summary, with all intermediate tool-call noise contained in the subagent's isolated context.
- Up to 3 tasks run in parallel in batch mode; results return together.
- Subagents genuinely cannot delegate further, contact the user, or access the parent's memory - verified by test, not assumed from the class hierarchy's intent.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/delegate-task.test.ts src/agents/orchestrator.test.ts
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "Delegate two tasks in parallel: check disk usage on /var, and check disk usage on /home"
```

## Dependencies
- The four existing sub-agent classes and `CarinaOrchestrator` (already built and tested - `orchestrator.test.ts` exists)
- A concurrency-limiting utility (check `package.json` for one before adding `p-limit` or similar)
- `01-terminal.md`/`03-file-system.md`/`05-browser.md` if `toolsets` is meant to expose those toolsets to subagents (a subagent with `toolsets: ["browser"]` is inert until the browser tools exist)
