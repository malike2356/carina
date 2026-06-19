import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';

export type HeartbeatStateFile = {
  lastChecks: Record<string, string>;
  updatedAt: string;
};

export function heartbeatStatePath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'data', 'memory', 'heartbeat-state.json');
}

export async function loadHeartbeatState(homeDir = CARINA_HOME): Promise<HeartbeatStateFile> {
  const filePath = heartbeatStatePath(homeDir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as HeartbeatStateFile;
    return {
      lastChecks: parsed.lastChecks ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { lastChecks: {}, updatedAt: new Date().toISOString() };
  }
}

export async function saveHeartbeatState(
  state: HeartbeatStateFile,
  homeDir = CARINA_HOME,
): Promise<void> {
  const filePath = heartbeatStatePath(homeDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}
