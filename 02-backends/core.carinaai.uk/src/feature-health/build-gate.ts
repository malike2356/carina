/**
 * Fix-before-build gate for agents and product sprints.
 */

import { getAllFeatures } from './feature-registry.js';
import { generateFixQueue, type FixQueueItem } from './prioritization-engine.js';

export type BuildGateResult = {
  allowed: boolean;
  blocked: boolean;
  blockingIssues: FixQueueItem[];
  fixQueue: FixQueueItem[];
  deprecate: FixQueueItem[];
  reason: string;
};

/** Returns false when any P0 or P1 issues exist. */
export function canBuildNewFeature(): boolean {
  return !getBlockingIssues().length;
}

export function getBlockingIssues(): FixQueueItem[] {
  const { fixNow } = generateFixQueue(getAllFeatures());
  return fixNow.filter((i) => i.priority === 'P0' || i.priority === 'P1');
}

export function evaluateBuildGate(): BuildGateResult {
  const { queue, fixNow, deprecate } = generateFixQueue(getAllFeatures());
  const blockingIssues = fixNow.filter((i) => i.priority === 'P0' || i.priority === 'P1');
  const allowed = blockingIssues.length === 0;
  return {
    allowed,
    blocked: !allowed,
    blockingIssues,
    fixQueue: queue,
    deprecate,
    reason: allowed
      ? 'No P0/P1 feature health blockers.'
      : `Blocked by ${blockingIssues.length} P0/P1 issue(s). Work the fix queue first.`,
  };
}

export type WeeklyAuditHandle = {
  /** Interval id when using setInterval; null in tests without timers. */
  timer: ReturnType<typeof setInterval> | null;
  stop: () => void;
};

/**
 * Schedule a recurring health audit (default 7 days). Caller supplies the runner
 * (typically checkAllFeatures + evaluateBuildGate).
 */
export function scheduleWeeklyAudit(
  run: () => void | Promise<void>,
  intervalMs = 7 * 24 * 60 * 60 * 1000,
): WeeklyAuditHandle {
  if (typeof setInterval !== 'function') {
    return { timer: null, stop: () => undefined };
  }
  const timer = setInterval(() => {
    void Promise.resolve(run()).catch(() => undefined);
  }, intervalMs);
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
  return {
    timer,
    stop: () => clearInterval(timer),
  };
}
