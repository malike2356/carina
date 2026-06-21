# Gap 21 - Prompt 01: Tiered Thinking Levels

**Status: COMPLETED 2026-06-21**

**What was built:** `thinking-levels.ts`, session config wiring, `/think` and `/fast` commands, provider mapping in LLM layer, TUI status bar.

**Gap:** 21 Thinking Architecture & Token Economics
**Prompt number:** 01 of 03
**Name:** Tiered thinking levels -- off/minimal/low/medium/high/xhigh/max/adaptive
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `agents/agent-runner.ts` -- where thinking/reasoning is configured
2. `providers/` -- provider-specific thinking parameter mapping
3. `config/schema.ts` -- existing thinking config

---

## Goal

Replace binary thinking on/off with graduated levels.

### Thinking Levels

| Level | Tokens | Use Case |
|-------|--------|----------|
| `off` | 0 | Quick factual answers, simple commands |
| `minimal` | ~128 | Slightly complex Q&A |
| `low` | ~512 | Multi-step reasoning |
| `medium` | ~2048 | Code generation, architecture |
| `high` | ~4096 | Complex debugging, security analysis |
| `xhigh` | ~8192 | Novel algorithm design, threat modeling |
| `max` | ~16384 | Research-grade reasoning |
| `adaptive` | auto | Model decides based on prompt complexity |

### Implementation

Create `agents/thinking-levels.ts`:

```typescript
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'adaptive';

const THINKING_TOKEN_BUDGETS: Record<Exclude<ThinkingLevel, 'off' | 'adaptive'>, number> = {
  minimal: 128,
  low: 512,
  medium: 2048,
  high: 4096,
  xhigh: 8192,
  max: 16384,
};

export function mapThinkingLevelToProvider(
  level: ThinkingLevel,
  provider: string,
): Record<string, unknown> {
  if (level === 'off') return { enabled: false };
  if (level === 'adaptive') return { enabled: true }; // let model decide

  const budget = THINKING_TOKEN_BUDGETS[level];

  switch (provider) {
    case 'anthropic':
      return { thinking: { type: 'enabled', budget_tokens: budget } };
    case 'openai':
      return { reasoning_effort: mapToOpenAIEffort(level) };
    case 'google':
      return { thinkingConfig: { thinkingBudget: budget } };
    default:
      return { thinking_tokens: budget };
  }
}

function mapToOpenAIEffort(level: ThinkingLevel): string {
  switch (level) {
    case 'minimal': return 'minimal';
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high': case 'xhigh': case 'max': return 'high';
    default: return 'medium';
  }
}
```

### Slash Commands

```
/think off|minimal|low|medium|high|xhigh|max|adaptive   Set thinking level
/think status                                            Show current level
/fast                                                    Toggle fast mode (think=off temporarily)
```

### Per-Model Defaults

In config, set default thinking per model:

```yaml
models:
  defaults:
    thinkingDefault: medium          # default for all models
  overrides:
    "anthropic/claude-opus-4-6":
      thinkingDefault: high          # strongest model gets more thinking
    "openai/gpt-5.5":
      thinkingDefault: medium
    "local/llama-3.3":
      thinkingDefault: minimal       # local models skip thinking
```

---

## Existing Carina code to integrate with

- `agents/agent-runner.ts` -- apply thinking level before each turn
- `agents/command-handler.ts` -- `/think` and `/fast` commands
- `providers/` -- map thinking levels to provider-specific params
- `config/schema.ts` -- `thinkingDefault`, per-model overrides
- `tui/status-bar.ts` -- show current thinking level
