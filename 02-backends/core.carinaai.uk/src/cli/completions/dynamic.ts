import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import { listAgentDefinitions } from '../../workspaces/agent-registry.js';
import { buildCatalogRows } from '../../brain/provider-catalog.js';

export const DYNAMIC_COMPLETION_TYPES = [
  'session-id',
  'session-name',
  'skill-name',
  'model-id',
  'workspace-id',
] as const;

export type DynamicCompletionType = typeof DYNAMIC_COMPLETION_TYPES[number];

export function isDynamicCompletionType(value: string): value is DynamicCompletionType {
  return (DYNAMIC_COMPLETION_TYPES as readonly string[]).includes(value);
}

async function listLocalSessionIds(limit = 50): Promise<string[]> {
  const sessionsDir = path.join(CARINA_HOME, 'sessions');
  const ids: string[] = [];
  try {
    const files = await fs.readdir(sessionsDir);
    for (const file of files.filter((f) => f.endsWith('.json')).slice(0, limit)) {
      ids.push(file.replace(/\.json$/, ''));
    }
  } catch {
    // optional local store
  }
  return ids;
}

async function listDbSessionIds(limit = 50): Promise<string[]> {
  try {
    const { initDb } = await import('../../memory/db.js');
    const { browseRecentSessions } = await import('../../memory/session-index.js');
    await initDb();
    const rows = await browseRecentSessions(limit);
    return rows.map((r) => r.sessionId);
  } catch {
    return [];
  }
}

export async function getCompletionValues(type: string): Promise<string[]> {
  try {
    switch (type) {
      case 'session-id': {
        const local = await listLocalSessionIds();
        const db = await listDbSessionIds();
        return [...new Set([...local, ...db])].slice(0, 50);
      }
      case 'session-name': {
        const ids = await getCompletionValues('session-id');
        return ids.map((id) => id.slice(0, 8));
      }
      case 'skill-name': {
        const { buildSkillIndex } = await import('../../skills/index.js');
        const index = await buildSkillIndex();
        return index.map((entry) => entry.name).slice(0, 100);
      }
      case 'model-id': {
        return buildCatalogRows({ includeCatalogOnly: true }).map((row) => row.id);
      }
      case 'workspace-id': {
        return listAgentDefinitions().map((agent) => agent.id);
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export async function printDynamicCompletionValues(type: string): Promise<void> {
  const values = await getCompletionValues(type);
  for (const value of values) {
    process.stdout.write(`${value}\n`);
  }
}
