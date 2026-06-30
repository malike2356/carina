import type { AivaStreamEvent, ProcessAivaMessageParams } from '../workers/aiva-process-message.js';

export type AivaWorkerSpawnConfig = {
  workerId: string;
  workspaceId: string;
};

export type WorkerMessage =
  | { type: 'ping' }
  | { type: 'process_message'; params: ProcessAivaMessageParams };

export type WorkerInboundMessage = WorkerMessage & { id: string };

export type WorkerResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string }
  | { id: string; type: 'stream'; event: AivaStreamEvent }
  | { type: 'fatal'; error: string };

export type AivaWorkerPoolStatus = {
  workerId: string;
  workspaceId: string;
  threadId: number | null;
  status: 'running' | 'stopped';
  memoryLimitMb: number;
  spawnedAt: string;
  lastPongAt: string | null;
};
