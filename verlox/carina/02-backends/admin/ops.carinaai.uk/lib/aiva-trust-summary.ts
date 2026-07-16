import { query, tableExists } from './db.js';
import { readEnvValue, resolveCoreEnvPath } from './core-env.js';

export type AivaAttestationReport = {
  totalRecords: number;
  confirmed: number;
  pending: number;
  failed: number;
  coveragePercent: number;
  last24hTotal: number;
  last24hConfirmed: number;
  last24hCoverage: number;
  byWorker: Array<{
    workerId: string;
    workerName: string;
    workspaceId: string;
    workspaceName: string;
    total: number;
    confirmed: number;
    coverage: number;
  }>;
};

export type AivaTrustSummary = {
  chainAttestEnabled: boolean;
  labyrinthEnabled: boolean;
  attestation: AivaAttestationReport;
};

const EMPTY_ATTESTATION: AivaAttestationReport = {
  totalRecords: 0,
  confirmed: 0,
  pending: 0,
  failed: 0,
  coveragePercent: 0,
  last24hTotal: 0,
  last24hConfirmed: 0,
  last24hCoverage: 0,
  byWorker: [],
};

function readCoreFlag(key: string): string | null {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  return readEnvValue(resolveCoreEnvPath(), key);
}

export function readAivaTrustFlags(): Pick<AivaTrustSummary, 'chainAttestEnabled' | 'labyrinthEnabled'> {
  const chainRaw = readCoreFlag('AIVA_CHAIN_ATTEST_ENABLED');
  const labyrinthRaw = readCoreFlag('LABYRINTH_ENABLED');
  return {
    chainAttestEnabled: chainRaw !== 'false',
    labyrinthEnabled: labyrinthRaw === 'true',
  };
}

export async function queryAttestationReport(): Promise<AivaAttestationReport> {
  if (!(await tableExists('ai_worker_activity'))) {
    return { ...EMPTY_ATTESTATION, byWorker: [] };
  }

  const totals = await query(
    `SELECT
       COUNT(*)::int AS total_records,
       COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL)::int AS confirmed,
       COUNT(*) FILTER (WHERE attestation_tx IS NULL AND created_at > NOW() - INTERVAL '1 hour')::int AS pending,
       COUNT(*) FILTER (WHERE attestation_tx IS NULL AND created_at <= NOW() - INTERVAL '1 hour')::int AS failed,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h_total,
       COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours')::int AS last24h_confirmed
     FROM ai_worker_activity`,
  );
  const row = totals.rows[0] as Record<string, unknown>;
  const totalRecords = Number(row.total_records ?? 0);
  const confirmed = Number(row.confirmed ?? 0);
  const last24hTotal = Number(row.last24h_total ?? 0);
  const last24hConfirmed = Number(row.last24h_confirmed ?? 0);

  const byWorker = await query(
    `SELECT w.id AS worker_id, w.name AS worker_name, w.workspace_id,
            c.owner_name, c.owner_email,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.attestation_tx IS NOT NULL)::int AS confirmed
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     GROUP BY w.id, w.name, w.workspace_id, c.owner_name, c.owner_email
     HAVING COUNT(*) > 0
     ORDER BY (COUNT(*) FILTER (WHERE a.attestation_tx IS NOT NULL)::float / COUNT(*)) ASC
     LIMIT 20`,
  );

  return {
    totalRecords,
    confirmed,
    pending: Number(row.pending ?? 0),
    failed: Number(row.failed ?? 0),
    coveragePercent: totalRecords > 0 ? (confirmed / totalRecords) * 100 : 0,
    last24hTotal,
    last24hConfirmed,
    last24hCoverage: last24hTotal > 0 ? (last24hConfirmed / last24hTotal) * 100 : 0,
    byWorker: byWorker.rows.map((w) => {
      const total = Number(w.total ?? 0);
      const workerConfirmed = Number(w.confirmed ?? 0);
      return {
        workerId: String(w.worker_id),
        workerName: String(w.worker_name),
        workspaceId: String(w.workspace_id),
        workspaceName: String(w.owner_name || w.owner_email || w.workspace_id).slice(0, 48),
        total,
        confirmed: workerConfirmed,
        coverage: total > 0 ? workerConfirmed / total : 0,
      };
    }),
  };
}

export async function getAivaTrustSummary(): Promise<AivaTrustSummary> {
  const attestation = await queryAttestationReport();
  return {
    ...readAivaTrustFlags(),
    attestation,
  };
}
