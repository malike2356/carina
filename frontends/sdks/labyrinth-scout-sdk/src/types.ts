export type Severity = 'info' | 'warning' | 'critical' | 'breach';
export type InstanceStatus = 'active' | 'suspended' | 'offline';

export type PolicyActionType =
  | 'shell' | 'http' | 'file_write' | 'email' | 'messaging' | 'tool_chain' | 'credential';

export type PolicyDecisionKind =
  | 'allow' | 'block' | 'require_approval' | 'dry_run' | 'quarantine_session';

export type ContextSourceType =
  | 'user_prompt' | 'tool_output' | 'web_fetch' | 'email_body'
  | 'attachment_text' | 'rag_chunk' | 'imported_doc';

export type ShieldMode = 'observe' | 'guard' | 'restrict' | 'quarantine';

export interface ScoutEvent {
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  instance_id?: string;
}

export interface PolicyEvaluateRequest {
  session_id: string;
  instance_id?: string;
  tool_name?: string;
  action_type?: PolicyActionType;
  params?: Record<string, unknown>;
  content?: string;
  context_type?: ContextSourceType;
  confirmed?: boolean;
}

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  actionType: PolicyActionType;
  reason: string;
  riskScore: number;
  shieldMode: ShieldMode;
  metadata?: Record<string, unknown>;
  filteredContent?: string;
  approval_id?: string;
  expires_at?: string;
  poll_url?: string;
}

export interface ContextFirewallResult {
  action: 'pass' | 'redact' | 'annotate' | 'downgrade_trust' | 'block' | 'isolate';
  content: string;
  reason: string;
}

export interface InstanceStatusResponse {
  suspended: boolean;
  reason?: string;
}

export interface KillSwitchStatus {
  armed: boolean;
  triggered: boolean;
  triggered_by: string | null;
  reason: string | null;
  agents_active: number;
}

export interface RegisterResponse {
  instance_id: string;
}

// Compatibility types matching @verlox/labyrinth-scout v0.1 API
export interface ReportEventOptions {
  severity: Severity;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

export interface ReportToolCallOptions {
  toolName: string;
  params?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  sessionId?: string;
}

export interface StatusResponse {
  suspended: boolean;
  reason?: string;
}

export interface LabyrinthScoutClientOptions {
  url: string;
  apiKey: string;
  instanceId: string;
  agentType?: string;
  enabled?: boolean;
  timeoutMs?: number;
}
