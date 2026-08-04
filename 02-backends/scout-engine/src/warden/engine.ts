// WARDEN main orchestrator; sensor dispatch, scheduler, response engine
import { randomUUID } from 'node:crypto';
import { loadWardenConfig } from './config.js';
import { correlateSignals } from './correlator.js';
import { respondToThreat } from './responder.js';
import { runAllSensors } from './sensors/index.js';
import { probeArsenalAvailabilityAsync, runArsenalPipeline } from './arsenal/pipeline.js';
import type {
  ScanJob,
  SensorName,
  SensorStatus,
  ThreatVerdict,
  WardenEvent,
  WardenStatus,
} from './types.js';

const scans = new Map<string, ScanJob>();
const threats = new Map<string, ThreatVerdict>();
const events: WardenEvent[] = [];
const sensorMeta = new Map<SensorName, SensorStatus>();

let timers: NodeJS.Timeout[] = [];
let started = false;

function rememberSensors(results: ScanJob['sensorResults']): void {
  const cfg = loadWardenConfig();
  for (const [name, signals] of Object.entries(results) as [SensorName, NonNullable<ScanJob['sensorResults'][SensorName]>][]) {
    sensorMeta.set(name, {
      name,
      enabled: Boolean(cfg.sensors[name]),
      lastRunAt: new Date().toISOString(),
      lastSignalCount: signals?.length ?? 0,
      healthy: true,
    });
  }
}

async function executeScan(job: ScanJob): Promise<void> {
  const cfg = loadWardenConfig();
  job.status = 'running';
  scans.set(job.id, job);

  if (!cfg.enabled) {
    job.status = 'failed';
    job.error = 'Warden disabled';
    job.completedAt = new Date().toISOString();
    scans.set(job.id, job);
    return;
  }

  try {
    const sensorMode = job.mode === 'quick' ? 'quick' : job.mode === 'deep' ? 'deep' : 'full';
    job.sensorResults = await runAllSensors(sensorMode);
    rememberSensors(job.sensorResults);

    const flat = Object.values(job.sensorResults).flatMap((s) => s ?? []);

    // Enrich artifacts through arsenal when present
    for (const sig of flat) {
      if (sig.artifactPath && (job.mode === 'full' || job.mode === 'deep')) {
        const arsenal = await runArsenalPipeline(sig.artifactPath);
        const hits = arsenal.filter((r) => r.ok && ((r.findings.matches as unknown[])?.length || r.summary.includes('match')));
        if (hits.length) {
          sig.confidence = Math.min(1, sig.confidence + 0.1 * hits.length);
          sig.evidence = { ...sig.evidence, arsenal: hits.map((h) => ({ tool: h.tool, summary: h.summary })) };
          sig.severity = Math.min(10, sig.severity + hits.length);
        }
      }
    }

    const verdicts = correlateSignals(flat, {
      autoRemove: cfg.auto_remove || cfg.response.critical_high_auto_remove,
      killSwitch: cfg.kill_switch_on_critical,
    });

    for (const verdict of verdicts) {
      threats.set(verdict.id, verdict);
      if (verdict.actions.some((a) => a !== 'log')) {
        const { event } = await respondToThreat(verdict);
        events.unshift(event);
        if (events.length > 500) events.pop();
      }
    }

    job.threats = verdicts;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.completedAt = new Date().toISOString();
  }

  scans.set(job.id, job);
}

/** Queue a scan and return immediately (202-friendly). Work continues in the background. */
export function enqueueScan(mode: ScanJob['mode'] = 'full'): ScanJob {
  const job: ScanJob = {
    id: randomUUID(),
    mode,
    status: 'queued',
    startedAt: new Date().toISOString(),
    sensorResults: {},
    threats: [],
  };
  scans.set(job.id, job);
  void executeScan(job);
  return job;
}

/** Await full scan completion (used by internal scheduler ticks). */
export async function runScan(mode: ScanJob['mode'] = 'full'): Promise<ScanJob> {
  const job = enqueueScan(mode);
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const current = scans.get(job.id);
    if (!current) return job;
    if (current.status === 'completed' || current.status === 'failed') return current;
    await new Promise((r) => setTimeout(r, 200));
  }
  return scans.get(job.id) ?? job;
}

export function getScan(id: string): ScanJob | undefined {
  return scans.get(id);
}

