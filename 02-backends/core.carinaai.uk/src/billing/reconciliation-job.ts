import { pool } from '../memory/db.js';

export interface ReconciliationDriftRow {
  orgId: string;
  ledgerProviderCostUsd: number;
  modelUsageCostUsd: number;
  driftPercent: number;
}

export interface ReconciliationReport {
  month: string;
  driftThresholdPercent: number;
  rows: ReconciliationDriftRow[];
}

export const DRIFT_THRESHOLD_PERCENT = 5;

export function computeDriftPercent(
  ledgerProviderCostUsd: number,
  modelUsageCostUsd: number,
): number {
  const baseline = Math.max(ledgerProviderCostUsd, modelUsageCostUsd, 0.000001);
  return Math.abs(ledgerProviderCostUsd - modelUsageCostUsd) / baseline * 100;
}

export function buildReconciliationRows(input: {
  ledgerByOrg: Map<string, number>;
  usageByOrg: Map<string, number>;
  thresholdPercent?: number;
}): ReconciliationDriftRow[] {
  const threshold = input.thresholdPercent ?? DRIFT_THRESHOLD_PERCENT;
  const orgIds = new Set([...input.ledgerByOrg.keys(), ...input.usageByOrg.keys()]);
  const rows: ReconciliationDriftRow[] = [];

  for (const orgId of orgIds) {
    const ledgerProviderCostUsd = input.ledgerByOrg.get(orgId) ?? 0;
    const modelUsageCostUsd = input.usageByOrg.get(orgId) ?? 0;
    const driftPercent = computeDriftPercent(ledgerProviderCostUsd, modelUsageCostUsd);
    if (driftPercent > threshold) {
      rows.push({
        orgId,
        ledgerProviderCostUsd,
        modelUsageCostUsd,
        driftPercent: Math.round(driftPercent * 10) / 10,
      });
    }
  }

  return rows.sort((a, b) => b.driftPercent - a.driftPercent);
}

export function logReconciliationReport(report: ReconciliationReport): void {
  for (const row of report.rows) {
    console.warn(
      `[reconciliation] org ${row.orgId} provider cost drift ${row.driftPercent.toFixed(1)}% `
      + `(ledger $${row.ledgerProviderCostUsd.toFixed(4)} vs model_usage $${row.modelUsageCostUsd.toFixed(4)})`,
    );
  }
  if (report.rows.length === 0) {
    console.log(`[reconciliation] ${report.month}: no drift above ${report.driftThresholdPercent}%`);
  } else {
    console.warn(
      `[reconciliation] ${report.month}: ${report.rows.length} org(s) above ${report.driftThresholdPercent}% drift`,
    );
  }
}

export async function reconcileLedgerVsModelUsage(
  orgId?: string,
): Promise<ReconciliationReport> {
  const month = new Date().toISOString().slice(0, 7);
  const params: unknown[] = [];
  let orgFilter = '';
  if (orgId) {
    orgFilter = 'AND l.org_id = $1';
    params.push(orgId);
  }

  const ledgerResult = await pool.query<{ org_id: string; total: string }>(
    `SELECT l.org_id, COALESCE(SUM(l.provider_cost_usd), 0)::TEXT AS total
     FROM ops_credit_ledger l
     WHERE l.created_at >= date_trunc('month', NOW())
       AND l.event_type IN ('usage', 'byok_usage')
       ${orgFilter}
     GROUP BY l.org_id`,
    params,
  );

  const usageResult = await pool.query<{ org_id: string; total: string }>(
    `SELECT o.id AS org_id, COALESCE(SUM(mu.estimated_cost), 0)::TEXT AS total
     FROM organizations o
     JOIN hosted_users hu ON hu.id = o.owner_user_id
     JOIN model_usage mu ON mu.session_id LIKE hu.id || '%'
       OR mu.session_id = hu.id
     WHERE mu.created_at >= date_trunc('month', NOW())
       ${orgId ? 'AND o.id = $1' : ''}
     GROUP BY o.id`,
    orgId ? [orgId] : [],
  );

  const ledgerByOrg = new Map(ledgerResult.rows.map((row) => [
    String(row.org_id),
    Number(row.total),
  ]));
  const usageByOrg = new Map(usageResult.rows.map((row) => [
    String(row.org_id),
    Number(row.total),
  ]));

  const rows = buildReconciliationRows({ ledgerByOrg, usageByOrg });

  return {
    month,
    driftThresholdPercent: DRIFT_THRESHOLD_PERCENT,
    rows,
  };
}

export async function runBillingReconciliation(orgId?: string): Promise<ReconciliationReport> {
  const report = await reconcileLedgerVsModelUsage(orgId);
  logReconciliationReport(report);
  return report;
}
