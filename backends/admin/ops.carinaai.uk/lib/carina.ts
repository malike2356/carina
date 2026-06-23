import fs from 'node:fs';
import { readCoreOpsToken } from './core-env.js';

const defaultCarinaUrl = 'https://core.carinaai.uk';

function opsRunsInDocker(): boolean {
  if (process.env.CARINA_OPS_IN_DOCKER === 'true') return true;
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

export function resolveCarinaApiUrl(): string {
  const raw = process.env.CARINA_API_URL?.trim();
  if (!raw) return defaultCarinaUrl;
  const isDockerInternal = /:\/\/carina-web(?::|\/|$)/.test(raw);
  if (isDockerInternal && !opsRunsInDocker()) {
    return defaultCarinaUrl;
  }
  return raw;
}

export const CARINA_BASE = resolveCarinaApiUrl();

function carinaUrl(): string {
  return CARINA_BASE;
}

function carinaOpsToken(): string {
  // Prefer the mounted core.env token so Docker ops stays in sync with carina-web.
  return readCoreOpsToken() ?? process.env.CARINA_WEB_PASSWORD ?? '';
}

export function carinaOpsTokenSet(): boolean {
  return carinaOpsToken().length > 0;
}

export function carinaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = carinaOpsToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function carinaGet(path: string, timeoutMs = 5000): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    headers: carinaHeaders(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function carinaReachable(): Promise<boolean> {
  try {
    const response = await carinaGet('/api/ops/health', 4000);
    return response.ok;
  } catch {
    return false;
  }
}

export async function carinaPut(path: string, body: unknown): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'PUT',
    headers: carinaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
}

export async function carinaPatch(path: string, body: unknown): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'PATCH',
    headers: carinaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
}

export async function carinaPost(path: string, body: unknown, timeoutMs = 15000): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'POST',
    headers: carinaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function carinaDelete(path: string): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'DELETE',
    headers: carinaHeaders(),
    signal: AbortSignal.timeout(15000),
  });
}

export async function carinaJson<T>(response: Response): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const text = await response.text();
  if (!response.ok) {
    let error = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) error = parsed.error;
    } catch {
      // keep raw snippet
    }
    return { ok: false, status: response.status, data: null, error };
  }
  try {
    return { ok: true, status: response.status, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: response.status, data: null, error: 'Invalid JSON from Carina' };
  }
}
