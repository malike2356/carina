import fs from 'fs/promises';
import path from 'path';
import type { SharedSkillBundle } from '../cross-agent-hub-sync.js';

export type SharedSkillStoreRow = SharedSkillBundle['skills'][number] & {
  id: string;
  publishedAt: string;
  downloads: number;
};

type SharedSkillStoreFile = {
  version: number;
  skills: SharedSkillStoreRow[];
};

function storePath(storageRoot: string): string {
  return path.join(storageRoot, 'shared-skills.json');
}

async function readStore(storageRoot: string): Promise<SharedSkillStoreFile> {
  try {
    const raw = await fs.readFile(storePath(storageRoot), 'utf8');
    const parsed = JSON.parse(raw) as SharedSkillStoreFile;
    return { version: parsed.version ?? 1, skills: parsed.skills ?? [] };
  } catch {
    return { version: 1, skills: [] };
  }
}

async function writeStore(storageRoot: string, store: SharedSkillStoreFile): Promise<void> {
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(storePath(storageRoot), JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function publishSharedSkillsToStore(
  storageRoot: string,
  bundle: SharedSkillBundle,
): Promise<number> {
  const store = await readStore(storageRoot);
  let published = 0;
  const now = new Date().toISOString();

  for (const skill of bundle.skills) {
    const id = `${skill.sourceAgentId}:${skill.skillName}`;
    const existing = store.skills.find((s) => s.id === id);
    if (existing) {
      existing.summary = skill.summary;
      existing.targetAgentIds = skill.targetAgentIds;
      existing.propagatedAt = skill.propagatedAt;
      continue;
    }
    store.skills.unshift({
      ...skill,
      id,
      publishedAt: now,
      downloads: 0,
    });
    published += 1;
  }

  store.skills = store.skills.slice(0, 1000);
  await writeStore(storageRoot, store);
  return published;
}

export async function listSharedSkillsFromStore(
  storageRoot: string,
  limit = 50,
): Promise<SharedSkillStoreRow[]> {
  const store = await readStore(storageRoot);
  return store.skills.slice(0, limit);
}

export async function recordSharedSkillDownload(storageRoot: string, id: string): Promise<void> {
  const store = await readStore(storageRoot);
  const row = store.skills.find((s) => s.id === id);
  if (!row) return;
  row.downloads += 1;
  await writeStore(storageRoot, store);
}
