import fs from 'node:fs';
import path from 'node:path';
import { resolveCarinaDataDir } from '../config/paths.js';
import type { PropreneurWebhookPayload } from '../workers/propreneur-event-webhook.js';

export const PROPRENEUR_EVENT_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_EVENT_SCHEMA_VERSIONS = new Set(['1.0.0']);

export type InboxEventStatus = 'pending' | 'processed' | 'retry' | 'dead';

export interface PropreneurInboxEvent {
  eventId: string;
  event: string;
  schemaVersion: string;
  tenantId: string;
  tenantSlug: string;
  workerId: string;
  resourceType: string;
  resourceId: string;
  resourceVersion: number;
  occurredAt: string;
  correlationId: string | null;
  receivedAt: string;
  status: InboxEventStatus;
  attempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  payload: Record<string, unknown>;
}

export interface PropreneurInboxStore {
  events: PropreneurInboxEvent[];
  lastEventId: string | null;
  lastReceivedAt: string | null;
}

const STORE_FILE = 'propreneur-event-inbox.json';

function storePath(): string {
  return path.join(resolveCarinaDataDir(), STORE_FILE);
}

function emptyStore(): PropreneurInboxStore {
  return { events: [], lastEventId: null, lastReceivedAt: null };
}

let memory: PropreneurInboxStore | null = null;

export function resetPropreneurEventInboxForTests(): void {
  memory = emptyStore();
  try {
    const file = storePath();
    if (fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(memory, null, 2));
    }
  } catch {
    // Best-effort disk clear for tests.
  }
}

function loadStore(): PropreneurInboxStore {
  if (memory) return memory;
  const file = storePath();
  if (!fs.existsSync(file)) {
    memory = emptyStore();
    return memory;
  }
  try {
    memory = JSON.parse(fs.readFileSync(file, 'utf8')) as PropreneurInboxStore;
    if (!Array.isArray(memory.events)) memory.events = [];
    return memory;
  } catch {
    memory = emptyStore();
    return memory;
  }
}

function saveStore(store: PropreneurInboxStore): void {
  memory = store;
  const dir = resolveCarinaDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
}

export function isSupportedEventSchemaVersion(version: string): boolean {
  return SUPPORTED_EVENT_SCHEMA_VERSIONS.has(version);
}

export type IngestResult =
  | { ok: true; duplicate: boolean; event: PropreneurInboxEvent }
  | { ok: false; reason: string };

export function ingestPropreneurWebhookEvent(
  payload: PropreneurWebhookPayload & Record<string, unknown>,
): IngestResult {
  let eventId = String(
    payload.event_id ?? payload.eventId ?? (payload.data as { event_id?: string } | undefined)?.event_id ?? '',
  ).trim();
  // Legacy notifications (e.g. email_processed) may omit event_id; synthesize a stable-enough id.
  if (!eventId) {
    const stamp = String(payload.occurredAt ?? payload.occurred_at ?? Date.now());
    eventId = `legacy:${payload.event}:${payload.tenantSlug}:${payload.workerId}:${stamp}`;
  }

  const schemaVersion = String(
    payload.schema_version ?? payload.schemaVersion ?? PROPRENEUR_EVENT_SCHEMA_VERSION,
  ).trim();
  if (!isSupportedEventSchemaVersion(schemaVersion)) {
    return { ok: false, reason: 'unsupported_schema_version' };
  }

  const store = loadStore();
  const existing = store.events.find((e) => e.eventId === eventId);
  if (existing) {
    return { ok: true, duplicate: true, event: existing };
  }

  const now = new Date().toISOString();
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const event: PropreneurInboxEvent = {
    eventId,
    event: String(payload.event ?? ''),
    schemaVersion,
    tenantId: String(payload.tenantId ?? payload.tenant_id ?? ''),
    tenantSlug: String(payload.tenantSlug ?? ''),
    workerId: String(payload.workerId ?? ''),
    resourceType: String(payload.resource_type ?? data.resource_type ?? 'unknown'),
    resourceId: String(payload.resource_id ?? data.resource_id ?? ''),
    resourceVersion: Number(payload.resource_version ?? data.resource_version ?? 1) || 1,
    occurredAt: String(payload.occurredAt ?? payload.occurred_at ?? now),
    correlationId: payload.correlation_id
      ? String(payload.correlation_id)
      : payload.correlationId
        ? String(payload.correlationId)
        : null,
    receivedAt: now,
    status: 'pending',
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    payload: { ...payload },
  };

  store.events.push(event);
  if (store.events.length > 5000) {
    store.events = store.events.slice(-4000);
  }
  store.lastEventId = eventId;
  store.lastReceivedAt = now;
  saveStore(store);
  return { ok: true, duplicate: false, event };
}

export function markInboxEventProcessed(eventId: string): void {
  const store = loadStore();
  const row = store.events.find((e) => e.eventId === eventId);
  if (!row) return;
  row.status = 'processed';
  row.lastError = null;
  saveStore(store);
}

export function markInboxEventRetry(eventId: string, error: string, maxAttempts = 8): void {
  const store = loadStore();
  const row = store.events.find((e) => e.eventId === eventId);
  if (!row) return;
  row.attempts += 1;
  row.lastError = error.slice(0, 2000);
  if (row.attempts >= maxAttempts) {
    row.status = 'dead';
    row.nextRetryAt = null;
  } else {
    row.status = 'retry';
    const backoffMs = Math.min(3_600_000, 2 ** Math.min(10, row.attempts) * 1000);
    const jitter = Math.floor(Math.random() * 500);
    row.nextRetryAt = new Date(Date.now() + backoffMs + jitter).toISOString();
  }
  saveStore(store);
}

/** Stub: enqueue a missing event for replay by id (operator tooling). */
export function enqueueMissingEventReplay(eventId: string): {
  ok: true;
  stub: true;
  eventId: string;
  message: string;
} {
  return {
    ok: true,
    stub: true,
    eventId,
    message: `Replay stub accepted for ${eventId}; wire to Propreneur outbox fetch in a later pass.`,
  };
}

export interface PropreneurSyncHealth {
  lastEventId: string | null;
  lastReceivedAt: string | null;
  lagSeconds: number | null;
  pendingCount: number;
  retryCount: number;
  deadLetterCount: number;
  schemaVersion: string;
}

export function getPropreneurSyncHealth(): PropreneurSyncHealth {
  const store = loadStore();
  const pendingCount = store.events.filter((e) => e.status === 'pending').length;
  const retryCount = store.events.filter((e) => e.status === 'retry').length;
  const deadLetterCount = store.events.filter((e) => e.status === 'dead').length;
  let lagSeconds: number | null = null;
  if (store.lastReceivedAt) {
    lagSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(store.lastReceivedAt)) / 1000));
  }
  return {
    lastEventId: store.lastEventId,
    lastReceivedAt: store.lastReceivedAt,
    lagSeconds,
    pendingCount,
    retryCount,
    deadLetterCount,
    schemaVersion: PROPRENEUR_EVENT_SCHEMA_VERSION,
  };
}
