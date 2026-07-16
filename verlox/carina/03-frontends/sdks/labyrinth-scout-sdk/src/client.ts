import type {
  ScoutEvent,
  PolicyEvaluateRequest,
  PolicyDecision,
  ContextFirewallResult,
  InstanceStatusResponse,
  KillSwitchStatus,
  RegisterResponse,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
  LabyrinthScoutClientOptions,
} from './types.js';

export interface ScoutClientOptions {
  url: string;
  apiKey: string;
  instanceId?: string;
  agentType?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export class ScoutClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  readonly instanceId: string | undefined;
  private readonly agentType: string;
  private readonly enabled: boolean;

  constructor(options: ScoutClientOptions | LabyrinthScoutClientOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.instanceId = options.instanceId;
    this.agentType = options.agentType ?? 'custom';
    this.enabled = options.enabled ?? true;
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'X-Scout-Key': this.apiKey };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.enabled) return undefined as T;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scout ${path} ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.enabled) return undefined as T;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers(),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scout ${path} ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  async emit(event: ScoutEvent): Promise<void> {
    await this.post('/api/events', event);
  }

  async heartbeat(instanceId?: string, name?: string): Promise<void> {
    const id = instanceId ?? this.instanceId ?? '';
    await this.post('/api/heartbeat', { instance_id: id, name: name ?? id });
  }

  async register(name: string, agentType?: string): Promise<RegisterResponse> {
    return this.post<RegisterResponse>('/api/instances/register', { name, agent_type: agentType });
  }

  async instanceStatus(instanceId: string): Promise<InstanceStatusResponse> {
    return this.get<InstanceStatusResponse>(`/api/instances/${instanceId}/status`);
  }

  async policyEvaluate(request: PolicyEvaluateRequest): Promise<PolicyDecision> {
    return this.post<PolicyDecision>('/api/policy/evaluate', request);
  }

  async waitForApproval(
    approvalId: string,
    options?: {
      timeoutMs?: number;
      pollIntervalMs?: number;
    },
  ): Promise<{ approved: boolean; reason?: string }> {
    if (!this.enabled) return { approved: true };

    const timeoutMs = options?.timeoutMs ?? 14 * 60 * 1000;
    const pollIntervalMs = options?.pollIntervalMs ?? 3000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const status = await this.get<{
          status: 'pending' | 'approved' | 'rejected' | 'expired';
          rejection_reason?: string;
        }>(`/api/approvals/${approvalId}/status`);

        if (status.status === 'approved') return { approved: true };
        if (status.status === 'rejected') {
          return { approved: false, reason: status.rejection_reason ?? 'Approval rejected' };
        }
        if (status.status === 'expired') {
          return { approved: false, reason: 'Approval expired' };
        }
      } catch (err) {
        console.warn(
          '[LabyrinthScout] waitForApproval poll failed (Scout may be unreachable):',
          err instanceof Error ? err.message : String(err),
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { approved: false, reason: 'Timeout waiting for approval' };
  }

  async evaluateAndWait(
    request: PolicyEvaluateRequest,
    options?: {
      waitTimeoutMs?: number;
    },
  ): Promise<{ proceed: boolean; decision: PolicyDecision; reason?: string }> {
    const decision = await this.policyEvaluate(request);

    if (decision.decision === 'allow') {
      return { proceed: true, decision };
    }
    if (decision.decision === 'block' || decision.decision === 'quarantine_session') {
      return { proceed: false, decision, reason: decision.reason };
    }
    if (decision.decision === 'require_approval') {
      if (!decision.approval_id) {
        return { proceed: false, decision, reason: 'Approval required but no approval_id returned' };
      }
      const result = await this.waitForApproval(decision.approval_id, {
        timeoutMs: options?.waitTimeoutMs,
      });
      return { proceed: result.approved, decision, reason: result.reason };
    }

    return { proceed: false, decision, reason: 'Unknown decision' };
  }

  async policyContext(
    content: string,
    sessionId: string,
    options?: { contextType?: string; toolName?: string },
  ): Promise<ContextFirewallResult> {
    return this.post<ContextFirewallResult>('/api/policy/context', {
      content,
      session_id: sessionId,
      context_type: options?.contextType,
      tool_name: options?.toolName,
    });
  }

  async killSwitchStatus(): Promise<KillSwitchStatus> {
    return this.get<KillSwitchStatus>('/api/killswitch/status');
  }

  // v0.1 compatibility: bound-instanceId event reporting, fail-open on network errors
  async report(event: ReportEventOptions): Promise<void> {
    try {
      await this.emit({
        event_type: event.eventType,
        severity: event.severity,
        source: this.agentType,
        description: event.description,
        session_id: event.sessionId,
        instance_id: this.instanceId,
        metadata: { ...(event.metadata ?? {}), agent_type: this.agentType },
      });
    } catch (err) {
      console.warn('[LabyrinthScout] report failed (Scout may be unreachable):', err instanceof Error ? err.message : String(err));
    }
  }

  async reportToolCall(info: ReportToolCallOptions): Promise<void> {
    try {
      await this.emit({
        event_type: 'tool_call',
        severity: 'info',
        source: this.agentType,
        description: `Tool executed: ${info.toolName}`,
        session_id: info.sessionId,
        instance_id: this.instanceId,
        metadata: { toolName: info.toolName, params: info.params, result: info.result, durationMs: info.durationMs, agent_type: this.agentType },
      });
    } catch (err) {
      console.warn('[LabyrinthScout] reportToolCall failed (Scout may be unreachable):', err instanceof Error ? err.message : String(err));
    }
  }

  async checkStatus(): Promise<StatusResponse> {
    if (!this.instanceId) return { suspended: false };
    try {
      return (await this.instanceStatus(this.instanceId)) ?? { suspended: false };
    } catch {
      return { suspended: false };
    }
  }

  startKillSwitchPolling(onSuspend: (reason: string) => void, intervalMs = 30_000): () => void {
    if (!this.enabled || !this.instanceId) return () => {};
    let wasSuspended = false;
    const poll = async () => {
      const status = await this.checkStatus();
      if (status.suspended && !wasSuspended) {
        wasSuspended = true;
        onSuspend(status.reason ?? 'No reason provided');
      } else if (!status.suspended) {
        wasSuspended = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), intervalMs);
    return () => clearInterval(timer);
  }

  streamUrl(): string {
    return `${this.baseUrl}/api/stream`;
  }

  streamUrlWithAuth(): string {
    return `${this.streamUrl()}?key=${encodeURIComponent(this.apiKey)}`;
  }

  streamHeaders(): Record<string, string> {
    return { 'X-Scout-Key': this.apiKey };
  }
}