export function listScans(limit = 20): ScanJob[] {
  return [...scans.values()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map((job) => ({
      ...job,
      // Keep list payloads light; full detail via GET /scan/:id
      sensorResults: {},
    }));
}

export function getActiveScans(): ScanJob[] {
  return [...scans.values()].filter((j) => j.status === 'queued' || j.status === 'running');
}

export function listThreats(): ThreatVerdict[] {
  return [...threats.values()].sort((a, b) => b.riskScore - a.riskScore);
}

export function getThreat(id: string): ThreatVerdict | undefined {
  return threats.get(id);
}

export function listEvents(limit = 100): WardenEvent[] {
  return events.slice(0, limit);
}

export function getEvidenceList(): Array<{ id: string; threatId?: string; evidenceDir?: string; timestamp: string; title: string }> {
  return events
    .filter((e) => e.evidenceDir)
    .map((e) => ({
      id: e.id,
      threatId: e.threatId,
      evidenceDir: e.evidenceDir,
      timestamp: e.timestamp,
      title: e.title,
    }));
}

export async function getWardenStatus(): Promise<WardenStatus> {
  const cfg = loadWardenConfig();
  const open = listThreats().filter((t) => t.status === 'open' || t.status === 'responding');
  const critical = open.filter((t) => t.severity === 'critical');
  const last = [...scans.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

  const sensors: SensorStatus[] = (
    [
      'carina',
      'scout',
      'host',
      'network',
      'connected_systems',
      'devices',
      'deployed_agents',
      'supply_chain',
    ] as SensorName[]
  ).map((name) => {
    return (
      sensorMeta.get(name) ?? {
        name,
        enabled: Boolean(cfg.sensors[name]),
        lastSignalCount: 0,
        healthy: true,
      }
    );
  });

  let posture: WardenStatus['posture'] = 'secure';
  if (critical.length > 0) posture = 'compromised';
  else if (open.length > 0) posture = 'elevated';
  if (!cfg.enabled) posture = 'unknown';

  return {
    enabled: cfg.enabled,
    dryRun: cfg.dry_run,
    posture,
    openThreats: open.length,
    criticalThreats: critical.length,
    lastScanId: last?.id,
    lastScanAt: last?.completedAt || last?.startedAt,
    sensors,
    arsenalAvailability: await probeArsenalAvailabilityAsync(),
  };
}

export function stopWardenScheduler(): void {
  for (const t of timers) clearInterval(t);
  timers = [];
  started = false;
}

export function startWardenScheduler(): void {
  if (started) return;
  const cfg = loadWardenConfig();
  if (!cfg.enabled) {
    console.log('[warden] disabled; scheduler not started');
    return;
  }

  started = true;
  console.log(
    '[warden] starting sensor scheduler (dry_run=%s quick=%sms full=%sms deep=%sms)',
    cfg.dry_run,
    cfg.schedule.network_ms,
    cfg.schedule.host_ms,
    cfg.schedule.deep_scan_ms,
  );

  if (cfg.schedule.network_ms > 0) {
    timers.push(setInterval(() => void enqueueScan('quick'), cfg.schedule.network_ms));
  }
  if (cfg.schedule.host_ms > 0) {
    timers.push(setInterval(() => void enqueueScan('full'), cfg.schedule.host_ms));
  }
  if (cfg.schedule.deep_scan_ms > 0) {
    timers.push(setInterval(() => void enqueueScan('deep'), cfg.schedule.deep_scan_ms));
  }

  // Kick an initial quick scan
  void enqueueScan('quick');
}

/** Rebuild interval timers after schedule config changes. */
export function restartWardenScheduler(): void {
  stopWardenScheduler();
  startWardenScheduler();
}

export function getScheduleStatus(): {
  running: boolean;
  schedule: ReturnType<typeof loadWardenConfig>['schedule'];
  activeScans: number;
} {
  const cfg = loadWardenConfig();
  return {
    running: started,
    schedule: cfg.schedule,
    activeScans: getActiveScans().length,
  };
}

export async function manualRespond(
  threatId: string,
  opts: {
    confirmedRemove?: boolean;
    instanceId?: string;
    /** If set, run only these actions instead of the full recommended set. */
    onlyActions?: import('./types.js').ResponseAction[];
  } = {},
): Promise<{
  ok: boolean;
  error?: string;
  threat?: ThreatVerdict;
  event?: WardenEvent;
  responses?: import('./types.js').ResponseResult[];
}> {
  const threat = threats.get(threatId);
  if (!threat) return { ok: false, error: 'Threat not found' };

  const originalActions = threat.actions;
  if (opts.onlyActions?.length) {
    threat.actions = opts.onlyActions;
  }
  try {
    const { event, responses } = await respondToThreat(threat, opts);
    events.unshift(event);
    if (events.length > 500) events.pop();
    return { ok: true, threat, event, responses };
  } finally {
    threat.actions = originalActions;
  }
}
