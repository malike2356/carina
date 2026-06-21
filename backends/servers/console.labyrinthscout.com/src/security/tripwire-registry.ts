import { honeypotManager } from './honeypot-manager.js';
import { pool } from '../db.js';

export type TripwireType =
  | 'honeytoken'
  | 'decoy_secret'
  | 'canary_file'
  | 'bait_endpoint'
  | 'tamper_marker';

export interface TripwireHit {
  id: string;
  type: TripwireType;
  sessionId?: string;
  instanceId?: string;
  severity: 'warning' | 'critical';
  description: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export interface TripwireConfig {
  type: TripwireType;
  enabled: boolean;
  autoQuarantine: boolean;
}

export const DEFAULT_TRIPWIRE_CONFIG: TripwireConfig[] = [
  { type: 'honeytoken', enabled: true, autoQuarantine: true },
  { type: 'decoy_secret', enabled: true, autoQuarantine: true },
  { type: 'canary_file', enabled: true, autoQuarantine: false },
  { type: 'bait_endpoint', enabled: true, autoQuarantine: true },
  { type: 'tamper_marker', enabled: true, autoQuarantine: false },
];

let config = [...DEFAULT_TRIPWIRE_CONFIG];

export function getTripwireConfig(): TripwireConfig[] {
  return [...config];
}

export function setTripwireConfig(newConfig: TripwireConfig[]): void {
  config = newConfig;
}

export function resetTripwireConfig(): void {
  config = [...DEFAULT_TRIPWIRE_CONFIG];
}

export async function recordTripwireHit(input: {
  type: TripwireType;
  sessionId?: string;
  instanceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<TripwireHit> {
  const cfg = config.find((c) => c.type === input.type);
  const severity = cfg?.autoQuarantine ? 'critical' : 'warning';

  const result = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, session_id, instance_id)
     VALUES ($1, 'tripwire', $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [
      severity,
      `tripwire_${input.type}`,
      input.description,
      JSON.stringify({ type: input.type, ...input.metadata }),
      input.sessionId ?? null,
      input.instanceId ?? null,
    ],
  );

  const row = result.rows[0];
  return {
    id: row?.id ?? 'unknown',
    type: input.type,
    sessionId: input.sessionId,
    instanceId: input.instanceId,
    severity,
    description: input.description,
    detectedAt: row ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

export async function checkHoneytoken(apiKey: string, meta: Record<string, unknown>): Promise<boolean> {
  const cfg = config.find((c) => c.type === 'honeytoken');
  if (!cfg?.enabled) return false;
  return honeypotManager.checkApiKey(apiKey, meta);
}

export async function listRecentTripwireHits(limit = 20): Promise<TripwireHit[]> {
  const result = await pool.query<{
    id: string;
    event_type: string;
    description: string;
    severity: string;
    session_id: string | null;
    instance_id: string | null;
    metadata: Record<string, unknown> | string | null;
    created_at: Date;
  }>(
    `SELECT id, event_type, description, severity, session_id, instance_id, metadata, created_at
     FROM security_events
     WHERE source = 'tripwire' OR event_type LIKE 'tripwire_%' OR event_type LIKE 'honeypot_%'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => {
    const meta = typeof row.metadata === 'object' && row.metadata !== null
      ? row.metadata as Record<string, unknown>
      : {};
    const type = (typeof meta.type === 'string' ? meta.type : row.event_type.replace(/^tripwire_/, '')) as TripwireType;
    return {
      id: row.id,
      type,
      sessionId: row.session_id ?? undefined,
      instanceId: row.instance_id ?? undefined,
      severity: row.severity === 'critical' ? 'critical' : 'warning',
      description: row.description,
      detectedAt: new Date(row.created_at).toISOString(),
      metadata: meta,
    };
  });
}
