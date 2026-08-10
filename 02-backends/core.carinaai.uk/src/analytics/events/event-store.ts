/**
 * Monthly-partitioned analytics event store (JSON files under CARINA_HOME/analytics/events/).
 * Shape is ready to swap to Postgres PARTITION BY RANGE (month) later.
 */

import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import { monthPartitionKey, type AnalyticsEvent } from './event-schema.js';

const partitionCache = new Map<string, AnalyticsEvent[]>();

function eventsDir(): string {
  return path.join(resolveCarinaHome(), 'analytics', 'events');
}

function partitionPath(monthKey: string): string {
  return path.join(eventsDir(), `events-${monthKey}.json`);
}

export function resetEventStoreCache(): void {
  partitionCache.clear();
}

function loadPartition(monthKey: string): AnalyticsEvent[] {
  if (partitionCache.has(monthKey)) return partitionCache.get(monthKey)!;
  const file = partitionPath(monthKey);
  if (!fs.existsSync(file)) {
    const empty: AnalyticsEvent[] = [];
    partitionCache.set(monthKey, empty);
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { events?: AnalyticsEvent[] };
    const events = Array.isArray(raw.events) ? raw.events : [];
    partitionCache.set(monthKey, events);
    return events;
  } catch {
    const empty: AnalyticsEvent[] = [];
    partitionCache.set(monthKey, empty);
    return empty;
  }
}

function savePartition(monthKey: string, events: AnalyticsEvent[]): void {
  fs.mkdirSync(eventsDir(), { recursive: true });
  fs.writeFileSync(partitionPath(monthKey), JSON.stringify({ month: monthKey, events }, null, 2));
  partitionCache.set(monthKey, events);
}

export function appendEvents(events: AnalyticsEvent[]): number {
  if (events.length === 0) return 0;
  const byMonth = new Map<string, AnalyticsEvent[]>();
  for (const evt of events) {
    const key = monthPartitionKey(evt.timestamp);
    const list = byMonth.get(key) ?? [];
    list.push(evt);
    byMonth.set(key, list);
  }
  let written = 0;
  for (const [monthKey, batch] of byMonth) {
    const existing = loadPartition(monthKey);
    existing.push(...batch);
    savePartition(monthKey, existing);
    written += batch.length;
  }
  return written;
}

export function listMonthKeys(): string[] {
  const dir = eventsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => {
      const m = /^events-(\d{4}-\d{2})\.json$/.exec(name);
      return m?.[1];
    })
    .filter((v): v is string => Boolean(v))
    .sort();
}

export function listEventsInRange(opts: {
  workspaceId: string;
  from: string;
  to: string;
  userId?: string;
  eventName?: string;
}): AnalyticsEvent[] {
  const fromMs = Date.parse(opts.from);
  const toMs = Date.parse(opts.to);
  const fromMonth = monthPartitionKey(opts.from);
  const toMonth = monthPartitionKey(opts.to);
  const months = listMonthKeys().filter((m) => m >= fromMonth && m <= toMonth);
  // Also include empty months in range that may not exist yet: walk from/to
  const needed = new Set(months);
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    needed.add(cursor);
    const [y, mo] = cursor.split('-').map(Number) as [number, number];
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    cursor = next;
  }
  const out: AnalyticsEvent[] = [];
  for (const month of [...needed].sort()) {
    for (const evt of loadPartition(month)) {
      if (evt.workspaceId !== opts.workspaceId) continue;
      const t = Date.parse(evt.timestamp);
      if (!Number.isFinite(t) || t < fromMs || t > toMs) continue;
      if (opts.userId && evt.userId !== opts.userId) continue;
      if (opts.eventName && evt.eventName !== opts.eventName) continue;
      out.push(evt);
    }
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function countEventsFast(workspaceId: string, from: string, to: string): number {
  return listEventsInRange({ workspaceId, from, to }).length;
}
