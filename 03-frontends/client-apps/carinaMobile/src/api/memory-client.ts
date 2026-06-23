import type { EpisodicMemory, MemoryListResponse } from './types';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

async function memoryFetch<T>(
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
    throw new Error(`Memory API ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function listMemories(
  baseUrl: string,
  options?: { page?: number; q?: string; category?: string; auth?: GatewayAuthOptions },
): Promise<MemoryListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.q) params.set('q', options.q);
  if (options?.category) params.set('category', options.category);
  const query = params.toString();
  return memoryFetch<MemoryListResponse>(
    baseUrl,
    `/api/memory${query ? `?${query}` : ''}`,
    options?.auth,
  );
}

export function deleteMemory(
  baseUrl: string,
  id: string,
  auth?: GatewayAuthOptions,
): Promise<{ deleted: boolean }> {
  return memoryFetch<{ deleted: boolean }>(
    baseUrl,
    `/api/memory/${id}`,
    auth,
    { method: 'DELETE' },
  );
}

export function updateMemory(
  baseUrl: string,
  id: string,
  content: string,
  auth?: GatewayAuthOptions,
): Promise<EpisodicMemory> {
  return memoryFetch<EpisodicMemory>(
    baseUrl,
    `/api/memory/${id}`,
    auth,
    {
      method: 'PUT',
      body: JSON.stringify({ content }),
    },
  );
}
