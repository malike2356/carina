# Gap 13 - Prompt 07: Writing Style on All Surfaces

**Status: COMPLETED 2026-06-21**

**What was built:** see gap-13 session work in backends/ and frontends/client-apps/app.carinaai.uk.

> **REUSE RULE:** See `../REUSE-RULES.md`. Matches repo AGENTS.md hard constraint: no em dashes, no emojis.

**Gap:** 13 Truth in Advertising
**Prompt number:** 07 of 08
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 02-channel-aware-quick-replies.md (recommended)

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

1. `core.carinaai.uk/src/security/writing-style.ts` - `sanitizeCarinaProse()`
2. `core.carinaai.uk/src/security/writing-style.test.ts`
3. `core.carinaai.uk/src/gateway/formatting.ts` - gateway application
4. `core.carinaai.uk/src/security/prompt-guard-middleware.ts`
5. `app.carinaai.uk/src/components/chat/MarkdownContent.tsx` - cloud rendering path
6. `../verlox/scripts/fix-writing-style.py` - repo-wide static fixer (reference only)

---

## The Problem

Repo rules forbid em dashes and emojis in all first-party prose. `sanitizeCarinaProse` runs on gateway output but NOT consistently on:

- Orchestrator quick replies (bypass LLM)
- Cloud app streamed chat (BYOK direct to provider)
- Telegram error strings (e.g. old TTS install hints)
- Static error messages in `app.carinaai.uk`

Users still see em dashes and emojis when the LLM ignores the prompt.

---

## What To Build

### 1. Audit outbound paths

Grep and document every path that sends user-visible text:

| Path | File | Sanitized today? |
|------|------|------------------|
| Gateway format | `gateway/formatting.ts` | Yes |
| Prompt guard output | `prompt-guard-middleware.ts` | Yes |
| Quick replies | `orchestrator.ts` | No |
| Telegram send | `gateway/telegram.ts` | Partial |
| Cloud stream | `carina-chat.ts` / chat route | No |
| TTS error strings | `telegram.ts`, `tts.ts` | No |

### 2. Shared sanitizer package boundary

Export `sanitizeCarinaProse` from a path cloud app can import:

- Option A: duplicate thin wrapper in `app.carinaai.uk/src/lib/writing-style.ts` (copy logic, keep in sync)
- Option B: publish from `@carina/core` if monorepo workspace allows

Prefer Option A for minimal scope unless workspace already links core into app.

### 3. Apply sanitizer

**Core:**

```typescript
// orchestrator.ts quickReply return
return sanitizeCarinaProse(buildCapabilitySummaryForSurface(...));

// telegram.ts - all bot.sendMessage text paths
const safe = sanitizeCarinaProse(text);
```

**Cloud app:**

```typescript
// In stream handler before yielding text events to client
yield { type: 'text', content: sanitizeCarinaProse(delta) };
```

**Error strings:** run sanitizer on any user-facing error in gateway and cloud API routes.

### 4. Optional: request-side pre-check

Not required for this prompt, but document that input sanitization is separate from output.

### 5. Tests

- Quick reply output with em dash in contract mock gets sanitized
- Cloud stream sanitizer test
- Regression: existing `writing-style.test.ts` unchanged and green

### 6. CI note (for prompt 08)

Add comment in `writing-style.test.ts` pointing to identity smoke tests for end-to-end coverage.

---

## Acceptance Criteria

- [ ] Every user-visible assistant string on core gateway paths passes `sanitizeCarinaProse`
- [ ] Cloud BYOK stream passes sanitizer before client
- [ ] Quick replies cannot bypass style rules
- [ ] Tests green

---

## Do Not

- Do not sanitize user messages (operator input)
- Do not strip hyphens in code blocks if cloud renders markdown code; sanitize only plain assistant prose paths or run sanitizer before markdown parse (test code blocks stay intact)
