/**
 * Async event bus: buffer → dedupe → batch flush (every 5s or 100 events).
 * Fire-and-forget: track paths never await disk.
 */

import type { AnalyticsEvent } from './event-schema.js';
import { appendEvents } from './event-store.js';
import { recordActivityDay, ensureSignup, toUtcDateString } from '../cohort/activity-store.js';

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 100;
const DEDUPE_WINDOW_MS = 1_000;
const MAX_RETRIES = 3;

let buffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let retryQueue: AnalyticsEvent[] = [];
let flushHook: ((events: AnalyticsEvent[]) => void) | null = null;

function dedupeKey(evt: AnalyticsEvent): string {
  const second = Math.floor(Date.parse(evt.timestamp) / DEDUPE_WINDOW_MS);
  return `${evt.workspaceId}|${evt.userId}|${evt.eventName}|${second}`;
}

function collapseBuffer(events: AnalyticsEvent[]): AnalyticsEvent[] {
  const seen = new Map<string, AnalyticsEvent>();
  for (const evt of events) {
    seen.set(dedupeKey(evt), evt);
  }
  return [...seen.values()];
}

function feedCohortActivity(events: AnalyticsEvent[]): void {
  for (const evt of events) {
    try {
      ensureSignup({
        userId: evt.userId,
        workspaceId: evt.workspaceId,
        signedUpAt: evt.timestamp,
      });
      recordActivityDay({
        userId: evt.userId,
        workspaceId: evt.workspaceId,
        date: toUtcDateString(evt.timestamp),
        active: true,
      });
    } catch {
      // never block analytics path
    }
  }
}

async function flushOnce(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    const pending = collapseBuffer([...retryQueue, ...buffer]);
    buffer = [];
    retryQueue = [];
    if (pending.length === 0) return 0;
    try {
      const written = appendEvents(pending);
      feedCohortActivity(pending);
      flushHook?.(pending);
      return written;
    } catch {
      retryQueue.push(...pending);
      if (retryQueue.length > FLUSH_BATCH_SIZE * MAX_RETRIES) {
        retryQueue = retryQueue.slice(-FLUSH_BATCH_SIZE * MAX_RETRIES);
      }
      return 0;
    }
  } finally {
    flushing = false;
  }
}

function ensureTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushOnce();
  }, FLUSH_INTERVAL_MS);
  if (typeof flushTimer === 'object' && flushTimer && 'unref' in flushTimer) {
    (flushTimer as NodeJS.Timeout).unref?.();
  }
}

/** Enqueue event; returns immediately. */
export function enqueueEvent(event: AnalyticsEvent): void {
  buffer.push(event);
  ensureTimer();
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    void flushOnce();
  }
}

export async function flushEventsNow(): Promise<number> {
  return flushOnce();
}

export function pendingEventCount(): number {
  return buffer.length + retryQueue.length;
}

export function resetEventBusForTests(): void {
  buffer = [];
  retryQueue = [];
  flushing = false;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Test hook to observe flushes without relying on timers. */
export function setEventFlushHook(hook: ((events: AnalyticsEvent[]) => void) | null): void {
  flushHook = hook;
}
