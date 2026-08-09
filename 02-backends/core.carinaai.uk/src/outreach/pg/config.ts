/**
 * Outreach persistence mode.
 * - json (default): legacy $CARINA_HOME/outreach/outreach-program.json
 * - postgres: tenant-scoped tables from migration 036-outreach-program.sql
 */
export type OutreachPersistenceMode = 'json' | 'postgres';

export function getOutreachPersistenceMode(): OutreachPersistenceMode {
  const raw = (process.env.CARINA_OUTREACH_PERSISTENCE || 'json').trim().toLowerCase();
  return raw === 'postgres' || raw === 'pg' ? 'postgres' : 'json';
}

export function isOutreachPostgresEnabled(): boolean {
  return getOutreachPersistenceMode() === 'postgres';
}

/** Days to retain inbound provider message bodies before eligible purge. */
export function outreachInboundRetentionDays(): number {
  const n = Number(process.env.CARINA_OUTREACH_INBOUND_RETENTION_DAYS || 90);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}
