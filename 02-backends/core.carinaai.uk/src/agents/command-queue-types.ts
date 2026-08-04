import type { CarinaMessage } from '../types/index.js';

export type QueueMode = 'steer' | 'followup' | 'collect' | 'interrupt';

export type QueueDropPolicy = 'summarize' | 'old' | 'new';

export interface QueueEntry {
  id: string;
  sessionId: string;
  channelId: string;
  message: CarinaMessage;
  mode: QueueMode;
  priority: number;
  enqueuedAt: number;
  debounceKey?: string;
  steerOnly?: boolean;
}

export interface QueueLane {
  sessionId: string;
  entries: QueueEntry[];
  state: 'idle' | 'running' | 'draining';
  lastDequeuedAt: number;
}

export interface QueueConfig {
  maxConcurrent: number;
  debounceMs: number;
  cap: number;
  drop: QueueDropPolicy;
  defaultMode: QueueMode;
  lockTimeoutMs: number;
  staleEvictMs: number;
}

export interface QueueStatus {
  totalEntries: number;
  activeLanes: number;
  idleLanes: number;
  oldestEntryAge: number;
  laneStatuses: Array<{
    sessionId: string;
    entries: number;
    state: string;
    oldestEntryAge: number;
  }>;
}

export type TypingIndicatorHook = (sessionId: string, action: 'start' | 'stop') => void;

export type AbortSessionHook = (sessionId: string) => void;

export type SteerInjectHook = (sessionId: string, content: string, entryId: string) => void;
