import { randomUUID } from 'node:crypto';
import type { CarinaMessage } from '../types/index.js';
import { SessionWriteLock } from './session-lock.js';
import type {
  AbortSessionHook,
  QueueConfig,
  QueueEntry,
  QueueLane,
  QueueMode,
  QueueStatus,
  SteerInjectHook,
  TypingIndicatorHook,
} from './command-queue-types.js';

export type { QueueConfig, QueueEntry, QueueLane, QueueMode, QueueStatus } from './command-queue-types.js';

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 4,
  debounceMs: 500,
  cap: 20,
  drop: 'summarize',
  defaultMode: 'steer',
  lockTimeoutMs: 60_000,
  staleEvictMs: 300_000,
};

export function loadQueueConfigFromEnv(): QueueConfig {
  const drop = process.env.CARINA_QUEUE_DROP?.trim() as QueueConfig['drop'] | undefined;
  const defaultMode = process.env.CARINA_QUEUE_DEFAULT_MODE?.trim() as QueueMode | undefined;
  return {
    maxConcurrent: Number(process.env.CARINA_QUEUE_MAX_CONCURRENT ?? 4) || 4,
    debounceMs: Number(process.env.CARINA_QUEUE_DEBOUNCE_MS ?? 500) || 500,
    cap: Number(process.env.CARINA_QUEUE_CAP ?? 20) || 20,
    drop: drop === 'old' || drop === 'new' || drop === 'summarize' ? drop : 'summarize',
    defaultMode:
      defaultMode === 'followup'
      || defaultMode === 'collect'
      || defaultMode === 'interrupt'
      || defaultMode === 'steer'
        ? defaultMode
        : 'steer',
    lockTimeoutMs: Number(process.env.CARINA_QUEUE_LOCK_TIMEOUT_MS ?? 60_000) || 60_000,
    staleEvictMs: Number(process.env.CARINA_QUEUE_STALE_EVICT_MS ?? 300_000) || 300_000,
  };
}

export class CommandQueue {
  private lanes = new Map<string, QueueLane>();
  private config: QueueConfig;
  private globalRunning = 0;
  private sessionOverrides = new Map<string, Partial<QueueConfig>>();
  private writeLock: SessionWriteLock;
  private onTyping?: TypingIndicatorHook;
  private onAbort?: AbortSessionHook;
  private onSteer?: SteerInjectHook;

  constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.writeLock = new SessionWriteLock(this.config.lockTimeoutMs);
  }

  setHooks(hooks: {
    onTyping?: TypingIndicatorHook;
    onAbort?: AbortSessionHook;
    onSteer?: SteerInjectHook;
  }): void {
    this.onTyping = hooks.onTyping;
    this.onAbort = hooks.onAbort;
    this.onSteer = hooks.onSteer;
  }

  setSessionConfig(sessionId: string, overrides: Partial<QueueConfig>): void {
    this.sessionOverrides.set(sessionId, overrides);
  }

  getSessionConfig(sessionId: string): QueueConfig {
    const overrides = this.sessionOverrides.get(sessionId) ?? {};
    return { ...this.config, ...overrides };
  }

  getDefaultMode(sessionId: string): QueueMode {
    return this.getSessionConfig(sessionId).defaultMode;
  }

  isSessionRunning(sessionId: string): boolean {
    return this.lanes.get(sessionId)?.state === 'running';
  }

  enqueue(
    sessionId: string,
    channelId: string,
    message: CarinaMessage,
    mode?: QueueMode,
  ): QueueEntry | null {
    const cfg = this.getSessionConfig(sessionId);
    let lane = this.lanes.get(sessionId);
    if (!lane) {
      lane = {
        sessionId,
        entries: [],
        state: 'idle',
        lastDequeuedAt: 0,
      };
      this.lanes.set(sessionId, lane);
    }

    const wasEmpty = lane.entries.length === 0;
    const effectiveMode = mode ?? cfg.defaultMode;

    if (effectiveMode === 'collect') {
      const existingCollect = lane.entries.find(
        (entry) => entry.mode === 'collect' && entry.channelId === channelId,
      );
      if (existingCollect && Date.now() - existingCollect.enqueuedAt < cfg.debounceMs) {
        existingCollect.message = this.mergeMessages(existingCollect.message, message);
        existingCollect.enqueuedAt = Date.now();
        return existingCollect;
      }
    }

    const entry: QueueEntry = {
      id: randomUUID(),
      sessionId,
      channelId,
      message,
      mode: effectiveMode,
      priority: effectiveMode === 'interrupt' ? 100 : 0,
      enqueuedAt: Date.now(),
      debounceKey: effectiveMode === 'collect' ? `${sessionId}:${channelId}` : undefined,
    };

    if (lane.entries.length >= cfg.cap) {
      switch (cfg.drop) {
        case 'old':
          lane.entries.shift();
          break;
        case 'new':
          return null;
        case 'summarize':
          this.summarizeLane(lane, cfg);
          break;
        default:
          break;
      }
    }

    lane.entries.push(entry);
    if (wasEmpty) this.onTyping?.(sessionId, 'start');
    return entry;
  }

  async claimNextForSession(sessionId: string): Promise<QueueEntry | null> {
    if (this.globalRunning >= this.config.maxConcurrent) return null;
    const lane = this.lanes.get(sessionId);
    if (!lane || lane.entries.length === 0) return null;

    const interruptEntry = lane.entries.find((entry) => entry.mode === 'interrupt');
    if (interruptEntry) {
      this.onAbort?.(sessionId);
      this.writeLock.forceRelease(sessionId);
      lane.entries = lane.entries.filter((entry) => entry.id !== interruptEntry.id);
      lane.state = 'running';
      lane.lastDequeuedAt = Date.now();
      this.globalRunning += 1;
      return interruptEntry;
    }

    if (lane.state === 'running') {
      const steerEntry = lane.entries.find((entry) => entry.mode === 'steer');
      if (steerEntry) {
        lane.entries = lane.entries.filter((entry) => entry.id !== steerEntry.id);
        this.onSteer?.(sessionId, steerEntry.message.content, steerEntry.id);
        return { ...steerEntry, steerOnly: true };
      }
      return null;
    }

    const collectMerged = this.coalesceCollectEntries(lane);
    const entry = collectMerged ?? lane.entries.shift()!;
    lane.state = 'running';
    lane.lastDequeuedAt = Date.now();
    this.globalRunning += 1;
    const acquired = await this.writeLock.acquire(sessionId, entry.id);
    if (!acquired) {
      lane.entries.unshift(entry);
      lane.state = 'idle';
      this.globalRunning = Math.max(0, this.globalRunning - 1);
      return null;
    }
    return entry;
  }

  async dequeue(): Promise<QueueEntry | null> {
    if (this.globalRunning >= this.config.maxConcurrent) return null;

    for (const lane of this.lanes.values()) {
      const interruptEntry = lane.entries.find((entry) => entry.mode === 'interrupt');
      if (interruptEntry) {
        this.onAbort?.(lane.sessionId);
        this.writeLock.forceRelease(lane.sessionId);
        lane.state = 'running';
        lane.lastDequeuedAt = Date.now();
        this.globalRunning += 1;
        lane.entries = lane.entries.filter((entry) => entry.id !== interruptEntry.id);
        return interruptEntry;
      }
    }

    for (const lane of this.lanes.values()) {
      if (lane.state === 'running' && lane.entries.length > 0) {
        const steerEntry = lane.entries.find((entry) => entry.mode === 'steer');
        if (steerEntry) {
          lane.entries = lane.entries.filter((entry) => entry.id !== steerEntry.id);
          this.onSteer?.(
            lane.sessionId,
            steerEntry.message.content,
            steerEntry.id,
          );
          return { ...steerEntry, steerOnly: true };
        }
      }
    }

    let oldestLane: QueueLane | null = null;
    let oldestTime = Infinity;
    for (const lane of this.lanes.values()) {
      if (lane.state === 'running' || lane.state === 'draining') continue;
      if (lane.entries.length === 0) continue;
      if (lane.lastDequeuedAt < oldestTime) {
        oldestTime = lane.lastDequeuedAt;
        oldestLane = lane;
      }
    }

    if (!oldestLane || oldestLane.entries.length === 0) return null;

    const collectMerged = this.coalesceCollectEntries(oldestLane);
    const entry = collectMerged ?? oldestLane.entries.shift()!;
    oldestLane.state = 'running';
    oldestLane.lastDequeuedAt = Date.now();
    this.globalRunning += 1;

    const acquired = await this.writeLock.acquire(entry.sessionId, entry.id);
    if (!acquired) {
      oldestLane.state = 'idle';
      this.globalRunning = Math.max(0, this.globalRunning - 1);
      return null;
    }

    return entry;
  }

  complete(sessionId: string, options?: { steer?: boolean; holderId?: string }): void {
    if (options?.steer) return;
    const lane = this.lanes.get(sessionId);
    if (lane) {
      lane.state = 'idle';
      if (lane.entries.length === 0) {
        this.onTyping?.(sessionId, 'stop');
      }
    }
    if (options?.holderId) {
      this.writeLock.release(sessionId, options.holderId);
    } else {
      this.writeLock.forceRelease(sessionId);
    }
    this.globalRunning = Math.max(0, this.globalRunning - 1);
  }

  drain(sessionId: string): void {
    const lane = this.lanes.get(sessionId);
    if (lane) {
      const wasRunning = lane.state === 'running';
      lane.state = 'draining';
      lane.entries = [];
      if (wasRunning) {
        this.globalRunning = Math.max(0, this.globalRunning - 1);
      }
    }
    this.writeLock.forceRelease(sessionId);
    this.lanes.delete(sessionId);
    this.onTyping?.(sessionId, 'stop');
  }

  peek(sessionId?: string): QueueEntry | undefined {
    if (sessionId) {
      return this.lanes.get(sessionId)?.entries[0];
    }
    for (const lane of this.lanes.values()) {
      if (lane.entries.length > 0) return lane.entries[0];
    }
    return undefined;
  }

  status(): QueueStatus {
    const laneStatuses: QueueStatus['laneStatuses'] = [];
    let totalEntries = 0;
    let oldestAge = 0;
    const now = Date.now();
    let activeLanes = 0;
    let idleLanes = 0;

    for (const lane of this.lanes.values()) {
      totalEntries += lane.entries.length;
      if (lane.state === 'running') activeLanes += 1;
      else idleLanes += 1;

      const laneOldest = lane.entries.reduce(
        (min, entry) => Math.min(min, now - entry.enqueuedAt),
        Infinity,
      );
      if (laneOldest !== Infinity && laneOldest > oldestAge) {
        oldestAge = laneOldest;
      }

      laneStatuses.push({
        sessionId: lane.sessionId,
        entries: lane.entries.length,
        state: lane.state,
        oldestEntryAge: laneOldest === Infinity ? 0 : laneOldest,
      });
    }

    return {
      totalEntries,
      activeLanes,
      idleLanes,
      oldestEntryAge: oldestAge,
      laneStatuses,
    };
  }

  evictStale(maxAgeMs = this.config.staleEvictMs): number {
    let evicted = 0;
    const now = Date.now();
    for (const [sessionId, lane] of this.lanes.entries()) {
      if (lane.state !== 'idle') continue;
      const before = lane.entries.length;
      lane.entries = lane.entries.filter((entry) => now - entry.enqueuedAt < maxAgeMs);
      evicted += before - lane.entries.length;
      if (lane.entries.length === 0) {
        this.lanes.delete(sessionId);
        this.onTyping?.(sessionId, 'stop');
      }
    }
    return evicted;
  }

  private coalesceCollectEntries(lane: QueueLane): QueueEntry | null {
    const first = lane.entries.find((entry) => entry.mode === 'collect');
    if (!first) return null;

    const merged: QueueEntry[] = [first];
    let index = lane.entries.indexOf(first) + 1;
    while (index < lane.entries.length) {
      const next = lane.entries[index];
      if (next.mode === 'collect' && next.channelId === first.channelId) {
        merged.push(next);
        lane.entries.splice(index, 1);
      } else {
        index += 1;
      }
    }

    if (merged.length === 1) return first;

    const combinedContent = merged
      .map((entry, idx) => `[Message ${idx + 1}] ${entry.message.content || '[non-text]'}`)
      .join('\n\n');

    lane.entries = lane.entries.filter((entry) => entry.id !== first.id);
    return {
      ...first,
      message: {
        ...first.message,
        content: combinedContent,
      },
    };
  }

  private summarizeLane(lane: QueueLane, cfg: QueueConfig): void {
    const toSummarize = lane.entries.splice(
      0,
      Math.max(1, lane.entries.length - Math.floor(cfg.cap / 2)),
    );
    const summaryContent = toSummarize
      .map((entry) => `[${entry.channelId}] ${entry.message.content}`)
      .join('\n');
    lane.entries.unshift({
      id: randomUUID(),
      sessionId: lane.sessionId,
      channelId: 'system',
      message: {
        id: randomUUID(),
        sessionId: lane.sessionId,
        content: `[Queue: ${toSummarize.length} messages summarized]\n${summaryContent}`,
        source: 'system',
        timestamp: new Date(),
      },
      mode: 'followup',
      priority: 0,
      enqueuedAt: Date.now(),
    });
  }

  private mergeMessages(existing: CarinaMessage, incoming: CarinaMessage): CarinaMessage {
    return {
      ...incoming,
      content: `${existing.content}\n\n[+follow-up]\n${incoming.content}`,
      timestamp: new Date(),
    };
  }
}
