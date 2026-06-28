import { requireAdminSession } from '@/lib/admin-session';

const DEFAULT_CORE_URL = 'http://localhost:3000';

function coreBaseUrl(): string {
  return (process.env.ADMIN_CORE_URL ?? DEFAULT_CORE_URL).replace(/\/$/, '');
}

export class CoreAdminError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'CoreAdminError';
    this.status = status;
  }
}

export async function coreAdminFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const session = await requireAdminSession();
  if (!session) {
    throw new CoreAdminError('Unauthorized', 401);
  }

  const url = `${coreBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.adminToken}`,
      'X-Admin-Token': session.adminToken,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new CoreAdminError(body.error ?? `Core error ${res.status}`, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function coreAdminFetchRaw(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const session = await requireAdminSession();
  if (!session) {
    throw new CoreAdminError('Unauthorized', 401);
  }

  const url = `${coreBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.adminToken}`,
      'X-Admin-Token': session.adminToken,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}
