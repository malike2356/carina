import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

export type ProcessStatus = 'running' | 'exited' | 'killed' | 'error' | 'orphaned';

export interface ProcessNotify {
  channel: ChannelName;
  conversationId: string;
  messagePrefix?: string;
}

export type ProcessWatchAction = 'notify' | 'kill';

export interface ProcessWatchRule {
  pattern: string;
  flags?: string;
  action?: ProcessWatchAction;
  message?: string;
  once?: boolean;
}

export interface SpawnProcessOptions {
  workdir?: string;
  notifyOnComplete?: ProcessNotify;
  notifyOnFailure?: ProcessNotify;
  watchRules?: ProcessWatchRule[];
  label?: string;
  ownerSessionId?: string;
  dedupeKey?: string;
}

export interface ProcessRecord {
  processId: string;
  pid: number;
  command: string;
  workdir?: string;
  label?: string;
  status: ProcessStatus;
  startedAt: Date;
  endedAt?: Date;
  exitCode?: number;
  ownerSessionId?: string;
  dedupeKey?: string;
  watchRules: ProcessWatchRule[];
  matchedPatterns: string[];
  outputLineCount: number;
  detached?: boolean;
}
