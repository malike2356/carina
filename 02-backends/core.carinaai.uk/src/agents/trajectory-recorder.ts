import { randomUUID } from 'node:crypto';
import { redactSensitiveText } from '../security/redaction.js';

export interface TrajectoryStep {
  stepIndex: number;
  timestamp: number;
  type: 'tool_call' | 'tool_result' | 'thinking' | 'message' | 'error';
  toolName?: string;
  toolParams?: Record<string, unknown>;
  result?: unknown;
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

const MAX_RESULT_CHARS = 2000;

export function truncateTrajectoryResult(result: unknown): { value: unknown; truncated: boolean } {
  const serialized = typeof result === 'string' ? result : JSON.stringify(result);
  if (serialized.length <= MAX_RESULT_CHARS) {
    return { value: result, truncated: false };
  }
  return {
    value: redactSensitiveText(serialized.slice(0, MAX_RESULT_CHARS)),
    truncated: true,
  };
}

export class TrajectoryRecorder {
  private active = new Map<string, TrajectoryBundle>();
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

  ensureBundle(sessionId: string, model = 'unknown'): TrajectoryBundle {
    return this.active.get(sessionId) ?? this.startBundle(sessionId, model);
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
      bundle.metadata.totalToolCalls += 1;
      if (step.toolName && !bundle.metadata.toolsUsed.includes(step.toolName)) {
        bundle.metadata.toolsUsed.push(step.toolName);
      }
    }
    if (step.type === 'error') bundle.metadata.totalErrors += 1;
    if (step.durationMs) bundle.metadata.totalDurationMs += step.durationMs;
  }

  completeBundle(sessionId: string): TrajectoryBundle | undefined {
    const bundle = this.active.get(sessionId);
    if (!bundle) return undefined;
    bundle.completedAt = Date.now();
    this.active.delete(sessionId);
    this.history.push(bundle);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return bundle;
  }

  getBundle(sessionId: string): TrajectoryBundle | undefined {
    return this.active.get(sessionId) ?? this.history.find((b) => b.sessionId === sessionId);
  }

  listRecent(limit = 20): TrajectoryBundle[] {
    return [...this.history].slice(-limit).reverse();
  }

  exportBundle(bundleId: string): string {
    const bundle =
      this.history.find((b) => b.bundleId === bundleId)
      ?? [...this.active.values()].find((b) => b.bundleId === bundleId);
    if (!bundle) throw new Error(`Bundle ${bundleId} not found`);
    return JSON.stringify(bundle, null, 2);
  }
}

let recorder: TrajectoryRecorder | null = null;

export function getTrajectoryRecorder(): TrajectoryRecorder {
  recorder ??= new TrajectoryRecorder();
  return recorder;
}
