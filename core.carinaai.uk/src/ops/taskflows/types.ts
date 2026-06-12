export type TaskFlowStep =
  | { type: 'webhook'; event: string; payload?: Record<string, unknown> }
  | { type: 'agent'; prompt: string }
  | { type: 'delay'; ms: number }
  | { type: 'cron'; jobId: string }
  | { type: 'tool'; name: string; args?: Record<string, unknown> };

export type TaskFlowTrigger =
  | { type: 'manual' }
  | { type: 'cron'; jobId: string }
  | { type: 'webhook'; event: string };

export type TaskFlow = {
  id: string;
  name: string;
  label?: string;
  steps: TaskFlowStep[];
  chainOnSuccess: string[];
  triggers?: TaskFlowTrigger[];
  status: 'active' | 'paused';
  maxRetries?: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'lost';

export type TaskFlowRun = {
  id: string;
  flowId: string;
  flowName: string;
  status: TaskRunStatus;
  stepIndex: number;
  retryCount?: number;
  retriedFromRunId?: string;
  idempotencyKey?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  output?: string;
  error?: string;
};

export type DeliveryQueueItem = {
  id: string;
  channel: string;
  conversationId: string;
  message: string;
  status: 'queued' | 'delivered' | 'failed';
  createdAt: string;
  deliveredAt?: string;
  error?: string;
  source?: string;
};

export type TaskFlowStoreFile = {
  version: number;
  flows: TaskFlow[];
  runs: TaskFlowRun[];
  deliveryQueue: DeliveryQueueItem[];
};
