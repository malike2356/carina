/**
 * Durable Customer Concierge event log (Prompt 705).
 * Aggregate analytics must use these events; message bodies are redacted.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolveCarinaHome } from '../config/paths.js';
import {
  CUSTOMER_CONCIERGE_CONTRACT_VERSION,
  type ConciergeActorType,
  type ConciergeEventEnvelope,
  type ConciergeEventType,
} from './types.js';
import { redactSensitiveValue } from '../security/redaction.js';

export type ConciergeEventRecord = ConciergeEventEnvelope & {
  id: string;
  workerId?: string | null;
};

type EventStoreShape = {
  events: ConciergeEventRecord[];
};

const STORE_FILE = 'concierge-events.json';
let cache: EventStoreShape | null = null;

function storePath(): string {
  return path.join(resolveCarinaHome(), 'customer-concierge', STORE_FILE);
}

function emptyStore(): EventStoreShape {
  return { events: [] };
}

function loadStore(): EventStoreShape {
  if (cache) return cache;
  const file = storePath();
  if (!fs.existsSync(file)) {
    cache = emptyStore();
    return cache;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<EventStoreShape>;
    cache = { events: Array.isArray(raw.events) ? raw.events : [] };
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

function saveStore(store: EventStoreShape): void {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  cache = store;
}

export function resetConciergeEventStoreCache(): void {
  cache = null;
}

/** Strip message bodies and secrets from payloads before persistence. */
export function redactConciergePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = redactSensitiveValue(payload) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (/message|body|content|transcript|prompt|text/i.test(key) && typeof value === 'string') {
      out[key] = '[REDACTED_CONTENT]';
      out[`${key}Length`] = value.length;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function appendConciergeEvent(input: {
  eventType: ConciergeEventType | string;
  workspaceId: string;
  workerId?: string | null;
  conciergeId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  actorType: ConciergeActorType | 'visitor' | 'ai' | 'owner';
  actorId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}): ConciergeEventRecord {
  const store = loadStore();
  const actorMap: Record<string, ConciergeActorType> = {
    audience: 'audience',
    visitor: 'audience',
    operator: 'operator',
    owner: 'operator',
    system: 'system',
    provider: 'provider',
    ai: 'system',
  };
  const actorType = actorMap[input.actorType] ?? 'system';
  const event: ConciergeEventRecord = {
    id: crypto.randomUUID(),
    contractVersion: CUSTOMER_CONCIERGE_CONTRACT_VERSION,
    eventId: crypto.randomUUID(),
    eventType: input.eventType as ConciergeEventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    workspaceId: input.workspaceId,
    conciergeId: input.conciergeId ?? input.workerId ?? 'unknown',
    correlationId: input.correlationId ?? crypto.randomUUID(),
    causationId: input.causationId ?? 'system',
    actorType,
    actorId: input.actorId ?? null,
    payload: {
      ...redactConciergePayload(input.payload ?? {}),
      ...(input.actorType !== actorType ? { actorLabel: input.actorType } : {}),
    },
    workerId: input.workerId ?? null,
  };
  store.events.push(event);
  // Cap file growth for workstation store.
  if (store.events.length > 20_000) {
    store.events = store.events.slice(-15_000);
  }
  saveStore(store);
  return event;
}

export function listConciergeEvents(input: {
  workspaceId: string;
  workerId?: string;
  eventTypes?: string[];
  since?: string;
  until?: string;
  limit?: number;
}): ConciergeEventRecord[] {
  const sinceMs = input.since ? Date.parse(input.since) : 0;
  const untilMs = input.until ? Date.parse(input.until) : Number.POSITIVE_INFINITY;
  const types = input.eventTypes ? new Set(input.eventTypes) : null;
  return loadStore()
    .events.filter((e) => e.workspaceId === input.workspaceId)
    .filter((e) => (!input.workerId || e.workerId === input.workerId || e.conciergeId === input.workerId))
    .filter((e) => (!types || types.has(e.eventType)))
    .filter((e) => {
      const t = Date.parse(e.occurredAt);
      return t >= sinceMs && t <= untilMs;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, Math.max(1, Math.min(500, input.limit ?? 100)));
}
