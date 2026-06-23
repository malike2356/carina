import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { resolveCarinaDataDir } from '../config/paths.js';
import type { ScoutFinding, ScoutInvestigation, ScoutInvestigationActiveContext } from './scout-findings-types.js';

const INVESTIGATIONS_DIR = 'scout-investigations';
const PULL_STATE_FILE = 'scout-pull-state.json';
const ACTIVE_CONTEXT_FILE = 'scout-investigation-active.json';

interface PullState {
  lastPullAt: string | null;
  findingIds: string[];
}

function investigationsDir(): string {
  return path.join(resolveCarinaDataDir(), INVESTIGATIONS_DIR);
}

function pullStatePath(): string {
  return path.join(resolveCarinaDataDir(), PULL_STATE_FILE);
}

function activeContextPath(): string {
  return path.join(resolveCarinaDataDir(), ACTIVE_CONTEXT_FILE);
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function readPullState(): Promise<PullState> {
  try {
    const raw = await fsp.readFile(pullStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as PullState;
    return {
      lastPullAt: parsed.lastPullAt ?? null,
      findingIds: Array.isArray(parsed.findingIds) ? parsed.findingIds : [],
    };
  } catch {
    return { lastPullAt: null, findingIds: [] };
  }
}

export async function writePullState(state: PullState): Promise<void> {
  await ensureDir(resolveCarinaDataDir());
  await fsp.writeFile(pullStatePath(), JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function countNewFindings(
  findings: ScoutFinding[],
  previousIds: string[],
): number {
  const known = new Set(previousIds);
  return findings.filter((f) => !known.has(f.id)).length;
}

export async function saveInvestigation(input: {
  finding: ScoutFinding;
  toolsSuggested: string[];
  notes?: string;
  operatorId?: string;
}): Promise<ScoutInvestigation> {
  const now = new Date().toISOString();
  const investigation: ScoutInvestigation = {
    id: randomUUID(),
    findingId: input.finding.id,
    status: 'opened',
    toolsSuggested: input.toolsSuggested,
    notes: input.notes ?? '',
    openedAt: now,
    updatedAt: now,
    finding: input.finding,
  };

  const dir = investigationsDir();
  await ensureDir(dir);
  const filePath = path.join(dir, `${investigation.id}.json`);
  await fsp.writeFile(filePath, JSON.stringify(investigation, null, 2), { mode: 0o600 });

  try {
    const { insertInvestigationRow } = await import('./scout-investigations-persistence.js');
    await insertInvestigationRow({
      id: investigation.id,
      finding: input.finding,
      toolsSuggested: input.toolsSuggested,
      notes: input.notes,
      operatorId: input.operatorId,
    });
  } catch {
    // Postgres unavailable; file store is sufficient for local CLI
  }

  return investigation;
}

export async function loadInvestigation(id: string): Promise<ScoutInvestigation | null> {
  try {
    const raw = await fsp.readFile(path.join(investigationsDir(), `${id}.json`), 'utf-8');
    return JSON.parse(raw) as ScoutInvestigation;
  } catch {
    return null;
  }
}

export async function listInvestigations(): Promise<ScoutInvestigation[]> {
  const dir = investigationsDir();
  try {
    const files = await fsp.readdir(dir);
    const investigations: ScoutInvestigation[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fsp.readFile(path.join(dir, file), 'utf-8');
      investigations.push(JSON.parse(raw) as ScoutInvestigation);
    }
    return investigations.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  } catch {
    return [];
  }
}

export async function updateInvestigation(
  id: string,
  patch: Partial<Pick<ScoutInvestigation, 'status' | 'notes' | 'obsidianCaseId' | 'obsidianCasePath'>>,
): Promise<ScoutInvestigation | null> {
  const current = await loadInvestigation(id);
  if (!current) return null;
  const updated: ScoutInvestigation = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(
    path.join(investigationsDir(), `${id}.json`),
    JSON.stringify(updated, null, 2),
    { mode: 0o600 },
  );

  try {
    const { updateInvestigationRow } = await import('./scout-investigations-persistence.js');
    await updateInvestigationRow(id, {
      status: patch.status,
      notes: patch.notes,
      obsidianCaseId: patch.obsidianCaseId,
      obsidianCasePath: patch.obsidianCasePath,
      closedAt: patch.status === 'closed' ? new Date().toISOString() : null,
    });
  } catch {
    // file store updated
  }

  return updated;
}

export async function setActiveInvestigationContext(
  context: ScoutInvestigationActiveContext,
): Promise<void> {
  await ensureDir(resolveCarinaDataDir());
  await fsp.writeFile(activeContextPath(), JSON.stringify(context, null, 2), { mode: 0o600 });
}

export async function getActiveInvestigationContext(): Promise<ScoutInvestigationActiveContext | null> {
  try {
    const raw = await fsp.readFile(activeContextPath(), 'utf-8');
    return JSON.parse(raw) as ScoutInvestigationActiveContext;
  } catch {
    return null;
  }
}

export async function clearActiveInvestigationContext(): Promise<void> {
  try {
    await fsp.unlink(activeContextPath());
  } catch {
    // no active context
  }
}

export async function findInvestigationByFindingId(
  findingId: string,
): Promise<ScoutInvestigation | null> {
  const investigations = await listInvestigations();
  return investigations.find((inv) => inv.findingId === findingId) ?? null;
}

export async function listOpenInvestigations(): Promise<ScoutInvestigation[]> {
  const investigations = await listInvestigations();
  return investigations.filter((inv) => inv.status !== 'closed');
}

export function summarizeSeverity(findings: ScoutFinding[]): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  }
  return counts;
}

export function summarizeStatus(findings: ScoutFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    counts[finding.status] = (counts[finding.status] ?? 0) + 1;
  }
  return counts;
}
