# Gap 21 - Prompt 02: Per-Session Token Tracking & Cost Visibility

**Status: COMPLETED 2026-06-21**

**What was built:** `token-tracker.ts`, carina turn recording, `/tokens` gateway commands, spend alert via `CARINA_TOKEN_ALERT_THRESHOLD_USD`.

**Gap:** 21 Thinking Architecture & Token Economics
**Prompt number:** 02 of 03
**Name:** Per-session token counting, cost estimates, rate alerts
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** None (can run in parallel with 01)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

OpenClaw's "tokenjuice" provides visible token spend per session. Add the
same to Carina.

### Step 1: Token Counter

Create `agents/token-tracker.ts`:

```typescript
export interface TokenUsage {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD (approximate)
  requestCount: number;
  lastRequestAt: number;
}

export class TokenTracker {
  private usage: Map<string, TokenUsage> = new Map();

  // Cost per 1M tokens (approximate, configurable)
  private static COST_PER_1M: Record<string, { input: number; output: number }> = {
    'claude-opus-4':    { input: 15, output: 75 },
    'claude-sonnet-4':  { input: 3,  output: 15 },
    'gpt-5.5':          { input: 2.5, output: 10 },
    'gemini-3-pro':    { input: 1.25, output: 5 },
    'llama-3.3':        { input: 0, output: 0 },  // free/local
  };

  record(
    sessionId: string,
    model: string,
    usage: { inputTokens: number; outputTokens: number; thinkingTokens?: number },
  ): void {
    let entry = this.usage.get(sessionId);
    if (!entry) {
      entry = {
        sessionId,
        model,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        requestCount: 0,
        lastRequestAt: Date.now(),
      };
      this.usage.set(sessionId, entry);
    }

    entry.inputTokens += usage.inputTokens;
    entry.outputTokens += usage.outputTokens;
    entry.thinkingTokens += usage.thinkingTokens || 0;
    entry.totalTokens += usage.inputTokens + usage.outputTokens + (usage.thinkingTokens || 0);
    entry.requestCount++;
    entry.lastRequestAt = Date.now();
    entry.estimatedCost = this.calculateCost(
      model,
      entry.inputTokens,
      entry.outputTokens,
    );
  }

  get(sessionId: string): TokenUsage | undefined {
    return this.usage.get(sessionId);
  }

  getAll(): TokenUsage[] {
    return Array.from(this.usage.values())
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  reset(sessionId: string): void {
    this.usage.delete(sessionId);
  }

  private calculateCost(model: string, input: number, output: number): number {
    const costs = TokenTracker.COST_PER_1M[model] || TokenTracker.COST_PER_1M['gpt-5.5'];
    return (input / 1_000_000) * costs.input + (output / 1_000_000) * costs.output;
  }
}
```

### Step 2: Wire into Agent Loop

After each LLM call in `agents/agent-runner.ts`:

```typescript
// After receiving usage from provider response:
const usage = response.usage; // { input_tokens, output_tokens }
this.tokenTracker.record(sessionId, modelId, {
  inputTokens: usage.input_tokens,
  outputTokens: usage.output_tokens,
});
```

### Step 3: Slash Commands

```
/tokens           Show current session token usage and cost
/tokens all       Show all sessions (admin)
/tokens reset     Reset counter for current session
```

Response format:

```
Session tokens: 12,450 (in: 8,200 | out: 4,250)
Estimated cost: ~$0.06
Requests: 3
Model: anthropic/claude-sonnet-4-6
```

### Step 4: Rate Alerts

Add optional alerts for heavy usage:

```typescript
// In gateway/router.ts, after each token record:
const usage = this.tokenTracker.get(sessionId);
if (usage && usage.estimatedCost > 5.0) { // $5 threshold
  // Notify user: "Session cost has exceeded $5.00. Current: $${usage.estimatedCost.toFixed(2)}"
  this.sendSystemMessage(sessionId, 
    `Token spend alert: ~$${usage.estimatedCost.toFixed(2)} this session (${usage.totalTokens.toLocaleString()} tokens)`
  );
}
```

Configurable via env: `CARINA_TOKEN_ALERT_THRESHOLD_USD` (default 5.00)

---

## Existing Carina code to integrate with

- `agents/agent-runner.ts` -- record usage after each LLM call
- `agents/command-handler.ts` -- `/tokens` command
- `gateway/router.ts` -- rate alerts
- `config/schema.ts` -- `CARINA_TOKEN_ALERT_THRESHOLD_USD`
