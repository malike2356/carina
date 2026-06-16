import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import type { ClientSurface } from './index.js';

export type SurfaceSessionRecord = {
  sessionId: string;
  externalUserId: string;
  updatedAt: string;
};

type SurfaceSessionStore = {
  version: number;
  surfaces: Partial<Record<ClientSurface, SurfaceSessionRecord>>;
};

const STORE_VERSION = 1;

function storePath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'surface-sessions.json');
}

async function readStore(homeDir = CARINA_HOME): Promise<SurfaceSessionStore> {
  try {
    const raw = JSON.parse(await fs.readFile(storePath(homeDir), 'utf-8')) as SurfaceSessionStore;
    return {
      version: STORE_VERSION,
      surfaces: raw.surfaces ?? {},
    };
  } catch {
    return { version: STORE_VERSION, surfaces: {} };
  }
}

async function writeStore(store: SurfaceSessionStore, homeDir = CARINA_HOME): Promise<void> {
  await fs.mkdir(homeDir, { recursive: true });
  await fs.writeFile(
    storePath(homeDir),
    JSON.stringify({ ...store, version: STORE_VERSION }, null, 2),
    { mode: 0o600 },
  );
}

export async function loadLastSurfaceSession(
  surface: ClientSurface,
  homeDir = CARINA_HOME,
): Promise<SurfaceSessionRecord | null> {
  const store = await readStore(homeDir);
  return store.surfaces[surface] ?? null;
}

export async function saveLastSurfaceSession(
  surface: ClientSurface,
  record: SurfaceSessionRecord,
  homeDir = CARINA_HOME,
): Promise<void> {
  const store = await readStore(homeDir);
  store.surfaces[surface] = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store, homeDir);
}

/** Reset store (tests only). */
export async function _resetSurfaceSessionStore(homeDir = CARINA_HOME): Promise<void> {
  try {
    await fs.rm(storePath(homeDir), { force: true });
  } catch {
    // ignore
  }
}
