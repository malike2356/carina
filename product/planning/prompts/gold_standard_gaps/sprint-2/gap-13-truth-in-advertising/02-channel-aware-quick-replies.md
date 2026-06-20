# Gap 13 - Prompt 02: Channel-Aware Quick Replies

> **REUSE RULE:** See `../REUSE-RULES.md`.

**Gap:** 13 Truth in Advertising
**Prompt number:** 02 of 08
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 01-surface-capability-contract.md

---

## Read First

1. `core.carinaai.uk/src/agents/orchestrator.ts` - `quickReply()` at line ~110
2. `core.carinaai.uk/src/agents/orchestrator.test.ts` - expects wrong web nav list
3. `core.carinaai.uk/src/product/surface-capabilities.ts` - from prompt 01
4. `core.carinaai.uk/src/gateway/router.ts` - how platform is passed to orchestrator
5. `core.carinaai.uk/src/gateway/telegram.ts` - Telegram entry path

---

## The Problem

Verified bug (2026-06-19): User asks `@CarinaVbot` "what can you do?" and gets:

```
Chat, Notes, Calendar, Scheduled, Documents, Email, Trello, Deep Research, Model Compare, Images, Memory.
```

That is the **hosted web sidebar**, not Telegram abilities. The orchestrator bypasses the LLM and returns a false catalog.

---

## What To Build

### 1. Pass platform into quick reply path

`CarinaOrchestrator` already has `this.platform` (verify in constructor / `setPlatform`). Ensure:

- Telegram sets `platform: 'telegram'`
- Web gateway sets `platform: 'web'`
- CLI sets `platform: 'cli'`

In `quickReply()`:

```typescript
if (/\bwhat can you do\b|\bcapabilit(y|ies)\b/.test(text) || /^help[?!.\s]*$/.test(text)) {
  return buildCapabilitySummaryForSurface(
    resolveSurface({ platform: this.platform, ...hostedFlags }),
    collectSurfaceRuntimeSnapshot(),
  );
}
```

Apply `sanitizeCarinaProse()` to the returned string (or rely on prompt 07 if not yet done).

### 2. Expand quick reply patterns (still honest, still no LLM)

Add channel-appropriate responses:

| Pattern | Behavior |
|---------|----------|
| `\bwho are you\b` | Return `contract.identityLine` for current surface |
| `\bdo you have (persistent )?memory\b` | Defer to prompt 05 if ready; else short honest line from runtime snapshot |
| `\bcan you (speak|do voice)\b` | Truth from `runtime.ttsAvailable` |

Do NOT add LLM calls inside quick replies; keep them deterministic.

### 3. Optional: `/help` and `/capabilities` gateway commands

In `core.carinaai.uk/src/gateway/commands.ts`, add:

- `/capabilities` - same text as quick reply for current platform
- Document in gateway help text

### 4. Update tests

Replace orchestrator.test.ts expectation:

```typescript
// OLD (wrong):
expect(content).toContain('Trello');

// NEW:
const orc = new CarinaOrchestrator('test-session', false, { platform: 'telegram' });
// ...
expect(content).toMatch(/web search|memory|voice/i);
expect(content).not.toMatch(/Trello|Calendar|Documents editor/);
```

Add cases for `platform: 'web'` still mentioning nav-appropriate features.

### 5. carina-agent-public mirror

If `carina-agent-public/src/agents/orchestrator.ts` duplicates quickReply, apply same fix or sync from core.

---

## Acceptance Criteria

- [ ] Telegram "what can you do?" never lists web-only nav labels
- [ ] Web platform quick reply can still mention workspace features that exist in web UI
- [ ] `orchestrator.test.ts` updated and green
- [ ] Manual: message `@CarinaVbot` "what can you do?" shows Telegram-relevant list

---

## Example Expected Telegram Reply

```
I can chat, search the web for current facts, remember things you ask me to save, and send voice replies when you ask. For documents, scheduling, and the full workspace, use the web app or CLI on your Carina install.
```

Adjust wording to match Carina voice; no em dashes.
