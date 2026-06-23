# Gap 09 - Prompt 02: Auxiliary Model Routing

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 3-4 hrs
**Depends on:** Nothing - standalone brain-layer addition

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Carina uses a single primary LLM model for all tasks: generating responses, curating skills,
creating embeddings, generating session titles, and searching across sessions. This is wasteful
and slow.

Hermes solves this with auxiliary model routing: each sub-task has its own model config that
can be a different provider, smaller model, or different reasoning effort. The curator uses
a cheap fast model. Embeddings use a dedicated embedding model. Session search uses a model
tuned for summarization. Title generation uses a tiny cheap model.

Result: faster secondary tasks, lower cost, better task-specific performance.

---

## Read First

```
core.carinaai.uk/src/brain/llm.ts                    (primary model calls)
core.carinaai.uk/src/skills/curator.ts               (skill curation - uses primary model today)
core.carinaai.uk/src/memory/embeddings.ts            (embeddings - check which model)
core.carinaai.uk/src/memory/session-search-service.ts (session search - check which model)
core.carinaai.uk/src/config/session-config.ts        (session config)
core.carinaai.uk/src/providers/                      (available providers)
```

---

## 1. Auxiliary Model Config Schema

Add to `src/types/index.ts` or a new `src/types/auxiliary-model.ts`:

```typescript
// src/types/auxiliary-model.ts

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface AuxiliaryModelConfig {
  provider?: string; // e.g. "anthropic", "openai", "groq" - defaults to primary
  model?: string; // e.g. "claude-haiku-4-5", "gpt-4o-mini", "llama-3.1-8b"
  maxTokens?: number; // cap tokens for this task
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
}

export interface AuxiliaryModelMap {
  /** Skill curation: deciding whether to archive/promote skills. Use cheap fast model. */
  curator?: AuxiliaryModelConfig;

  /** Image/document analysis. Use a vision-capable model. */
  vision?: AuxiliaryModelConfig;

  /** Vector embeddings for memory storage and retrieval. */
  embedding?: AuxiliaryModelConfig;

  /** One-line session title generation. Use cheapest possible model. */
  titleGeneration?: AuxiliaryModelConfig;

  /** Cross-session search result summarization. */
  sessionSearch?: AuxiliaryModelConfig;

  /** User preference/personality modeling (honcho-style). */
  userModeling?: AuxiliaryModelConfig;

  /** Background summarization of long documents. */
  summarization?: AuxiliaryModelConfig;
}
```

---

## 2. Auxiliary LLM Client

```typescript
// src/brain/auxiliary-client.ts

import type { AuxiliaryModelConfig, AuxiliaryModelMap } from '../types/auxiliary-model.js';
import { getConfig } from '../config/index.js';

/**
 * Resolve the effective config for a specific auxiliary task.
 * Falls back to the primary model if no override is configured.
 */
export function resolveAuxiliaryConfig(
  task: keyof AuxiliaryModelMap
): AuxiliaryModelConfig & { provider: string; model: string } {
  const config = getConfig();
  const primary = { provider: config.provider, model: config.model };
  const aux: AuxiliaryModelConfig = config.auxiliaryModels?.[task] ?? {};

  return {
    provider: aux.provider ?? primary.provider,
    model: aux.model ?? primary.model,
    maxTokens: aux.maxTokens,
    reasoningEffort: aux.reasoningEffort,
    temperature: aux.temperature,
  };
}

/**
 * Call an LLM for a specific auxiliary task with its configured model.
 */
export async function callAuxiliaryModel(
  task: keyof AuxiliaryModelMap,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const cfg = resolveAuxiliaryConfig(task);

  // Build request params
  const params = {
    provider: cfg.provider,
    model: cfg.model,
    maxTokens: cfg.maxTokens ?? 512,
    temperature: cfg.temperature ?? 0.2,
    messages: [
      ...(systemPrompt ? [{ role: 'user' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ],
  };

  // Route to the right provider adapter
  const { callProvider } = await import('./llm.js');
  return callProvider(params);
}
```

---

## 3. Wire Into Each Task

### Skill Curator

```typescript
// src/skills/curator.ts  (modify evalSkillCandidate)

import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

async function evalSkillCandidateWithLLM(skill: Skill): Promise<{
  pass: boolean;
  reason: string;
}> {
  const prompt = `
Evaluate this skill definition and decide if it should remain active or be archived.

Skill name: ${skill.name}
Description: ${skill.description}
Last used: ${skill.usageCount} times
Steps preview: ${(skill.steps ?? '').slice(0, 200)}

Respond with JSON: { "pass": true/false, "reason": "one sentence" }
`;

  try {
    const raw = await callAuxiliaryModel('curator', prompt);
    const parsed = JSON.parse(raw.trim());
    return { pass: Boolean(parsed.pass), reason: String(parsed.reason ?? '') };
  } catch {
    // Fallback: basic heuristic
    return { pass: skill.usageCount > 0 || Boolean(skill.steps?.trim()), reason: 'heuristic' };
  }
}
```

### Session Title Generation

