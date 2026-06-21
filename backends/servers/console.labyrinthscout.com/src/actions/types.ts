import type { AlertSeverity } from '../alerts/types.js';

export interface PlaybookAction {
  id: string;
  label: string;
  description: string;
  type: 'button' | 'script' | 'steps';
  script?: string;
  steps?: string[];
  destructive: boolean;
  reversible: boolean;
  requiresConfirmation: boolean;
  apiEndpoint?: string;
  apiMethod?: 'POST' | 'DELETE';
  apiBody?: Record<string, unknown>;
}

export interface ActionPlaybook {
  id: string;
  eventType: string;
  minSeverity: AlertSeverity;
  title: string;
  summary: string;
  riskNote: string;
  category: 'auto' | 'human' | 'monitor';
  actions: PlaybookAction[];
  createdAt: Date;
  updatedAt: Date;
}

export type PendingActionStatus = 'pending' | 'resolved' | 'dismissed' | 'auto_resolved';

export interface PendingAction {
  id: string;
  eventId: string;
  playbookId: string;
  status: PendingActionStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  notes: string | null;
  createdAt: Date;
  playbook?: ActionPlaybook;
  eventType?: string;
  eventSeverity?: AlertSeverity;
  eventDescription?: string;
  instanceId?: string;
  sessionId?: string;
}

export type ExecutionOutcome = 'success' | 'failure' | 'partial' | 'dry_run';
export type ExecutionType = 'auto' | 'manual';

export interface ActionExecution {
  id: string;
  pendingId: string | null;
  eventId: string;
  actionId: string;
  actionLabel: string;
  executedBy: string;
  executionType: ExecutionType;
  outcome: ExecutionOutcome;
  output: string | null;
  metadata: Record<string, unknown>;
  executedAt: Date;
}
