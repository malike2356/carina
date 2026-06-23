import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import {
  createTarget,
  getTargetForAccount,
  queueScanRun,
  getScanRunByIdOnly,
  listFindingsForScanRun,
} from './store.js';
import type { Finding, ScanRun } from './types.js';

const FREE_SCAN_EMAIL = 'free-scan@system.scout.internal';
let cachedAccountId: string | null = null;

export async function ensureFreeScanAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId;

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM accounts WHERE email = $1`,
    [FREE_SCAN_EMAIL],
  );
  if (existing.rows[0]) {
    cachedAccountId = existing.rows[0].id;
    return cachedAccountId;
  }

  const passwordHash = await bcrypt.hash(`system-${Date.now()}-free-scan`, 12);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO accounts (email, password_hash, subscription_plan)
     VALUES ($1, $2, 'scout_pro')
     RETURNING id`,
    [FREE_SCAN_EMAIL, passwordHash],
  );
  const row = inserted.rows[0];
  if (!row) throw new Error('Failed to create free scan system account');
  cachedAccountId = row.id;
  return cachedAccountId;
}

export interface FreeScanRecord {
  id: string;
  scanRunId: string;
  domain: string;
  clientIp: string | null;
  createdAt: string;
}

export async function createFreeScan(domain: string, clientIp: string): Promise<{
  scan: ScanRun;
  freeScanId: string;
}> {
  const accountId = await ensureFreeScanAccountId();

  let target = await getTargetForAccount(accountId, domain);
  if (!target) {
    target = await createTarget({
      accountId,
      target: domain,
      targetType: 'domain',
      label: 'free-scan',
    });
  }

  const scan = await queueScanRun(accountId, target.id, 'quick-scan');
  if (!scan) throw new Error('Failed to queue scan');

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO free_scans (scan_run_id, domain, client_ip)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [scan.id, domain, clientIp],
  );
  const freeScanId = inserted.rows[0]?.id;
  if (!freeScanId) throw new Error('Failed to record free scan');

  return { scan, freeScanId };
}

export async function getFreeScanByRunId(scanRunId: string): Promise<FreeScanRecord | null> {
  const result = await pool.query<{
    id: string;
    scan_run_id: string;
    domain: string;
    client_ip: string | null;
    created_at: string;
  }>(
    `SELECT id, scan_run_id, domain, client_ip, created_at
     FROM free_scans
     WHERE scan_run_id = $1`,
    [scanRunId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scanRunId: row.scan_run_id,
    domain: row.domain,
    clientIp: row.client_ip,
    createdAt: row.created_at,
  };
}

export async function getRecentFreeScanForDomain(
  domain: string,
  withinHours: number,
): Promise<FreeScanRecord | null> {
  const result = await pool.query<{
    id: string;
    scan_run_id: string;
    domain: string;
    client_ip: string | null;
    created_at: string;
  }>(
    `SELECT id, scan_run_id, domain, client_ip, created_at
     FROM free_scans
     WHERE domain = $1
       AND created_at > NOW() - ($2::text || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 1`,
    [domain, String(withinHours)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    scanRunId: row.scan_run_id,
    domain: row.domain,
    clientIp: row.client_ip,
    createdAt: row.created_at,
  };
}

export async function loadFreeScanResult(scanRunId: string): Promise<{
  scan: ScanRun;
  findings: Finding[];
  domain: string;
} | null> {
  const freeScan = await getFreeScanByRunId(scanRunId);
  if (!freeScan) return null;

  const scan = await getScanRunByIdOnly(scanRunId);
  if (!scan) return null;

  const findings = await listFindingsForScanRun(scan.accountId, scanRunId);
  return { scan, findings, domain: freeScan.domain };
}

export function summarizeFindings(findings: Finding[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  openPorts: number[];
  subdomains: string[];
  techStack: string[];
} {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const openPorts: number[] = [];
  const subdomains: string[] = [];
  const techStack: string[] = [];

  for (const f of findings) {
    counts[f.severity] += 1;
    if (f.findingType === 'open_port') {
      const port = f.rawData.port;
      if (typeof port === 'number') openPorts.push(port);
    }
    if (f.findingType === 'subdomain') {
      const sub = f.rawData.subdomain;
      if (typeof sub === 'string') subdomains.push(sub);
    }
    if (f.findingType === 'tech_stack') {
      const server = f.rawData.server;
      const powered = f.rawData.poweredBy;
      if (typeof server === 'string') techStack.push(server);
      if (typeof powered === 'string') techStack.push(powered);
    }
  }

  return {
    ...counts,
    openPorts: [...new Set(openPorts)].sort((a, b) => a - b),
    subdomains: [...new Set(subdomains)].slice(0, 20),
    techStack: [...new Set(techStack)],
  };
}
