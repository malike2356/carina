import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config/index.js';
import { validatePackDir, rejectEnvFilesInPack } from './validate.js';
import { buildPackArchiveFromDir } from './publish-pack.js';
import {
  getLocalPackLicense,
  packRequiresLicense,
  writePackLicense,
} from './pack-licenses.js';
import type { HubPackRow, HubSkillRow, RegistrySummary } from './registry.js';

const execAsync = promisify(exec);

export function resolveHubUrl(override?: string): string {
  const raw = override
    ?? process.env.HUB_URL
    ?? process.env.SKILLS_HUB_URL
    ?? config.hub.url;
  return raw.replace(/\/$/, '');
}

export function hubBaseUrl(override?: string): string {
  return resolveHubUrl(override);
}

function hubPublishToken(override?: string): string {
  return (
    override
    ?? process.env.CARINA_HUB_TOKEN
    ?? process.env.SKILLS_HUB_PUBLISH_KEY
    ?? process.env.SKILLS_HUB_PUBLISH_API_KEY
    ?? config.hub.publishApiKey
    ?? ''
  );
}

function isLocalHubUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function hubFetch<T>(fetchPath: string, baseUrl?: string): Promise<T> {
  const url = `${hubBaseUrl(baseUrl)}${fetchPath}`;
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

export async function searchHubPacks(
  query: string,
  baseUrl?: string,
): Promise<HubPackRow[]> {
  return fetchHubPacks({ q: query, baseUrl });
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

export function hubUnreachableHint(baseUrl?: string): string {
  return `Hub unreachable at ${hubBaseUrl(baseUrl)}. For local dev run: pnpm hub (or carina hub start)`;
}

async function downloadPackArchiveUrl(
  name: string,
  destDir: string,
  baseUrl?: string,
  licenseToken?: string,
): Promise<void> {
  const base = hubBaseUrl(baseUrl);
  const licenseQuery = licenseToken ? `?license=${encodeURIComponent(licenseToken)}` : '';
  const candidates = [
    `${base}/api/packs/${encodeURIComponent(name)}/download${licenseQuery}`,
    `${base}/packs/${encodeURIComponent(name)}/download${licenseQuery}`,
  ];

  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 402) {
          const body = await res.json().catch(() => ({})) as { priceGbpCents?: number };
          const price = body.priceGbpCents != null ? ` (£${(body.priceGbpCents / 100).toFixed(2)} ex VAT)` : '';
          throw new Error(
            `Premium pack "${name}" requires a license${price}. Buy at ${base}/?pack=${encodeURIComponent(name)} or run checkout from the Hub.`,
          );
        }
        lastError = new Error(`Hub download failed (${res.status}): ${url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(destDir, { recursive: true });
      const archive = path.join(destDir, `${name}.tar.gz`);
      await fs.writeFile(archive, buf);
      await execAsync(`tar -xzf "${archive}" -C "${destDir}"`);
      await fs.unlink(archive);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error(`Failed to download pack: ${name}`);
}

export async function downloadHubPackArchive(
  name: string,
  destDir: string,
  baseUrl?: string,
  licenseToken?: string,
): Promise<void> {
  await downloadPackArchiveUrl(name, destDir, baseUrl, licenseToken);
}

export async function createHubPackCheckout(
  packName: string,
  email: string,
  baseUrl?: string,
): Promise<{ sessionId: string; url: string }> {
  const base = hubBaseUrl(baseUrl);
  const res = await fetch(`${base}/api/packs/${encodeURIComponent(packName)}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hub checkout failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json() as Promise<{ sessionId: string; url: string }>;
}

export async function fulfillHubPackLicense(
  packName: string,
  sessionId: string,
  baseUrl?: string,
): Promise<void> {
  const base = hubBaseUrl(baseUrl);
  const res = await fetch(`${base}/api/packs/${encodeURIComponent(packName)}/license/fulfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`License fulfill failed (${res.status}): ${body || res.statusText}`);
  }
  const data = await res.json() as { license: { packName: string; token: string; email: string; purchasedAt: string } };
  await writePackLicense(data.license);
}

export function isPremiumPaidPack(row: HubPackRow): boolean {
  return packRequiresLicense(row.pricing_tier, row.price_gbp_cents);
}

export async function resolvePremiumPackLicense(
  packName: string,
): Promise<string | undefined> {
  const local = await getLocalPackLicense(packName);
  return local?.token;
}

export type HubPublishResult = {
  name: string;
  version: string;
  skillCount: number;
  pendingVerification: boolean;
  archivePath?: string;
};

export async function publishPackToHub(
  packDir: string,
  options: {
    baseUrl?: string;
    token?: string;
    featured?: boolean;
  } = {},
): Promise<HubPublishResult> {
  const resolved = path.resolve(packDir);
  await rejectEnvFilesInPack(resolved);
  const manifest = await validatePackDir(resolved);

  const baseUrl = hubBaseUrl(options.baseUrl);
  const token = hubPublishToken(options.token);

  if (isLocalHubUrl(baseUrl) && !token) {
    const { initHubDb } = await import('./migrations.js');
    const { publishPackDirectory } = await import('./publish-pack.js');
    const { fileURLToPath } = await import('url');
    const storageDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../data/hub-packs',
    );
    await initHubDb();
    const result = await publishPackDirectory(resolved, storageDir, {
      featured: options.featured === true,
    });
    return {
      name: result.name,
      version: result.version,
      skillCount: result.skillCount,
      pendingVerification: !options.featured,
      archivePath: result.archivePath,
    };
  }

  if (!token) {
    throw new Error(
      'Publish requires CARINA_HUB_TOKEN (or SKILLS_HUB_PUBLISH_KEY). Free to publish; verification is manual.',
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-pack-publish-'));
  try {
    const archivePath = await buildPackArchiveFromDir(resolved, tmpDir);
    const archive = await fs.readFile(archivePath);
    const manifestHeader = Buffer.from(JSON.stringify(manifest)).toString('base64url');

    const res = await fetch(`${baseUrl}/api/packs/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/gzip',
        Authorization: `Bearer ${token}`,
        'X-Pack-Manifest': manifestHeader,
      },
      body: archive,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hub publish failed (${res.status}): ${body || res.statusText}`);
    }

    const result = await res.json() as {
      name: string;
      version: string;
      skillCount?: number;
    };
    return {
      name: result.name,
      version: result.version,
      skillCount: result.skillCount ?? manifest.skillCount,
      pendingVerification: true,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export function isPackVerified(row: HubPackRow): boolean {
  return row.featured === true || row.pricing_tier === 'certified';
}
