import type {
  EpisodicMemory,
  MemoryListResponse,
  MemorySessionsResponse,
  MemoryStatsResponse,
} from './types';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

function formatMemoryError(status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('self.__next_f')
  ) {
    return `Memory API ${status}: endpoint missing or returned HTML instead of JSON.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return `Memory API ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  const short = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
  return `Memory API ${status}: ${short || statusText}`;
}

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
    throw new Error(formatMemoryError(response.status, body, response.statusText));
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

export function listMemorySessions(
  baseUrl: string,
  options?: { limit?: number; auth?: GatewayAuthOptions },
): Promise<MemorySessionsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return memoryFetch<MemorySessionsResponse>(
    baseUrl,
    `/api/memory/sessions${query ? `?${query}` : ''}`,
    options?.auth,
  );
}

export function fetchMemoryStats(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<MemoryStatsResponse> {
  return memoryFetch<MemoryStatsResponse>(baseUrl, '/api/memory/stats', auth);
}

export function createMemory(
  baseUrl: string,
  content: string,
  options?: { category?: string; priority?: number; auth?: GatewayAuthOptions },
): Promise<EpisodicMemory> {
  return memoryFetch<EpisodicMemory>(baseUrl, '/api/memory', options?.auth, {
    method: 'POST',
    body: JSON.stringify({
      content,
      category: options?.category ?? 'general',
      priority: options?.priority ?? 0,
    }),
  });
}
