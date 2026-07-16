import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { loadWardenConfig } from './config.js';
import type { ResponseResult, ThreatVerdict, WardenEvent } from './types.js';

export function hashBuffer(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function createEvidenceDir(prefix = 'event'): string {
  const cfg = loadWardenConfig();
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'event';
  const directory = path.join(
    cfg.evidence_dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${safePrefix}-${randomUUID()}`,
  );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export function writeThreatReport(
  threat: ThreatVerdict,
  responses: ResponseResult[],
): WardenEvent {
  const evidenceDir = createEvidenceDir(`threat-${threat.id}`);
  const event: WardenEvent = {
    id: randomUUID(),
    threatId: threat.id,
    timestamp: new Date().toISOString(),
    title: threat.title,
    severity: threat.severity,
    riskScore: threat.riskScore,
    status: threat.status,
    responses,
    evidenceDir,
  };

  const report = {
    event,
    threat,
    integrity: {
      generatedAt: event.timestamp,
      signalIds: threat.signals.map((signal) => signal.id),
    },
  };
  const reportPath = path.join(evidenceDir, 'threat-report.json');
  const serialized = JSON.stringify(report, null, 2);
  fs.writeFileSync(reportPath, serialized, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(
    path.join(evidenceDir, 'sha256.txt'),
    `${hashBuffer(Buffer.from(serialized))}  threat-report.json\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  return event;
}

export async function maybeSendAlerts(event: WardenEvent): Promise<void> {
  const cfg = loadWardenConfig();
  if (cfg.alerts.syslog) {
    console.warn(
      `[warden:alert] ${event.severity.toUpperCase()} ${event.title} (${event.threatId})`,
    );
  }
  if (!cfg.alerts.webhook_url) return;

  try {
    const response = await fetch(cfg.alerts.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[warden] alert webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(
      '[warden] alert webhook failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
