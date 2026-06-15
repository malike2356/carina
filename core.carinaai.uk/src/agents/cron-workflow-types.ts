import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

export type CronWorkflowStatus = 'active' | 'paused' | 'removed';
export type CronWorkflowRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';

export interface CronWorkflowStep {
  id: string;
  prompt?: string;
  scriptPath?: string;
  noAgent?: boolean;
  needs?: string[];
  contextFrom?: string[];
  retries?: number;
  retryDelayMs?: number;
  deliver?: boolean | string | string[];
  enabledToolsets?: string[];
  workdir?: string;
}

export interface CronWorkflowOnFailure {
  deliver?: string | string[];
  message?: string;
}

export interface CronWorkflowDefinition {
  version: 1;
  steps: CronWorkflowStep[];
  deliverOn?: 'last' | 'each' | 'failed';
  onFailure?: CronWorkflowOnFailure;
  maxStepOutputChars?: number;
}

export interface CronWorkflow {
  id: string;
  name: string;
  schedule: string;
  definition: CronWorkflowDefinition;
  deliver: string;
  deliverChannels: string[];
  status: CronWorkflowStatus;
  workdir: string | null;
  originSessionId: string | null;
  originChannel: ChannelName | null;
  originConversationId: string | null;
  originThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CronWorkflowStepState {
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  output?: string;
  attempts: number;
  error?: string;
  finishedAt?: string;
}

export interface CronWorkflowRun {
  id: string;
  workflowId: string;
  status: CronWorkflowRunStatus;
  currentStepId: string | null;
  stepStates: Record<string, CronWorkflowStepState>;
  context: Record<string, string>;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}
