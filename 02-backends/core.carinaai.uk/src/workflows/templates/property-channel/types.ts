import type { ChannelDomainId, ChannelNicheId } from '../../../content/script-generator/niches.js';

export const PROPERTY_CHANNEL_STEP_IDS = [
  'channel-provision',
  'niche-research',
  'script-generation',
  'media-pipeline',
  'youtube-upload',
  'comment-monitor',
  'analytics-report',
] as const;

export type PropertyChannelStepId = (typeof PROPERTY_CHANNEL_STEP_IDS)[number];

export type PropertyChannelRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type PropertyChannelStepStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface PropertyChannelStepState {
  id: PropertyChannelStepId;
  status: PropertyChannelStepStatus;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface PropertyChannelInput {
  workspaceId: string;
  domain: ChannelDomainId;
  niche: ChannelNicheId;
  /** Location (property) or audience/focus (other domains). */
  location: string;
  publishTime: string;
  channelId?: string;
}

export interface PropertyChannelRun {
  id: string;
  workspaceId: string;
  input: PropertyChannelInput;
  status: PropertyChannelRunStatus;
  currentStepIndex: number;
  steps: Record<PropertyChannelStepId, PropertyChannelStepState>;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
