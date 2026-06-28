export type AivaWorkerStatus =
  | 'active'
  | 'paused'
  | 'configuring'
  | 'error'
  | 'dismissed';

export type AivaActionType =
  | 'message_received'
  | 'message_sent'
  | 'task_completed'
  | 'escalated'
  | 'skill_used'
  | 'automation_run'
  | 'automation_ran'
  | 'tool_called';

export interface AivaWorker {
  id: string;
  workspaceId: string;
  name: string;
  roleDescription: string;
  templateId: string | null;
  skillPacks?: string[];
  channels: string[];
  language: string;
  status: AivaWorkerStatus;
  propreneurTenantSlug?: string | null;
  messagesToday?: number;
  totalMessages?: number;
  escalationRate?: number;
  automationsRan?: number;
  lastActiveAt?: string | null;
  trialDaysLeft?: number;
  scout?: {
    enabled?: boolean;
    registered?: boolean;
    monitoring?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AivaActivityItem {
  id: string;
  workerId: string;
  actionType: AivaActionType;
  summary: string;
  createdAt: string;
}

export interface AivaAuditRow {
  id: string;
  actionType: AivaActionType;
  inputSummary?: string | null;
  outputSummary?: string | null;
  attestationTx?: string | null;
  attestationGated?: boolean;
  createdAt: string;
}

export interface AivaAutomation {
  id: string;
  workerId: string;
  name: string;
  description: string;
  scheduleLabel: string;
  enabled: boolean;
  lastRunAt?: string | null;
}

export interface AivaChannelCard {
  id: string;
  type: string;
  label: string;
  identifier?: string;
  active?: boolean;
  connected: boolean;
  messageCount?: number;
}

export interface AivaUsageBar {
  count: number;
  limit: number;
  resetsAt: string;
}

export interface AivaSubscriptionStatus {
  trialDaysRemaining?: number;
  status?: string;
}
