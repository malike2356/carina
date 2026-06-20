import type {
  LabyrinthScoutClientOptions,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5_000;

export class LabyrinthScoutClient {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly instanceId: string;
  private readonly agentType: string;
  private readonly enabled: boolean;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: LabyrinthScoutClientOptions) {
    this.url = options.url.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.instanceId = options.instanceId;
    this.agentType = options.agentType ?? 'custom';
    this.enabled = options.enabled ?? true;
  }

  async report(event: ReportEventOptions): Promise<void> {
    await this.post('/api/events', {
      instance_id: this.instanceId,
      agent_type: this.agentType,
      source: this.agentType,
      event_type: event.eventType,
      severity: event.severity,
      description: event.description,
      session_id: event.sessionId ?? 'sdk',
      metadata: {
        ...(event.metadata ?? {}),
        agent_type: this.agentType,
      },
    });
  }

  async reportToolCall(info: ReportToolCallOptions): Promise<void> {
    await this.post('/api/events', {
      instance_id: this.instanceId,
      agent_type: this.agentType,
      source: this.agentType,
      event_type: 'tool_call',
      severity: 'info',
      description: `Tool executed: ${info.toolName}`,
      session_id: info.sessionId ?? 'sdk',
      metadata: {
        toolName: info.toolName,
        params: info.params,
        result: info.result,
        durationMs: info.durationMs,
        agent_type: this.agentType,
      },
    });
  }

  async heartbeat(): Promise<void> {
    await this.post('/api/heartbeat', {
      instance_id: this.instanceId,
      name: this.instanceId,
      agent_type: this.agentType,
      timestamp: new Date().toISOString(),
    });
  }

  async checkStatus(): Promise<StatusResponse> {
    if (!this.enabled) return { suspended: false };
    const res = await this.get(
      `/api/instances/${encodeURIComponent(this.instanceId)}/status`,
    );
    if (!res) return { suspended: false };
    if (!res.ok) return { suspended: false };
    try {
      const data = (await res.json()) as { suspended: boolean; reason?: string };
      return { suspended: data.suspended, reason: data.reason };
    } catch {
      return { suspended: false };
    }
  }

  startKillSwitchPolling(
    onSuspend: (reason: string) => void,
    intervalMs = 30_000,
  ): () => void {
    if (!this.enabled) return () => {};

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
    this.pollingInterval = setInterval(() => void poll(), intervalMs);

    return () => {
      if (this.pollingInterval !== null) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    };
  }

  private async post(path: string, body: unknown): Promise<Response | null> {
    if (!this.enabled) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const res = await fetch(`${this.url}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scout-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      console.warn(
        '[LabyrinthScout] POST failed (Scout may be unreachable):',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  private async get(path: string): Promise<Response | null> {
    if (!this.enabled) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const res = await fetch(`${this.url}${path}`, {
        method: 'GET',
        headers: {
          'X-Scout-Key': this.apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      console.warn(
        '[LabyrinthScout] GET failed (Scout may be unreachable):',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }
}
