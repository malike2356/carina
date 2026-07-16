/**
 * Protect telemetry schema v1 (AI Security OS prompt 08).
 * PII minimization: no passwords, tokens, email bodies, or full file contents.
 */

export const TELEMETRY_SCHEMA_VERSION = 'protect.telemetry.v1';

export const TELEMETRY_EVENT_TYPES = [
  'asset.heartbeat',
  'process.exec',
  'net.conn',
  'auth.session',
  'file.integrity',
  'agent.health',
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export type TelemetryEnvelope = {
  schema_version: typeof TELEMETRY_SCHEMA_VERSION;
  tenant_id: string;
  sensor_id: string;
  event_type: TelemetryEventType;
  occurred_at: string;
  payload: Record<string, unknown>;
};

const FORBIDDEN_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'email_body',
  'file_content',
  'private_key',
]);

export type TelemetryValidationResult =
  | { ok: true; event: TelemetryEnvelope }
  | { ok: false; error: string };

function isIsoDate(value: string): boolean {
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

function hasForbiddenKey(obj: Record<string, unknown>, depth = 0): string | null {
  if (depth > 4) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) return k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = hasForbiddenKey(v as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function validateTelemetryEvent(
  raw: unknown,
  opts: { tenantId: string; sensorId: string },
): TelemetryValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'event must be an object' };
  }
  const e = raw as Record<string, unknown>;

  const schema_version =
    typeof e.schema_version === 'string' ? e.schema_version : TELEMETRY_SCHEMA_VERSION;
  if (schema_version !== TELEMETRY_SCHEMA_VERSION) {
    return { ok: false, error: `unsupported schema_version (want ${TELEMETRY_SCHEMA_VERSION})` };
  }

  const event_type = typeof e.event_type === 'string'
    ? e.event_type
    : typeof e.type === 'string'
      ? e.type
      : '';
  if (!TELEMETRY_EVENT_TYPES.includes(event_type as TelemetryEventType)) {
    return {
      ok: false,
      error: `event_type must be one of: ${TELEMETRY_EVENT_TYPES.join(', ')}`,
    };
  }

  const occurred_at =
    typeof e.occurred_at === 'string'
      ? e.occurred_at
      : typeof e.timestamp === 'string'
        ? e.timestamp
        : new Date().toISOString();
  if (!isIsoDate(occurred_at)) {
    return { ok: false, error: 'occurred_at must be ISO-8601' };
  }

  const payload =
    typeof e.payload === 'object' && e.payload !== null && !Array.isArray(e.payload)
      ? (e.payload as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(e).filter(
            ([k]) =>
              ![
                'schema_version',
                'tenant_id',
                'sensor_id',
                'event_type',
                'type',
                'occurred_at',
                'timestamp',
                'payload',
              ].includes(k),
          ),
        );

  const forbidden = hasForbiddenKey(payload);
  if (forbidden) {
    return { ok: false, error: `PII/secret field not allowed: ${forbidden}` };
  }

  // Per-type required fields (minimal)
  if (event_type === 'process.exec' && typeof payload.pid !== 'number' && typeof payload.cmd !== 'string') {
    return { ok: false, error: 'process.exec requires pid or cmd' };
  }
  if (event_type === 'net.conn' && typeof payload.remote_host !== 'string' && typeof payload.remoteHost !== 'string') {
    return { ok: false, error: 'net.conn requires remote_host' };
  }
  if (event_type === 'asset.heartbeat' && payload.status == null) {
    payload.status = 'ok';
  }

  return {
    ok: true,
    event: {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      tenant_id: opts.tenantId,
      sensor_id: opts.sensorId,
      event_type: event_type as TelemetryEventType,
      occurred_at,
      payload,
    },
  };
}

/** Default retention for Protect telemetry (days). */
export const TELEMETRY_RETENTION_DAYS_DEFAULT = 90;

export const TELEMETRY_PII_RULES = [
  'No passwords, tokens, cookies, private keys, or email bodies in payload',
  'Prefer process basename over full argv when argv may contain secrets',
  'Mask user emails to local-part hash when auth.session includes identity',
  `Default retention ${TELEMETRY_RETENTION_DAYS_DEFAULT} days; board packs use further redaction`,
];
