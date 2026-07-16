import crypto from 'node:crypto';
import { pool } from '../db.js';

export type BoardPackOptions = {
  accountId: string;
  days?: number;
  /** Fixed clock for deterministic fixtures */
  generatedAt?: string;
};

export type BoardPack = {
  schema_version: 'protect.board_pack.v1';
  generated_at: string;
  account_id: string;
  window_days: number;
  coverage: {
    sensors_total: number;
    sensors_healthy: number;
    healthy_pct: number;
  };
  metrics: {
    mttd_minutes: number | null;
    mttr_minutes: number | null;
    note: string;
  };
  top_incidents: Array<Record<string, unknown>>;
  containment_actions: Array<Record<string, unknown>>;
  policy_denials: Array<Record<string, unknown>>;
  attestations: Array<Record<string, unknown>>;
  chain_of_custody: {
    pack_content_hash: string;
    redaction: string[];
    retention_days_default: number;
  };
};

function redactHost(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Keep shape, drop last DNS label detail for board packs
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    const parts = value.split('.');
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return value.replace(/([a-z0-9-]+)\.([a-z0-9.-]+)$/i, '*.$2');
}

export async function buildProtectBoardPack(opts: BoardPackOptions): Promise<BoardPack> {
  const days = opts.days ?? 30;
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const accountId = opts.accountId;

  const sensors = await pool.query<{ id: string; last_seen_at: Date | null }>(
    `SELECT id, last_seen_at FROM sensor_keys WHERE account_id = $1 AND active = true`,
    [accountId],
  );
  const now = new Date(generatedAt).getTime();
  const healthy = sensors.rows.filter((s) => {
    if (!s.last_seen_at) return false;
    return now - new Date(s.last_seen_at).getTime() < 5 * 60 * 1000;
  }).length;

  const containments = await pool.query(
    `SELECT id, command_type, status, payload, soft_wall_id, created_at
     FROM protect_control_commands
     WHERE account_id = $1
       AND created_at >= NOW() - ($2::text || ' days')::interval
     ORDER BY created_at DESC
     LIMIT 50`,
    [accountId, String(days)],
  );

  const denials = await pool.query(
    `SELECT id, event_type, severity, description, created_at, metadata
     FROM security_events
     WHERE source IN ('protect', 'scout-api', 'policy')
       AND (
         event_type IN ('soft_wall_decision', 'protect_contain', 'policy_blocked', 'session_blocked')
         OR description ILIKE '%den%' OR description ILIKE '%block%'
       )
       AND created_at >= NOW() - ($1::text || ' days')::interval
       AND (
         metadata->>'account_id' = $2
         OR metadata->'account_id' IS NULL
       )
     ORDER BY created_at DESC
     LIMIT 50`,
    [String(days), accountId],
  );

  const incidents = await pool.query(
    `SELECT id, event_type, severity, description, created_at, session_id, instance_id
     FROM security_events
     WHERE severity IN ('critical', 'breach')
       AND created_at >= NOW() - ($1::text || ' days')::interval
       AND (metadata->>'account_id' = $2 OR metadata->'account_id' IS NULL)
     ORDER BY created_at DESC
     LIMIT 20`,
    [String(days), accountId],
  );

  const attestations = await pool.query(
    `SELECT a.id, a.event_id, a.event_type, a.severity, a.content_hash, a.chain_hash, a.attested_at
     FROM critical_event_attestations a
     JOIN security_events e ON e.id = a.event_id
     WHERE a.attested_at >= NOW() - ($1::text || ' days')::interval
       AND (e.metadata->>'account_id' = $2 OR e.metadata->'account_id' IS NULL)
     ORDER BY a.attested_at DESC
     LIMIT 50`,
    [String(days), accountId],
  );

  const bodyWithoutHash = {
    schema_version: 'protect.board_pack.v1' as const,
    generated_at: generatedAt,
    account_id: accountId,
    window_days: days,
    coverage: {
      sensors_total: sensors.rows.length,
      sensors_healthy: healthy,
      healthy_pct:
        sensors.rows.length > 0 ? Math.round((healthy / sensors.rows.length) * 100) : 0,
    },
    metrics: {
      mttd_minutes: null as number | null,
      mttr_minutes: null as number | null,
      note: 'MTTD/MTTR filled when incident detect/respond timestamps exist (prompt 20).',
    },
    top_incidents: incidents.rows.map((r) => ({
      id: r.id,
      event_type: r.event_type,
      severity: r.severity,
      description: String(r.description).slice(0, 200),
      created_at: new Date(r.created_at).toISOString(),
    })),
    containment_actions: containments.rows.map((r) => ({
      id: r.id,
      command_type: r.command_type,
      status: r.status,
      target: redactHost((r.payload as { targetResource?: string })?.targetResource),
      soft_wall_id: r.soft_wall_id,
      created_at: new Date(r.created_at).toISOString(),
    })),
    policy_denials: denials.rows.map((r) => ({
      id: r.id,
      event_type: r.event_type,
      severity: r.severity,
      description: String(r.description).slice(0, 200),
      created_at: new Date(r.created_at).toISOString(),
    })),
    attestations: attestations.rows.map((r) => ({
      id: r.id,
      event_id: r.event_id,
      event_type: r.event_type,
      content_hash: r.content_hash,
      chain_hash: r.chain_hash,
      attested_at: new Date(r.attested_at).toISOString(),
    })),
  };

  const pack_content_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(bodyWithoutHash))
    .digest('hex');

  return {
    ...bodyWithoutHash,
    chain_of_custody: {
      pack_content_hash,
      redaction: [
        'IPv4 last two octets masked',
        'Hostname left-most label replaced with *',
        'MDR internal notes never included',
        'Raw process command lines omitted from board pack',
      ],
      retention_days_default: 365,
    },
  };
}
