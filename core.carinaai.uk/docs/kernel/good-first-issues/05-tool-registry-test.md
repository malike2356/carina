---
title: "test: add coverage for tool registration edge cases"
labels:
  - good first issue
  - test
---

## Context

Tools register via `ToolRegistry` in `src/tools/registry.ts`. The global `registry` in `src/tools/index.ts` registers all builtin tools at module load. There is no dedicated unit test file for `ToolRegistry` edge cases (duplicate names, unregister, provider format with empty list).

## Task

Add Vitest coverage for tool registration edge cases in a new file `src/tools/registry.test.ts`.

## Files to create

- `src/tools/registry.test.ts`

## Files to reference

- `src/tools/registry.ts` - `ToolRegistry` class
- `src/types/index.ts` - `Tool` interface (minimal mock tools for tests)

## Test cases to implement

1. **Duplicate registration** - registering two tools with the same `name` leaves the second tool active (`get()` returns latest)
2. **Unregister** - `unregister()` returns true/false; `get()` is undefined after remove
3. **Missing schema** - tool with minimal/empty `parameters` object still appears in `list()` and `toProviderFormat()` without throwing
4. **Provider formats** - `toProviderFormat('anthropic')` and `toProviderFormat('openai')` return expected shapes for one mock tool

Use isolated `new ToolRegistry()` instances; do not mutate the global singleton used by production.

## Acceptance criteria

- [ ] New test file with at least 4 test cases covering the cases above
- [ ] Tests pass in CI (`pnpm test`)
- [ ] No changes to production registry behavior unless a bug is found (document in PR if so)

## Test

```bash
cd core.carinaai.uk
pnpm test src/tools/registry.test.ts
pnpm test
```
