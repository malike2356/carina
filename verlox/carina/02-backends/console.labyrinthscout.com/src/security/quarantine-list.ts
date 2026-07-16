import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { setShieldMode } from './session-shield.js';
import type { ShieldModeState } from './policy-decisions.js';

const QUARANTINE_KEY_PREFIX = 'scout:quarantine:';
const SHIELD_KEY_PREFIX = 'scout:shield:';

const VALID_TOOLS = new Set([
  'web-search',
  'file-read',
  'file-write',
  'shell-exec',
  'http-request',
  'email-send',
  'code-exec',
]);

export interface QuarantineListEntry {
  id: string;
  entity: string;
  type: 'tool' | 'session';
  reason: string;
  created_at: string | null;
  quarantined_at: string | null;
  instance_id: string | null;
}

export interface QuarantineListResult {
  quarantined: QuarantineListEntry[];
  released_7d: number;
}

function parseToolKey(key: string): { instanceId: string; tool: string } | null {
  if (!key.startsWith(QUARANTINE_KEY_PREFIX)) return null;
  const rest = key.slice(QUARANTINE_KEY_PREFIX.length);
  const splitAt = rest.indexOf(':');
  if (splitAt <= 0) return null;
  const instanceId = rest.slice(0, splitAt);
  const tool = rest.slice(splitAt + 1);
  if (!VALID_TOOLS.has(tool)) return null;
  return { instanceId, tool };
}

async function countReleasedLast7Days(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM security_events
     WHERE event_type IN ('tool_quarantine_lifted', 'session_quarantine_lifted')
       AND created_at > NOW() - INTERVAL '7 days'`,
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function listQuarantineEntries(): Promise<QuarantineListResult> {
  const quarantined: QuarantineListEntry[] = [];
  const redis = getRedis();

  if (redis) {
    const toolKeys = await redis.keys(`${QUARANTINE_KEY_PREFIX}*`);
    for (const key of toolKeys) {
      const parsed = parseToolKey(key);
      if (!parsed) continue;
      const ttl = await redis.ttl(key);
      if (ttl <= 0) continue;
      const reason = (await redis.get(key)) ?? 'Tool quarantined';
      quarantined.push({
        id: `tool:${parsed.instanceId}:${parsed.tool}`,
        entity: `${parsed.instanceId}:${parsed.tool}`,
        type: 'tool',
        reason,
        created_at: null,
        quarantined_at: null,
        instance_id: parsed.instanceId,
      });
    }

    const shieldKeys = await redis.keys(`${SHIELD_KEY_PREFIX}*`);
    for (const key of shieldKeys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      let state: ShieldModeState;
      try {
        state = JSON.parse(raw) as ShieldModeState;
      } catch {
        continue;
      }
      if (state.mode !== 'quarantine') continue;
      quarantined.push({
        id: `session:${state.sessionId}`,
        entity: state.sessionId,
        type: 'session',
        reason: state.reason ?? 'Session quarantined',
        created_at: state.changedAt ?? null,
        quarantined_at: state.changedAt ?? null,
        instance_id: null,
      });
    }
  }

  const released_7d = await countReleasedLast7Days().catch(() => 0);
  quarantined.sort((a, b) => {
    const aTs = a.quarantined_at ? Date.parse(a.quarantined_at) : 0;
    const bTs = b.quarantined_at ? Date.parse(b.quarantined_at) : 0;
    return bTs - aTs;
  });

  return { quarantined, released_7d };
}

export async function releaseQuarantineEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: 'id is required' };

  if (trimmed.startsWith('tool:')) {
    const parts = trimmed.split(':');
    if (parts.length !== 3) return { ok: false, error: 'Invalid tool quarantine id' };
    const instanceId = parts[1]!;
    const tool = parts[2]!;
    if (!VALID_TOOLS.has(tool)) return { ok: false, error: 'Unknown tool' };

    const redis = getRedis();
    if (redis) {
      await redis.del(`${QUARANTINE_KEY_PREFIX}${instanceId}:${tool}`);
    }

    await publishControlMessage({
      action: 'lift_quarantine',
      tool,
      instance_id: instanceId,
      timestamp: new Date().toISOString(),
    });

    await pool.query(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, instance_id)
       VALUES ('info', 'scout-api', 'tool_quarantine_lifted', $1, $2, $3)`,
      [
        `Quarantine released by operator: ${tool}`,
        JSON.stringify({ tool, released_via: 'quarantine_list' }),
        instanceId,
      ],
    );

    return { ok: true };
  }

  if (trimmed.startsWith('session:')) {
    const sessionId = trimmed.slice('session:'.length);
    if (!sessionId) return { ok: false, error: 'Invalid session quarantine id' };

    await setShieldMode(sessionId, 'observe', 'operator-release', 'Released from quarantine list');

    await pool.query(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, session_id)
       VALUES ('info', 'scout-api', 'session_quarantine_lifted', $1, $2, $3)`,
      [
        'Session quarantine released by operator',
        JSON.stringify({ session_id: sessionId, released_via: 'quarantine_list' }),
        sessionId,
      ],
    );

    return { ok: true };
  }

  return { ok: false, error: 'Unsupported quarantine id' };
}
