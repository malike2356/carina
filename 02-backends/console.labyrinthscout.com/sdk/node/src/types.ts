export type Severity = 'info' | 'warning' | 'critical' | 'breach';

export interface ReportEventOptions {
  severity: Severity;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

export interface ReportToolCallOptions {
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  durationMs: number;
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
}
