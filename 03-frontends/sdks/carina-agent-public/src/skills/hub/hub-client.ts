import { config } from '../../config/index.js';
import type { HubPackRow, HubSkillRow, RegistrySummary } from './registry.js';

export function hubBaseUrl(override?: string): string {
  return (override ?? config.hub.url).replace(/\/$/, '');
}

async function hubFetch<T>(path: string, baseUrl?: string): Promise<T> {
  const url = `${hubBaseUrl(baseUrl)}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Skills Hub ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRegistrySummary(baseUrl?: string): Promise<RegistrySummary> {
  return hubFetch('/api/registry', baseUrl);
}

export async function fetchHubPacks(params: {
  q?: string;
  category?: string;
  featured?: boolean;
  baseUrl?: string;
} = {}): Promise<HubPackRow[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.featured) qs.set('featured', 'true');
  const query = qs.toString();
  const data = await hubFetch<{ packs: HubPackRow[] }>(
    `/api/packs${query ? `?${query}` : ''}`,
    params.baseUrl,
  );
  return data.packs;
}

export async function fetchHubSkills(params: {
  q?: string;
  pack?: string;
  category?: string;
  limit?: number;
  baseUrl?: string;
} = {}): Promise<HubSkillRow[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.pack) qs.set('pack', params.pack);
  if (params.category) qs.set('category', params.category);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  const data = await hubFetch<{ skills: HubSkillRow[] }>(
    `/api/skills${query ? `?${query}` : ''}`,
    params.baseUrl,
  );
  return data.skills;
}

export async function fetchHubPack(name: string, baseUrl?: string): Promise<HubPackRow> {
  return hubFetch(`/api/packs/${encodeURIComponent(name)}`, baseUrl);
}

export async function fetchHubSkill(
  packName: string,
  skillName: string,
  baseUrl?: string,
): Promise<HubSkillRow & { pack?: HubPackRow }> {
  return hubFetch(
    `/api/skills/${encodeURIComponent(packName)}/${encodeURIComponent(skillName)}`,
    baseUrl,
  );
}
