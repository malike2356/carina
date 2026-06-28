import { readFile } from 'node:fs/promises';
import { pool } from '../memory/db.js';

export type HealthCheckValue = 'ok' | 'warn' | 'fail' | 'unknown';

export interface ProductionHealthPayload {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  checks: Record<string, HealthCheckValue>;
}

async function readEpochAgeSeconds(path: string): Promise<number | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const epoch = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(epoch)) return null;
    return Math.floor(Date.now() / 1000) - epoch;
  } catch {
    return null;
  }
}

export async function buildProductionHealthPayload(): Promise<ProductionHealthPayload> {
  const checks: Record<string, HealthCheckValue> = {};
  let healthy = true;

  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'fail';
    healthy = false;
  }

  const backupAge = await readEpochAgeSeconds('/var/log/verlox/backup-last-success.epoch');
  if (backupAge === null) {
    checks.backup = 'unknown';
  } else if (backupAge < 90000) {
    checks.backup = 'ok';
  } else {
    checks.backup = 'warn';
  }

  const cronAge = await readEpochAgeSeconds('/var/log/verlox/cron-heartbeat.epoch');
  if (cronAge === null) {
    checks.cron_scheduler = 'unknown';
  } else if (cronAge < 600) {
    checks.cron_scheduler = 'ok';
  } else {
    checks.cron_scheduler = 'warn';
  }

  try {
    const { readdir, stat } = await import('node:fs/promises');
    const walDir = process.env.POSTGRES_WAL_ARCHIVE_DIR?.trim() || '/var/backups/postgres/wal';
    const entries = await readdir(walDir);
    if (entries.length === 0) {
      checks.wal_archive = 'warn';
    } else {
      let newest = 0;
      for (const name of entries.slice(0, 200)) {
        const info = await stat(`${walDir}/${name}`);
        if (info.mtimeMs > newest) newest = info.mtimeMs;
      }
      const ageHours = (Date.now() - newest) / 3_600_000;
      checks.wal_archive = ageHours < 24 ? 'ok' : 'warn';
    }
  } catch {
    checks.wal_archive = 'unknown';
  }

  return {
    status: healthy ? 'ok' : 'degraded',
    service: 'carina-core',
    version: process.env.npm_package_version || process.env.CARINA_VERSION || 'unknown',
    timestamp: new Date().toISOString(),
    checks,
  };
}
