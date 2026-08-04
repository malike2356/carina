import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import type { GeneratedVideoItem } from './generator.js';

const STORE_FILE = 'content-calendars.json';

interface CalendarRecord {
  workspaceId: string;
  channelId: string;
  items: GeneratedVideoItem[];
}

function emptyStore(): CalendarRecord[] {
  return [];
}

export function saveCalendar(workspaceId: string, channelId: string, items: GeneratedVideoItem[]): void {
  const store = loadJsonStore<CalendarRecord[]>(STORE_FILE, emptyStore);
  const idx = store.findIndex((r) => r.workspaceId === workspaceId && r.channelId === channelId);
  if (idx >= 0) store[idx] = { workspaceId, channelId, items };
  else store.push({ workspaceId, channelId, items });
  saveJsonStore(STORE_FILE, store);
}

export function getCalendar(workspaceId: string, channelId: string): GeneratedVideoItem[] {
  const store = loadJsonStore<CalendarRecord[]>(STORE_FILE, emptyStore);
  return store.find((r) => r.workspaceId === workspaceId && r.channelId === channelId)?.items ?? [];
}

export function getCalendarItem(
  workspaceId: string,
  channelId: string,
  dayIndex: number,
): GeneratedVideoItem | undefined {
  return getCalendar(workspaceId, channelId).find((item) => item.dayIndex === dayIndex);
}
