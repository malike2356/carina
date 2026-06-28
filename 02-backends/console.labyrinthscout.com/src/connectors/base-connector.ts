import type {
  ConnectorHealth,
  PushResult,
  ScoutAlert,
  ScoutFinding,
  SiemConnector,
  VendorStatus,
} from './types.js';

export abstract class BaseConnector implements SiemConnector {
  abstract id: string;
  abstract name: string;
  abstract category: SiemConnector['category'];
  abstract version: string;
  abstract description: string;
  abstract configSchema: SiemConnector['configSchema'];

  protected config: Record<string, string> = {};

  async init(config: Record<string, string>): Promise<void> {
    this.config = { ...config };
    this.validateRequiredConfig();
    await this.onInit();
  }

  protected validateRequiredConfig(): void {
    for (const field of this.configSchema) {
      if (!field.required) continue;
      const value = this.config[field.key]?.trim();
      if (!value) {
        throw new Error(`${this.name}: missing required config "${field.key}"`);
      }
    }
  }

  protected async onInit(): Promise<void> {
    // optional hook for subclasses
  }

  protected cfg(key: string, fallback = ''): string {
    return this.config[key]?.trim() || fallback;
  }

  abstract health(): Promise<ConnectorHealth>;
  abstract pushFinding(finding: ScoutFinding): Promise<PushResult>;
  abstract pushAlert(alert: ScoutAlert): Promise<PushResult>;

  async getStatus(vendorId: string): Promise<VendorStatus> {
    return { vendorId, status: 'unknown' };
  }

  async shutdown(): Promise<void> {
    this.config = {};
  }

  protected skipped(vendorId = 'skipped'): PushResult {
    return {
      ok: true,
      vendorId,
      pushedAt: new Date().toISOString(),
    };
  }

  protected healthResult(
    probe: { ok: boolean; latencyMs: number; error?: string },
  ): ConnectorHealth {
    return {
      ok: probe.ok,
      latencyMs: probe.latencyMs,
      error: probe.error,
      lastChecked: new Date().toISOString(),
    };
  }
}
