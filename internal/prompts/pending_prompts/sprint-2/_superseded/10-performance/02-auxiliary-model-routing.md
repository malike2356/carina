# Prompt 02: Auxiliary Model Routing


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Not all tasks need the full capability of DeepSeek-V3 or Claude Sonnet. Classification,
simple extraction, brief summaries, and template filling can run on smaller/faster models
(Haiku, Gemini Flash, DeepSeek-V2.5-lite). Routing low-complexity tasks to cheaper models
reduces cost and latency without affecting quality.

## What to Build

### 1. Task complexity classifier

Create `src/brain/task-classifier.ts`:
```typescript
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

// Rules-based classifier (no LLM call needed for classification)
export function classifyTaskComplexity(prompt: string, context: TaskContext): ComplexityLevel {
  const len = prompt.length;
  const hasTools = context.tools && context.tools.length > 0;
  const isMultiStep = /then|after|next|finally|step/i.test(prompt);
  const isCodeGen = /write|implement|create|build|code/i.test(prompt);
  const isAnalysis = /analyze|investigate|research|audit/i.test(prompt);

  // Complex: code gen, analysis, multi-step, or long prompts with tools
  if (isCodeGen || isAnalysis || (isMultiStep && hasTools) || (len > 500 && hasTools)) {
    return 'complex';
  }

  // Simple: short single-step queries, no tools, extraction/classification
  if (len < 150 && !hasTools && !isMultiStep) {
    return 'simple';
  }

  return 'moderate';
}
```

### 2. Model routing table

In `src/brain/LLMRouter.ts`, add routing based on complexity:
```typescript
const AUXILIARY_MODELS: Record<ComplexityLevel, string> = {
  simple: process.env.MODEL_SIMPLE ?? 'claude-haiku-4-5-20251001',
  moderate: process.env.MODEL_MODERATE ?? 'deepseek-chat',
  complex: process.env.MODEL_COMPLEX ?? 'claude-sonnet-4-6',
};

export async function routeToModel(prompt: string, context: TaskContext): Promise<string> {
  const complexity = classifyTaskComplexity(prompt, context);
  const model = AUXILIARY_MODELS[complexity];
  return model;
}
```

### 3. Override mechanism

Users can always override the model routing:
```typescript
// In CLI
carina ask "classify this email" --model claude-haiku-4-5-20251001

// In API
POST /api/chat { "model": "claude-haiku-4-5-20251001", ... }

// In config
CARINA_DEFAULT_MODEL=claude-sonnet-4-6   # override all routing
```

When `CARINA_DEFAULT_MODEL` is set, routing is disabled and all calls use that model.

### 4. Cost tracking

Track per-model token usage and cost:
```typescript
type ModelUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number; // based on published pricing
};

// Track in Redis sorted set: cost per model per day
await redis.zincrby(`model-cost:${today}`, usage.estimatedCostUsd, model);
```

Expose via `GET /api/ops/metrics/model-costs`:
```json
{
  "today": [
    { "model": "claude-haiku-4-5-20251001", "tokens": 45000, "costUsd": 0.009 },
    { "model": "deepseek-chat", "tokens": 120000, "costUsd": 0.014 },
    { "model": "claude-sonnet-4-6", "tokens": 8000, "costUsd": 0.024 }
  ],
  "totalUsd": 0.047
}
```

### 5. Routing analytics

Log which complexity level was assigned for each request:
```typescript
metrics.record('task-routing', { complexity, model, latencyMs, tokens });
```

Show a "Model Distribution" pie chart in the ops admin dashboard showing what percentage
of requests go to each model tier.

## Verification Checklist

- [ ] Short "classify this" query routes to Haiku (log: "routing simple -> haiku")
- [ ] "Write me a Python script for..." routes to Sonnet (complex)
- [ ] `CARINA_DEFAULT_MODEL=deepseek-chat` makes all calls use DeepSeek regardless of complexity
- [ ] `GET /api/ops/metrics/model-costs` shows per-model cost breakdown
- [ ] Ops dashboard shows model distribution chart

## Files to Create or Modify

- CREATE `src/brain/task-classifier.ts`
- MODIFY `src/brain/LLMRouter.ts` - add complexity routing before provider selection
- MODIFY `src/api/metrics.ts` - add model cost endpoint
- MODIFY `ops.carinaai.uk/views/dashboard.ejs` - add model distribution chart
