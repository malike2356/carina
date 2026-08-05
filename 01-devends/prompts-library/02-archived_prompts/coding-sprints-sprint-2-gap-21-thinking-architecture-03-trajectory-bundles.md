# Gap 21 - Prompt 03: Trajectory Bundles -- Tool Call Recording

**Status: COMPLETED 2026-06-21**

**What was built:** `trajectory-recorder.ts`, tool-runner step recording, `carina trajectory` CLI, bundle completion on session clear/evict.

**Gap:** 21 Thinking Architecture & Token Economics
**Prompt number:** 03 of 03
**Name:** Trajectory bundles -- tool call trajectory recording & export
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** None

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

Trajectory bundles record every tool call the agent makes during a session
for debugging, sharing, and optimization.

### Step 1: Trajectory Recorder

Create `agents/trajectory-recorder.ts`:

```typescript
export interface TrajectoryStep {
  stepIndex: number;
  timestamp: number;
  type: 'tool_call' | 'tool_result' | 'thinking' | 'message' | 'error';
  toolName?: string;
  toolParams?: Record<string, unknown>;
  result?: unknown; // truncated/sanitized
  resultTruncated?: boolean;
  durationMs?: number;
  errorMessage?: string;
}

export interface TrajectoryBundle {
  bundleId: string;
  sessionId: string;
  model: string;
  startedAt: number;
  completedAt?: number;
  steps: TrajectoryStep[];
  metadata: {
    totalToolCalls: number;
    totalErrors: number;
    totalDurationMs: number;
    toolsUsed: string[];
  };
}

export class TrajectoryRecorder {
  private active: Map<string, TrajectoryBundle> = new Map();
  private history: TrajectoryBundle[] = [];
  private maxHistory = 50;

  startBundle(sessionId: string, model: string): TrajectoryBundle {
    const bundle: TrajectoryBundle = {
      bundleId: `traj_${randomUUID().slice(0, 8)}`,
      sessionId,
      model,
      startedAt: Date.now(),
      steps: [],
      metadata: { totalToolCalls: 0, totalErrors: 0, totalDurationMs: 0, toolsUsed: [] },
    };
    this.active.set(sessionId, bundle);
    return bundle;
  }

  recordStep(
    sessionId: string,
    step: Omit<TrajectoryStep, 'stepIndex' | 'timestamp'>,
  ): void {
    const bundle = this.active.get(sessionId);
    if (!bundle) return;

    const fullStep: TrajectoryStep = {
      ...step,
      stepIndex: bundle.steps.length,
      timestamp: Date.now(),
    };

    bundle.steps.push(fullStep);

    if (step.type === 'tool_call') {
      bundle.metadata.totalToolCalls++;
      if (step.toolName && !bundle.metadata.toolsUsed.includes(step.toolName)) {
        bundle.metadata.toolsUsed.push(step.toolName);
      }
    }
    if (step.type === 'error') bundle.metadata.totalErrors++;
    if (step.durationMs) bundle.metadata.totalDurationMs += step.durationMs;
  }

  completeBundle(sessionId: string): TrajectoryBundle | undefined {
    const bundle = this.active.get(sessionId);
    if (!bundle) return undefined;

    bundle.completedAt = Date.now();
    this.active.delete(sessionId);

    // Archive
    this.history.push(bundle);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return bundle;
  }

  getBundle(sessionId: string): TrajectoryBundle | undefined {
    return this.active.get(sessionId)
      || this.history.find(b => b.sessionId === sessionId);
  }

  exportBundle(bundleId: string): string {
    const bundle = this.history.find(b => b.bundleId === bundleId);
    if (!bundle) throw new Error(`Bundle ${bundleId} not found`);
    return JSON.stringify(bundle, null, 2);
  }
}
```

### Step 2: Wire into Agent Loop

In `agents/agent-runner.ts`, wrap tool execution:

```typescript
// Before tool call:
this.trajectoryRecorder.recordStep(sessionId, {
  type: 'tool_call',
  toolName,
  toolParams,
});

const startTime = Date.now();
try {
  const result = await executeTool(toolName, toolParams);
  this.trajectoryRecorder.recordStep(sessionId, {
    type: 'tool_result',
    toolName,
    result: truncateResult(result, 2000),
    resultTruncated: JSON.stringify(result).length > 2000,
    durationMs: Date.now() - startTime,
  });
} catch (err) {
  this.trajectoryRecorder.recordStep(sessionId, {
    type: 'error',
    toolName,
    errorMessage: err.message,
    durationMs: Date.now() - startTime,
  });
}
```

### Step 3: CLI Commands

```
carina trajectory start [sessionId]    Start recording (usually auto)
carina trajectory stop  [sessionId]    Stop and archive
carina trajectory show  [sessionId]    Show current trajectory
carina trajectory export [bundleId]    Export as JSON
carina trajectory list                 List recent bundles
```

### Step 4: Trajectory Replay (Future)

The trajectory JSON can be replayed for debugging or used to optimize
prompts by analyzing which tool calls succeeded vs failed.

---

## Existing Carina code to integrate with

- `agents/agent-runner.ts` -- wrap tool execution with recording
- `agents/session-manager.ts` -- start/complete bundles on session lifecycle
- `cli/commands.ts` -- `trajectory` command group
