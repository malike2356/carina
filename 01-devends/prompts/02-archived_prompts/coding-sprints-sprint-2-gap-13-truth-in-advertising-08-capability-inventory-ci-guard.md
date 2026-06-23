# Gap 13 - Prompt 08: Capability Inventory CI Guard

**Status: COMPLETED 2026-06-21**

**What was built:** see gap-13 session work in backends/ and frontends/client-apps/app.carinaai.uk.

> **REUSE RULE:** See `../REUSE-RULES.md`.

**Gap:** 13 Truth in Advertising
**Prompt number:** 08 of 08
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 01 through 07

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

1. `docs.carinaai.uk/docs/user/capability-inventory.md` - public inventory
2. `core.carinaai.uk/src/product/surface-capabilities.ts` - from prompt 01
3. `core.carinaai.uk/src/security/behavior-proof.ts` - behavior proof pattern
4. `core.carinaai.uk/scripts/behavior-proof-check.mjs` - CI script pattern
5. `carinaai.uk/index.html` - marketing claims (meta description, feature sections)
6. `core.carinaai.uk/src/agents/orchestrator.test.ts` - identity test pattern

---

## The Problem

Capability counts, marketing copy, and runtime behavior drift apart silently. Docs say "19 channel adapters" while code changes. Marketing says "40+ channels" while only Telegram is configured on a given install. No CI fails when identity regressions ship.

---

## What To Build

### 1. Identity smoke tests (Vitest)

Create `core.carinaai.uk/src/product/identity-smoke.test.ts`:

```typescript
describe('identity smoke', () => {
  it('telegram capability summary excludes web-only nav labels', () => { ... });
  it('telegram identity line is horizontal agent not property-only', () => { ... });
  it('secret exfiltration returns No only', () => { ... });
  it('memory quick reply respects unavailable backend', () => { ... });
});
```

Use mocked runtime snapshots for deterministic tests.

Create platform matrix helper:

```typescript
const PLATFORMS = ['telegram', 'cli', 'web'] as const;
for (const platform of PLATFORMS) {
  it(`${platform} summary is non-empty and has no raw tool names`, () => { ... });
}
```

### 2. Inventory sync script

Create `core.carinaai.uk/scripts/capability-inventory-check.mjs`:

- Count registered tools from `tool-surface-catalog` or registry export
- Count channel adapters from `channel-status.ts` metadata
- Count LLM providers from provider catalog
- Compare against numbers documented in `docs.carinaai.uk/docs/user/capability-inventory.md` using tolerant ranges (e.g. "72+" allows >= 72)
- Exit 1 on mismatch with diff printed

Allow override file `core.carinaai.uk/qa/capability-inventory-baseline.json` for intentional updates:

```json
{
  "minTools": 72,
  "minChannelAdapters": 19,
  "minProviders": 51,
  "docPath": "../../docs.carinaai.uk/docs/user/capability-inventory.md"
}
```

### 3. Marketing claim lint (lightweight)

Create `core.carinaai.uk/scripts/marketing-claim-check.mjs`:

Parse `carinaai.uk/index.html` for hard numbers:

- "40+ channels" -> warn if configured channel count in default `.env.example` is < 5 (document that marketing is aspirational catalog size, not per-install)
- "persistent memory" -> require docs link to capability-inventory memory section

This script **warns** by default; use `--strict` in CI to fail.

Do not scrape live VPS; compare against codebase catalog counts only.

### 4. Wire CI

Add to `core.carinaai.uk/.github/workflows/ci.yml` or root `.github/workflows/ci.yml`:

```yaml
- name: Capability inventory check
  run: node scripts/capability-inventory-check.mjs

- name: Identity smoke tests
  run: pnpm test identity-smoke
```

Optional: `behavior-proof` job includes identity cases from prompt 04 and 05.

### 5. Update docs when counts change

Document in `capability-inventory.md`:

```markdown
## Maintenance

Counts are verified by `pnpm capability:check` (runs in CI). Update `qa/capability-inventory-baseline.json` when adding tools or channels.
```

Add package script: `"capability:check": "node scripts/capability-inventory-check.mjs"`

### 6. Cloud app test stub

If cloud identity lives only in app package, add `app.carinaai.uk/src/lib/cloud-identity.test.ts` to CI matrix (from prompt 03).

---

## Acceptance Criteria

- [ ] `pnpm test identity-smoke` passes
- [ ] `pnpm capability:check` passes on current codebase
- [ ] CI runs both on every PR touching product/ or agents/
- [ ] Deliberate count changes require baseline JSON update (reviewable diff)

---

## Done-When for Entire Gap 13

When this prompt ships, re-run manual checklist from README:

- Telegram "what can you do?" honest
- Cloud prompt not property-only
- `.env` request -> "No."
- Memory answer runtime-gated
- Cloud nav gated
- Style sanitizer everywhere
- CI guards identity + inventory

---

## Do Not

- Do not fail CI on marketing aspirational numbers without `--strict`; document the difference between catalog size and install configuration
- Do not commit secrets in test fixtures
