const defaultCarinaUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';

export const CARINA_BASE = defaultCarinaUrl;

function carinaUrl(): string {
  return process.env.CARINA_API_URL ?? defaultCarinaUrl;
}

function carinaOpsToken(): string {
  // CARINA_OPS_TOKEN is the dedicated inter-service bearer token shared with core.
  // Falling back to CARINA_WEB_PASSWORD is kept for compatibility only.
  return process.env.CARINA_OPS_TOKEN ?? process.env.CARINA_WEB_PASSWORD ?? '';
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

export async function carinaGet(path: string): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    headers: carinaHeaders(),
    signal: AbortSignal.timeout(5000),
  });
}

export async function carinaPut(path: string, body: unknown): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'PUT',
    headers: carinaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
}

export async function carinaPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${carinaUrl()}${path}`, {
    method: 'POST',
    headers: carinaHeaders(),
    body: JSON.stringify(body),
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
