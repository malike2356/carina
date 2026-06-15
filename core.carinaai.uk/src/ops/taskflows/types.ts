export type ModelOverride = {
  provider?: string;
  model?: string;
};

export type TaskFlowStep =
  | { type: 'webhook'; event: string; payload?: Record<string, unknown> }
  | { type: 'agent'; prompt: string; model?: ModelOverride; profile?: string }
  | { type: 'delay'; ms: number }
  | { type: 'cron'; jobId: string }
  | { type: 'tool'; name: string; args?: Record<string, unknown> }
  | { type: 'subagent'; agentType: 'research' | 'coding' | 'communication' | 'file'; prompt: string; model?: ModelOverride }
  | { type: 'kanban'; action: 'create_cards' | 'run_lanes' | 'wait_review'; sessionId?: string; titles?: string[]; cardIds?: string[] }
  | { type: 'flow'; flowId: string; wait?: boolean };

export type TaskFlowTrigger =
  | { type: 'manual' }
  | { type: 'cron'; jobId: string }
  | { type: 'webhook'; event: string }
  | { type: 'subagent'; agentType?: string }
  | { type: 'kanban'; event: 'review' | 'done' | 'move' };

export type TaskFlow = {
  id: string;
  name: string;
  label?: string;
  profileName?: string;
  model?: ModelOverride;
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
  profileName?: string;
  status: TaskRunStatus;
  stepIndex: number;
  stepOutputs?: Record<string, string>;
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

export type TaskFlowYamlDocument = {
  name: string;
  label?: string;
  profile?: string;
  profileName?: string;
  model?: ModelOverride;
  maxRetries?: number;
  chainOnSuccess?: string[];
  triggers?: TaskFlowTrigger[];
  steps: TaskFlowStep[];
};