```typescript
// src/surfaces/session-store.ts  (or wherever titles are generated)

import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

export async function generateSessionTitle(firstMessage: string): Promise<string> {
  try {
    const raw = await callAuxiliaryModel(
      'titleGeneration',
      `Generate a 5-8 word title for a conversation starting with: "${firstMessage.slice(0, 200)}"
Output only the title, no quotes, no punctuation at end.`
    );
    return raw.trim().slice(0, 60);
  } catch {
    return firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
  }
}
```

### Session Search Summarization

```typescript
// src/memory/session-search-service.ts  (modify the LLM summarization call)

import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

async function summarizeSearchResults(
  query: string,
  rawResults: SessionSearchResult[]
): Promise<string> {
  const context = rawResults
    .slice(0, 5)
    .map(r => `[${r.sessionId.slice(0, 8)}] ${r.snippet}`)
    .join('\n');

  return callAuxiliaryModel(
    'sessionSearch',
    `Query: "${query}"\n\nRelevant past conversations:\n${context}\n\nSummarize what was found in 2-3 sentences.`
  );
}
```

---

## 4. Config File Integration

Add `auxiliaryModels` to the user config schema:

```typescript
// src/config/config-schema.ts  (additions)

auxiliaryModels: z.object({
  curator: auxiliaryModelConfigSchema.optional(),
  vision: auxiliaryModelConfigSchema.optional(),
  embedding: auxiliaryModelConfigSchema.optional(),
  titleGeneration: auxiliaryModelConfigSchema.optional(),
  sessionSearch: auxiliaryModelConfigSchema.optional(),
  userModeling: auxiliaryModelConfigSchema.optional(),
  summarization: auxiliaryModelConfigSchema.optional(),
}).optional(),
```

Example user config (`~/.carina/config.json`):

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "auxiliaryModels": {
    "curator": {
      "model": "claude-haiku-4-5-20251001",
      "maxTokens": 256,
      "temperature": 0.1
    },
    "titleGeneration": {
      "provider": "groq",
      "model": "llama-3.1-8b-instant",
      "maxTokens": 32
    },
    "sessionSearch": {
      "model": "claude-haiku-4-5-20251001",
      "maxTokens": 512
    },
    "summarization": {
      "model": "claude-haiku-4-5-20251001",
      "maxTokens": 1024
    }
  }
}
```

---

## 5. CLI Config Commands

```typescript
// Add to src/cli/commands/config-commands.ts:

registry.register({
  name: 'config set-task-model',
  description: 'Set model for a specific auxiliary task',
  args: [
    { name: 'task', choices: ['curator','vision','embedding','titleGeneration','sessionSearch','userModeling','summarization'] },
    { name: 'model', description: 'Model ID or "reset" to clear override' },
  ],
  options: [
    { name: '--provider', description: 'Provider name (default: use primary provider)' },
    { name: '--max-tokens', type: 'number' },
  ],
  handler: async ({ task, model, provider, maxTokens }) => {
    if (model === 'reset') {
      await deleteAuxiliaryConfig(task);
      return `Auxiliary model for ${task} reset to primary model`;
    }
    await saveAuxiliaryConfig(task, { model, provider, maxTokens });
    return `Auxiliary model for ${task} set to ${provider ? provider + '/' : ''}${model}`;
  },
});

registry.register({
  name: 'config list-task-models',
  description: 'Show all auxiliary model configs',
  handler: async () => {
    const map = getConfig().auxiliaryModels ?? {};
    const rows = Object.entries(map).map(([task, cfg]) =>
      `${task.padEnd(18)} ${cfg.provider ?? 'primary'}/${cfg.model ?? 'primary'}`
    );
    return rows.length > 0 ? rows.join('\n') : 'No auxiliary overrides set (all tasks use primary model)';
  },
});
```

---

## Files to Create

```
core.carinaai.uk/src/types/auxiliary-model.ts
core.carinaai.uk/src/brain/auxiliary-client.ts
```

## Files to Modify

```
core.carinaai.uk/src/skills/curator.ts                 use callAuxiliaryModel('curator', ...)
core.carinaai.uk/src/surfaces/session-store.ts         use callAuxiliaryModel('titleGeneration', ...)
core.carinaai.uk/src/memory/session-search-service.ts  use callAuxiliaryModel('sessionSearch', ...)
core.carinaai.uk/src/config/config-schema.ts           add auxiliaryModels schema
core.carinaai.uk/src/cli/commands/config-commands.ts   add set-auxiliary + show-auxiliary commands
```

---

## Done When

- [ ] `resolveAuxiliaryConfig('curator')` returns primary model when no override set
- [ ] `resolveAuxiliaryConfig('curator')` returns haiku config when set in user config
- [ ] Skill curator LLM calls use the auxiliary model, not the primary conversation model
- [ ] Session title generation uses configured titleGeneration model
- [ ] Session search summarization uses configured sessionSearch model
- [ ] `carina config set-task-model curator --model claude-haiku-4-5-20251001` persists the config
- [ ] `carina config list-task-models` lists all active overrides
- [ ] Fallback to primary model works when auxiliary call fails (no crash)
- [ ] Unit test: callAuxiliaryModel routes to different provider when configured
- [ ] Unit test: missing auxiliaryModels key in config does not throw