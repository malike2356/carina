# Phase 4 - Multi-Agent + Self-Improvement

**Status: COMPLETE**

All deliverables built by Cursor. Do not rebuild.

## What Was Built

- `src/agents/orchestrator.ts` - `CarinaOrchestrator`: calls `decompose()` via LLM (JSON plan with `singleAgent` flag and `steps[]`); falls back to `heuristicPlan()` (keyword matching on research/calculate/email); executes steps with dependency graph (parallel for steps with no `dependsOn`, sequential otherwise); streams `{type:'status'}` events between steps; calls `evaluateAndWriteSkill()` after completion
- `src/agents/sub-agent.ts` - abstract `SubAgent` base with `run(task, context)` returning full text response
- `src/agents/research-agent.ts` - allowed tools: `web-search`, `http-request`, `file-read`
- `src/agents/coding-agent.ts` - allowed tools: `file-read`, `file-write`, `code-exec`, `shell-exec`
- `src/agents/communication-agent.ts` - allowed tools: `email-send`, `http-request`; `forceConfirm: true`
- `src/agents/file-agent.ts` - allowed tools: `file-read`, `file-write`
- `src/skills/auto-writer.ts` - triggers on tool use or multi-step tasks; LLM evaluates via `chatCheap()`; Jaccard similarity deduplication at 80% threshold before saving
- `src/skills/index.ts` - `loadPackSkills()`, `exportPack()`, `importPack()`, `getPackSystemSuffix()`
- `src/skills/packs/property-uk/skills.ts` - 6 production-quality skill documents

## One Known Gap

`GatewayRouter.agents` is a `Map<string, CarinaOrchestrator>` that grows without bound. Sessions are never evicted. For production hosting with many users this will leak memory. Fix: add a TTL-based cleanup using `setTimeout` or a periodic sweep on session last-seen timestamp.
