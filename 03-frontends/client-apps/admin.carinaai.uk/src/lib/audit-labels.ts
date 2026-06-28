export const ACTION_LABEL_MAP: Record<string, string> = {
  extend_trial: 'Extended trial',
  force_plan_change: 'Force plan change',
  pause_workspace_aivas: 'Paused all Aivas',
  resume_workspace_aivas: 'Resumed all Aivas',
  add_credit: 'Added credit',
  kill_switch_pause: 'Kill switch: pause',
  kill_switch_resume: 'Kill switch: resume',
  refund: 'Refund issued',
  va_assign: 'VA assigned',
  va_resolve: 'VA resolved',
  va_reply: 'VA reply sent',
  attestation_retry: 'Attestation retry',
  va_team_add: 'VA team member added',
  va_team_remove: 'VA team member removed',
};

export function humanAuditAction(action: string): string {
  return ACTION_LABEL_MAP[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(ACTION_LABEL_MAP).map(([value, label]) => ({
  value,
  label,
}));
