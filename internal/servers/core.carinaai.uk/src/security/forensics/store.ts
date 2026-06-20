import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  exportDir,
  incidentsLogPath,
  playbookExecutionsPath,
  snapshotPath,
  timelinePath,
  forensicsRoot,
} from './paths.js';
import type {
  ForensicIncident,
  ForensicSnapshot,
  PlaybookExecution,
  TimelineEvent,
} from './types.js';

async function appendJsonl<T>(file: string, row: T): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(row)}\n`, 'utf8');
}

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const rows: T[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as T);
      } catch {
        // skip
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function saveIncident(incident: ForensicIncident): Promise<void> {
  await appendJsonl(incidentsLogPath(), incident);
}

export async function listIncidents(limit = 100): Promise<ForensicIncident[]> {
  const rows = await readJsonl<ForensicIncident>(incidentsLogPath());
  return rows.slice(-limit).reverse();
}

export async function getIncident(incidentId: string): Promise<ForensicIncident | null> {
  const rows = await readJsonl<ForensicIncident>(incidentsLogPath());
  return rows.find((row) => row.id === incidentId) ?? null;
}

export async function updateIncident(
  incidentId: string,
  patch: Partial<ForensicIncident>,
): Promise<ForensicIncident | null> {
  const rows = await readJsonl<ForensicIncident>(incidentsLogPath());
  const index = rows.findIndex((row) => row.id === incidentId);
  if (index < 0) return null;
  const updated = { ...rows[index]!, ...patch };
  rows[index] = updated;
  await fs.mkdir(path.dirname(incidentsLogPath()), { recursive: true });
  await fs.writeFile(
    incidentsLogPath(),
    rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''),
    'utf8',
  );
  return updated;
}

export async function saveSnapshot(snapshot: ForensicSnapshot): Promise<void> {
  const file = snapshotPath(snapshot.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), 'utf8');
}

export async function loadSnapshot(snapshotId: string): Promise<ForensicSnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(snapshotId), 'utf8');
    return JSON.parse(raw) as ForensicSnapshot;
  } catch {
    return null;
  }
}

export async function loadSnapshotForIncident(incidentId: string): Promise<ForensicSnapshot | null> {
  try {
    const dir = path.join(forensicsRoot(), 'snapshots');
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      const snapshot = JSON.parse(raw) as ForensicSnapshot;
      if (snapshot.incidentId === incidentId) return snapshot;
    }
  } catch {
    // no snapshots yet
  }
  return null;
}

export async function saveTimeline(incidentId: string, events: TimelineEvent[]): Promise<void> {
  const file = timelinePath(incidentId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(events, null, 2), 'utf8');
}

export async function loadTimeline(incidentId: string): Promise<TimelineEvent[]> {
  try {
    const raw = await fs.readFile(timelinePath(incidentId), 'utf8');
    return JSON.parse(raw) as TimelineEvent[];
  } catch {
    return [];
  }
}

export async function savePlaybookExecution(execution: PlaybookExecution): Promise<void> {
  await appendJsonl(playbookExecutionsPath(), execution);
}

export async function listPlaybookExecutions(incidentId?: string): Promise<PlaybookExecution[]> {
  const rows = await readJsonl<PlaybookExecution>(playbookExecutionsPath());
  if (!incidentId) return rows;
  return rows.filter((row) => row.incidentId === incidentId);
}

export async function createIncident(input: {
  title: string;
  severity: ForensicIncident['severity'];
  sessionId?: string;
  agentId?: string;
  classification?: string;
  triggerEventTypes?: string[];
}): Promise<ForensicIncident> {
  const incident: ForensicIncident = {
    id: randomUUID(),
    title: input.title,
    severity: input.severity,
    status: 'active',
    detectedAt: Date.now(),
    sessionId: input.sessionId,
    agentId: input.agentId,
    classification: input.classification,
    triggerEventTypes: input.triggerEventTypes,
    createdAt: new Date().toISOString(),
  };
  await saveIncident(incident);
  return incident;
}

export async function ensureExportDir(incidentId: string): Promise<string> {
  const dir = exportDir(incidentId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function _resetForensicsStoreForTests(): Promise<void> {
  try {
    await fs.rm(forensicsRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
