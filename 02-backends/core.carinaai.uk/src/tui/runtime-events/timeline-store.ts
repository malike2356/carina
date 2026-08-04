export type RuntimeTimelineEventType =
  | 'session.started'
  | 'session.switched'
  | 'model.started'
  | 'model.token'
  | 'model.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.requested'
  | 'approval.resolved'
  | 'agent.started'
  | 'agent.completed'
  | 'scout.signal'
  | 'runtime.warning'
  | 'runtime.error'
  | 'interrupt.requested'
  | 'transport.reconnected';

export interface RuntimeTimelineEvent {
  id: string;
  type: RuntimeTimelineEventType;
  at: string;
  label: string;
  detail?: string;
  sessionId?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
}

export interface TimelineFilter {
  types?: RuntimeTimelineEventType[];
  severity?: RuntimeTimelineEvent['severity'][];
  sessionId?: string;
}

export class RuntimeTimelineStore {
  private events: RuntimeTimelineEvent[] = [];

  constructor(private limit = 200) {}

  add(input: Omit<RuntimeTimelineEvent, 'id' | 'at' | 'label' | 'severity'> & Partial<Pick<RuntimeTimelineEvent, 'id' | 'at' | 'label' | 'severity'>>): RuntimeTimelineEvent {
    const event = normalizeRuntimeEvent(input);
    this.events = [...this.events, event].slice(-this.limit);
    return event;
  }

  list(filter: TimelineFilter = {}): RuntimeTimelineEvent[] {
    return this.events.filter((event) => {
      if (filter.sessionId && event.sessionId !== filter.sessionId) return false;
      if (filter.types && !filter.types.includes(event.type)) return false;
      if (filter.severity && !filter.severity.includes(event.severity)) return false;
      return true;
    });
  }

  clear(): void {
    this.events = [];
  }
}

export function normalizeRuntimeEvent(
  input: Omit<RuntimeTimelineEvent, 'id' | 'at' | 'label' | 'severity'> & Partial<Pick<RuntimeTimelineEvent, 'id' | 'at' | 'label' | 'severity'>>,
): RuntimeTimelineEvent {
  const preset = eventPreset(input.type);
  return {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
    type: input.type,
    label: input.label ?? preset.label,
    detail: input.detail ? redactTimelineText(input.detail) : undefined,
    sessionId: input.sessionId,
    severity: input.severity ?? preset.severity,
    metadata: sanitizeMetadata(input.metadata),
  };
}

export function renderTimelineLines(events: RuntimeTimelineEvent[], width: number): string[] {
  const usable = Math.max(24, width);
  return events.map((event) => {
    const time = event.at.slice(11, 19);
    const detail = event.detail ? ` - ${event.detail}` : '';
    const line = `${time} ${event.label}${detail}`;
    return line.length > usable ? `${line.slice(0, usable - 3)}...` : line;
  });
}

export function redactTimelineText(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(?:sk|pk|rk|whsec|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{8,}\b/g, '[secret]')
    .replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, '$1=[redacted]');
}

function sanitizeMetadata(metadata: RuntimeTimelineEvent['metadata']): RuntimeTimelineEvent['metadata'] {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      typeof value === 'string' ? redactTimelineText(value) : value,
    ]),
  );
}

function eventPreset(type: RuntimeTimelineEventType): Pick<RuntimeTimelineEvent, 'label' | 'severity'> {
  switch (type) {
    case 'session.started': return { label: 'Session started', severity: 'success' };
    case 'session.switched': return { label: 'Session switched', severity: 'info' };
    case 'model.started': return { label: 'Model started', severity: 'info' };
    case 'model.token': return { label: 'Token received', severity: 'info' };
    case 'model.completed': return { label: 'Model completed', severity: 'success' };
    case 'tool.started': return { label: 'Tool started', severity: 'info' };
    case 'tool.completed': return { label: 'Tool completed', severity: 'success' };
    case 'tool.failed': return { label: 'Tool failed', severity: 'error' };
    case 'approval.requested': return { label: 'Approval requested', severity: 'warning' };
    case 'approval.resolved': return { label: 'Approval resolved', severity: 'success' };
    case 'agent.started': return { label: 'Agent started', severity: 'info' };
    case 'agent.completed': return { label: 'Agent completed', severity: 'success' };
    case 'scout.signal': return { label: 'Scout signal', severity: 'warning' };
    case 'runtime.warning': return { label: 'Runtime warning', severity: 'warning' };
    case 'runtime.error': return { label: 'Runtime error', severity: 'error' };
    case 'interrupt.requested': return { label: 'Interrupt requested', severity: 'warning' };
    case 'transport.reconnected': return { label: 'Transport reconnected', severity: 'success' };
  }
}
