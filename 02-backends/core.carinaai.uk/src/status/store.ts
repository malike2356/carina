/**
 * File-backed status store: incidents, maintenance, ping history, uptime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DailyUptime,
  Incident,
  IncidentPhase,
  IncidentSeverity,
  IncidentUpdate,
  MaintenanceWindow,
  MonitoredEndpoint,
  OverallStatus,
  PingResult,
  ServiceHealth,
  StatusSnapshot,
} from './types.js';

export interface StatusStoreData {
  product: string;
  endpoints: MonitoredEndpoint[];
  incidents: Incident[];
  maintenance: MaintenanceWindow[];
  /** Newest first; capped. */
  pings: PingResult[];
  /** endpointId -> consecutive failure count */
  failureStreak: Record<string, number>;
  /** endpointId -> consecutive success ms window start (ISO) while recovering */
  recoverySince: Record<string, string | null>;
  openIncidentByService: Record<string, string>;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function pct(ok: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((ok / total) * 10000) / 100;
}

export class StatusStore {
  private filePath: string | null;
  private data: StatusStoreData;

  constructor(opts?: { filePath?: string; product?: string; endpoints?: MonitoredEndpoint[] }) {
    this.filePath = opts?.filePath || null;
    this.data = this.loadOrInit(opts?.product || 'product', opts?.endpoints || []);
  }

  private loadOrInit(product: string, endpoints: MonitoredEndpoint[]): StatusStoreData {
    if (this.filePath && fs.existsSync(this.filePath)) {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StatusStoreData;
      return {
        product: raw.product || product,
        endpoints: raw.endpoints?.length ? raw.endpoints : endpoints,
        incidents: raw.incidents || [],
        maintenance: raw.maintenance || [],
        pings: raw.pings || [],
        failureStreak: raw.failureStreak || {},
        recoverySince: raw.recoverySince || {},
        openIncidentByService: raw.openIncidentByService || {},
      };
    }
    return {
      product,
      endpoints: [...endpoints],
      incidents: [],
      maintenance: [],
      pings: [],
      failureStreak: {},
      recoverySince: {},
      openIncidentByService: {},
    };
  }

