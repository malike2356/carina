import { pool } from '../memory/db.js';
import { config } from '../config/index.js';

export interface TenantScoutCredentials {
  apiKey: string;
  instanceId: string;
  instanceName: string;
  plan: string;
  status: string;
}

export function maskScoutKey(key: string): string {
  if (!key || key.length < 12) return '***';
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

export async function getTenantScoutSubscription(tenantId: string): Promise<{
  plan: string;
  status: string;
  scoutApiKey: string | null;
} | null> {
  const result = await pool.query<{
    plan: string;
    status: string;
    scout_api_key: string | null;
  }>(
    `SELECT plan, status, scout_api_key
     FROM subscriptions
     WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    plan: row.plan,
    status: row.status,
    scoutApiKey: row.scout_api_key,
  };
}

export async function getTenantScoutCredentials(
  tenantId: string,
  email?: string,
): Promise<TenantScoutCredentials | null> {
  const sub = await getTenantScoutSubscription(tenantId);
  if (!sub?.scoutApiKey) return null;
  if (sub.status === 'canceled' || sub.plan === 'free') return null;

  const scoutUrl = config.labyrinth.url || process.env.LABYRINTH_URL || '';
  if (!scoutUrl) return null;

  return {
    apiKey: sub.scoutApiKey,
    instanceId: `hosted:${tenantId}`,
    instanceName: email ? `Carina Cloud (${email})` : `Carina Cloud (${tenantId.slice(0, 8)})`,
    plan: sub.plan,
    status: sub.status,
  };
}

export function scoutServiceUrl(): string {
  return (config.labyrinth.url || process.env.LABYRINTH_URL || '').replace(/\/+$/, '');
}
