import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { OutreachStoreShape } from './types.js';

const caches = new Map<string, unknown>();

export function outreachStoreDir(): string {
  return path.join(resolveCarinaHome(), 'outreach');
}

function storeFilePath(fileName: string): string {
  return path.join(outreachStoreDir(), fileName);
}

export function loadOutreachJson<T>(fileName: string, defaultValue: () => T): T {
  if (caches.has(fileName)) return caches.get(fileName) as T;
  const file = storeFilePath(fileName);
  if (!fs.existsSync(file)) {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    caches.set(fileName, raw);
    return raw;
  } catch {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
}

export function saveOutreachJson<T>(fileName: string, value: T): void {
  fs.mkdirSync(outreachStoreDir(), { recursive: true });
  fs.writeFileSync(storeFilePath(fileName), JSON.stringify(value, null, 2));
  caches.set(fileName, value);
}

export function resetOutreachStoreCache(fileName?: string): void {
  if (fileName) caches.delete(fileName);
  else caches.clear();
}

const STORE_FILE = 'outreach-program.json';

export function emptyOutreachStore(): OutreachStoreShape {
  return {
    leads: [],
    campaigns: [],
    sequences: [],
    enrollments: [],
    deliveries: [],
    lists: [],
    replyReviews: [],
    bookings: [],
    reminders: [],
    bookingConfigs: {},
    boardConfigs: {},
    boardRefs: {},
    alertTargets: {},
    controls: {},
    followUpTasks: [],
    leadSheetConfigs: {},
  };
}

export function loadOutreachStore(): OutreachStoreShape {
  const raw = loadOutreachJson<OutreachStoreShape>(STORE_FILE, emptyOutreachStore);
  return {
    leads: raw.leads ?? [],
    campaigns: raw.campaigns ?? [],
    sequences: raw.sequences ?? [],
    enrollments: raw.enrollments ?? [],
    deliveries: raw.deliveries ?? [],
    lists: raw.lists ?? [],
    replyReviews: raw.replyReviews ?? [],
    bookings: raw.bookings ?? [],
    reminders: raw.reminders ?? [],
    bookingConfigs: raw.bookingConfigs ?? {},
    boardConfigs: raw.boardConfigs ?? {},
    boardRefs: raw.boardRefs ?? {},
    alertTargets: raw.alertTargets ?? {},
    controls: raw.controls ?? {},
    followUpTasks: raw.followUpTasks ?? [],
    leadSheetConfigs: raw.leadSheetConfigs ?? {},
  };
}

export function saveOutreachStore(store: OutreachStoreShape): void {
  saveOutreachJson(STORE_FILE, store);
}

export function mutateOutreachStore(mutator: (store: OutreachStoreShape) => void): OutreachStoreShape {
  const store = loadOutreachStore();
  mutator(store);
  saveOutreachStore(store);
  return store;
}
