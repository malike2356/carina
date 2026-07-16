import { config } from '../../config/index.js';
import { resolveScoutApiConfig } from '../../integrations/scout-findings-api.js';
import type { ScoutCorrelationMatch, ScoutSecurityEvent } from './types.js';

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normaliseEvent(row: Record<string, unknown>): ScoutSecurityEvent {
  return {
    id: String(row.id ?? row.event_id ?? ''),
    severity: String(row.severity ?? 'info'),
    source: String(row.source ?? 'unknown'),
    event_type: String(row.event_type ?? row.eventType ?? 'unknown'),
    description: String(row.description ?? ''),
    metadata: parseMetadata(row.metadata),
    ip_address: row.ip_address != null ? String(row.ip_address) : null,
    session_id: row.session_id != null ? String(row.session_id) : null,
    instance_id: row.instance_id != null ? String(row.instance_id) : null,
    created_at: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : new Date().toISOString(),
  };
}

async function scoutFetch<T>(path: string): Promise<T | null> {
  const scoutConfig = resolveScoutApiConfig();
  if (!scoutConfig) return null;
  try {
    const response = await fetch(`${scoutConfig.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': scoutConfig.apiKey,
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function loadLocalSignalCache(limit: number): Promise<ScoutSecurityEvent[]> {
  try {
    const { pool } = await import('../../memory/db.js');
    const instanceId = config.labyrinth.instanceId;
    const result = await pool.query<{
      id: string;
      event_type: string;
      severity: string;
      summary: string;
      metadata: unknown;
      created_at: Date;
    }>(
      `SELECT id::text, event_type, severity, summary, metadata, created_at
       FROM scout_signal_cache
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [instanceId, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      severity: row.severity,
      source: 'carina-cache',
      event_type: row.event_type,
      description: row.summary,
      metadata: parseMetadata(row.metadata),
      instance_id: instanceId,
      created_at: new Date(row.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function fetchScoutEvents(input: {
  limit?: number;
  instanceId?: string;
} = {}): Promise<ScoutSecurityEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const payload = await scoutFetch<{ events?: Array<Record<string, unknown>> }>(
    `/api/events?limit=${limit}`,
  );
  const events = (payload?.events ?? []).map(normaliseEvent);
  if (events.length > 0) {
    if (input.instanceId) {
      return events.filter((e) => e.instance_id === input.instanceId);
    }
    return events;
  }
  return loadLocalSignalCache(limit);
}

export async function fetchScoutCorrelationMatches(limit = 50): Promise<ScoutCorrelationMatch[]> {
  const payload = await scoutFetch<{ matches?: Array<Record<string, unknown>> }>(
    `/api/detections/matches?limit=${Math.min(limit, 200)}`,
  );
  if (!payload?.matches?.length) return [];
  return payload.matches.map((row) => ({
    id: String(row.id ?? ''),
    ruleId: String(row.ruleId ?? row.rule_id ?? ''),
    matchedEvents: Array.isArray(row.matchedEvents)
      ? row.matchedEvents.map(String)
      : Array.isArray(row.matched_events)
        ? row.matched_events.map(String)
        : [],
    caseId: row.caseId != null
      ? String(row.caseId)
      : row.case_id != null
        ? String(row.case_id)
        : null,
    firedAt: row.firedAt
      ? String(row.firedAt)
      : row.fired_at
        ? new Date(String(row.fired_at)).toISOString()
        : new Date().toISOString(),
  }));
}

export async function fetchEventsForCorrelation(matchId: string): Promise<{
  match: ScoutCorrelationMatch | null;
  events: ScoutSecurityEvent[];
}> {
  const matches = await fetchScoutCorrelationMatches(200);
  const match = matches.find((m) => m.id === matchId) ?? null;
  if (!match) return { match: null, events: [] };

  const allEvents = await fetchScoutEvents({ limit: 500 });
  const eventSet = new Set(match.matchedEvents);
  const events = allEvents.filter((e) => eventSet.has(e.id));
  return { match, events };
}

export async function fetchSessionEvents(sessionId: string, limit = 200): Promise<ScoutSecurityEvent[]> {
  const events = await fetchScoutEvents({ limit });
  return events.filter((e) => e.session_id === sessionId).slice(0, limit);
}

export function filterEvents(
  events: ScoutSecurityEvent[],
  filters: {
    ip?: string;
    sessionId?: string;
    eventTypeContains?: string;
    severity?: string;
    sinceMs?: number;
    instanceId?: string;
  },
): ScoutSecurityEvent[] {
  const since = filters.sinceMs ? Date.now() - filters.sinceMs : null;
  return events.filter((event) => {
    if (filters.ip && event.ip_address !== filters.ip && !event.description.includes(filters.ip)) {
      return false;
    }
    if (filters.sessionId && event.session_id !== filters.sessionId) return false;
    if (filters.instanceId && event.instance_id !== filters.instanceId) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.eventTypeContains && !event.event_type.includes(filters.eventTypeContains)) {
      return false;
    }
    if (since && new Date(event.created_at).getTime() < since) return false;
    return true;
  });
}
