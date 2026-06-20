# Gap 09 - Prompt 01: Prompt Caching Invariant Enforcement

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 3-4 hrs
**Depends on:** Nothing - standalone brain-layer change

---

## The Problem (Why Carina Feels Slow)

Carina's current `src/brain/prompt-cache.ts` is a content-addressed TTL cache. It hashes the
system prompt and deduplicates identical prompts. That is not the same as enforcing that the
system prompt stays byte-stable for the lifetime of a conversation.

What actually happens today:
- Conversation starts with skills A, B, C loaded into the system prompt.
- User message 2 triggers a new skill D to load.
- System prompt is rebuilt with A, B, C, D.
- The hash changes. Anthropic's prompt cache is invalidated.
- Every subsequent token in this turn costs full input token price, not cached price.
- This happens on EVERY turn that touches skills, memory, or tools.

Hermes treats this as a sacred invariant: the system prompt is FROZEN at the start of a
conversation. No skill or tool changes take effect until the NEXT conversation starts. Only
explicit `--now` flag breaks the freeze. This keeps cache hits across the entire conversation.

The performance difference is dramatic: Anthropic caches tokens at roughly 10% of normal cost.
A 20,000-token system prompt that stays stable for 10 turns saves 20,000 * 9 * (cost-per-token)
across the conversation vs one that rebuilds every turn.

---

## Read First

```
core.carinaai.uk/src/brain/prompt-cache.ts         (current cache implementation)
core.carinaai.uk/src/brain/llm.ts                  (where system prompt is assembled)
core.carinaai.uk/src/skills/index.ts               (skill loading)
core.carinaai.uk/src/tools/session-tool-store.ts   (per-session tool state)
core.carinaai.uk/src/gateway/session-control.ts    (session lifecycle)
core.carinaai.uk/src/config/session-config.ts      (session config)
```

---

## What To Build

### 1. Frozen System Prompt Per Session

In `src/brain/prompt-cache.ts`, add a per-session frozen prompt store:

```typescript
// src/brain/prompt-cache.ts  (additions)

interface FrozenSessionPrompt {
  systemPrompt: string;
  frozenAt: number;
  skillSnapshot: string[]; // skill names at freeze time
  toolSnapshot: string[]; // tool names at freeze time
}

// Keyed by sessionId
const frozenSessionPrompts = new Map<string, FrozenSessionPrompt>();

// Pending changes deferred until next conversation
const pendingInvalidations = new Map<string, {
  reason: string;
  requestedAt: number;
}>();

/**
 * Freeze the system prompt for a session at conversation start.
 * Once frozen, the same prompt is returned for all turns in this session.
 */
export function freezeSessionPrompt(
  sessionId: string,
  systemPrompt: string,
  skills: string[],
  tools: string[]
): void {
  if (frozenSessionPrompts.has(sessionId)) return; // already frozen
  frozenSessionPrompts.set(sessionId, {
    systemPrompt,
    frozenAt: Date.now(),
    skillSnapshot: [...skills],
    toolSnapshot: [...tools],
  });
}

/**
 * Get the frozen system prompt for a session.
 * Returns null if not yet frozen (first call in a new session).
 */
export function getFrozenSystemPrompt(sessionId: string): string | null {
  return frozenSessionPrompts.get(sessionId)?.systemPrompt ?? null;
}

/**
 * Request deferred invalidation. The prompt does NOT change now.
 * It will regenerate at the start of the next conversation.
 */
export function deferPromptInvalidation(sessionId: string, reason: string): void {
  pendingInvalidations.set(sessionId, { reason, requestedAt: Date.now() });
  // Log to ops telemetry so devs can see deferred invalidations
  console.debug(`[prompt-cache] Deferred invalidation for session ${sessionId}: ${reason}`);
}

/**
 * Check if a session has pending invalidation (for UX feedback).
 */
export function hasPendingInvalidation(sessionId: string): boolean {
  return pendingInvalidations.has(sessionId);
}

/**
 * Force immediate invalidation (opt-in via carina --now flag or operator override).
 * Should only be used during development or explicit operator override.
 */
export function forceImmediateInvalidation(sessionId: string): void {
  frozenSessionPrompts.delete(sessionId);
  pendingInvalidations.delete(sessionId);
}

/**
 * Apply pending invalidation at session end (before next conversation starts).
 * Called by the session lifecycle when a conversation ends.
 */
export function applyPendingInvalidation(sessionId: string): boolean {
  const hasPending = pendingInvalidations.has(sessionId);
  if (hasPending) {
    frozenSessionPrompts.delete(sessionId);
    pendingInvalidations.delete(sessionId);
  }
  return hasPending;
}

/**
 * Thaw session (cleanup when session is destroyed).
 */
export function thawSession(sessionId: string): void {
  frozenSessionPrompts.delete(sessionId);
  pendingInvalidations.delete(sessionId);
}
```

---

### 2. Wire Freeze Into the Conversation Loop

In `src/brain/llm.ts` (or wherever the system prompt is assembled per turn), wrap the assembly
in the freeze logic:

```typescript
// src/brain/llm.ts  (modified section)
import {
  freezeSessionPrompt,
  getFrozenSystemPrompt,
  deferPromptInvalidation,
} from './prompt-cache.js';

export async function buildSystemPrompt(
  sessionId: string,
  context: ConversationContext,
  opts: { forceRebuild?: boolean } = {}
): Promise<string> {

  // Return frozen prompt if available and not force-rebuilding
  if (!opts.forceRebuild) {
    const frozen = getFrozenSystemPrompt(sessionId);
    if (frozen) return frozen;
  }

  // Build the prompt fresh (first turn of a new conversation)
  const parts: string[] = [];
  parts.push(CARINA_CORE_PERSONA); // static: never changes
  parts.push(await loadActiveBrainRules()); // static per workspace
  parts.push(buildSkillsBlock(context.loadedSkills));
  parts.push(buildToolsBlock(context.availableTools));
  parts.push(buildMemoryContext(context.injectedMemories));

  const systemPrompt = parts.join('\n\n');

  // Freeze it for this session
  freezeSessionPrompt(
    sessionId,
    systemPrompt,
    context.loadedSkills.map(s => s.name),
    context.availableTools.map(t => t.name)
  );

  return systemPrompt;
}
```

---

### 3. Defer Skill and Tool Changes

Any code that currently mutates loaded skills or tools mid-session must call
`deferPromptInvalidation` instead of triggering a rebuild:

```typescript
// src/skills/index.ts  (modified install handler)
import { deferPromptInvalidation, hasPendingInvalidation } from '../brain/prompt-cache.js';

export async function installSkillInSession(
  sessionId: string,
  skill: Skill
): Promise<{ deferred: boolean }> {
  // Persist the skill to DB (immediate)
  await persistSkill(skill);

  // Check if session is active
  const frozen = getFrozenSystemPrompt(sessionId);
  if (frozen) {
    // Session is live: defer the prompt update
    deferPromptInvalidation(sessionId, `skill installed: ${skill.name}`);
    return { deferred: true };
  }

  // No active session: take effect immediately
  return { deferred: false };
}
```

Same pattern for tool registration and memory injection mid-conversation.

---

### 4. Apply Deferred Changes at Session End

In the session lifecycle (session-control.ts or gateway equivalent):

```typescript
// src/gateway/session-control.ts  (session end hook)
import { applyPendingInvalidation } from '../brain/prompt-cache.js';

async function onSessionEnd(sessionId: string): Promise<void> {
  const wasInvalidated = applyPendingInvalidation(sessionId);
  if (wasInvalidated) {
    console.debug(`[session] System prompt refreshed for next conversation (${sessionId})`);
  }
  // ... rest of cleanup
}
```

---

### 5. The --now Override

Add a `--now` CLI flag and operator command so developers can force an immediate rebuild:

```typescript
// src/cli/commands/session-commands.ts  (new command)
registry.register({
  name: 'session refresh-prompt',
  description: 'Force immediate system prompt rebuild (breaks cache for this turn)',
  handler: async ({ sessionId }) => {
    forceImmediateInvalidation(sessionId);
    return 'System prompt will rebuild on next message. Cache miss on this turn.';
  },
});
```

In the TUI, show a notification when a deferred invalidation is pending:

```typescript
// In StatusLine or the TUI operator panel:
if (hasPendingInvalidation(currentSessionId)) {
  // Show: "Prompt refresh pending (takes effect next conversation)"
}
```

---

### 6. Add cache_control Markers for Anthropic

If calling Anthropic directly, add `cache_control: { type: "ephemeral" }` to the system message
to opt into prompt caching at the API level:

```typescript
// src/brain/llm.ts (Anthropic adapter section)
function buildAnthropicMessages(systemPrompt: string, messages: Message[]) {
  return {
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },  // tell Anthropic to cache this
      },
    ],
    messages: messages.filter(m => m.role !== 'system'),
  };
}
```

For long system prompts (> 1024 tokens), Anthropic will cache the prefix. The cache lives for
5 minutes of inactivity. With a frozen system prompt, all subsequent turns in the conversation
hit the cache.

---

## Files to Modify

```
core.carinaai.uk/src/brain/prompt-cache.ts          add freeze/thaw/defer functions
core.carinaai.uk/src/brain/llm.ts                   use freeze on first turn, return frozen on subsequent turns
core.carinaai.uk/src/skills/index.ts                defer invalidation instead of immediate rebuild
core.carinaai.uk/src/tools/session-tool-store.ts    defer invalidation on tool registration
core.carinaai.uk/src/gateway/session-control.ts     apply pending invalidation on session end
core.carinaai.uk/src/cli/commands/session-commands.ts  add `session refresh-prompt` command
```

---

## Done When

- [ ] First turn of a new conversation builds and freezes the system prompt
- [ ] Subsequent turns in the same conversation return the frozen prompt (no rebuild)
- [ ] Installing a skill mid-session returns `{ deferred: true }` and shows a TUI notification
- [ ] `carina session refresh-prompt` forces immediate invalidation with a warning
- [ ] Session end applies any pending invalidations so the next conversation picks up changes
- [ ] Anthropic API calls include `cache_control: { type: "ephemeral" }` on the system block
- [ ] TUI status line shows "Prompt refresh pending" badge when deferred invalidation is queued
- [ ] Telemetry records cache-hit rate per session (visible in ops dashboard)
- [ ] Unit test: same session ID returns same prompt bytes on turns 2-10
- [ ] Unit test: different session IDs get independent frozen prompts
- [ ] Unit test: `applyPendingInvalidation` clears the freeze for the next build