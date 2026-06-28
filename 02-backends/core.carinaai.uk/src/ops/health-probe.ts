import { pool } from '../memory/db.js';

const PROBE_TARGETS = [
  { label: 'platform_api', url: 'https://api.carinaai.uk/api/v1/platform/health' },
  { label: 'core_api',     url: 'https://core.carinaai.uk/api/health' },
  { label: 'app_frontend', url: 'https://app.carinaai.uk/api/health' },
];

export async function runHealthProbe(): Promise<void> {
  for (const target of PROBE_TARGETS) {
    const start = Date.now();
    let statusCode: number | null = null;
    let healthy = false;
    let error: string | null = null;
    try {
      const res = await fetch(target.url, { signal: AbortSignal.timeout(5000) });
      statusCode = res.status;
      healthy = res.ok;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const latencyMs = Date.now() - start;
    await pool.query(
      `INSERT INTO platform_health_checks
         (endpoint, status_code, latency_ms, healthy, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [target.label, statusCode, latencyMs, healthy, error],
    );
  }
}

export interface SlaReport {
  month: string;
  totalChecks: number;
  unhealthyChecks: number;
  uptimePercent: number;
  slaBreach: boolean;
  downtimeMinutes: number;
  creditDuePartners: Array<{ partnerId: string; partnerName: string; creditPence: number }>;
}

const SLA_THRESHOLD_MINUTES = 527; // 8.77 hours = 99.9% of 30 days
const CREDIT_PENCE_PER_HOUR = 500; // GBP 5 per hour beyond threshold

export async function calculateSlaReport(month: string): Promise<SlaReport> {
  const [year, mon] = month.split('-').map(Number);
  const fromDate = new Date(year, mon - 1, 1).toISOString();
  const toDate = new Date(year, mon, 1).toISOString();

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE endpoint = 'platform_api')                        AS total_checks,
       COUNT(*) FILTER (WHERE endpoint = 'platform_api' AND healthy = false)    AS unhealthy_checks
     FROM platform_health_checks
     WHERE checked_at >= $1 AND checked_at < $2`,
    [fromDate, toDate],
  );

  const row = result.rows[0] as Record<string, unknown>;
  const totalChecks = Number(row.total_checks ?? 0);
  const unhealthyChecks = Number(row.unhealthy_checks ?? 0);
  const uptimePercent = totalChecks > 0
    ? ((totalChecks - unhealthyChecks) / totalChecks) * 100
    : 100;
  const slaBreach = uptimePercent < 99.9;
  const downtimeMinutes = unhealthyChecks;
  const creditPence = slaBreach
    ? Math.max(0, Math.floor((downtimeMinutes - SLA_THRESHOLD_MINUTES) / 60 * CREDIT_PENCE_PER_HOUR))
    : 0;

  let creditDuePartners: SlaReport['creditDuePartners'] = [];
  if (slaBreach && creditPence > 0) {
    const partners = await pool.query(
      `SELECT id, name FROM partner_accounts WHERE status = 'active' ORDER BY name`,
    );
    creditDuePartners = (partners.rows as Array<{ id: string; name: string }>).map((p) => ({
      partnerId: p.id,
      partnerName: p.name,
      creditPence,
    }));
  }

  return { month, totalChecks, unhealthyChecks, uptimePercent, slaBreach, downtimeMinutes, creditDuePartners };
}

export interface ServiceStatusRow {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptimePct: number;
}

let statusCache: { data: { services: ServiceStatusRow[]; sla: string; checkedAt: string }; expiresAt: number } | null = null;

export function clearStatusCacheForTesting(): void {
  statusCache = null;
}

export async function getPlatformStatus(): Promise<{ services: ServiceStatusRow[]; sla: string; checkedAt: string }> {
  const now = Date.now();
  if (statusCache && statusCache.expiresAt > now) return statusCache.data;

  const LABELS = [
    { endpoint: 'platform_api', name: 'Platform API' },
    { endpoint: 'core_api',     name: 'Core API' },
    { endpoint: 'app_frontend', name: 'App Frontend' },
  ];

  const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = await pool.query(
    `SELECT endpoint,
       COUNT(*)                            AS total,
       COUNT(*) FILTER (WHERE healthy)     AS healthy_count
     FROM platform_health_checks
     WHERE checked_at >= $1
     GROUP BY endpoint`,
    [since],
  );

  const rowMap = new Map<string, { total: number; healthy: number }>();
  for (const r of result.rows as Array<{ endpoint: string; total: string; healthy_count: string }>) {
    rowMap.set(r.endpoint, { total: Number(r.total), healthy: Number(r.healthy_count) });
  }

  const services: ServiceStatusRow[] = LABELS.map(({ endpoint, name }) => {
    const row = rowMap.get(endpoint);
    if (!row || row.total === 0) return { name, status: 'operational', uptimePct: 100 };
    const uptimePct = parseFloat(((row.healthy / row.total) * 100).toFixed(2));
    const status: ServiceStatusRow['status'] = uptimePct >= 99.5 ? 'operational' : uptimePct >= 95 ? 'degraded' : 'outage';
    return { name, status, uptimePct };
  });

  const data = { services, sla: '99.9%', checkedAt: new Date().toISOString() };
  statusCache = { data, expiresAt: now + 60_000 };
  return data;
}
