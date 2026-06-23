# Gap 13 - Prompt 03: Cloud Chat Identity and Honest Prompts

**Status: COMPLETED 2026-06-21**

**What was built:** cloud-identity.ts, cloud-identity.test.ts, vitest config; carina-chat.ts uses buildCloudSystemPrompt with BYOK/core-proxy mode blocks.

> **REUSE RULE:** See `../REUSE-RULES.md`.

**Gap:** 13 Truth in Advertising
**Prompt number:** 03 of 08
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** 01-surface-capability-contract.md (recommended)

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

1. `app.carinaai.uk/src/lib/carina-chat.ts` - `buildSystemPrompt()` line ~198 (property-only bug)
2. `app.carinaai.uk/src/lib/cloud-capabilities.ts` - `getCloudCapabilities()`
3. `app.carinaai.uk/src/lib/core-api-proxy.ts` - core proxy detection
4. `core.carinaai.uk/src/agents/system-prompt.ts` - canonical identity (horizontal agent)
5. `core.carinaai.uk/src/brain/llm.ts` - `SYSTEM_PROMPT` fallback
6. `app.carinaai.uk/src/app/api/chat/route.ts` - chat entry point

---

## The Problem

Carina Cloud BYOK chat uses:

```typescript
return `You are Carina, an AI assistant for property professionals. Be direct and concise.${memoryBlock}...`;
```

This contradicts:

- Core agent identity (horizontal platform, optional skill packs)
- Marketing (carinaai.uk general-purpose positioning)
- User expectation when not running property-uk pack

Cloud users asking "what can you do?" get property framing and no tool loop unless core proxy is enabled.

---

## What To Build

### 1. Shared cloud identity builder

Create `app.carinaai.uk/src/lib/cloud-identity.ts`:

```typescript
import { getCloudCapabilities } from './cloud-capabilities';

export function buildCloudSystemPrompt(opts: {
  workspaceId: string;
  memoryBlock: string;
  enabledSkillsBlock: string;
  disabledSkillsBlock: string;
  activePacks?: string[];
}): string;
```

Identity rules:

- Base: horizontal Carina agent built by VERLOX (mirror core tone, shorter for token budget)
- Never say "property professionals only" unless `activePacks` includes `property-uk`
- Include explicit **mode block** from `getCloudCapabilities()`:

```typescript
const caps = getCloudCapabilities();
const modeBlock = caps.chatMode === 'core-proxy'
  ? 'This workspace routes chat through the Carina core agent. Web search and tools may be available when configured.'
  : 'This workspace uses BYOK direct chat. You answer from the model only; you do not have live tools, web search, or shell access on this path unless the operator enables core proxy.';
```

- Include memory rules matching core (when user says "remember", acknowledge that memory is saved via the Memory panel / auto-extract, not a live tool in BYOK mode)
- Refusal rule: `.env` / secrets -> say "No." only (align with prompt 04)

### 2. Replace `buildSystemPrompt` in carina-chat.ts

Remove property-only string. Call `buildCloudSystemPrompt()`.

### 3. Core-proxy path honesty

When `coreProxyEnabled()` and chat routes to core API:

- System prompt should NOT claim BYOK limitations
- Pass surface `cloud-core-proxy` to any capability helper
- Ensure `/api/chat/route.ts` uses same identity for both streaming paths

### 4. "What can you do?" in cloud app

If cloud chat ever adds client-side quick paths, use `buildCapabilitySummaryForSurface('cloud-byok' | 'cloud-core-proxy')`.

Prefer routing identity questions through the same contract module (import from core package or duplicate minimal cloud subset in app lib).

### 5. Tests

Create `app.carinaai.uk/src/lib/cloud-identity.test.ts`:

- Default prompt does not contain "property professionals"
- With `property-uk` in activePacks, prompt mentions property pack without excluding general abilities
- BYOK mode block states no live tools
- core-proxy mode block states tools may be available

Run: `cd app.carinaai.uk && pnpm test cloud-identity` (add vitest if missing).

---

## Files To Create/Modify

| Action | Path |
|--------|------|
| Create | `app.carinaai.uk/src/lib/cloud-identity.ts` |
| Create | `app.carinaai.uk/src/lib/cloud-identity.test.ts` |
| Modify | `app.carinaai.uk/src/lib/carina-chat.ts` |
| Modify | `app.carinaai.uk/src/app/api/chat/route.ts` (if prompt built there too) |

---

## Acceptance Criteria

- [ ] No "property professionals" in default cloud system prompt
- [ ] BYOK vs core-proxy limitations stated plainly in prompt
- [ ] Matches core horizontal identity when property pack inactive
- [ ] Tests green

---

## Do Not

- Do not copy entire 4KB core system prompt into cloud (token cost); use condensed honest subset
- Do not claim tools exist in BYOK mode
