import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import type { InstalledPack, PackMeta } from './types';

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
    throw new Error(`Packs API ${response.status}: ${body || response.statusText}`);
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
