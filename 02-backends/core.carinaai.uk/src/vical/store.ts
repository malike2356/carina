import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { VcalStoreShape } from './types.js';

const caches = new Map<string, unknown>();
const STORE_FILE = 'vical-store.json';

export function vicalStoreDir(): string {
  return path.join(resolveCarinaHome(), 'vical');
}

function storeFilePath(): string {
  return path.join(vicalStoreDir(), STORE_FILE);
}

export function emptyVicalStore(): VcalStoreShape {
  return {
    eventTypes: [],
    intakePools: [],
    availabilityRules: [],
    blackouts: [],
    bookings: [],
    slotLocks: [],
    publishProfiles: {},
    reminders: [],
  };
}

export function resetVicalStoreCache(): void {
  caches.clear();
}

export function loadVicalStore(): VcalStoreShape {
  if (caches.has(STORE_FILE)) return caches.get(STORE_FILE) as VcalStoreShape;
  const file = storeFilePath();
  if (!fs.existsSync(file)) {
    const value = emptyVicalStore();
    caches.set(STORE_FILE, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<VcalStoreShape>;
    const value: VcalStoreShape = {
      eventTypes: raw.eventTypes ?? [],
      intakePools: raw.intakePools ?? [],
      availabilityRules: raw.availabilityRules ?? [],
      blackouts: raw.blackouts ?? [],
      bookings: raw.bookings ?? [],
      slotLocks: raw.slotLocks ?? [],
      publishProfiles: raw.publishProfiles ?? {},
      reminders: raw.reminders ?? [],
    };
    caches.set(STORE_FILE, value);
    return value;
  } catch {
    const value = emptyVicalStore();
    caches.set(STORE_FILE, value);
    return value;
  }
}

export function saveVicalStore(store: VcalStoreShape): void {
  fs.mkdirSync(vicalStoreDir(), { recursive: true });
  fs.writeFileSync(storeFilePath(), JSON.stringify(store, null, 2));
  caches.set(STORE_FILE, store);
}

export function mutateVicalStore(mutator: (store: VcalStoreShape) => void): VcalStoreShape {
  const store = loadVicalStore();
  mutator(store);
  saveVicalStore(store);
  return store;
}
