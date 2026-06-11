---
sidebar_position: 1
---

# Tool registry

Tools register in `src/tools/index.ts` via `registry.register()`.

```typescript
import { registry } from './registry.js';

registry.register({
  name: 'my-tool',
  description: 'What the tool does',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async execute(params) {
    return { ok: true };
  },
});
```

## Execution path

1. LLM returns a tool call
2. `agents/tool-runner.ts` validates params and Scout policy
3. Tool `execute()` runs; result is fed back to the model

## Tests

Colocate `my-tool.test.ts` beside the implementation. Run `pnpm test` from `core.carinaai.uk/`.
