# Prompt 04: RASP Engine (Runtime Application Self-Protection)

## Context

RASP (Runtime Application Self-Protection) monitors Carina's own behavior in real time
and can block or quarantine suspicious activity. Unlike Scout (which monitors the AGENT's
actions), RASP monitors the PLATFORM itself: detecting prompt injection attacks, unexpected
outbound connections, resource exhaustion, and abnormal tool execution patterns.

## What to Build

### 1. RASP monitor core

Create `src/security/rasp/monitor.ts`:
```typescript
export type RaspEvent = {
  type: 'prompt-injection' | 'unexpected-connection' | 'resource-exhaustion' | 'anomalous-tool-chain';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  timestamp: Date;
};

export type RaspAction = 'log' | 'block' | 'quarantine' | 'kill-session';

export class RaspMonitor {
  private rules: RaspRule[] = [];

  addRule(rule: RaspRule): void {
    this.rules.push(rule);
  }

  async evaluate(event: RaspEvent): Promise<RaspAction> {
    for (const rule of this.rules) {
      if (rule.matches(event)) {
        return rule.action;
      }
    }
    return 'log';
  }
}

export const raspm = new RaspMonitor();
```

### 2. Prompt injection detection

```typescript
export class PromptInjectionDetector {
  private readonly INJECTION_PATTERNS = [
    /ignore\s+previous\s+instructions/i,
    /system\s+prompt/i,
    /\bforget\s+everything\b/i,
    /\bact\s+as\s+if\s+you\s+are\b/i,
    /\bdo\s+not\s+follow\s+any\s+rules\b/i,
    /\bDAN\b/,  // "Do Anything Now" jailbreak
  ];

  detect(input: string): boolean {
    return this.INJECTION_PATTERNS.some(p => p.test(input));
  }

  score(input: string): number {
    return this.INJECTION_PATTERNS.filter(p => p.test(input)).length;
  }
}
```

When injection is detected:
- Score 1: log to Scout
- Score 2-3: block this message, warn user
- Score 4+: terminate session, lock account for review

### 3. Anomalous tool chain detection

Detect unusual sequences of tool calls that suggest the agent is being manipulated:
```typescript
export class ToolChainAnalyzer {
  // Flag unusual patterns:
  // - delete-file immediately after read-file (data exfiltration then destruction)
  // - run-command calling curl with external domain (C2 callback)
  // - rapid tool calls with no user interaction (automated exploitation)

  analyze(recentTools: ToolCall[]): RaspEvent | null {
    const names = recentTools.map(t => t.name);

    // C2 callback pattern: run-command with curl to non-whitelisted domain
    const curlCall = recentTools.find(t => t.name === 'run-command' && /curl|wget/.test(String(t.args.command)));
    if (curlCall && !isWhitelistedDomain(extractDomain(String(curlCall.args.command)))) {
      return { type: 'anomalous-tool-chain', severity: 'critical', details: { tool: 'run-command', pattern: 'c2-callback' }, timestamp: new Date() };
    }

    // Rapid fire: >10 tool calls in <30 seconds without user message
    if (names.length >= 10 && timeSince(recentTools[0].timestamp) < 30000) {
      return { type: 'anomalous-tool-chain', severity: 'high', details: { count: names.length, windowMs: 30000 }, timestamp: new Date() };
    }

    return null;
  }
}
```

### 4. Resource exhaustion monitor

```typescript
export class ResourceMonitor {
  checkMemory(): RaspEvent | null {
    const { heapUsed, heapTotal } = process.memoryUsage();
    if (heapUsed / heapTotal > 0.95) {
      return { type: 'resource-exhaustion', severity: 'high', details: { heapUsed, heapTotal }, timestamp: new Date() };
    }
    return null;
  }
}
```

Run `ResourceMonitor.checkMemory()` every 60 seconds via a setInterval.

### 5. Integration with agent execution

In `src/agents/CarinaAgent.ts`, before processing each user message:
```typescript
const injectionScore = detector.score(userMessage);
if (injectionScore >= 4) {
  await raspm.evaluate({ type: 'prompt-injection', severity: 'critical', details: { score: injectionScore }, timestamp: new Date() });
  throw new Error('Message blocked: potential prompt injection detected');
}
```

After each tool call:
```typescript
const raspEvent = toolAnalyzer.analyze(this.recentToolCalls);
if (raspEvent) {
  const action = await raspm.evaluate(raspEvent);
  if (action === 'kill-session') this.terminate();
}
```

## Verification Checklist

- [ ] Message containing "ignore previous instructions" is blocked at score 4+
- [ ] Scout shows `prompt-injection` event when injection is detected
- [ ] Tool chain with curl to external domain triggers `critical` RASP alert
- [ ] Memory usage alert fires when heap exceeds 95% (test with `--max-old-space-size=50`)
- [ ] RASP kills session on critical anomalous tool chain detection

## Files to Create or Modify

- CREATE `src/security/rasp/monitor.ts`
- CREATE `src/security/rasp/prompt-injection.ts`
- CREATE `src/security/rasp/tool-chain-analyzer.ts`
- CREATE `src/security/rasp/resource-monitor.ts`
- MODIFY `src/agents/CarinaAgent.ts` - integrate RASP checks
- MODIFY `src/server.ts` - start ResourceMonitor interval
