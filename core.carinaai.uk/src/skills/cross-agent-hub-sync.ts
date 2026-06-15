import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCarinaHome } from '../config/paths.js';
import type { SharedSkillRecord } from './cross-agent-learning.js';
import { hubBaseUrl } from './hub/hub-client.js';

export type SharedSkillBundle = {
  version: number;
  exportedAt: string;
  sourceWorkspace: string;
  skills: SharedSkillRecord[];
};

export type SharedSkillHubRow = SharedSkillRecord & {
  id: string;
  publishedAt: string;
  downloads: number;
};

function bundlePath(): string {
  return path.join(resolveCarinaHome(), 'shared-skills-export.json');
}

export async function exportSharedSkillsBundle(
  skills: SharedSkillRecord[],
  workspace = process.env.CARINA_WORKSPACE ?? 'default',
): Promise<SharedSkillBundle> {
  const bundle: SharedSkillBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceWorkspace: workspace,
    skills,
  };
  await fs.mkdir(resolveCarinaHome(), { recursive: true });
  await fs.writeFile(bundlePath(), JSON.stringify(bundle, null, 2), { mode: 0o600 });
  return bundle;
}

export async function loadSharedSkillsBundle(filePath = bundlePath()): Promise<SharedSkillBundle | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as SharedSkillBundle;
  } catch {
    return null;
  }
}

export async function mergeSharedSkillsBundle(
  bundle: SharedSkillBundle,
): Promise<{ merged: number; total: number }> {
  const indexPath = path.join(resolveCarinaHome(), 'shared-skills.json');
  let index: { version: number; skills: SharedSkillRecord[] } = { version: 1, skills: [] };
  try {
    index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as typeof index;
  } catch {
    // fresh index
  }

  let merged = 0;
  for (const incoming of bundle.skills) {
    const key = `${incoming.sourceAgentId}:${incoming.skillName}`;
    const exists = index.skills.some((s) => `${s.sourceAgentId}:${s.skillName}` === key);
    if (exists) continue;
    index.skills.unshift(incoming);
    merged += 1;
  }
  index.skills = index.skills.slice(0, 500);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), { mode: 0o600 });
  return { merged, total: index.skills.length };
}

export async function publishSharedSkillsToHub(
  bundle: SharedSkillBundle,
  options: { baseUrl?: string; token?: string } = {},
): Promise<{ published: number; url: string }> {
  const base = hubBaseUrl(options.baseUrl);
  const token = options.token
    ?? process.env.CARINA_HUB_TOKEN
    ?? process.env.SKILLS_HUB_PUBLISH_KEY
    ?? '';
  if (!token) {
    throw new Error('Set CARINA_HUB_TOKEN or SKILLS_HUB_PUBLISH_KEY to publish shared skills');
  }
  const res = await fetch(`${base}/api/shared-skills/publish`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bundle),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hub publish failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { published: number };
  return { published: data.published, url: `${base}/api/shared-skills` };
}

export async function fetchSharedSkillsFromHub(
  options: { baseUrl?: string; limit?: number } = {},
): Promise<SharedSkillHubRow[]> {
  const base = hubBaseUrl(options.baseUrl);
  const limit = options.limit ?? 50;
  const res = await fetch(`${base}/api/shared-skills?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Hub shared-skills fetch failed (${res.status})`);
  }
  const data = await res.json() as { skills: SharedSkillHubRow[] };
  return data.skills ?? [];
}

export async function syncSharedSkillsFromHub(
  options: { baseUrl?: string; limit?: number } = {},
): Promise<{ fetched: number; merged: number; total: number }> {
  const rows = await fetchSharedSkillsFromHub(options);
  const bundle: SharedSkillBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceWorkspace: 'hub',
    skills: rows.map((row) => ({
      skillName: row.skillName,
      skillId: row.skillId,
      sourceAgentId: row.sourceAgentId,
      targetAgentIds: row.targetAgentIds,
      propagatedAt: row.propagatedAt,
      learningEventId: row.learningEventId,
      summary: row.summary,
    })),
  };
  const result = await mergeSharedSkillsBundle(bundle);
  return { fetched: rows.length, merged: result.merged, total: result.total };
}
