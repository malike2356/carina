# Gap 13 - Prompt 05: Memory and Tool Honesty Replies

**Status: COMPLETED 2026-06-21**

**What was built:** see gap-13 session work in backends/ and frontends/client-apps/app.carinaai.uk.

> **REUSE RULE:** See `../REUSE-RULES.md`.

**Gap:** 13 Truth in Advertising
**Prompt number:** 05 of 08
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 01-surface-capability-contract.md, 02-channel-aware-quick-replies.md

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

1. `core.carinaai.uk/src/agents/system-prompt.ts` - persistent memory rules
2. `core.carinaai.uk/src/memory/store.ts` - memory availability
3. `core.carinaai.uk/src/agents/orchestrator.ts` - quickReply extension point
4. `core.carinaai.uk/src/index.ts` - "Continuing without persistent memory" warning
5. `app.carinaai.uk/src/lib/cloud-capabilities.ts` - cloud memory scope

---

## The Problem

User asks "do you have persistent memory?" on Telegram. Carina answers "Yes" because the system prompt says so, even when:

- Memory backend failed to init
- Cloud BYOK only injects DB memories, not full episodic memory
- Session has memory disabled in settings

Truth requires **runtime proof**, not prompt faith.

---

## What To Build

### 1. Memory status helper

Create `core.carinaai.uk/src/memory/memory-status.ts`:

```typescript
export interface MemoryStatus {
  available: boolean;
  backend: 'postgres' | 'sqlite' | 'file' | 'cloud-db' | 'none';
  episodic: boolean;
  persistent: boolean;
  injectInChat: boolean;
  reason?: string;
}

export async function getMemoryStatus(opts?: {
  platform?: string;
  workspaceId?: string;
}): Promise<MemoryStatus>;
```

Logic:

- Core install: check memory store connection / init flag from startup
- Cloud: episodic false unless core proxy; workspace DB memories true if `injectMemoriesInChat`
- Return `available: false` with reason when backend down

### 2. Tool status helper

Create `core.carinaai.uk/src/tools/tool-status.ts`:

```typescript
export interface ToolStatus {
  available: boolean;
  count: number;
  categories: string[]; // plain labels: "web", "files", "shell", not raw tool names
  reason?: string;
}

export function getToolStatus(opts?: { platform?: string; sessionId?: string }): ToolStatus;
```

### 3. Honest quick replies in orchestrator

Extend `quickReply()`:

```typescript
if (/\bdo you have (persistent )?memory\b|\bcan you remember\b/.test(text)) {
  const status = await getMemoryStatus({ platform: this.platform });
  if (!status.available) {
    return `Memory is not available on this install right now${status.reason ? `: ${status.reason}` : '.'}`;
  }
  if (status.persistent) {
    return 'Yes. I keep durable memory across sessions on this install. Ask "what do you remember?" and I will check before answering.';
  }
  return 'I have session memory only on this surface. Durable memory is not enabled here.';
}
```

Similar for `\bdo you have tools\b|\bcan you run commands\b`:

Use `getToolStatus()`; Telegram should mention tools only if registry has session tools.

**Important:** `quickReply` is currently sync. Either:

- Make `turn()` await async quick reply check, OR
- Use sync snapshot from session-scoped cache populated at orchestrator init

Prefer async quick reply branch before LLM call in `turn()`.

### 4. "What do you remember?" behavior

When matched, do NOT quick-reply with fake yes/no. Either:

- Route to LLM with instruction to call `memory(action=list)` first, OR
- Quick reply: "Checking memory..." and invoke memory list tool synchronously, format top 5 items

Minimum for this prompt: ensure quick reply does not claim empty memory without checking.

### 5. Tests

- Memory unavailable -> honest negative
- Memory available -> positive with nuance
- Cloud BYOK -> distinguishes workspace memories vs full episodic
- Tool status on Telegram with empty registry -> does not claim shell access

---

## Acceptance Criteria

- [ ] Memory questions reflect `getMemoryStatus()` not prompt alone
- [ ] Tool questions reflect `getToolStatus()`
- [ ] Async quick reply path does not break existing sync greetings
- [ ] Tests green
