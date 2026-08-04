import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import type {
  ActivePacksResponse,
  CustomResourceFile,
  InstalledPack,
  PackConfigResponse,
  PackMeta,
} from './types';

function formatPacksError(status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('self.__next_f')
  ) {
    return `Packs API ${status}: endpoint missing or returned HTML instead of JSON.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return `Packs API ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  const short = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
  return `Packs API ${status}: ${short || statusText}`;
}

async function packsFetch<T>(
  baseUrl: string,
  path: string,
  auth?: GatewayAuthOptions,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}${path}`,
    mergeGatewayInit(auth, init),
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatPacksError(response.status, body, response.statusText));
  }

  return response.json() as Promise<T>;
}

export function listAvailablePacks(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ packs: PackMeta[] }> {
  return packsFetch(baseUrl, '/api/packs/available', auth);
}

export function listInstalledPacks(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ installed: InstalledPack[] }> {
  return packsFetch(baseUrl, '/api/packs/installed', auth);
}

export function installPack(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<{ installed: boolean; pack: string; version: string }> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/install`, auth, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function uninstallPack(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<{ uninstalled: boolean }> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/uninstall`, auth, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchActivePacks(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<ActivePacksResponse> {
  return packsFetch(baseUrl, '/api/packs/active', auth);
}

export function fetchPackDetail(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<PackMeta> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}`, auth);
}

export function fetchPackConfig(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<PackConfigResponse> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/config`, auth);
}

export function savePackConfig(
  baseUrl: string,
  packName: string,
  config: Record<string, unknown>,
  auth?: GatewayAuthOptions,
): Promise<{ saved: boolean }> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/config`, auth, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export function setActivePacks(
  baseUrl: string,
  packs: string[],
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean; active: string[] }> {
  return packsFetch(baseUrl, '/api/packs/active', auth, {
    method: 'PUT',
    body: JSON.stringify({ packs }),
  });
}

export function listCustomResources(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ files: CustomResourceFile[] }> {
  return packsFetch(baseUrl, '/api/packs/custom', auth);
}

export function uploadCustomResource(
  baseUrl: string,
  kind: 'skill' | 'knowledge',
  filename: string,
  content: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean; file: CustomResourceFile }> {
  return packsFetch(baseUrl, '/api/packs/custom/upload', auth, {
    method: 'POST',
    body: JSON.stringify({ kind, filename, content }),
  });
}

export function deleteCustomResource(
  baseUrl: string,
  kind: 'skill' | 'knowledge',
  filename: string,
  auth?: GatewayAuthOptions,
): Promise<{ deleted: boolean }> {
  return packsFetch(
    baseUrl,
    `/api/packs/custom/${encodeURIComponent(kind)}/${encodeURIComponent(filename)}`,
    auth,
    { method: 'DELETE' },
  );
}
