import { pool } from '../db.js';
import { decryptSecret, encryptSecret, maskSecret } from './secret-crypto.js';
import { createConnector, hasConnector } from '../connectors/registry.js';
import type { ConnectorConfigField, ScoutFindingSeverity } from '../connectors/types.js';

const CONNECTOR_SECRET_KEYS: Record<string, string[]> = {
  sentinelone: ['apiToken'],
  crowdstrike: ['clientSecret'],
  defender: ['clientSecret'],
  wiz: ['clientSecret'],
  snyk: ['apiToken'],
  socket: ['apiKey'],
  semgrep: ['apiToken'],
  jira: ['apiToken'],
  servicenow: ['password'],
  pagerduty: ['routingKey'],
  'generic-webhook': ['authHeader'],
};

export interface ConnectorConfigRow {
  id: string;
  connector_id: string;
  account_id: string;
  config: Record<string, string>;
  enabled: boolean;
  last_health: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorRouteRow {
  id: string;
  connector_id: string;
  account_id: string;
  finding_types: string[] | null;
  min_severity: ScoutFindingSeverity;
  route_alerts: boolean;
  enabled: boolean;
  priority: number;
}

export interface ConnectorPublic {
  connector_id: string;
  enabled: boolean;
  config: Record<string, string>;
  secrets_set: Record<string, boolean>;
  last_health: string | null;
}

export interface VendorRefRow {
  scout_finding_id: string;
  connector_id: string;
  account_id: string;
  vendor_id: string;
  vendor_url: string | null;
  pushed_at: string;
}

function isMaskedSecret(value: string): boolean {
  return value === '********' || /^\S{1,4}\.\.\.\S{1,4}$/.test(value);
}

export function getConnectorSecretKeys(connectorId: string): string[] {
  return CONNECTOR_SECRET_KEYS[connectorId] ?? [];
}

function encryptConnectorConfig(
  connectorId: string,
  config: Record<string, string>,
): Record<string, string> {
  const out = { ...config };
  for (const key of getConnectorSecretKeys(connectorId)) {
    const val = out[key]?.trim();
    if (val) out[key] = encryptSecret(val);
  }
  return out;
}

export function decryptConnectorConfig(
  connectorId: string,
  config: Record<string, string>,
): Record<string, string> {
  const out = { ...config };
  for (const key of getConnectorSecretKeys(connectorId)) {
    if (out[key]) out[key] = decryptSecret(out[key]);
  }
  return out;
}

function toPublic(row: ConnectorConfigRow, schema: ConnectorConfigField[]): ConnectorPublic {
  const secrets_set: Record<string, boolean> = {};
  const config: Record<string, string> = {};
  const secretKeys = getConnectorSecretKeys(row.connector_id);

  for (const field of schema) {
    const value = row.config[field.key] ?? '';
    if (secretKeys.includes(field.key)) {
      secrets_set[field.key] = Boolean(value);
      config[field.key] = value ? maskSecret(value) : '';
    } else {
      config[field.key] = value;
    }
  }

  return {
    connector_id: row.connector_id,
    enabled: row.enabled,
    config,
    secrets_set,
    last_health: row.last_health,
  };
}

export async function listConnectorConfigs(accountId: string): Promise<ConnectorPublic[]> {
  const { listConnectorDefinitions } = await import('../connectors/registry.js');
  const definitions = listConnectorDefinitions();
  const result = await pool.query<ConnectorConfigRow>(
    `SELECT id, connector_id, account_id, config, enabled, last_health::text, created_at::text, updated_at::text
     FROM connector_configs
     WHERE account_id = $1`,
    [accountId],
  );
  const byId = new Map(result.rows.map((row) => [row.connector_id, row]));

  return definitions.map((definition) => {
    const row = byId.get(definition.id);
    if (!row) {
      return {
        connector_id: definition.id,
        enabled: false,
        config: Object.fromEntries(
          definition.configSchema.map((field) => [field.key, field.default ?? '']),
        ),
        secrets_set: Object.fromEntries(
          getConnectorSecretKeys(definition.id).map((key) => [key, false]),
        ),
        last_health: null,
      };
    }
    return toPublic(
      {
        ...row,
        config: (row.config ?? {}) as Record<string, string>,
      },
      definition.configSchema,
    );
  });
}

export async function getConnectorConfig(
  accountId: string,
  connectorId: string,
): Promise<ConnectorConfigRow | null> {
  const result = await pool.query<ConnectorConfigRow>(
    `SELECT id, connector_id, account_id, config, enabled, last_health::text, created_at::text, updated_at::text
     FROM connector_configs
     WHERE account_id = $1 AND connector_id = $2
     LIMIT 1`,
    [accountId, connectorId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    config: (row.config ?? {}) as Record<string, string>,
  };
}

export async function upsertConnectorConfig(
  accountId: string,
  connectorId: string,
  input: {
    enabled?: boolean;
    config?: Record<string, string>;
  },
): Promise<ConnectorPublic> {
  if (!hasConnector(connectorId)) {
    throw new Error(`Unknown connector: ${connectorId}`);
  }

  const definition = createConnector(connectorId);
  if (!definition) throw new Error(`Connector factory missing: ${connectorId}`);

  const existing = await getConnectorConfig(accountId, connectorId);
  const merged: Record<string, string> = { ...(existing?.config ?? {}) };
  const secretKeys = getConnectorSecretKeys(connectorId);

  if (input.config) {
    for (const [key, value] of Object.entries(input.config)) {
      if (value === undefined || value === null) continue;
      const trimmed = String(value).trim();
      if (secretKeys.includes(key) && (!trimmed || isMaskedSecret(trimmed))) continue;
      if (trimmed) merged[key] = trimmed;
      else if (!secretKeys.includes(key)) merged[key] = '';
    }
  }

  const encrypted = encryptConnectorConfig(connectorId, merged);
  const enabled = input.enabled ?? existing?.enabled ?? false;

  if (existing) {
    await pool.query(
      `UPDATE connector_configs
       SET config = $3, enabled = $4, updated_at = NOW()
       WHERE account_id = $1 AND connector_id = $2`,
      [accountId, connectorId, JSON.stringify(encrypted), enabled],
    );
  } else {
    await pool.query(
      `INSERT INTO connector_configs (connector_id, account_id, config, enabled)
       VALUES ($1, $2, $3, $4)`,
      [connectorId, accountId, JSON.stringify(encrypted), enabled],
    );
  }

  await ensureDefaultRoute(accountId, connectorId, enabled);

  const configs = await listConnectorConfigs(accountId);
  const saved = configs.find((c) => c.connector_id === connectorId);
  if (!saved) throw new Error('Connector config save failed');
  return saved;
}

async function ensureDefaultRoute(
  accountId: string,
  connectorId: string,
  enabled: boolean,
): Promise<void> {
  const existing = await pool.query(
    `SELECT id FROM connector_routes WHERE account_id = $1 AND connector_id = $2 LIMIT 1`,
    [accountId, connectorId],
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE connector_routes SET enabled = $3 WHERE account_id = $1 AND connector_id = $2`,
      [accountId, connectorId, enabled],
    );
    return;
  }

  await pool.query(
    `INSERT INTO connector_routes (
      connector_id, account_id, finding_types, min_severity, route_alerts, enabled, priority
    ) VALUES ($1, $2, NULL, 'medium', TRUE, $3, 0)`,
    [connectorId, accountId, enabled],
  );
}

export async function setConnectorEnabled(
  accountId: string,
  connectorId: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE connector_configs SET enabled = $3, updated_at = NOW()
     WHERE account_id = $1 AND connector_id = $2`,
    [accountId, connectorId, enabled],
  );
  await pool.query(
    `UPDATE connector_routes SET enabled = $3 WHERE account_id = $1 AND connector_id = $2`,
    [accountId, connectorId, enabled],
  );
}

export async function loadEnabledConnectorRoutes(accountId: string): Promise<ConnectorRouteRow[]> {
  const result = await pool.query<ConnectorRouteRow>(
    `SELECT id, connector_id, account_id, finding_types, min_severity, route_alerts, enabled, priority
     FROM connector_routes
     WHERE account_id = $1 AND enabled = TRUE
     ORDER BY priority ASC, created_at ASC`,
    [accountId],
  );
  return result.rows;
}

export async function storeVendorRef(input: {
  scoutFindingId: string;
  connectorId: string;
  accountId: string;
  vendorId: string;
  vendorUrl?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO connector_vendor_refs (
      scout_finding_id, connector_id, account_id, vendor_id, vendor_url
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (scout_finding_id, connector_id)
    DO UPDATE SET vendor_id = EXCLUDED.vendor_id, vendor_url = EXCLUDED.vendor_url, pushed_at = NOW()`,
    [
      input.scoutFindingId,
      input.connectorId,
      input.accountId,
      input.vendorId,
      input.vendorUrl ?? null,
    ],
  );
}

export async function listVendorRefs(
  scoutFindingId: string,
): Promise<VendorRefRow[]> {
  const result = await pool.query<VendorRefRow>(
    `SELECT scout_finding_id, connector_id, account_id, vendor_id, vendor_url, pushed_at::text
     FROM connector_vendor_refs
     WHERE scout_finding_id = $1`,
    [scoutFindingId],
  );
  return result.rows;
}

export async function updateConnectorHealth(
  accountId: string,
  connectorId: string,
  checkedAt: string,
): Promise<void> {
  await pool.query(
    `UPDATE connector_configs SET last_health = $3, updated_at = NOW()
     WHERE account_id = $1 AND connector_id = $2`,
    [accountId, connectorId, checkedAt],
  );
}

export async function createInitializedConnector(
  accountId: string,
  connectorId: string,
): Promise<{ connector: import('../connectors/types.js').SiemConnector; configRow: ConnectorConfigRow } | null> {
  const row = await getConnectorConfig(accountId, connectorId);
  if (!row?.enabled) return null;

  const connector = createConnector(connectorId);
  if (!connector) return null;

  const decrypted = decryptConnectorConfig(connectorId, row.config);
  await connector.init(decrypted);
  return { connector, configRow: row };
}
