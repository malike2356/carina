/** Agent engine OPS types (C05). */

export type AgentEngineName = 'keprix' | 'carina';

export type AgentEngineConfig = {
  global_engine: AgentEngineName;
  keprix_url: string;
  default_model: string;
  max_iterations: number;
  timeout_seconds: number;
  prompt_filter_enabled: boolean;
  kill_switch_enabled: boolean;
  scout_integration_enabled: boolean;
};

export type WorkspaceEngineAssignment = {
  id: string;
  name: string;
  engine: AgentEngineName;
  status: 'active' | 'suspended' | 'unknown';
};

export type AgentEngineHealth = {
  engine: AgentEngineName;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';
  uptime_seconds: number | null;
  version: string | null;
  active_sessions: number | null;
  memory_usage_mb: number | null;
  cpu_percent: number | null;
  last_error: string | null;
  checked_at: string;
  /** True only when primary invoke probe succeeds (not health ping alone). */
  keprix_primary_invoke_ok?: boolean;
  pack_version?: string | null;
  capability_counts?: Record<string, number> | null;
  circuit?: string | null;
  raw?: Record<string, unknown>;
};

export type AgentEngineLogEntry = {
  timestamp: string;
  level: string;
  workspace_id?: string;
  message: string;
  source?: string;
};

export type AgentEngineAuditEntry = {
  at: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
};

export type AgentEngineState = {
  config: AgentEngineConfig;
  workspaces: Record<string, { name?: string; engine: AgentEngineName; status?: string }>;
  last_deploy: {
    action: string;
    status: string;
    at: string;
    estimated_downtime_seconds?: number;
    detail?: string;
  } | null;
  logs: AgentEngineLogEntry[];
  audit: AgentEngineAuditEntry[];
  health_failures: number;
  last_alert_at: string | null;
};
