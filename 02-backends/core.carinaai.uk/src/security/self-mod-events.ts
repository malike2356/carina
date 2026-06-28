export const SELF_MOD_EVENT_TYPES = {
  TOOL_GEN_REQUESTED:     'tool_gen.requested',
  TOOL_GEN_AUTH_FAILED:   'tool_gen.auth_failed',
  TOOL_GEN_AUTH_LOCKOUT:  'tool_gen.auth_lockout',
  TOOL_GEN_CODE_GENERATED:'tool_gen.code_generated',
  TOOL_GEN_STATIC_SCAN:   'tool_gen.static_scan',
  TOOL_GEN_SANDBOX_RUN:   'tool_gen.sandbox_run',
  TOOL_GEN_SANDBOX_FAIL:  'tool_gen.sandbox_failed',
  TOOL_GEN_COMPLETED:     'tool_gen.completed',

  TOOL_PERSIST_REQUESTED: 'tool_persist.requested',
  TOOL_PERSIST_AUTH_FAIL: 'tool_persist.auth_failed',
  TOOL_PERSIST_SAVED:     'tool_persist.saved',
  TOOL_APPROVED:          'tool_approved',
  TOOL_REJECTED:          'tool_rejected',
  TOOL_DISABLED:          'tool_disabled',

  TOOL_FETCH_DENIED:      'tool.fetch_denied',
  TOOL_INJECTION_BLOCKED: 'tool.injection_blocked',
  TOOL_CONCURRENCY_BLOCK: 'tool.concurrency_blocked',
  TOOL_RAPID_GENERATION:  'tool.rapid_generation',
  TOOL_HIGH_RISK_PATTERN: 'tool.high_risk_pattern',

  SCOUT_AUTO_QUARANTINE:  'scout.auto_quarantine',
  SCOUT_AUTO_SUSPEND:     'scout.auto_suspend',
  SCOUT_ALERT_SENT:       'scout.alert_sent',
} as const;

export type SelfModEventType = (typeof SELF_MOD_EVENT_TYPES)[keyof typeof SELF_MOD_EVENT_TYPES];

export const EVENT_SEVERITY: Record<string, 'info' | 'warning' | 'critical'> = {
  'tool_gen.requested':       'info',
  'tool_gen.auth_failed':     'warning',
  'tool_gen.auth_lockout':    'critical',
  'tool_gen.code_generated':  'info',
  'tool_gen.static_scan':     'info',
  'tool_gen.sandbox_run':     'info',
  'tool_gen.sandbox_failed':  'warning',
  'tool_gen.completed':       'info',
  'tool_persist.requested':   'info',
  'tool_persist.auth_failed': 'warning',
  'tool_persist.saved':       'info',
  'tool_approved':            'info',
  'tool_rejected':            'info',
  'tool_disabled':            'info',
  'tool.fetch_denied':        'warning',
  'tool.injection_blocked':   'critical',
  'tool.concurrency_blocked': 'warning',
  'tool.rapid_generation':    'critical',
  'tool.high_risk_pattern':   'critical',
  'scout.auto_quarantine':    'warning',
  'scout.auto_suspend':       'critical',
  'scout.alert_sent':         'info',
};