  persist(): void {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  get product(): string {
    return this.data.product;
  }

  setEndpoints(endpoints: MonitoredEndpoint[]): void {
    this.data.endpoints = endpoints.map((e) => ({ ...e }));
    this.persist();
  }

  listEndpoints(): MonitoredEndpoint[] {
    return this.data.endpoints.map((e) => ({ ...e }));
  }

  recordPing(result: PingResult): void {
    this.data.pings.unshift(result);
    if (this.data.pings.length > 50_000) {
      this.data.pings = this.data.pings.slice(0, 50_000);
    }
    this.persist();
  }

  listPings(limit = 100): PingResult[] {
    return this.data.pings.slice(0, limit);
  }

  getFailureStreak(endpointId: string): number {
    return this.data.failureStreak[endpointId] || 0;
  }

  setFailureStreak(endpointId: string, n: number): void {
    this.data.failureStreak[endpointId] = n;
    this.persist();
  }

  getRecoverySince(endpointId: string): string | null {
    return this.data.recoverySince[endpointId] ?? null;
  }

  setRecoverySince(endpointId: string, iso: string | null): void {
    this.data.recoverySince[endpointId] = iso;
    this.persist();
  }

  getOpenIncidentId(serviceId: string): string | undefined {
    return this.data.openIncidentByService[serviceId];
  }

  setOpenIncidentId(serviceId: string, incidentId: string | null): void {
    if (!incidentId) delete this.data.openIncidentByService[serviceId];
    else this.data.openIncidentByService[serviceId] = incidentId;
    this.persist();
  }

  createIncident(input: {
    title: string;
    severity?: IncidentSeverity;
    affectedServices: string[];
    autoCreated?: boolean;
    message?: string;
    detectedAt?: string;
  }): Incident {
    const now = input.detectedAt || new Date().toISOString();
    const update: IncidentUpdate = {
      id: randomUUID(),
      phase: 'investigating',
      message: input.message || 'Automated health checks detected an outage. Investigating.',
      at: now,
    };
    const incident: Incident = {
      id: randomUUID(),
      title: input.title,
      severity: input.severity || 'major',
      phase: 'investigating',
      affectedServices: [...input.affectedServices],
      detectedAt: now,
      autoCreated: Boolean(input.autoCreated),
      updates: [update],
    };
    this.data.incidents.unshift(incident);
    for (const svc of incident.affectedServices) {
      this.data.openIncidentByService[svc] = incident.id;
    }
    this.persist();
    return structuredClone(incident);
  }

  addIncidentUpdate(
    incidentId: string,
    phase: IncidentPhase,
    message: string,
    at?: string,
  ): Incident | null {
    const row = this.data.incidents.find((i) => i.id === incidentId);
    if (!row) return null;
    const stamp = at || new Date().toISOString();
    row.phase = phase;
    row.updates.push({ id: randomUUID(), phase, message, at: stamp });
    if (phase === 'resolved') {
      row.resolvedAt = stamp;
      for (const svc of row.affectedServices) {
        if (this.data.openIncidentByService[svc] === row.id) {
          delete this.data.openIncidentByService[svc];
        }
      }
    }
    this.persist();
    return structuredClone(row);
  }

  getIncident(id: string): Incident | undefined {
    const row = this.data.incidents.find((i) => i.id === id);
    return row ? structuredClone(row) : undefined;
  }

  listIncidents(): Incident[] {
    return this.data.incidents.map((i) => structuredClone(i));
  }

  openIncidents(): Incident[] {
    return this.data.incidents.filter((i) => i.phase !== 'resolved').map((i) => structuredClone(i));
  }

  listMaintenance(): MaintenanceWindow[] {
    return this.data.maintenance.map((m) => structuredClone(m));
  }

  addMaintenance(window: MaintenanceWindow): void {
    this.data.maintenance.push(window);
    this.persist();
  }

  updateMaintenance(window: MaintenanceWindow): void {
    const idx = this.data.maintenance.findIndex((m) => m.id === window.id);
    if (idx >= 0) this.data.maintenance[idx] = window;
    this.persist();
  }

  serviceHealthMap(): Array<{ id: string; name: string; health: ServiceHealth }> {
    const out: Array<{ id: string; name: string; health: ServiceHealth }> = [];
    for (const ep of this.data.endpoints) {
      const streak = this.data.failureStreak[ep.id] || 0;
      let health: ServiceHealth = 'unknown';
      const last = this.data.pings.find((p) => p.endpointId === ep.id);
      if (last) health = last.ok && streak === 0 ? 'up' : streak > 0 ? 'down' : last.ok ? 'up' : 'down';
      out.push({ id: ep.id, name: ep.name, health });
    }
    return out;
  }

  computeDailyUptime(days = 90): DailyUptime[] {
    const byDay = new Map<string, { ok: number; total: number }>();
    const now = Date.now();
    for (let i = 0; i < days; i++) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      byDay.set(d, { ok: 0, total: 0 });
    }
    for (const ping of this.data.pings) {
      const key = dayKey(ping.at);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (ping.ok) bucket.ok += 1;
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        okChecks: v.ok,
        totalChecks: v.total,
        uptimePct: v.total === 0 ? 100 : pct(v.ok, v.total),
      }));
  }

  uptime90d(): number {
    const daily = this.computeDailyUptime(90);
    let ok = 0;
    let total = 0;
    for (const d of daily) {
      ok += d.okChecks;
      total += d.totalChecks;
    }
    return pct(ok, total);
  }

  deriveOverall(): OverallStatus {
    const now = Date.now();
    const activeMaint = this.data.maintenance.some((m) => {
      const start = Date.parse(m.startsAt);
      const end = Date.parse(m.endsAt);
      return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
    });
    if (activeMaint) return 'maintenance';
    const open = this.openIncidents();
    if (open.some((i) => i.severity === 'critical' || i.severity === 'major')) return 'outage';
    if (open.length > 0) return 'degraded';
    const health = this.serviceHealthMap();
    if (health.some((h) => h.health === 'down')) return 'degraded';
    return 'operational';
  }

  snapshot(): StatusSnapshot {
    const open = this.openIncidents();
    const recent = this.listIncidents().slice(0, 20);
    const upcoming = this.listMaintenance()
      .filter((m) => Date.parse(m.endsAt) >= Date.now())
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return {
      product: this.data.product,
      overall: this.deriveOverall(),
      updatedAt: new Date().toISOString(),
      services: this.serviceHealthMap(),
      openIncidents: open,
      recentIncidents: recent,
      upcomingMaintenance: upcoming,
      uptime90d: this.uptime90d(),
      dailyUptime: this.computeDailyUptime(90),
    };
  }

  /** Export portable JSON for static hosting (separate from app runtime). */
  exportPublicJson(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }
}
