export interface SessionMetricsPayload {
  tool_calls_per_5min?: number;
  unique_tools_used?: number;
  avg_response_length?: number;
  shell_exec_count?: number;
  http_request_count?: number;
  injection_attempt_count?: number;
  egress_blocked_count?: number;
  tool_sequence?: string[];
  hour_utc?: number;
}

function tryParseMetrics(description: string): SessionMetricsPayload | null {
  if (!description.trim().startsWith('{')) return null;
  try {
    return JSON.parse(description) as SessionMetricsPayload;
  } catch {
    return null;
  }
}

/** Human label for security_events.event_type in customer-facing UI. */
export function formatEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'session_metrics':
      return 'Session telemetry';
    case 'tool_call':
      return 'Tool call';
    case 'cli_test':
      return 'Pairing test';
    case 'anomaly_detected':
      return 'Anomaly';
    case 'prompt_injection':
      return 'Prompt injection';
    case 'injection_attempt':
      return 'Injection attempt';
    default:
      return eventType.replace(/_/g, ' ');
  }
}

/** Readable description for account dashboard and similar surfaces. */
export function formatEventDescription(
  eventType: string,
  description: string,
  instanceId?: string | null,
): string {
  if (eventType === 'session_metrics') {
    const m = tryParseMetrics(description);
    if (!m) return 'Session metrics received';
    const parts: string[] = [];
    const calls = m.tool_calls_per_5min ?? 0;
    if (calls === 0) {
      parts.push('Session idle (0 tool calls in 5 min)');
    } else {
      parts.push(`${calls} tool call${calls === 1 ? '' : 's'} in 5 min`);
    }
    if ((m.injection_attempt_count ?? 0) > 0) {
      parts.push(`${m.injection_attempt_count} injection attempt(s)`);
    }
    if ((m.egress_blocked_count ?? 0) > 0) {
      parts.push(`${m.egress_blocked_count} egress block(s)`);
    }
    if ((m.shell_exec_count ?? 0) > 0) {
      parts.push(`${m.shell_exec_count} shell exec`);
    }
    if ((m.http_request_count ?? 0) > 0) {
      parts.push(`${m.http_request_count} HTTP request(s)`);
    }
    if (instanceId) parts.push(`instance ${instanceId}`);
    return parts.join('; ');
  }

  if (eventType === 'tool_call') {
    try {
      const parsed = JSON.parse(description) as { tool?: string; success?: boolean };
      if (parsed.tool) {
        return parsed.success === false
          ? `Tool ${parsed.tool} failed`
          : `Tool ${parsed.tool} completed`;
      }
    } catch {
      /* fall through */
    }
  }

  if (eventType === 'anomaly_detected') {
    try {
      const parsed = JSON.parse(description) as { metricName?: string; currentValue?: number };
      if (parsed.metricName) {
        return `Spike on ${parsed.metricName}${parsed.currentValue !== undefined ? ` (${parsed.currentValue})` : ''}`;
      }
    } catch {
      /* fall through */
    }
  }

  if (description.length > 160) {
    return `${description.slice(0, 157)}...`;
  }
  return description;
}
