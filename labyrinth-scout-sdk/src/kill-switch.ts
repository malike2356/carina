import type { ScoutClient } from './client.js';

export interface KillSwitchWatcherOptions {
  instanceId: string;
  pollIntervalMs?: number;
  onKill: (reason: string | null) => void | Promise<void>;
  onResume?: () => void | Promise<void>;
}

export class KillSwitchWatcher {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private wasTriggered = false;
  private stopped = false;

  constructor(
    private readonly scout: ScoutClient,
    private readonly options: KillSwitchWatcherOptions,
  ) {}

  start(): void {
    if (this.stopped) return;
    const interval = this.options.pollIntervalMs ?? 5000;

    this.pollTimer = setInterval(async () => {
      if (this.stopped) return;
      try {
        const status = await this.scout.killSwitchStatus();
        if (status.triggered && !this.wasTriggered) {
          this.wasTriggered = true;
          await this.options.onKill(status.reason);
        } else if (!status.triggered && this.wasTriggered) {
          this.wasTriggered = false;
          if (this.options.onResume) await this.options.onResume();
        }
      } catch {
        // Scout temporarily unreachable - do not kill
      }
    }, interval);
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export class KillSwitchSseWatcher {
  private es: EventSource | null = null;
  private stopped = false;

  constructor(
    private readonly scout: ScoutClient,
    private readonly options: Omit<KillSwitchWatcherOptions, 'pollIntervalMs'>,
  ) {}

  start(): void {
    if (this.stopped) return;
    this.es = new EventSource(this.scout.streamUrlWithAuth());

    this.es.addEventListener('kill_switch_status', async (e: MessageEvent) => {
      if (this.stopped) return;
      try {
        const data = JSON.parse(e.data as string) as { data?: { event_type?: string } };
        const eventType = data?.data?.event_type;
        if (eventType === 'kill_switch_activated') {
          await this.options.onKill(null);
        } else if (eventType === 'kill_switch_resumed' && this.options.onResume) {
          await this.options.onResume();
        }
      } catch {
        /* malformed event - ignore */
      }
    });

    this.es.onerror = () => {
      if (this.stopped) return;
      this.es?.close();
      setTimeout(() => { if (!this.stopped) this.start(); }, 10_000);
    };
  }

  stop(): void {
    this.stopped = true;
    this.es?.close();
    this.es = null;
  }
}
