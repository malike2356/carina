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
  workerConfig?: {
    permissions?: AivaWorkerPermissions;
    telegram?: {
      /** Default off. Explicit voice asks still go out as audio. */
      preferVoiceReplies?: boolean;
    };
  };
  messagesToday?: number;
  totalMessages?: number;
  escalationRate?: number;
  automationsRan?: number;
  lastActiveAt?: string | null;
  openThreads?: number;
  pendingApprovals?: number;
  trialDaysLeft?: number;
  scout?: {
    enabled?: boolean;
    registered?: boolean;
    monitoring?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type AivaWorkerPermissions = {
  email: 'anyone' | 'specific' | 'organization' | 'owner_only';
  whatsapp: 'anyone' | 'organization' | 'owner_only';
};

export type AivaOutboundMessage = {
  id: string;
  channel: string;
  contactId: string;
  preview: string;
  subject?: string;
  status: 'delivered' | 'failed' | 'pending';
  createdAt: string;
};

export type AivaWorkspaceProfile = {
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  preferredName: string;
  workFunction: string;
  personalPreferences: string;
  marketingOptOut: boolean;
};

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
  triggerType?: string;
  actionType?: string;
  approvalMode?: string;
  nextRunAt?: string | null;
}

export interface AivaAutomationRun {
  id: string;
  automationId: string;
  status: string;
  triggerKind: string;
  error?: string | null;
  durationMs?: number | null;
  approvalStatus?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  result?: Record<string, unknown> | null;
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
  walletRemainingGbp?: number;
  walletLowCredit?: boolean;
  walletExhausted?: boolean;
  byokActive?: boolean;
}

export interface AivaSubscriptionStatus {
  trialDaysRemaining?: number;
  status?: string;
}

export interface AivaEmployeeMessage {
  id: string;
  threadId: string;
  workerId: string;
  workspaceId: string;
  sender: 'user' | 'employee' | 'system';
  content: string;
  createdAt: string;
}

export interface AivaEmployeeTask {
  id: string;
  workerId: string;
  workspaceId: string;
  title: string;
  instructions: string;
  expectedOutput?: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  status: 'assigned' | 'working' | 'blocked' | 'waiting_approval' | 'done' | 'approved' | 'rejected' | string;
  dueAt?: string | null;
  completedWork?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AivaEmployeeEvent {
  id: string;
  workerId: string;
  workspaceId: string;
  taskId?: string | null;
  threadId?: string | null;
  eventType: string;
  summary: string;
  createdAt: string;
}
