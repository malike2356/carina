export type PolicyActionType =
  | 'shell'
  | 'http'
  | 'file_write'
  | 'email'
  | 'messaging'
  | 'tool_chain'
  | 'credential';

export type PolicyDecisionKind =
  | 'allow'
  | 'block'
  | 'require_approval'
  | 'dry_run'
  | 'quarantine_session';

export type ContextSourceType =
  | 'user_prompt'
  | 'tool_output'
  | 'web_fetch'
  | 'email_body'
  | 'attachment_text'
  | 'rag_chunk'
  | 'imported_doc';

export type ContextFirewallAction =
  | 'pass'
  | 'redact'
  | 'annotate'
  | 'downgrade_trust'
  | 'block'
  | 'isolate';

export type ShieldMode = 'observe' | 'guard' | 'restrict' | 'quarantine';

export interface PolicyEvaluateRequest {
  actionType: PolicyActionType;
  sessionId: string;
  instanceId?: string;
  toolName?: string;
  params?: Record<string, unknown>;
  content?: string;
  contextType?: ContextSourceType;
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
}

export interface ContextFirewallResult {
  action: ContextFirewallAction;
  content: string;
  reason: string;
  patterns: string[];
  riskScore: number;
}

export interface ShieldModeState {
  sessionId: string;
  mode: ShieldMode;
  reason?: string;
  changedAt: string;
  changedBy: string;
}

export function isBlockingDecision(decision: PolicyDecisionKind): boolean {
  return decision === 'block' || decision === 'quarantine_session';
}

export function decisionToHttpStatus(decision: PolicyDecisionKind): number {
  switch (decision) {
    case 'block':
    case 'quarantine_session':
      return 403;
    case 'require_approval':
      return 428;
    case 'dry_run':
      return 200;
    default:
      return 200;
  }
}

export function decisionToErrorCode(decision: PolicyDecisionKind): string {
  switch (decision) {
    case 'block':
      return 'policy_blocked';
    case 'quarantine_session':
      return 'session_quarantined';
    case 'require_approval':
      return 'approval_required';
    case 'dry_run':
      return 'dry_run_only';
    default:
      return 'allowed';
  }
}
